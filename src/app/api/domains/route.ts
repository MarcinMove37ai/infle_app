// src/app/api/domains/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  canUseCustomDomain,
  validateDomainInput,
} from '@/lib/domains';
import { createCustomHostname } from '@/lib/cloudflare';
import type { Role } from '@prisma/client';
import { promises as dns } from 'dns';

// ============================================================
// DNS pre-check — verify the subdomain is empty (no existing
// records that would conflict with the user's setup).
// Returns null if the domain is empty (good to add).
// Returns { target, type } if there's a conflicting record.
// ============================================================
async function checkDomainAvailability(domain: string): Promise<
  { available: true } | { available: false; target: string; type: string }
> {
  const checks = await Promise.allSettled([
    dns.resolve4(domain),     // A
    dns.resolve6(domain),     // AAAA
    dns.resolveCname(domain), // CNAME
  ]);

  const [a, aaaa, cname] = checks;

  if (cname.status === 'fulfilled' && cname.value.length > 0) {
    return { available: false, target: cname.value.join(', '), type: 'CNAME' };
  }
  if (a.status === 'fulfilled' && a.value.length > 0) {
    return { available: false, target: a.value.join(', '), type: 'A' };
  }
  if (aaaa.status === 'fulfilled' && aaaa.value.length > 0) {
    return { available: false, target: aaaa.value.join(', '), type: 'AAAA' };
  }

  return { available: true };
}

// ============================================================
// GET /api/domains
// List all custom domains belonging to the authenticated user.
// ============================================================
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const domains = await prisma.customDomain.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      domain: true,
      status: true,
      sslStatus: true,
      ownershipVerification: true,
      verificationErrors: true,
      verifiedAt: true,
      createdAt: true,
      lastCheckedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Annotate which one is primary for the user
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { primaryDomainId: true },
  });

  return NextResponse.json({
    domains: domains.map(d => ({
      ...d,
      isPrimary: d.id === user?.primaryDomainId,
    })),
    cnameTarget: process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'connect.inflee.app',
  });
}

// ============================================================
// POST /api/domains
// Register a new custom domain for the authenticated user.
//
// Body: { domain: string, force?: boolean }
//   - force=false (default): runs DNS pre-check, returns 409 if records exist
//   - force=true: skips DNS check, registers immediately
//
// Calls Cloudflare for SaaS API to create the custom hostname,
// stores the resulting hostname id + DNS verification instructions
// in our DB, returns instructions to display in UI.
// ============================================================
export async function POST(req: NextRequest) {
  // 1. Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Plan gating
  const userRole = (session.user.role as Role | null | undefined);
  if (!canUseCustomDomain(userRole)) {
    return NextResponse.json(
      { error: 'plan_required', message: 'Custom domains require Creator plan or higher.' },
      { status: 403 }
    );
  }

  // 3. Parse + validate input
  let body: { domain?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (typeof body.domain !== 'string') {
    return NextResponse.json({ error: 'invalid_domain' }, { status: 400 });
  }

  const validation = validateDomainInput(body.domain);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const normalizedDomain = validation.normalized;
  const force = body.force === true;

  // 4. Check uniqueness across ALL users (DB unique constraint will also enforce this,
  //    but we want a clean error message instead of Prisma exception).
  const existing = await prisma.customDomain.findUnique({
    where: { domain: normalizedDomain },
    select: { id: true, userId: true },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: 'domain_already_registered',
        message: 'This domain is already registered. Please use a different one or contact support if you believe this is an error.',
      },
      { status: 409 }
    );
  }

  // 5. DNS pre-check (skipped when force=true).
  //    If the subdomain has existing A / AAAA / CNAME records, we warn the user
  //    BEFORE registering — adding our records would override their existing setup.
  if (!force) {
    const availability = await checkDomainAvailability(normalizedDomain);
    if (!availability.available) {
      return NextResponse.json(
        {
          error: 'domain_not_empty',
          currentTarget: availability.target,
          recordType: availability.type,
          message: `${normalizedDomain} already points to ${availability.target} (${availability.type} record). Adding it now would replace your existing setup.`,
        },
        { status: 409 }
      );
    }
  }

  // 6. Register in Cloudflare for SaaS.
  //
  // CF tworzy hostname natychmiast, ale `ssl.validation_records` (DCV TXT)
  // pojawiają się asynchronicznie — czasem od razu, czasem po 1-3s.
  // Bez tej wartości UI pokazałby tylko 2 z 3 rekordów DNS, a 3-ci
  // dolatuje przy pierwszym polling refreshu — wygląda chaotycznie
  // i niespójnie z punktu widzenia user'a.
  //
  // Dlatego po POST robimy do 5 retry'ów z 600ms delay między nimi,
  // czekając aż CF zwróci pełen komplet (ownership_verification + ssl.validation_records).
  // Łączny worst-case: 3 sekundy. W praktyce zwykle wystarcza 1 retry.
  // User w tym czasie widzi spinner "Verifying..." na buttonie.
  let cfHostname;
  try {
    cfHostname = await createCustomHostname(normalizedDomain);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('[api/domains POST] Cloudflare error:', message);
    return NextResponse.json(
      { error: 'cloudflare_error', message },
      { status: 502 }
    );
  }

  const hasFullRecords = (cf: typeof cfHostname): boolean => {
    const sslRecords = (cf.ssl as any)?.validation_records;
    return !!cf.ownership_verification && Array.isArray(sslRecords) &&
           sslRecords.some((r: any) => r.txt_name && r.txt_value);
  };

  if (!hasFullRecords(cfHostname)) {
    const { getCustomHostname } = await import('@/lib/cloudflare');
    const MAX_RETRIES = 5;
    const DELAY_MS = 600;

    for (let i = 0; i < MAX_RETRIES; i++) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      try {
        const refreshed = await getCustomHostname(cfHostname.id);
        cfHostname = refreshed;
        if (hasFullRecords(refreshed)) {
          console.log(`[api/domains POST] Got full records after ${i + 1} retry(ies)`);
          break;
        }
      } catch (err) {
        console.warn(`[api/domains POST] Retry ${i + 1} failed:`, err);
      }
    }

    if (!hasFullRecords(cfHostname)) {
      console.warn('[api/domains POST] CF did not return full validation_records after retries — UI will fetch via polling');
    }
  }

  // 7. Persist to DB
  const created = await prisma.customDomain.create({
    data: {
      userId: session.user.id,
      domain: normalizedDomain,
      status: 'pending',
      cloudflareHostnameId: cfHostname.id,
      sslStatus: cfHostname.ssl?.status ?? 'pending_validation',
      ownershipVerification: cfHostname.ownership_verification
        ? {
            type: cfHostname.ownership_verification.type,
            name: cfHostname.ownership_verification.name,
            value: cfHostname.ownership_verification.value,
          }
        : undefined,
      lastCheckedAt: new Date(),
    },
    select: {
      id: true,
      domain: true,
      status: true,
      sslStatus: true,
      ownershipVerification: true,
      verificationErrors: true,
      verifiedAt: true,
      createdAt: true,
      lastCheckedAt: true,
    },
  });

  // 8. Return instructions for the user's DNS provider.
  //    Shape matches what CustomDomainsSection.tsx expects:
  //    - ownershipTxt: TXT record proving ownership (Cloudflare hostname verification)
  //    - dcvTxt: TXT record for SSL certificate DCV (may not be present in initial response;
  //              Cloudflare populates ssl.validation_records when SSL pre-validation kicks in,
  //              so this can be null at registration time and filled in by GET /[id] later)
  //    - cname: CNAME pointing to our fallback origin
  const cnameTarget = process.env.CUSTOM_DOMAIN_CNAME_TARGET || 'connect.inflee.app';

  // SSL validation records (DCV) — Cloudflare may include these in the SSL block
  // for `txt` validation method. Extract first record if present.
  const sslValidation = (cfHostname.ssl as any)?.validation_records?.[0];
  const dcvTxt = sslValidation?.txt_name && sslValidation?.txt_value
    ? { name: sslValidation.txt_name, value: sslValidation.txt_value }
    : null;

  return NextResponse.json({
    domain: created,
    instructions: {
      ownershipTxt: cfHostname.ownership_verification
        ? {
            name: cfHostname.ownership_verification.name,
            value: cfHostname.ownership_verification.value,
          }
        : null,
      dcvTxt,
      cname: {
        name: normalizedDomain,
        value: cnameTarget,
      },
    },
  }, { status: 201 });
}