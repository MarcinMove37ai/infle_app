// src/app/api/ebooks/[ebookId]/chapters/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Używamy typu, który jasno określa, że 'params' to Promise
type RouteContext = { params: Promise<{ ebookId: string }> };

/**
 * GET: Pobieranie ebooka razem ze wszystkimi jego rozdziałami.
 */
export async function GET(request: Request, { params: paramsPromise }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // POPRAWKA: Poprawna obsługa 'params' jako Promise
    const params = await paramsPromise;
    const ebookId = parseInt(params.ebookId);

    const ebookWithChapters = await prisma.ebooks.findUnique({
      where: {
        id: ebookId,
        userId: session.user.id, // Używamy poprawnego pola 'userId' (String)
      },
      include: {
        ebook_chapters: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!ebookWithChapters) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ebook: ebookWithChapters });
  } catch (error) {
    console.error('Błąd podczas pobierania rozdziałów:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}

/**
 * POST: Dodawanie nowych rozdziałów do ebooka.
 */
export async function POST(request: Request, { params: paramsPromise }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // POPRAWKA: Poprawna obsługa 'params' jako Promise
    const params = await paramsPromise;
    const ebookId = parseInt(params.ebookId);

    const { chapters } = await request.json();

    if (!Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json({ error: 'Tablica rozdziałów jest wymagana' }, { status: 400 });
    }

    const newChapters = await prisma.$transaction(async (tx) => {
      const ebook = await tx.ebooks.findUniqueOrThrow({
        where: { id: ebookId, userId: session.user.id },
      });

      const lastChapter = await tx.ebook_chapters.findFirst({
        where: { ebook_id: ebook.id },
        orderBy: { position: 'desc' },
      });
      const startPosition = lastChapter ? lastChapter.position + 1 : 1;

      const chaptersToCreate = chapters.map((chapter: { title: string }, index) => ({
        title: chapter.title,
        ebook_id: ebook.id,
        position: startPosition + index,
      }));

      await tx.ebook_chapters.createMany({
        data: chaptersToCreate,
      });

      await tx.ebooks.update({
          where: { id: ebookId },
          data: { updated_at: new Date() }
      });

      const createdChapters = await tx.ebook_chapters.findMany({
        where: {
          ebook_id: ebookId,
          position: {
            gte: startPosition,
          },
        },
        orderBy: {
          position: 'asc',
        },
      });

      return createdChapters;
    });

    return NextResponse.json({ success: true, chapters: newChapters });

  } catch (error) {
    console.error('Błąd podczas dodawania rozdziałów:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}

/**
 * DELETE: Usuwanie wszystkich rozdziałów z ebooka.
 */
export async function DELETE(request: Request, { params: paramsPromise }: RouteContext) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
        }

        // POPRAWKA: Poprawna obsługa 'params' jako Promise
        const params = await paramsPromise;
        const ebookId = parseInt(params.ebookId);

        const result = await prisma.$transaction(async (tx) => {
            const ebook = await tx.ebooks.findUniqueOrThrow({
                where: { id: ebookId, userId: session.user.id }
            });

            const { count } = await tx.ebook_chapters.deleteMany({
                where: { ebook_id: ebook.id }
            });

            await tx.ebooks.update({
                where: { id: ebookId },
                data: { updated_at: new Date() }
            });

            return { deletedCount: count };
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Błąd podczas usuwania rozdziałów:', error);
        return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
    }
}

/**
 * PATCH: Zmiana kolejności rozdziałów (przesunięcie góra/dół).
 */
export async function PATCH(request: Request, { params: paramsPromise }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // POPRAWKA: Poprawna obsługa 'params' jako Promise
    const params = await paramsPromise;
    const ebookId = parseInt(params.ebookId);

    const { chapterId, direction } = await request.json();
    const chapterIdInt = parseInt(chapterId);

    if (!chapterIdInt || !direction || !['up', 'down'].includes(direction)) {
      return NextResponse.json({ error: 'Nieprawidłowe parametry' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.ebooks.findUniqueOrThrow({
        where: { id: ebookId, userId: session.user.id },
      });

      const chapterToMove = await tx.ebook_chapters.findUniqueOrThrow({
        where: { id: chapterIdInt, ebook_id: ebookId },
      });
      const currentPosition = chapterToMove.position;

      const targetPosition = direction === 'up' ? currentPosition - 1 : currentPosition + 1;
      const chapterToSwapWith = await tx.ebook_chapters.findFirstOrThrow({
        where: { ebook_id: ebookId, position: targetPosition },
      });

      await tx.ebook_chapters.update({
        where: { id: chapterToMove.id },
        data: { position: targetPosition },
      });
      await tx.ebook_chapters.update({
        where: { id: chapterToSwapWith.id },
        data: { position: currentPosition },
      });

      await tx.ebooks.update({
        where: { id: ebookId },
        data: { updated_at: new Date() },
      });
    });

    return NextResponse.json({ success: true, message: "Kolejność zaktualizowana." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
       return NextResponse.json({ error: 'Nie można przesunąć rozdziału' }, { status: 400 });
    }
    console.error('Błąd podczas zmiany kolejności rozdziałów:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}