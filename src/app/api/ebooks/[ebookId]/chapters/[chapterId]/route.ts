// src/app/api/ebooks/[ebookId]/chapters/[chapterId]/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type RouteContext = { params: Promise<{ ebookId: string; chapterId: string }> };

/**
 * Aktualizacja pojedynczego rozdziału
 */
export async function PUT(request: Request, { params: paramsPromise }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // POPRAWKA: Oczekujemy na rozwiązanie Promise z parametrami
    const params = await paramsPromise;
    const ebookId = parseInt(params.ebookId);
    const chapterId = parseInt(params.chapterId);

    const { title, content } = await request.json();
    const dataToUpdate: { title?: string; content?: string } = {};
    if (title) dataToUpdate.title = title.trim();
    if (content) dataToUpdate.content = content;

    if (Object.keys(dataToUpdate).length === 0) {
        return NextResponse.json({ error: 'Brak danych do aktualizacji' }, { status: 400 });
    }

    const updatedChapter = await prisma.$transaction(async (tx) => {
      const chapter = await tx.ebook_chapters.update({
        where: {
          id: chapterId,
          ebook_id: ebookId,
          ebooks: {
            userId: session.user.id,
          },
        },
        data: dataToUpdate,
      });

      await tx.ebooks.update({
        where: { id: ebookId },
        data: { updated_at: new Date() },
      });

      return chapter;
    });

    return NextResponse.json({ success: true, chapter: updatedChapter });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Rozdział nie został znaleziony lub nie masz uprawnień' }, { status: 404 });
    }
    console.error('Błąd podczas aktualizacji rozdziału:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}

/**
 * Usunięcie pojedynczego rozdziału
 */
export async function DELETE(request: Request, { params: paramsPromise }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // POPRAWKA: Oczekujemy na rozwiązanie Promise z parametrami
    const params = await paramsPromise;
    const ebookId = parseInt(params.ebookId);
    const chapterId = parseInt(params.chapterId);

    await prisma.$transaction(async (tx) => {
        await tx.ebook_chapters.delete({
            where: {
                id: chapterId,
                ebook_id: ebookId,
                ebooks: {
                    userId: session.user.id,
                },
            },
        });

        await tx.ebooks.update({
            where: { id: ebookId },
            data: { updated_at: new Date() }
        });
    });

    return NextResponse.json({ success: true, message: 'Rozdział został usunięty' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Rozdział nie został znaleziony lub nie masz uprawnień' }, { status: 404 });
    }
    console.error('Błąd podczas usuwania rozdziału:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera' }, { status: 500 });
  }
}