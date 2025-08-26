//src/app/api/pages/visits/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Zakładam, że używasz Prisma

export async function POST(request: NextRequest) {
  try {
    const { pageId } = await request.json();

    if (!pageId) {
      return NextResponse.json({ error: 'Brak pageId w zapytaniu' }, { status: 400 });
    }

    // Atomowa operacja inkrementacji licznika w bazie danych
    const updatedPage = await prisma.pages.update({
      where: { id: pageId },
      data: {
        visits: {
          increment: 1,
        },
      },
      select: {
        visits: true, // Zwracamy tylko zaktualizowaną liczbę odwiedzin
      },
    });

    return NextResponse.json({
      success: true,
      visitors: updatedPage.visits,
    });
  } catch (error) {
    console.error('Błąd podczas aktualizacji licznika odwiedzin:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}