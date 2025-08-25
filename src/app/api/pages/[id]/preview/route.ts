// src/app/api/pages/[id]/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// W Next.js 15, params są teraz asynchroniczne
interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * @method POST
 * @description Generuje lub zwraca istniejący link do podglądu dla strony.
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rozwiąż Promise dla params
    const resolvedParams = await params;
    const pageId = resolvedParams.id;
    const userId = session.user.id;
    const userRole = (session.user as any)?.role || 'USER';

    // Pobierz stronę, weryfikując uprawnienia.
    const page = await prisma.pages.findFirst({
      where: {
        id: pageId,
        // Użytkownik niebędący adminem może zarządzać tylko swoimi stronami.
        ...(userRole !== 'admin' ? { userId: userId } : {}),
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found or access denied' },
        { status: 404 }
      );
    }

    // Jeśli link do podglądu już istnieje, zwróć go.
    if (page.draft_url) {
      return NextResponse.json({
        success: true,
        draft_url: page.draft_url,
        preview_url: `${
          process.env.NEXTAUTH_URL || 'http://localhost:3000'
        }${page.draft_url}?view_mode=preview`,
        message: 'Using existing preview link',
      });
    }

    // Jeśli link nie istnieje, wygeneruj nowy unikalny token.
    const token = nanoid(10);
    const draft_url = `/preview/${token}`;

    // Zapisz nowy link w bazie danych.
    await prisma.pages.update({
      where: { id: pageId },
      data: { draft_url },
    });

    return NextResponse.json({
      success: true,
      draft_url: draft_url,
      preview_url: `${
        process.env.NEXTAUTH_URL || 'http://localhost:3000'
      }${draft_url}?view_mode=preview`,
      message: 'Preview link generated successfully',
    });
  } catch (error) {
    console.error('Error generating preview link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * @method GET
 * @description Pobiera istniejący link do podglądu dla strony.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rozwiąż Promise dla params
    const resolvedParams = await params;
    const pageId = resolvedParams.id;
    const userId = session.user.id;
    const userRole = (session.user as any)?.role || 'USER';

    // Pobierz stronę, weryfikując uprawnienia.
    const page = await prisma.pages.findFirst({
      where: {
        id: pageId,
        ...(userRole !== 'admin' ? { userId: userId } : {}),
      },
      select: {
        id: true,
        draft_url: true,
        title: true,
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found or access denied' },
        { status: 404 }
      );
    }

    // Jeśli strona nie ma linku do podglądu.
    if (!page.draft_url) {
      return NextResponse.json({
        success: false,
        has_preview: false,
        message: 'No preview link exists for this page',
      });
    }

    // Zwróć istniejący link.
    return NextResponse.json({
      success: true,
      has_preview: true,
      draft_url: page.draft_url,
      preview_url: `${
        process.env.NEXTAUTH_URL || 'http://localhost:3000'
      }${page.draft_url}?view_mode=preview`,
    });
  } catch (error) {
    console.error('Error fetching preview link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}