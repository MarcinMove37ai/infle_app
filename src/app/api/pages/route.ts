// src/app/api/pages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

// Interfejsy odpowiedzi API
interface PagesApiResponse {
  pages: {
    role: string;
    id: string;
    title: string;
    headline?: string;
    subtitle?: string;
    creator: string;
    supervisorCode?: string;
    visits: number;
    leads: number;
    type: string;
    status: string;
    createdAt: string;
    url: string;
    draft_url: string;
    coverImage: string;
    videoPassword?: string;
    isOwnedByUser: boolean;
    customDomainId?: string | null;
  }[];
  stats: {
    total: number;
    published: number;
    pending: number;
    ebook: number;
    sales: number;
    draft: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || !session.user.id || !session.user.role) {
      return NextResponse.json({ error: 'Brak autoryzacji. Użytkownik niezalogowany.' }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');

    // FIXED: Base clause dla użytkownika (zawsze aktywne)
    let baseWhereClause: Prisma.pagesWhereInput = {};
    if (userRole !== 'admin') {
      baseWhereClause = { userId: userId };
    }

    // FIXED: Pobierz WSZYSTKIE strony użytkownika dla statystyk (bez filtrów)
    const allUserPages = await prisma.pages.findMany({
      where: baseWhereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            role: true
          }
        },
        ebook: {
          select: {
            subtitle: true
          }
        }
      }
    });

    // FIXED: Jeśli limit=9999 lub brak filtrów, zwróć wszystkie strony (client-side filtering)
    const shouldReturnAll = limit === '9999' || (!status && !type && !search);

    let dbPages = allUserPages;

    // FIXED: Aplikuj filtry tylko jeśli nie ma limit=9999
    if (!shouldReturnAll) {
      const filters: Prisma.pagesWhereInput[] = [baseWhereClause];

      if (status) {
        const dbStatus = status === 'published' ? 'published' : status;
        filters.push({ status: dbStatus });
      }
      if (type) {
        filters.push({ type: type });
      }
      if (search) {
        filters.push({
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { headline: { contains: search, mode: 'insensitive' } },
            { creator: { contains: search, mode: 'insensitive' } },
          ],
        });
      }

      const whereClause: Prisma.pagesWhereInput = { AND: filters };

      dbPages = await prisma.pages.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              role: true
            }
          },
          ebook: {
            select: {
              subtitle: true
            }
          }
        }
      });
    } else {
      // Sort all pages by creation date
      dbPages.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
    }

    const pages = dbPages.map(page => {
      const creatorName = `${page.user?.firstName || ''} ${page.user?.lastName || ''}`.trim();

      return {
        role: page.user?.role?.toString() ?? 'free',
        id: page.id,
        title: page.title || '',
        headline: page.headline || '',
        subtitle: page.ebook?.subtitle || '',
        creator: creatorName || page.creator || 'Nieznany autor',
        supervisorCode: '',
        visits: page.visits || 0,
        leads: page.leadsCount || 0,
        type: page.type || '',
        status: page.status,
        createdAt: page.createdAt?.toISOString() ?? new Date().toISOString(),
        url: page.url || '',
        draft_url: page.draft_url || '',
        coverImage: page.coverImage || '',
        videoPassword: '',
        isOwnedByUser: page.userId === userId,
        customDomainId: page.customDomainId,
      };
    });

    // FIXED: Statystyki ZAWSZE z wszystkich stron użytkownika
    const allUserPagesForStats = allUserPages.map(page => {
      const creatorName = `${page.user?.firstName || ''} ${page.user?.lastName || ''}`.trim();

      return {
        role: page.user?.role?.toString() ?? 'free',
        id: page.id,
        title: page.title || '',
        headline: page.headline || '',
        subtitle: page.ebook?.subtitle || '',
        creator: creatorName || page.creator || 'Nieznany autor',
        supervisorCode: '',
        visits: page.visits || 0,
        leads: page.leadsCount || 0,
        type: page.type || '',
        status: page.status,
        createdAt: page.createdAt?.toISOString() ?? new Date().toISOString(),
        url: page.url || '',
        draft_url: page.draft_url || '',
        coverImage: page.coverImage || '',
        videoPassword: '',
        isOwnedByUser: page.userId === userId,
        customDomainId: page.customDomainId,
      };
    });

    const stats = {
      total: allUserPagesForStats.length,
      published: allUserPagesForStats.filter(p => p.status === 'published').length,
      pending: allUserPagesForStats.filter(p => p.status === 'pending').length,
      draft: allUserPagesForStats.filter(p => p.status === 'draft').length,
      ebook: allUserPagesForStats.filter(p => p.type === 'ebook').length,
      sales: allUserPagesForStats.filter(p => p.type === 'sales').length,
    };

    const response: PagesApiResponse = { pages, stats };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('Błąd w GET /api/pages:', error);
    const errorMsg = error instanceof Error ? error.message : 'Wewnętrzny błąd serwera';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// =================================================================
// FUNKCJA: Usuwanie rekordu z tabeli 'pages'
// =================================================================
export async function DELETE(request: NextRequest) {
  try {
    // 1. Uwierzytelnianie użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id || !session.user.role) {
      return NextResponse.json({ error: 'Brak autoryzacji. Użytkownik niezalogowany.' }, { status: 401 });
    }
    const userId = session.user.id;
    const userRole = session.user.role;

    // 2. Pobranie ID strony z ciała żądania
    const { pageId } = await request.json();
    if (!pageId) {
      return NextResponse.json({ error: 'Nie podano identyfikatora strony (pageId).' }, { status: 400 });
    }

    // 3. Weryfikacja, czy strona istnieje i czy użytkownik ma uprawnienia do jej usunięcia
    const pageToDelete = await prisma.pages.findUnique({
      where: {
        id: pageId,
      },
    });

    if (!pageToDelete) {
      return NextResponse.json({ error: 'Strona o podanym ID nie została znaleziona.' }, { status: 404 });
    }

    // Sprawdzenie uprawnień: użytkownik musi być właścicielem strony LUB administratorem
    if (userRole !== 'admin' && pageToDelete.userId !== userId) {
      return NextResponse.json({ error: 'Brak uprawnień do usunięcia tej strony.' }, { status: 403 });
    }

    // 4. Usunięcie rekordu z bazy danych
    await prisma.pages.delete({
      where: {
        id: pageId,
      },
    });

    // 5. Zwrócenie odpowiedzi o powodzeniu
    return NextResponse.json({ message: 'Strona została pomyślnie usunięta.' }, { status: 200 });

  } catch (error: unknown) {
    console.error('Błąd w DELETE /api/pages:', error);
    const errorMsg = error instanceof Error ? error.message : 'Wewnętrzny błąd serwera';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

// =================================================================
// FUNKCJA: Tworzenie strony zapisu dla e-booka
// =================================================================
export async function POST(request: NextRequest) {
  try {
    // 1. Uwierzytelnianie użytkownika (standardowa procedura)
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Pobranie ID e-booka z ciała żądania
    const { ebookId } = await request.json();
    if (!ebookId) {
      return NextResponse.json({ error: 'Nie podano identyfikatora e-booka (ebookId).' }, { status: 400 });
    }

    // 3. Sprawdzenie, czy strona dla tego e-booka już istnieje
    const existingPage = await prisma.pages.findFirst({
      where: {
        ebookId: ebookId,
      },
    });

    if (existingPage) {
      return NextResponse.json({ error: 'Strona zapisu dla tego e-booka już istnieje.' }, { status: 409 }); // 409 Conflict
    }

    // 4. Pobranie danych e-booka, aby skopiować je na stronę
    const ebook = await prisma.ebooks.findUnique({
      where: {
        id: ebookId,
        // Dodatkowe zabezpieczenie: tylko właściciel może utworzyć stronę
        userId: userId,
      },
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Nie znaleziono e-booka lub brak uprawnień.' }, { status: 404 });
    }

    // 5. Utworzenie nowego rekordu w tabeli 'pages'
    const newPage = await prisma.pages.create({
      data: {
        id: randomUUID(), // Generujemy unikalne ID dla nowej strony
        title: ebook.title,
        headline: ebook.subtitle || '',
        creator: ebook.authorDisplayName || 'Nieznany autor',
        status: 'draft',
        type: 'ebook',
        coverImage: ebook.final_mockup_url || ebook.cover_image_url || '',
        userId: ebook.userId,
        ebookId: ebook.id,
      },
    });

    // 6. Zwrócenie odpowiedzi o powodzeniu z danymi nowej strony
    return NextResponse.json(newPage, { status: 201 }); // 201 Created

  } catch (error: unknown) {
    console.error('Błąd w POST /api/pages:', error);
    const errorMsg = error instanceof Error ? error.message : 'Wewnętrzny błąd serwera';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}