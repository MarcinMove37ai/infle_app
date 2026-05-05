// src/app/api/domains/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getCustomHostname,
  deleteCustomHostname,
  type CFCustomHostname,
} from '@/lib/cloudflare';
import type { DomainStatus } from '@prisma/client';
import { promises as dns } from 'dns';

// ============================================================
// Helpers
// ============================================================

/**
 * Map Cloudflare hostname state into our DomainStatus enum.
 *
 * Cloudflare exposes two relevant fields:
 *   - hostname.status — overall provisioning state ("active", "pending", ...)
 *   - hostname.ssl.status — certificate state ("active", "pending_validation", ...)
 *
 * We treat the domain as "active" only when BOTH the hostname and the cert
 * are active. Anything else is "verifying" (waiting on DNS/cert) or "failed".
 */
function mapCfToDomainStatus(cf: CFCustomHostname): DomainStatus {
  const hnStatus = cf.status;
  const sslStatus = cf.ssl?.status;

  if (hnStatus === 'active' && sslStatus === 'active') {
    return 'active';
  }

  // Hard failures: cert won't be issued / hostname permanently blocked
  if (
    sslStatus === 'failed' ||
    sslStatus === 'expired' ||
    sslStatus === 'deactivated' ||
    hnStatus === 'blocked' ||
    hnStatus === 'pending_blocked' ||
    hnStatus === 'test_blocked' ||
    hnStatus === 'test_failed'
  ) {
    return 'failed';
  }

  // Anything in progress: pending DNS, pending cert issuance, deploying...
  return 'verifying';
}

/**
 * Build full DCV (Domain Control Validation) instructions to display to the user.
 *
 * Cloudflare wymaga 3 rekordów:
 *   - CNAME wskazujący na nasz fallback origin (ruch HTTP)
 *   - TXT pre-validation (ownership — potwierdza kontrolę domeny dla CF)
 *   - TXT certificate validation (DCV — potwierdza kontrolę dla CA Google Trust Services)
 *
 * ZAWSZE zwracamy wszystkie 3 rekordy (jeśli CF dostarczył ich konfigurację),
 * niezależnie od statusu domeny/SSL. UI wyświetla je razem z per-record status badge,
 * dzięki czemu user widzi WSZYSTKIE wgrane wartości — nawet po aktywacji
 * (do weryfikacji że ma poprawną konfigurację, do diagnozowania jeśli się rozjedzie).
 */
/**
 * Stored verification data (z naszej bazy danych).
 * Cloudflare po aktywacji domeny czyści `ownership_verification` i `ssl.validation_records`
 * w response — bez fallbacku do DB user widziałby pustą listę rekordów po sukcesie.
 * Te wartości zapisujemy przy POST (ownership) oraz przy GET refresh (DCV gdy CF dostarczy).
 */
interface StoredVerification {
  ownershipVerification?: { name?: string; value?: string } | null;
  dcvVerification?: { name?: string; value?: string } | null;
}

/**
 * Build full DCV (Domain Control Validation) instructions.
 *
 * ZAWSZE zwracamy wszystkie 3 rekordy (jeśli mamy ich wartości — z CF lub z DB).
 * Logika fallbacku per rekord:
 *   - CNAME       → zawsze syntetyzowany z hostname + env (nigdy nie zniknie)
 *   - ownership   → CF (cf.ownership_verification) → fallback DB (stored.ownershipVerification)
 *   - DCV         → CF (cf.ssl.validation_records) → fallback DB (stored.dcvVerification)
 *
 * Cloudflare po aktywacji zeruje pola w response, więc DB jest source of truth
 * po pierwszej weryfikacji. Dzięki temu user zawsze widzi 3 rekordy w modal.
 */
function buildInstructions(cf: CFCustomHostname, stored?: StoredVerification) {
  const cnameTarget = process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'connect.inflee.app';

  // Ownership TXT — CF first, fallback DB.
  const cfOwnership = cf.ownership_verification;
  const dbOwnership = stored?.ownershipVerification;
  const ownershipTxt =
    cfOwnership?.name && cfOwnership?.value
      ? { name: cfOwnership.name, value: cfOwnership.value }
      : dbOwnership?.name && dbOwnership?.value
      ? { name: dbOwnership.name, value: dbOwnership.value }
      : null;

  // DCV TXT — CF first, fallback DB.
  const cfDcv = cf.ssl?.validation_records?.find(r => r.txt_name && r.txt_value);
  const dbDcv = stored?.dcvVerification;
  const dcvTxt =
    cfDcv?.txt_name && cfDcv?.txt_value
      ? { name: cfDcv.txt_name, value: cfDcv.txt_value }
      : dbDcv?.name && dbDcv?.value
      ? { name: dbDcv.name, value: dbDcv.value }
      : null;

  // CNAME — zawsze syntetyzowany. Hostname + env CNAME target.
  const cname = { name: cf.hostname, value: cnameTarget };

  return { ownershipTxt, dcvTxt, cname };
}

// ============================================================
// Per-record DNS status check.
//
// Sprawdza KAŻDY z 3 rekordów osobno przez DNS resolver, porównuje
// faktyczną wartość w DNS z wartością oczekiwaną (z Cloudflare API).
// Każdy rekord dostaje jeden z 3 statusów:
//   - 'ok'      — rekord istnieje w DNS i wartość się zgadza
//   - 'pending' — rekord nie istnieje (jeszcze nie wgrany lub propagacja)
//   - 'error'   — rekord istnieje, ale wartość JEST INNA niż oczekiwana
//                 (literówka u usera albo konflikt z innym rekordem)
//
// Wyniki dla rekordów które user nie musi dodawać (instrukcja zwróciła null)
// są pomijane z output'u — user zobaczy badge tylko dla rekordów które są
// faktycznie wymagane do skopiowania.
// ============================================================
type RecordCheckStatus = 'ok' | 'pending' | 'error';

async function checkSingleCname(
  hostname: string,
  expectedTarget: string
): Promise<RecordCheckStatus> {
  try {
    const records = await dns.resolveCname(hostname);
    if (records.length === 0) return 'pending';
    // Cloudflare proxied CNAME może zwrócić różne wartości — sprawdzamy zawieranie,
    // a nie strict equality (DNS może mieć trailing dot, mieszaną wielkość liter)
    const normalized = records.map(r => r.toLowerCase().replace(/\.$/, ''));
    const expected = expectedTarget.toLowerCase().replace(/\.$/, '');
    return normalized.includes(expected) ? 'ok' : 'error';
  } catch (err: any) {
    // ENODATA / ENOTFOUND / NXDOMAIN — rekord jeszcze nie istnieje
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') return 'pending';
    return 'pending';
  }
}

async function checkSingleTxt(
  hostname: string,
  expectedValue: string
): Promise<RecordCheckStatus> {
  try {
    // dns.resolveTxt zwraca string[][] — każdy rekord TXT to tablica fragmentów
    // (DNS dzieli długie TXT na 255-char chunks). Łączymy je w jeden string.
    const records = await dns.resolveTxt(hostname);
    if (records.length === 0) return 'pending';
    const flatValues = records.map(chunks => chunks.join(''));
    return flatValues.includes(expectedValue) ? 'ok' : 'error';
  } catch (err: any) {
    if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') return 'pending';
    return 'pending';
  }
}

async function checkRecordStatuses(
  domainName: string,
  instructions: ReturnType<typeof buildInstructions>,
  cnameTarget: string
): Promise<{
  cname?: RecordCheckStatus;
  ownership?: RecordCheckStatus;
  dcv?: RecordCheckStatus;
}> {
  const checks = await Promise.allSettled([
    instructions.cname
      ? checkSingleCname(instructions.cname.name, cnameTarget)
      : Promise.resolve(null),
    instructions.ownershipTxt
      ? checkSingleTxt(instructions.ownershipTxt.name, instructions.ownershipTxt.value)
      : Promise.resolve(null),
    instructions.dcvTxt
      ? checkSingleTxt(instructions.dcvTxt.name, instructions.dcvTxt.value)
      : Promise.resolve(null),
  ]);

  const result: {
    cname?: RecordCheckStatus;
    ownership?: RecordCheckStatus;
    dcv?: RecordCheckStatus;
  } = {};

  if (checks[0].status === 'fulfilled' && checks[0].value !== null) {
    result.cname = checks[0].value;
  }
  if (checks[1].status === 'fulfilled' && checks[1].value !== null) {
    result.ownership = checks[1].value;
  }
  if (checks[2].status === 'fulfilled' && checks[2].value !== null) {
    result.dcv = checks[2].value;
  }

  return result;
}

// ============================================================
// GET /api/domains/[id]
// Returns current status of a custom domain, syncing with Cloudflare.
// Used by the UI to poll while user configures DNS.
// ============================================================
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // 1. Fetch domain from DB (with userId guard).
  // Pobieramy też dcvVerification — używane jako fallback w buildInstructions
  // gdy CF już przestał zwracać ssl.validation_records (po wystawieniu certa).
  const domain = await prisma.customDomain.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      domain: true,
      status: true,
      cloudflareHostnameId: true,
      sslStatus: true,
      verificationErrors: true,
      ownershipVerification: true,
      dcvVerification: true,
      verifiedAt: true,
      createdAt: true,
    },
  });

  if (!domain) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 2. If we never registered with Cloudflare (shouldn't happen, but defensive),
  //    return whatever we have without sync.
  if (!domain.cloudflareHostnameId) {
    return NextResponse.json({ domain, instructions: null });
  }

  // 3. Sync with Cloudflare
  let cf: CFCustomHostname;
  try {
    cf = await getCustomHostname(domain.cloudflareHostnameId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('[api/domains/[id] GET] Cloudflare sync error:', message);
    // Return DB state so UI can still display SOMETHING
    return NextResponse.json({
      domain,
      instructions: null,
      syncError: message,
    });
  }

  // 4. Update DB with fresh state from Cloudflare.
  //
  // Defensive write — gdy CF zwraca świeże ownership/DCV (przed aktywacją),
  // zapisujemy do DB. Jeśli CF już zeruje (po aktywacji), zostawiamy poprzednią
  // wartość w DB nietkniętą (undefined w Prisma update = nie modyfikuj pola).
  // Dzięki temu DB akumuluje source of truth: pierwszy raz dostaje wartości z CF,
  // potem ich nie traci.
  const newStatus = mapCfToDomainStatus(cf);
  const justBecameActive = newStatus === 'active' && domain.status !== 'active';

  const cfDcvForDb = cf.ssl?.validation_records?.find(r => r.txt_name && r.txt_value);

  const updated = await prisma.customDomain.update({
    where: { id: domain.id },
    data: {
      status: newStatus,
      sslStatus: cf.ssl?.status ?? null,
      verificationErrors:
        cf.ssl?.validation_errors && cf.ssl.validation_errors.length > 0
          ? cf.ssl.validation_errors
          : cf.verification_errors && cf.verification_errors.length > 0
          ? cf.verification_errors.map(message => ({ message }))
          : undefined,
      ownershipVerification: cf.ownership_verification
        ? {
            type: cf.ownership_verification.type,
            name: cf.ownership_verification.name,
            value: cf.ownership_verification.value,
          }
        : undefined,
      dcvVerification: cfDcvForDb
        ? {
            name: cfDcvForDb.txt_name,
            value: cfDcvForDb.txt_value,
          }
        : undefined,
      lastCheckedAt: new Date(),
      verifiedAt: justBecameActive ? new Date() : undefined,
    },
    select: {
      id: true,
      domain: true,
      status: true,
      sslStatus: true,
      verificationErrors: true,
      ownershipVerification: true,
      dcvVerification: true,
      verifiedAt: true,
      lastCheckedAt: true,
      createdAt: true,
    },
  });

  // Build instructions z DB-fallback. Jeśli CF zwraca świeże dane → użyj CF.
  // Jeśli CF zeruje (po aktywacji) → fallback do `updated.ownershipVerification` i `updated.dcvVerification`.
  // Per-record status sprawdza każdy rekord osobno przez DNS lookup.
  const cnameTarget = process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'connect.inflee.app';
  const instructions = buildInstructions(cf, {
    ownershipVerification: updated.ownershipVerification as StoredVerification['ownershipVerification'],
    dcvVerification: updated.dcvVerification as StoredVerification['dcvVerification'],
  });
  const recordStatus = await checkRecordStatuses(updated.domain, instructions, cnameTarget);

  return NextResponse.json({
    domain: updated,
    instructions,
    recordStatus,
    cnameTarget,
  });
}

// ============================================================
// DELETE /api/domains/[id]
// Removes a custom domain from Cloudflare and our DB.
// If it was the user's primary domain, primaryDomainId is cleared.
// ============================================================
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // 1. Fetch domain (with userId guard)
  const domain = await prisma.customDomain.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, cloudflareHostnameId: true },
  });

  if (!domain) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 2. Delete in Cloudflare first (best-effort — if CF fails, we still
  //    delete from DB to avoid stuck records, but log the error).
  if (domain.cloudflareHostnameId) {
    try {
      await deleteCustomHostname(domain.cloudflareHostnameId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      console.error(
        '[api/domains/[id] DELETE] Cloudflare delete error (proceeding with DB cleanup):',
        message
      );
    }
  }

  // 3. Delete from DB. The User.primaryDomainId FK with onDelete: SetNull
  //    handles the primary-domain unset automatically.
  await prisma.customDomain.delete({ where: { id: domain.id } });

  return NextResponse.json({ ok: true });
}