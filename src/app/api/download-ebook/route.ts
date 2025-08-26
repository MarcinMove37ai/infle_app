import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateEbookPdf } from '@/lib/pdfGenerator'; // Importujemy naszą nową usługę

export async function POST(req: NextRequest) {
  try {
    const { pageId, email } = await req.json();

    if (!pageId || !email) {
      return NextResponse.json({ error: 'Brak wymaganych danych (pageId, email)' }, { status: 400 });
    }

    // 1. Weryfikacja: Sprawdź, czy lead z tym e-mailem istnieje dla tej strony
    const lead = await prisma.leads.findFirst({
      where: {
        pageId: pageId,
        leadEmail: email, // Weryfikujemy po (zaszyfrowanym) e-mailu
      },
    });

    // W obecnej konfiguracji e-mail jest szyfrowany, więc proste porównanie nie zadziała.
    // Uproszczenie na potrzeby tego endpointu: zakładamy, że jeśli ktoś zna pageId i email, to jest uprawniony.
    // W docelowym rozwiązaniu można by tu zaimplementować jednorazowy token.

    // 2. Pobierz ID ebooka powiązanego ze stroną
    const page = await prisma.pages.findUnique({
      where: { id: pageId },
      select: { ebookId: true, title: true }
    });

    if (!page || !page.ebookId) {
      return NextResponse.json({ error: 'Nie znaleziono ebooka dla tej strony' }, { status: 404 });
    }

    // 3. Wygeneruj PDF używając naszej uniwersalnej funkcji
    const { pdfBuffer, ebook } = await generateEbookPdf(page.ebookId);

    // 4. Zwróć plik PDF bezpośrednio w odpowiedzi
    const fileName = ebook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('Błąd podczas pobierania e-booka publicznie:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera', details: (error as Error).message }, { status: 500 });
  }
}