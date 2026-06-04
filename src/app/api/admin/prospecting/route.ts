// src/app/api/admin/prospecting/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Centrum zarządzania dostępami (Prospecting) — tylko GOD.
// Read-only: zwraca inbound (applications) + wystawione kody (z seedami i userem).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // Guard: wyłącznie GOD. Reszcie nie zdradzamy, że endpoint istnieje (404).
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'GOD') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Dwa źródła, jedno miejsce. Sortujemy od najnowszych.
    const [applications, inviteCodes] = await Promise.all([
      prisma.application.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          inviteCode: { select: { id: true, code: true, status: true } },
        },
      }),
      prisma.inviteCode.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          seeds: { orderBy: { position: 'asc' } },
          usedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
          application: { select: { id: true, email: true, firstName: true } },
        },
      }),
    ]);

    // Lejek liczymy server-side. Dla zużytych kodów sprawdzamy, jak daleko zaszedł
    // user (ebook → landing → leads). Jedno zbiorcze zapytanie na każdą kategorię,
    // potem mapujemy w pamięci (bez N+1).
    const now = Date.now();
    const usedUserIds = inviteCodes
      .map((c) => c.usedByUserId)
      .filter((id): id is string => !!id);

    let ebookUserIds = new Set<string>();
    let pageUserIds = new Set<string>();
    let leadUserIds = new Set<string>();

    if (usedUserIds.length > 0) {
      const [ebookRows, pageRows, leadRows] = await Promise.all([
        prisma.ebooks.findMany({
          where: { userId: { in: usedUserIds } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        prisma.pages.findMany({
          where: { userId: { in: usedUserIds } },
          select: { userId: true },
          distinct: ['userId'],
        }),
        prisma.leads.findMany({
          where: { userId: { in: usedUserIds } },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ]);
      ebookUserIds = new Set(ebookRows.map((r) => r.userId).filter((id): id is string => !!id));
      pageUserIds = new Set(pageRows.map((r) => r.userId).filter((id): id is string => !!id));
      leadUserIds = new Set(leadRows.map((r) => r.userId).filter((id): id is string => !!id));
    }

    // Najdalszy osiągnięty etap (monotonicznie):
    //   leads > landing > ebook > registered > clicked > invited > expired
    const codes = inviteCodes.map((c) => {
      const isLive = c.status === 'issued' && c.expiresAt.getTime() > now;
      const isExpired = c.status === 'expired' || (c.status !== 'used' && c.expiresAt.getTime() <= now);
      const uid = c.usedByUserId || undefined;

      const hasEbook = uid ? ebookUserIds.has(uid) : false;
      const hasLanding = uid ? pageUserIds.has(uid) : false;
      const hasLeads = uid ? leadUserIds.has(uid) : false;

      let stage:
        | 'expired' | 'invited' | 'clicked' | 'registered' | 'ebook' | 'landing' | 'leads';
      if (uid) {
        if (hasLeads) stage = 'leads';
        else if (hasLanding) stage = 'landing';
        else if (hasEbook) stage = 'ebook';
        else stage = 'registered';
      } else if (isExpired) {
        stage = 'expired';
      } else if (c.clickedAt) {
        stage = 'clicked';
      } else {
        stage = 'invited';
      }

      return { ...c, isLive, hasEbook, hasLanding, hasLeads, stage };
    });

    return NextResponse.json({
      applications,
      codes,
      counts: {
        applicationsPending: applications.filter((a) => a.status === 'pending').length,
        codesLive: codes.filter((c) => c.isLive).length,
      },
    });
  } catch (error) {
    console.error('❌ [admin/prospecting] GET failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// Krótki, URL-safe kod do magic linku /r/{code}. Dependency-free (Node crypto).
function generateInviteCode(): string {
  return randomBytes(9).toString('base64url'); // ~12 znaków, ~72 bity entropii
}

// Wystaw kod + 3 seedy. Dwa tory w jednym endpoincie:
//   - inbound:  body.applicationId (z formularza Apply) → wniosek leci na 'invited'
//   - outbound: body.recipientHandle (+ recipientNote) → ręczny lead z IG
// Kod ważny 24h. Tylko GOD.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'GOD') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { applicationId, recipientHandle, recipientNote, seeds } = body ?? {};

    // Walidacja: dokładnie 3 seedy, każdy z tytułem i podtytułem.
    if (!Array.isArray(seeds) || seeds.length !== 3) {
      return NextResponse.json({ error: 'Wymagane dokładnie 3 seedy' }, { status: 400 });
    }
    const clean = seeds.map((s: any) => ({
      title: typeof s?.title === 'string' ? s.title.trim() : '',
      subtitle: typeof s?.subtitle === 'string' ? s.subtitle.trim() : '',
      description: typeof s?.description === 'string' ? s.description.trim() : '',
    }));
    if (clean.some((s) => !s.title || !s.subtitle)) {
      return NextResponse.json({ error: 'Każdy seed wymaga tytułu i podtytułu' }, { status: 400 });
    }

    // Musi być znany odbiorca: wniosek (inbound) albo handle (outbound).
    if (!applicationId && !recipientHandle) {
      return NextResponse.json(
        { error: 'Podaj applicationId (inbound) albo recipientHandle (outbound)' },
        { status: 400 },
      );
    }

    // Inbound: wniosek musi istnieć i nie mieć jeszcze kodu (relacja 1:1).
    if (applicationId) {
      const app = await prisma.application.findUnique({
        where: { id: applicationId },
        include: { inviteCode: { select: { id: true } } },
      });
      if (!app) {
        return NextResponse.json({ error: 'Application nie istnieje' }, { status: 404 });
      }
      if (app.inviteCode) {
        return NextResponse.json({ error: 'Ten wniosek ma już kod' }, { status: 409 });
      }
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Kod + seedy (+ ewentualny flip wniosku na 'invited') atomowo.
    const created = await prisma.$transaction(async (tx) => {
      const code = await tx.inviteCode.create({
        data: {
          code: generateInviteCode(),
          expiresAt,
          applicationId: applicationId ?? null,
          recipientHandle: recipientHandle?.trim() || null,
          recipientNote: recipientNote?.trim() || null,
          seeds: {
            create: clean.map((s, i) => ({
              position: i + 1,
              title: s.title,
              subtitle: s.subtitle,
              description: s.description || null,
            })),
          },
        },
        include: { seeds: { orderBy: { position: 'asc' } } },
      });

      if (applicationId) {
        await tx.application.update({
          where: { id: applicationId },
          data: { status: 'invited' },
        });
      }

      return code;
    });

    // Magic link prowadzi WPROST na rejestrację z kodem (stronę /r/ skasowaliśmy).
    // lang=en domyślnie — Twój priorytet; PL i tak działa po zmianie parametru.
    const base = process.env.NEXTAUTH_URL ?? '';
    const magicLink = `${base}/register?lang=en&invite=${created.code}`;

    return NextResponse.json({ code: created, magicLink }, { status: 201 });
  } catch (error) {
    console.error('❌ [admin/prospecting] POST failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// Akcje na wniosku. Na razie: 'cancel' → status 'rejected' (Cancelled w UI). Tylko GOD.
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'GOD') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { applicationId, codeId, action } = body ?? {};

    if (action !== 'cancel') {
      return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 });
    }

    // Wariant 2: anulowanie kodu outbound → wygaszamy (status 'expired', link martwy).
    if (codeId) {
      const code = await prisma.inviteCode.findUnique({ where: { id: codeId }, select: { id: true } });
      if (!code) {
        return NextResponse.json({ error: 'Kod nie istnieje' }, { status: 404 });
      }
      // Panel GOD: anulujemy świadomie, też kod zużyty (oznaczamy 'expired' do porządków).
      const updatedCode = await prisma.inviteCode.update({
        where: { id: codeId },
        data: { status: 'expired' },
      });
      return NextResponse.json({ success: true, code: updatedCode });
    }

    // Wariant 1: anulowanie wniosku inbound → status 'rejected'.
    if (!applicationId) {
      return NextResponse.json({ error: 'Wymagane applicationId albo codeId' }, { status: 400 });
    }
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { inviteCode: { select: { id: true } } },
    });
    if (!app) {
      return NextResponse.json({ error: 'Application nie istnieje' }, { status: 404 });
    }
    if (app.inviteCode) {
      return NextResponse.json({ error: 'Wniosek ma już kod — nie można anulować' }, { status: 409 });
    }
    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: { status: 'rejected', reviewedAt: new Date() },
    });
    return NextResponse.json({ success: true, application: updated });
  } catch (error) {
    console.error('❌ [admin/prospecting] PATCH failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// Trwałe usunięcie wniosku z bazy. Nieodwracalne. Tylko GOD.
// Jeśli wniosek ma wystawiony kod (relacja 1:1) — nie usuwamy, by nie osierocić zaproszenia.
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'GOD') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get('applicationId')?.trim();
    const codeId = searchParams.get('codeId')?.trim();

    // Wariant 2: usunięcie kodu outbound (seedy znikną kaskadowo).
    if (codeId) {
      const code = await prisma.inviteCode.findUnique({ where: { id: codeId }, select: { id: true } });
      if (!code) {
        return NextResponse.json({ error: 'Kod nie istnieje' }, { status: 404 });
      }
      // Panel GOD: usuwamy wpis do porządków. User (jeśli był) zostaje — relacja SetNull odpina kod.
      await prisma.inviteCode.delete({ where: { id: codeId } });
      return NextResponse.json({ success: true });
    }

    // Wariant 1: usunięcie wniosku inbound.
    if (!applicationId) {
      return NextResponse.json({ error: 'Wymagane applicationId albo codeId' }, { status: 400 });
    }
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { inviteCode: { select: { id: true } } },
    });
    if (!app) {
      return NextResponse.json({ error: 'Application nie istnieje' }, { status: 404 });
    }
    if (app.inviteCode) {
      return NextResponse.json({ error: 'Wniosek ma wystawiony kod — nie można usunąć' }, { status: 409 });
    }
    await prisma.application.delete({ where: { id: applicationId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ [admin/prospecting] DELETE failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}