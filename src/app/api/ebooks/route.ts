// src/app/api/ebooks/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Obsługa tworzenia nowego ebooka (POST)
 * Wersja zaadaptowana do infle_app z minimalnymi zmianami.
 */
export async function POST(request: Request) {
  try {
    // --- ZMIANA 1: Uwierzytelnianie ---
    // Zamiast czytać nagłówki, pobieramy dane zalogowanego użytkownika z sesji.
    // To jest standard w infle_app.
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    // Pobierz dane z żądania (logika pozostaje bez zmian)
    const data = await request.json();
    const { title, subtitle } = data;

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    console.log(`Creating new ebook: "${title}"${subtitle ? ` with subtitle: "${subtitle}"` : ''} for user ID=${userId}`);

    // --- ZMIANA 2: Zapis do bazy danych ---
    // Zamiast klienta 'pg' i surowego SQL, używamy Prisma Client.
    // Jest to konieczne, ponieważ tak skonfigurowana jest nowa aplikacja.
    // Zapisujemy tylko kluczowe informacje. Reszta danych użytkownika jest
    // bezpiecznie przechowywana w tabeli User i powiązana przez `userId`.
    const newEbook = await prisma.ebooks.create({
      data: {
        title: title,
        subtitle: subtitle || null,
        userId: userId, // Powiązanie z użytkownikiem przez jego ID z sesji
        // UWAGA: Celowo nie kopiujemy pól x_amz_meta_*, ponieważ w nowym schemacie
        // mamy bezpośrednią relację do użytkownika, co jest czystszym rozwiązaniem.
        // Logika pozostaje ta sama: tworzymy ebook powiązany z użytkownikiem.
      },
      select: {
        id: true, // Zwracamy tylko ID, tak jak w oryginalnym kodzie
      },
    });

    console.log(`Ebook created successfully with ID=${newEbook.id}`);

    return NextResponse.json({
      success: true,
      ebookId: newEbook.id,
    });
  } catch (error) {
    console.error('Error creating ebook:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while creating the ebook',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
  // `finally` z `client.end()` nie jest już potrzebne, Prisma zarządza tym za nas.
}