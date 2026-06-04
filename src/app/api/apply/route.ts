// src/app/api/apply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Publiczny endpoint wniosku o dostęp (Apply). Składa go NIEzalogowany user,
// który trafił na rejestrację bez prawidłowego kodu (invite-only).
// Zapis do tabeli Application (status 'pending'). Zero guarda GOD.
//
// Wymagania (ustalone): imię + email + min. jeden link (www/IG/FB/YT/LI).
// Dedup: ten sam email z istniejącym 'pending' → nie dublujemy wniosku.

// Prosta walidacja maila — bez bibliotek, wystarczy do odsiania śmieci.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const firstName = clean(body.firstName);
    const email = clean(body.email).toLowerCase();
    const website = clean(body.website);
    const instagram = clean(body.instagram);
    const facebook = clean(body.facebook);
    const youtube = clean(body.youtube);
    const linkedin = clean(body.linkedin);

    // Imię + poprawny email.
    if (!firstName) {
      return NextResponse.json({ error: 'missing_first_name' }, { status: 400 });
    }
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }

    // Min. jeden link — bez tego nie poznamy, z kim mamy do czynienia.
    const hasAnyLink = Boolean(website || instagram || facebook || youtube || linkedin);
    if (!hasAnyLink) {
      return NextResponse.json({ error: 'missing_link' }, { status: 400 });
    }

    // Dedup: jeśli ten email ma już wniosek w 'pending', nie tworzymy drugiego.
    const existingPending = await prisma.application.findFirst({
      where: { email, status: 'pending' },
      select: { id: true },
    });
    if (existingPending) {
      return NextResponse.json(
        { ok: true, duplicate: true, message: 'already_pending' },
        { status: 200 },
      );
    }

    await prisma.application.create({
      data: {
        firstName,
        email,
        website: website || null,
        instagram: instagram || null,
        facebook: facebook || null,
        youtube: youtube || null,
        linkedin: linkedin || null,
        // status -> domyślnie 'pending' (z schematu)
      },
    });

    return NextResponse.json({ ok: true, duplicate: false }, { status: 201 });
  } catch (error) {
    console.error('❌ [apply] POST failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}