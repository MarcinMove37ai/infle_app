// src/app/move37th/route.ts
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

// Furtka dostępowa (hardcoded, świadomie). Wchodzisz na /move37th →
// wystawiamy świeży kod BEZ seedów → redirect na rejestrację z tym kodem.
// User leci normalną ścieżką: formularz (bez welcome modalu, bo brak seedów).
// Omija analizę profilu, więc nie ma czego podsuwać.
export async function GET() {
  try {
    const code = randomBytes(9).toString('base64url');

    await prisma.inviteCode.create({
      data: {
        code,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        recipientNote: 'move37th (furtka)',
        // brak seeds — celowo
      },
    });

    const base = process.env.NEXTAUTH_URL ?? '';
    return NextResponse.redirect(`${base}/register?lang=en&invite=${code}`);
  } catch (error) {
    console.error('❌ [move37th] failed:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}