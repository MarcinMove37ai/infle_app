// src/app/api/ebooks/[ebookId]/export-pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateEbookPdf } from '@/lib/pdfGenerator'; // 👈 IMPORT

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  try {
    // ✅ KROK 1: AUTENTYKACJA
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // ✅ KROK 2: WALIDACJA PARAMETRÓW
    const resolvedParams = await params;
    const ebookId = resolvedParams.ebookId;

    if (!ebookId) {
      return NextResponse.json({ error: 'Brak ebookId w ścieżce URL.' }, { status: 400 });
    }

    const ebookIdNum = parseInt(ebookId);
    if (isNaN(ebookIdNum)) {
      return NextResponse.json({ error: 'Nieprawidłowy ebookId.' }, { status: 400 });
    }

    // ✅ KROK 3: AUTORYZACJA (sprawdzenie uprawnień)
    const ebookOwnerCheck = await prisma.ebooks.findFirst({
      where: {
        id: ebookIdNum,
        userId: session.user.id
      },
      select: { id: true } // Tylko sprawdzamy czy istnieje
    });

    if (!ebookOwnerCheck) {
      return NextResponse.json(
        { error: 'Ebook nie został znaleziony lub nie masz uprawnień' },
        { status: 404 }
      );
    }

    console.log(`📄 Rozpoczęcie eksportu PDF dla ebooka ${ebookId}`);

    // ✅ KROK 4: DELEGACJA DO PDFGENERATOR (jedyne źródło prawdy!)
    const { pdfBuffer, ebook } = await generateEbookPdf(ebookIdNum);

    // ✅ KROK 5: ZWRÓCENIE PDF JAKO HTTP RESPONSE
    const fileName = `${ebook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('❌ Błąd podczas eksportu PDF:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas generowania PDF' },
      { status: 500 }
    );
  }
}