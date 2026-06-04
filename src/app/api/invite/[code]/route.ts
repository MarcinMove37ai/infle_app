// src/app/api/invite/[code]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Walidacja kodu zaproszenia (publiczny, read-only).
// Czyta go strona /r/{code} ORAZ rejestracja — jedno źródło prawdy o "żywotności".
// Ważny = status 'issued' AND expiresAt > now() AND jeszcze niezużyty.
// Zwraca podgląd 3 seedów, ale NIC wrażliwego (żadnych danych właściciela kodu).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await params;

    if (!code) {
      return NextResponse.json({ valid: false, reason: 'missing' }, { status: 400 });
    }

    const invite = await prisma.inviteCode.findUnique({
      where: { code },
      include: {
        seeds: { orderBy: { position: 'asc' }, select: { position: true, title: true, subtitle: true } },
      },
    });

    // Nieznany kod — celowo 200 z valid:false (front pokaże "nieprawidłowy",
    // nie chcemy 404, żeby nie różnicować "nie ma" od "wygasł" dla zgadujących).
    if (!invite) {
      return NextResponse.json({ valid: false, reason: 'not_found' });
    }

    const isExpired = invite.expiresAt.getTime() <= Date.now();
    const isUsed = invite.status === 'used' || invite.usedByUserId !== null;

    if (isUsed) {
      return NextResponse.json({ valid: false, reason: 'used' });
    }
    if (invite.status === 'expired' || isExpired) {
      return NextResponse.json({ valid: false, reason: 'expired' });
    }
    if (invite.status !== 'issued') {
      return NextResponse.json({ valid: false, reason: 'invalid' });
    }

    // Lejek "Clicked": pierwsze otwarcie żywego linku znaczymy czasem.
    // Tylko raz (gdy puste) i bez blokowania odpowiedzi (fire-and-forget).
    if (!invite.clickedAt) {
      prisma.inviteCode
        .update({ where: { code }, data: { clickedAt: new Date() } })
        .catch((e) => console.error('⚠️ [invite/[code]] clickedAt update failed:', e));
    }

    // Żywy kod: oddajemy tylko to, co potrzebne stronie powitalnej.
    return NextResponse.json({
      valid: true,
      code: invite.code,
      expiresAt: invite.expiresAt,
      seeds: invite.seeds,
    });
  } catch (error) {
    console.error('❌ [invite/[code]] GET failed:', error);
    return NextResponse.json(
      { valid: false, reason: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}