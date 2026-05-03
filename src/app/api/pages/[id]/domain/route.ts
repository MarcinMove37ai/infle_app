// src/app/api/pages/[id]/domain/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ============================================================
// PATCH /api/pages/[id]/domain
// Body: { customDomainId: string | null }
//   - customDomainId === null  → strona wraca do app.inflee.app/...
//   - customDomainId === "..." → strona serwowana z https://<customDomain>/
//
// Walidacje:
//  1. User jest zalogowany
//  2. Strona należy do usera (pages.userId === session.user.id)
//  3. Jeśli customDomainId !== null:
//     a. Custom domain istnieje
//     b. Należy do tego samego usera co strona
//     c. Ma status 'active' (nie pending/verifying/failed)
//
// Side effects:
//  - Aktualizuje pages.customDomainId
//  - Nic nie ruszamy w Cloudflare (domena była już wcześniej zarejestrowana)
// ============================================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Parse body
  let body: { customDomainId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // customDomainId może być string lub null
  const customDomainId = body.customDomainId;
  if (customDomainId !== null && typeof customDomainId !== 'string') {
    return NextResponse.json(
      { error: 'invalid_customDomainId', message: 'customDomainId must be a string or null' },
      { status: 400 }
    );
  }

  // 1. Verify page exists and belongs to user
  const page = await prisma.pages.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, customDomainId: true, url: true },
  });

  if (!page) {
    return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
  }

  // 2. If assigning a custom domain, verify it exists, belongs to user, and is active
  if (customDomainId !== null) {
    const customDomain = await prisma.customDomain.findFirst({
      where: {
        id: customDomainId,
        userId: session.user.id,
      },
      select: { id: true, status: true, domain: true },
    });

    if (!customDomain) {
      return NextResponse.json(
        { error: 'domain_not_found', message: 'Custom domain not found or does not belong to you' },
        { status: 404 }
      );
    }

    if (customDomain.status !== 'active') {
      return NextResponse.json(
        {
          error: 'domain_not_active',
          message: `Custom domain is in '${customDomain.status}' state. Only active domains can be assigned to pages.`,
        },
        { status: 409 }
      );
    }
  }

  // 3. Update the page
  const updated = await prisma.pages.update({
    where: { id: page.id },
    data: { customDomainId },
    select: {
      id: true,
      customDomainId: true,
      url: true,
      customDomain: {
        select: { id: true, domain: true, status: true },
      },
    },
  });

  // Compute publicUrl: jeśli ma custom domain to https://<domain>,
  // inaczej trzymamy istniejący url (z pages.url) lub fallback na app.inflee.app + url path.
  // pages.url wygląda jak "/lp/xyz" lub pełny URL — używamy tego co już jest.
  const appHost = process.env.APP_HOST || 'app.inflee.app';
  let publicUrl: string;
  if (updated.customDomain) {
    publicUrl = `https://${updated.customDomain.domain}`;
  } else if (updated.url) {
    // url może być relatywny ("/lp/xxx") lub absolutny ("https://...")
    publicUrl = updated.url.startsWith('http')
      ? updated.url
      : `https://${appHost}${updated.url}`;
  } else {
    publicUrl = `https://${appHost}/ebookpage/${updated.id}`;
  }

  return NextResponse.json({
    page: updated,
    publicUrl,
  });
}