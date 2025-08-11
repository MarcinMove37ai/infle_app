// src/app/api/ebooks/[ebookId]/chapters/update-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Obsługa aktualizacji treści rozdziałów (PUT)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  try {
    // Autoryzacja przez session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // W Next.js 15 params jest obiektem Promise, który trzeba rozwiązać
    const resolvedParams = await params;
    const ebookId = parseInt(resolvedParams.ebookId);

    if (isNaN(ebookId)) {
      return NextResponse.json({ error: 'Invalid ebook ID' }, { status: 400 });
    }

    // Sprawdź czy ebook istnieje i należy do użytkownika
    const ebook = await prisma.ebooks.findFirst({
      where: {
        id: ebookId,
        userId: session.user.id
      },
      select: {
        id: true,
        title: true
      }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook not found or access denied' }, { status: 404 });
    }

    // Pobierz dane z żądania
    const data = await request.json();
    const { chapters } = data;

    if (!Array.isArray(chapters)) {
      return NextResponse.json({ error: 'Invalid chapters format' }, { status: 400 });
    }

    console.log(`📝 Updating content for ${chapters.length} chapters in ebook ID=${ebookId}`);

    // Aktualizuj treść każdego rozdziału
    const updatedChapters = [];

    for (const chapter of chapters) {
      if (!chapter.id) {
        updatedChapters.push({ error: `Missing ID for chapter: ${chapter.title}` });
        continue;
      }

      try {
        // Weryfikuj czy rozdział należy do tego ebooka i użytkownika
        const existingChapter = await prisma.ebook_chapters.findFirst({
          where: {
            id: chapter.id,
            ebook_id: ebookId,
            ebooks: {
              userId: session.user.id
            }
          },
          select: {
            id: true,
            title: true
          }
        });

        if (!existingChapter) {
          updatedChapters.push({ error: `Chapter with ID ${chapter.id} not found or access denied` });
          continue;
        }

        // Aktualizuj treść rozdziału
        const updatedChapter = await prisma.ebook_chapters.update({
          where: {
            id: chapter.id
          },
          data: {
            content: chapter.content || '',
            updated_at: new Date()
          },
          select: {
            id: true,
            title: true,
            updated_at: true
          }
        });

        updatedChapters.push({
          id: updatedChapter.id,
          title: updatedChapter.title,
          updated: true,
          updated_at: updatedChapter.updated_at
        });

        console.log(`✅ Updated chapter ID=${chapter.id}: "${updatedChapter.title}"`);

      } catch (chapterError) {
        console.error(`❌ Error updating chapter ID=${chapter.id}:`, chapterError);
        updatedChapters.push({
          error: `Failed to update chapter with ID ${chapter.id}: ${chapterError instanceof Error ? chapterError.message : 'Unknown error'}`
        });
      }
    }

    // Aktualizuj datę modyfikacji ebooka
    await prisma.ebooks.update({
      where: { id: ebookId },
      data: { updated_at: new Date() }
    });

    console.log(`✅ Successfully updated content for chapters in ebook ID=${ebookId}`);

    // Sprawdź czy wszystkie aktualizacje się powiodły
    const errorCount = updatedChapters.filter(ch => ch.error).length;
    const successCount = updatedChapters.filter(ch => ch.updated).length;

    return NextResponse.json({
      success: errorCount === 0,
      message: errorCount === 0
        ? `Successfully updated ${successCount} chapters`
        : `Updated ${successCount} chapters, ${errorCount} failed`,
      chapters: updatedChapters,
      summary: {
        total: chapters.length,
        success: successCount,
        errors: errorCount
      }
    });

  } catch (error) {
    console.error('❌ Error updating chapter content:', error);
    return NextResponse.json({
      error: 'An error occurred while updating chapter content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}