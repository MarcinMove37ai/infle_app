// src/app/api/pages/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Weryfikacja sesji i uprawnień użytkownika
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // Await params to get the actual parameters
    const resolvedParams = await params;
    const pageId = resolvedParams.id;
    const changes = await request.json();
    const userId = session.user.id;
    const userRole = (session.user as any)?.role || 'USER';

    // 2. Weryfikacja, czy strona istnieje i czy użytkownik ma do niej dostęp
    const page = await prisma.pages.findFirst({
      where: {
        id: pageId,
        ...(userRole !== 'admin' ? { userId: userId } : {}),
      },
      include: {
        content: {
          select: { id: true }
        }
      }
    });

    if (!page) {
      return NextResponse.json({ error: 'Nie znaleziono strony lub brak dostępu' }, { status: 404 });
    }

    // 3. Rozdzielenie zmian na te dla tabeli `pages` i `page_content`
    const pageUpdates: Record<string, any> = {};
    const contentUpdates: Record<string, any> = {};

    for (const key in changes) {
      if (key.startsWith('pagecontent_')) {
        const dbKey = key.replace('pagecontent_', '');
        contentUpdates[dbKey] = changes[key];
      } else if (key === 'color' || key === 'status' || key === 'url') {
        pageUpdates[key] = changes[key];
      }
    }

    // 4. Użycie transakcji do atomowego zapisu zmian w obu tabelach
    const transactionOperations = [];

    if (Object.keys(pageUpdates).length > 0) {
      transactionOperations.push(
        prisma.pages.update({
          where: { id: pageId },
          data: pageUpdates,
        })
      );
    }

    if (Object.keys(contentUpdates).length > 0 && page.content?.id) {
      transactionOperations.push(
        prisma.page_content.update({
          where: { id: page.content.id },
          data: contentUpdates,
        })
      );
    }

    // Jeśli są jakiekolwiek operacje do wykonania, uruchom transakcję
    if (transactionOperations.length > 0) {
      await prisma.$transaction(transactionOperations);
    }

    // 5. Zwrócenie zaktualizowanych danych strony
    const updatedPage = await prisma.pages.findUnique({
      where: { id: pageId }
    });

    return NextResponse.json(updatedPage);

  } catch (error) {
    console.error('Błąd podczas aktualizacji strony:', error);
    return NextResponse.json({ error: 'Wystąpił błąd serwera podczas zapisywania zmian' }, { status: 500 });
  }
}