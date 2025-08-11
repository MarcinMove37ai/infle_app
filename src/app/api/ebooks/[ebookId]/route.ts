// src/app/api/ebooks/[ebookId]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Pobieranie szczegółów jednego ebooka (GET)
 */
export async function GET(
  request: Request,
  { params }: { params: { ebookId: string } }
) {
  try {
    // 1. Weryfikacja sesji użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;
    const { ebookId } = params;

    // 2. Pobranie danych z bazy za pomocą Prisma
    // WAŻNE: Dodajemy warunek `userId`, aby upewnić się, że użytkownik
    // pobiera tylko swój własny ebook.
    const ebook = await prisma.ebooks.findUnique({
      where: {
        id: ebookId,
        userId: userId,
      },
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ebook });
  } catch (error) {
    console.error('Błąd podczas pobierania ebooka:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}

/**
 * Aktualizacja ebooka (PUT)
 */
export async function PUT(
  request: Request,
  { params }: { params: { ebookId: string } }
) {
  try {
    // 1. Weryfikacja sesji użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;
    const { ebookId } = params;

    // 2. Pobranie danych z żądania
    const body = await request.json();
    const { title, subtitle } = body;

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Tytuł jest wymagany' }, { status: 400 });
    }

    // 3. Aktualizacja danych w bazie za pomocą Prisma
    // WAŻNE: `where` zawiera `userId`, więc użytkownik może zaktualizować
    // tylko ebook, który do niego należy.
    const updatedEbook = await prisma.ebook.update({
      where: {
        id: ebookId,
        userId: userId,
      },
      data: {
        title: title.trim(),
        subtitle: subtitle || null,
      },
    });

    return NextResponse.json({ success: true, ebook: updatedEbook });
  } catch (error) {
    // Prisma zwraca specyficzny błąd, jeśli rekord do aktualizacji nie zostanie znaleziony
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Ebook nie został znaleziony lub nie masz do niego uprawnień' }, { status: 404 });
    }

    console.error('Błąd podczas aktualizacji ebooka:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}