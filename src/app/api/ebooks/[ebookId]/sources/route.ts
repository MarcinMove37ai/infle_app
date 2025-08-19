import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Pobieranie wszystkich źródeł dla danego ebooka
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  try {
    // 1. Identyfikacja użytkownika na podstawie sesji
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Walidacja ID ebooka z URL - ZMIANA: await params
    const resolvedParams = await params;
    const ebookId = parseInt(resolvedParams.ebookId, 10);
    if (isNaN(ebookId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe ID ebooka.' }, { status: 400 });
    }

    // 3. Weryfikacja, czy użytkownik ma uprawnienia do tego ebooka
    const ebook = await prisma.ebooks.findFirst({
      where: {
        id: ebookId,
        userId: userId,
      },
    });

    if (!ebook) {
      return NextResponse.json({ success: false, error: 'Ebook nie został znaleziony lub nie masz do niego uprawnień.' }, { status: 404 });
    }

    // 4. Pobranie wszystkich źródeł powiązanych z danym ebookiem
    const sources = await prisma.ebookSource.findMany({
      where: {
        ebook_id: ebookId,
      },
    });

    console.log(`[API] Pobrano ${sources.length} źródeł dla ebooka o ID: ${ebookId}`);
    return NextResponse.json({ success: true, sources: sources });

  } catch (error: any) {
    console.error('[API-ERROR] /sources GET:', error);
    return NextResponse.json({ success: false, error: 'Wystąpił wewnętrzny błąd serwera.' }, { status: 500 });
  }
}

/**
 * Dodawanie nowego źródła do ebooka
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  try {
    // KROK 1: Identyfikacja użytkownika na serwerze na podstawie sesji (tak jak w innych endpointach)
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;
    console.log(`[API] Użytkownik zidentyfikowany na podstawie sesji: ${userId}`);

    // Krok 2: Walidacja ID ebooka z URL - ZMIANA: await params
    const resolvedParams = await params;
    const ebookId = parseInt(resolvedParams.ebookId, 10);
    if (isNaN(ebookId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe ID ebooka.' }, { status: 400 });
    }

    // Krok 3: Pobranie danych z ciała żądania (już bez userId)
    const body = await request.json();
    const {
      sourceType,
      url,
      title,
      content,
      sourceLabel,
      metadata,
    } = body;

    if (!sourceType || !url || !title || !content) {
      return NextResponse.json({ success: false, error: 'Brakujące pola w ciele żądania.' }, { status: 400 });
    }

    // Krok 4: Weryfikacja, czy ebook należy do zalogowanego użytkownika
    const ebook = await prisma.ebooks.findFirst({
      where: {
        id: ebookId,
        userId: userId, // Sprawdzamy, czy ID użytkownika z sesji zgadza się z właścicielem ebooka
      },
    });

    if (!ebook) {
      return NextResponse.json({ success: false, error: `Ebook o ID ${ebookId} nie został znaleziony lub nie masz do niego uprawnień.` }, { status: 404 });
    }

    // Krok 5: Utworzenie nowego źródła
    const newSource = await prisma.ebookSource.create({
      data: {
        ebook_id: ebookId,
        user_id: userId, // Używamy bezpiecznego userId z sesji
        sourceType,
        url,
        title,
        content,
        sourceLabel: sourceLabel || null,
        metadata: metadata || null,
      },
    });
    console.log(`[API] Pomyślnie utworzono nowe źródło o ID: ${newSource.id} dla użytkownika ${userId}`);

    return NextResponse.json({ success: true, source: newSource }, { status: 201 });

  } catch (error: any) {
    console.error('[API-ERROR] /sources POST:', error);
    if (error.code === 'P2002') {
       return NextResponse.json({ success: false, error: 'To źródło URL już istnieje dla tego ebooka.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Wystąpił wewnętrzny błąd serwera.' }, { status: 500 });
  }
}

/**
 * Usuwanie pojedynczego źródła
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ ebookId: string }> } // ZMIANA: Promise<{ ebookId: string }>
) {
  try {
    // 1. Identyfikacja użytkownika na podstawie sesji
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    // 2. Walidacja ID ebooka z URL - ZMIANA: await params
    const resolvedParams = await params;
    const ebookId = parseInt(resolvedParams.ebookId, 10);
    if (isNaN(ebookId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe ID ebooka.' }, { status: 400 });
    }

    // 3. Pobranie ID źródła z ciała żądania
    const body = await request.json();
    const { sourceId } = body;

    if (!sourceId || isNaN(parseInt(sourceId, 10))) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowe lub brakujące ID źródła w ciele żądania.' }, { status: 400 });
    }
    const numericSourceId = parseInt(sourceId, 10);

    // 4. Weryfikacja, czy źródło, które chcemy usunąć, należy do użytkownika
    const source = await prisma.ebookSource.findFirst({
      where: {
        id: numericSourceId,
        ebook_id: ebookId,
        user_id: userId, // Upewniamy się, że tylko właściciel może usunąć
      }
    });

    if (!source) {
      return NextResponse.json({ success: false, error: 'Źródło nie zostało znalezione lub nie masz uprawnień do jego usunięcia.' }, { status: 404 });
    }

    // 5. Usunięcie źródła
    await prisma.ebookSource.delete({
      where: {
        id: numericSourceId,
      }
    });

    console.log(`[API] Pomyślnie usunięto źródło o ID: ${numericSourceId} z ebooka o ID: ${ebookId}`);
    return NextResponse.json({ success: true, message: 'Źródło zostało usunięte.' });

  } catch (error: any) {
    console.error('[API-ERROR] /sources DELETE:', error);
    return NextResponse.json({ success: false, error: 'Wystąpił wewnętrzny błąd serwera.' }, { status: 500 });
  }
}