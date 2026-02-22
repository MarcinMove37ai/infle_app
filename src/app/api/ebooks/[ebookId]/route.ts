// src/app/api/ebooks/[ebookId]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ebookEvents } from '@/lib/ebookEvents';

/**
 * Pobieranie szczegółów jednego ebooka (GET)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  try {
    // 1. Weryfikacja sesji użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. W Next.js 15 params jest Promise - musi być awaited
    const resolvedParams = await params;
    const { ebookId } = resolvedParams;

    // Sprawdź czy ebookId jest numerem
    const ebookIdNum = parseInt(ebookId);
    if (isNaN(ebookIdNum)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator ebooka' }, { status: 400 });
    }

    // 3. Pobranie danych z bazy za pomocą Prisma
    // WAŻNE: Dodajemy warunek `userId`, aby upewnić się, że użytkownik
    // pobiera tylko swój własny ebook.
    const ebook = await prisma.ebooks.findFirst({
      where: {
        id: ebookIdNum,
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
  { params }: { params: Promise<{ ebookId: string }> }
) {
  try {
    // 1. Weryfikacja sesji użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. W Next.js 15 params jest Promise - musi być awaited
    const resolvedParams = await params;
    const { ebookId } = resolvedParams;

    // Sprawdź czy ebookId jest numerem
    const ebookIdNum = parseInt(ebookId);
    if (isNaN(ebookIdNum)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator ebooka' }, { status: 400 });
    }

    // 3. Pobranie danych z żądania
    const body = await request.json();

    // ✅ ZMIANA 1: Pobieramy również pole 'intro' (oraz status dla kompletności)
    const { title, subtitle, description, intro, status } = body;

    // ✅ ZMIANA 2: Walidacja warunkowa.
    // Sprawdzamy tytuł TYLKO JEŚLI został przesłany w żądaniu.
    // Jeśli wysyłasz tylko 'intro', title będzie undefined i błąd nie zostanie rzucony.
    if (title !== undefined && title.trim() === '') {
      return NextResponse.json({ error: 'Tytuł jest wymagany' }, { status: 400 });
    }

    // 4. Aktualizacja danych w bazie za pomocą Prisma
    // WAŻNE: Najpierw sprawdź czy ebook istnieje i należy do użytkownika
    const existingEbook = await prisma.ebooks.findFirst({
      where: {
        id: ebookIdNum,
        userId: userId,
      },
    });

    if (!existingEbook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony lub nie masz do niego uprawnień' }, { status: 404 });
    }

    // 5. Wykonaj aktualizację
    // ✅ ZMIANA 3: Budujemy obiekt danych dynamicznie (Partial Update)
    // Dzięki temu aktualizujemy tylko to, co przyszło w żądaniu.
    const updateData: any = {
      updated_at: new Date(),
    };

    if (title !== undefined) updateData.title = title.trim();
    if (subtitle !== undefined) updateData.subtitle = subtitle || null;
    if (description !== undefined) updateData.description = description || null;

    // Tutaj obsługujemy zapis wstępu:
    if (intro !== undefined) updateData.intro = intro;
    if (status !== undefined) updateData.status = status;

    const updatedEbook = await prisma.ebooks.update({
      where: {
        id: ebookIdNum,
      },
      data: updateData,
    });

    // Ta część jest kluczowa dla odświeżania listy w czasie rzeczywistym
    ebookEvents.emitEbookChange({
      type: 'updated',
      userId: userId,
      ebookId: updatedEbook.id,
      timestamp: new Date()
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

/**
 * Usuwanie ebooka (DELETE)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  try {
    // 1. Weryfikacja sesji użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. W Next.js 15 params jest Promise - musi być awaited
    const resolvedParams = await params;
    const { ebookId } = resolvedParams;

    // Sprawdź czy ebookId jest numerem
    const ebookIdNum = parseInt(ebookId);
    if (isNaN(ebookIdNum)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator ebooka' }, { status: 400 });
    }

    // 3. Sprawdź czy ebook istnieje i należy do użytkownika
    const existingEbook = await prisma.ebooks.findFirst({
      where: {
        id: ebookIdNum,
        userId: userId,
      },
      include: {
        ebook_chapters: {
          select: {
            id: true
          }
        }
      }
    });

    if (!existingEbook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony lub nie masz do niego uprawnień' }, { status: 404 });
    }

    // 4. Usuń ebook (razem z rozdziałami przez CASCADE)
    await prisma.ebooks.delete({
      where: {
        id: ebookIdNum,
      },
    });

    console.log(`✅ Usunięto ebook ID=${ebookIdNum} wraz z ${existingEbook.ebook_chapters.length} rozdziałami`);

    return NextResponse.json({
      success: true,
      message: `Ebook "${existingEbook.title}" został usunięty`,
      deleted_chapters: existingEbook.ebook_chapters.length
    });

  } catch (error) {
    console.error('Błąd podczas usuwania ebooka:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}