// ===================================================================
// src/app/api/ebooks/route.ts - WERSJA ZAKTUALIZOWANA
// ===================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserEbookSettings } from '@/lib/ai-settings';
import { ebookEvents } from '@/lib/ebookEvents';

/**
 * ZAKTUALIZOWANA FUNKCJA GET
 * Obsługuje dwa scenariusze:
 * 1. Pobieranie listy e-booków (gdy brak `?id=...` w URL).
 * 2. Pobieranie szczegółowych danych jednego e-booka (gdy jest `?id=...` w URL).
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // <-- NOWY BLOK: Sprawdzamy, czy żądanie dotyczy jednego, konkretnego e-booka
    const ebookId = searchParams.get('id');

    if (ebookId) {
      // === SCENARIUSZ 1: POBIERANIE SZCZEGÓŁÓW JEDNEGO E-BOOKA ===
      const ebook = await prisma.ebooks.findFirst({
        where: {
          id: parseInt(ebookId),
          userId: userId, // Zapewnia, że użytkownik ma dostęp tylko do swoich e-booków
        },
        include: {
          ebook_chapters: { // Dołączamy powiązane rozdziały
            orderBy: {
              position: 'asc', // Sortujemy rozdziały według ich kolejności
            },
          },
        },
      });

      if (!ebook) {
        return NextResponse.json({ error: 'E-book nie został znaleziony lub nie masz do niego dostępu' }, { status: 404 });
      }

      // Mapujemy dane na format, którego oczekuje frontend w modalu edycji
      const responseData = {
        id: ebook.id,
        title: ebook.title,
        subtitle: ebook.subtitle,
        description: ebook.description,
        // Zmieniamy nazwę z 'ebook_chapters' na 'chapters' i dostosowujemy pola
        chapters: ebook.ebook_chapters.map(chapter => ({
          id: chapter.id.toString(), // Frontend oczekuje ID jako string
          title: chapter.title,
          content: chapter.content,
          position: chapter.position,
          image_url: chapter.image_url, // Przesyłamy snake_case, frontend sobie poradzi lub można zmienić na camelCase
          image_prompt: chapter.image_prompt,
        })),
      };

      return NextResponse.json(responseData);
    }
    // <-- KONIEC NOWEGO BLOKU

    // === SCENARIUSZ 2: POBIERANIE LISTY E-BOOKÓW (ISTNIEJĄCA LOGIKA) ===
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const filter = searchParams.get('filter') || 'all';

    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const skip = (validatedPage - 1) * validatedLimit;

    const whereCondition: any = { userId: userId };

    if (search.trim()) {
      whereCondition.OR = [
        { title: { contains: search.trim(), mode: 'insensitive' } },
        { subtitle: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { authorDisplayName: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const filteredWhereCondition = { ...whereCondition };
    if (filter === 'completed') {
      filteredWhereCondition.status = { in: ['published', 'completed'] };
    } else if (filter === 'draft') {
      filteredWhereCondition.status = { in: ['in-progress', 'draft'] };
    }

    const [ebooks, totalCount, completedCount, inProgressCount, allEbooksTotalCount] = await Promise.all([
      prisma.ebooks.findMany({
        where: filteredWhereCondition,
        select: {
          id: true,
          title: true,
          subtitle: true,
          description: true,
          status: true,
          authorDisplayName: true,
          authorLogoUrl: true,
          text_ai_provider: true,
          text_ai_model: true,
          image_ai_provider: true,
          image_ai_model: true,
          ai_generation_timestamp: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip: skip,
        take: validatedLimit,
      }),
      prisma.ebooks.count({ where: filteredWhereCondition }),
      prisma.ebooks.count({
        where: {
          ...whereCondition,
          status: { in: ['published', 'completed'] }
        },
      }),
      prisma.ebooks.count({
        where: {
          ...whereCondition,
          status: { in: ['in-progress', 'draft'] }
        },
      }),
      prisma.ebooks.count({ where: whereCondition }),
    ]);

    return NextResponse.json({
      success: true,
      ebooks: ebooks,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / validatedLimit),
        hasNext: skip + validatedLimit < totalCount,
        hasPrev: validatedPage > 1,
      },
      stats: {
        total: allEbooksTotalCount,
        completed: completedCount,
        inProgress: inProgressCount,
      },
    });

  } catch (error) {
    console.error('❌ Błąd w GET /api/ebooks:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd podczas pobierania danych',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Obsługa tworzenia nowego ebooka (POST) - BEZ ZMIAN
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    const data = await request.json();
    const { title, subtitle, description, authorDisplayName, authorLogoUrl } = data;

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const userSettings = await getUserEbookSettings(userId);
    const finalAuthorName = authorDisplayName?.trim() || userSettings.authorDisplayName;
    const finalAuthorLogo = authorLogoUrl?.trim() || userSettings.authorLogoUrl;

    const newEbook = await prisma.ebooks.create({
      data: {
        title: title.trim(),
        subtitle: subtitle?.trim() || null,
        description: description?.trim() || null,
        userId: userId,
        authorDisplayName: finalAuthorName,
        authorLogoUrl: finalAuthorLogo,
        text_ai_provider: userSettings.textAiProvider,
        text_ai_model: userSettings.textAiModel,
        image_ai_provider: userSettings.imageAiProvider,
        image_ai_model: userSettings.imageAiModel,
        ai_generation_timestamp: new Date(),
      },
      select: {
        id: true,
      },
    });

    ebookEvents.emitEbookChange({
      type: 'created',
      userId: userId,
      ebookId: newEbook.id,
      timestamp: new Date()
    });

    console.log(`✅ Utworzono e-book o ID=${newEbook.id}`);

    return NextResponse.json({
      success: true,
      ebookId: newEbook.id,
    });
  } catch (error) {
    console.error('❌ Błąd podczas tworzenia e-booka:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd podczas tworzenia e-booka',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Obsługa usuwania ebooka (DELETE) - BEZ ZMIAN
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const ebookId = searchParams.get('id');

    if (!ebookId) {
      return NextResponse.json({ error: 'ID e-booka jest wymagane' }, { status: 400 });
    }

    const existingEbook = await prisma.ebooks.findFirst({
      where: {
        id: parseInt(ebookId),
        userId: userId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!existingEbook) {
      return NextResponse.json(
        { error: 'E-book nie został znaleziony lub nie masz do niego dostępu' },
        { status: 404 }
      );
    }

    await prisma.ebooks.delete({
      where: {
        id: parseInt(ebookId),
      },
    });

    ebookEvents.emitEbookChange({
      type: 'deleted',
      userId: userId,
      ebookId: parseInt(ebookId),
      timestamp: new Date()
    });

    console.log(`✅ Usunięto e-book "${existingEbook.title}" (ID=${ebookId})`);

    return NextResponse.json({
      success: true,
      message: 'E-book został usunięty',
      deletedEbook: {
        id: existingEbook.id,
        title: existingEbook.title,
      },
    });
  } catch (error) {
    console.error('❌ Błąd podczas usuwania e-booka:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd podczas usuwania e-booka',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}