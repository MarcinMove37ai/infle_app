// ===================================================================
// src/app/api/ebooks/route.ts - WERSJA FINALNA
// ===================================================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserEbookSettings } from '@/lib/ai-settings';
import { ebookEvents } from '@/lib/ebookEvents';
// --- NOWE IMPORTY DLA OPERACJI NA PLIKACH ---
import fs from 'fs/promises';
import path from 'path';


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

    const ebookId = searchParams.get('id');

    if (ebookId) {
      // === SCENARIUSZ 1: POBIERANIE SZCZEGÓŁÓW JEDNEGO E-BOOKA (BEZ ZMIAN) ===
      const ebook = await prisma.ebooks.findFirst({
        where: { id: parseInt(ebookId), userId: userId },
        include: { ebook_chapters: { orderBy: { position: 'asc' } } },
      });

      if (!ebook) {
        return NextResponse.json({ error: 'E-book nie został znaleziony' }, { status: 404 });
      }

      const responseData = {
        id: ebook.id,
        title: ebook.title,
        subtitle: ebook.subtitle,
        description: ebook.description,
        chapters: ebook.ebook_chapters.map(chapter => ({
          id: chapter.id.toString(),
          title: chapter.title,
          content: chapter.content,
          position: chapter.position,
          image_url: chapter.image_url,
          image_prompt: chapter.image_prompt,
        })),
      };

      return NextResponse.json(responseData);
    }

    // === SCENARIUSZ 2: POBIERANIE LISTY E-BOOKÓW (Z POPRAWKAMI) ===
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

    // Krok 1: Pobieramy dane z bazy i statystyki (tak jak wcześniej)
    const [ebooksFromDb, totalCount, completedCount, inProgressCount, allEbooksTotalCount] = await Promise.all([
      prisma.ebooks.findMany({
        where: filteredWhereCondition,
        include: {
          pages: {       // Dołącz powiązane rekordy z tabeli 'pages'
            select: {
              id: true   // Wystarczy nam tylko ID, aby potwierdzić istnienie
            }
          }
        },
        // Ważne: usuwamy 'select', aby pobrać wszystkie pola potrzebne do mapowania
        orderBy: { created_at: 'desc' },
        skip: skip,
        take: validatedLimit,
      }),
      prisma.ebooks.count({ where: filteredWhereCondition }),
      prisma.ebooks.count({ where: { ...whereCondition, status: { in: ['published', 'completed'] } } }),
      prisma.ebooks.count({ where: { ...whereCondition, status: { in: ['in-progress', 'draft'] } } }),
      prisma.ebooks.count({ where: whereCondition }),
    ]);

    // =======================================================================
    // START: NOWA LOGIKA - DOŁĄCZANIE ŚCIEŻEK DO OKŁADEK
    // =======================================================================

    // Krok 2: Odczytujemy listę plików z katalogu `uploads`
    const uploadsDir = path.resolve(process.env.UPLOADS_DIR || '/data/uploads/uploads');
    let allUploadedFiles: string[] = [];
    try {
      allUploadedFiles = await fs.readdir(uploadsDir);
    } catch (err) {
      console.warn(`⚠️ Ostrzeżenie: Nie można odczytać katalogu z okładkami: ${uploadsDir}.`);
    }

    // Krok 3: Mapujemy wyniki z bazy, aby dołączyć ścieżkę do okładki
    const ebooksWithCovers = ebooksFromDb.map(ebook => {
      // Używamy tego samego prefiksu, co w logice usuwania
      const filePrefix = `${ebook.userId}_EB${ebook.id}_`;
      const coverFilename = allUploadedFiles.find(file => file.startsWith(filePrefix) && file.includes('_COVER'));

      return {
        ...ebook, // Kopiujemy wszystkie dane z bazy
        hasLandingPage: ebook.pages.length > 0,
        cover_image_webp_url: coverFilename ? `uploads/${coverFilename}` : null,
      };
    });

    // =======================================================================
    // KONIEC: NOWA LOGIKA
    // =======================================================================

    // Krok 4: Zwracamy kompletne dane do frontendu
    return NextResponse.json({
      success: true,
      ebooks: ebooksWithCovers, // Zwracamy przetworzoną listę
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
 * ZAKTUALIZOWANA FUNKCJA DELETE
 * Usuwa e-book z bazy danych ORAZ wszystkie powiązane z nim grafiki z dysku.
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const ebookIdParam = searchParams.get('id');

    if (!ebookIdParam) {
      return NextResponse.json({ error: 'ID e-booka jest wymagane' }, { status: 400 });
    }
    const ebookId = parseInt(ebookIdParam);

    const existingEbook = await prisma.ebooks.findFirst({
      where: {
        id: ebookId,
        userId: userId,
      },
      select: {
        id: true,
        title: true,
        userId: true, // Pobieramy userId, aby mieć pewność, że go mamy
      },
    });

    if (!existingEbook) {
      return NextResponse.json(
        { error: 'E-book nie został znaleziony lub nie masz do niego dostępu' },
        { status: 404 }
      );
    }

    // Krok 1: Usunięcie e-booka z bazy danych
    await prisma.ebooks.delete({
      where: {
        id: ebookId,
      },
    });

    console.log(`✅ Usunięto e-book "${existingEbook.title}" (ID=${ebookId}) z bazy danych.`);

    // ===================================================================
    // Krok 2: Logika usuwania powiązanych grafik z dysku
    // ===================================================================
    let deletedFilesCount = 0;
    try {
      const filePrefix = `${existingEbook.userId}_EB${existingEbook.id}_`;

      // ====================== KLUCZOWA POPRAWKA ======================
      // Zmieniamy logikę, aby naśladowała działanie eksploratora plików.
      // Używamy ścieżki absolutnej od roota dysku, tak jak w logach, które
      // potwierdziły skuteczne usuwanie przez eksplorator.
      const uploadsDir = path.resolve(process.env.UPLOADS_DIR || '/data/uploads/uploads');
      // ===============================================================

      console.log(`🔍 Skanowanie katalogu: ${uploadsDir} w poszukiwaniu plików z prefiksem: "${filePrefix}"`);

      try {
        const allFiles = await fs.readdir(uploadsDir);
        const filesToDelete = allFiles.filter(file => file.startsWith(filePrefix));

        if (filesToDelete.length === 0) {
          console.log(`ℹ️ Nie znaleziono plików do usunięcia dla e-booka ID=${ebookId}.`);
        } else {
          await Promise.all(filesToDelete.map(async (file) => {
            const filePath = path.join(uploadsDir, file);
            await fs.unlink(filePath);
            console.log(`🗑️ Usunięto plik graficzny: ${file}`);
            deletedFilesCount++;
          }));
        }
      } catch (dirError: any) {
        if (dirError.code === 'ENOENT') {
          console.log(`ℹ️ Katalog ${uploadsDir} nie istnieje. Pomijam krok usuwania plików graficznych.`);
        } else {
          throw dirError; // Rzucamy dalej inne, nieoczekiwane błędy
        }
      }
    } catch (error) {
      console.error(`❌ Wystąpił błąd podczas usuwania plików graficznych dla e-booka ID=${ebookId}, ale rekord z bazy został usunięty. Błąd:`, error);
    }
    // ===================================================================

    // Krok 3: Emisja zdarzenia i wysłanie odpowiedzi
    ebookEvents.emitEbookChange({
      type: 'deleted',
      userId: userId,
      ebookId: ebookId,
      timestamp: new Date()
    });

    return NextResponse.json({
      success: true,
      message: `E-book "${existingEbook.title}" został pomyślnie usunięty.`,
      details: `Usunięto ${deletedFilesCount} powiązanych plików graficznych.`,
      deletedEbook: {
        id: existingEbook.id,
        title: existingEbook.title,
      },
    });

  } catch (error) {
    console.error('❌ Krytyczny błąd podczas usuwania e-booka:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd serwera podczas usuwania e-booka',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}