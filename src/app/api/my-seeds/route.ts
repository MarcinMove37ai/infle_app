// src/app/api/my-seeds/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Zwraca seedy (tytuł+podtytuł) przypięte do kodu, którym zalogowany user
// się zarejestrował. Źródło dla dropdownu na kroku 0 tworzenia ebooka.
// Brak kodu / brak seedów (np. furtka /move37th, stary user) → pusta lista.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ seeds: [] }, { status: 401 });
    }

    // Kod, który user zużył przy rejestracji (relacja 1:1 User.inviteCode),
    // wraz z seedami posortowanymi po pozycji.
    const invite = await prisma.inviteCode.findUnique({
      where: { usedByUserId: session.user.id },
      include: {
        seeds: {
          orderBy: { position: 'asc' },
          select: { position: true, title: true, subtitle: true, description: true },
        },
      },
    });

    return NextResponse.json({ seeds: invite?.seeds ?? [] });
  } catch (error) {
    console.error('❌ [my-seeds] failed:', error);
    return NextResponse.json({ seeds: [] }, { status: 500 });
  }
}