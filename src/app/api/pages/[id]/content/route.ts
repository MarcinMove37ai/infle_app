// src/app/api/pages/[id]/content/route.ts
//
// Endpoint do edycji treści LP — atomic update pojedynczego pola
// w jednej z 7 kolumn jsonb (hero, problem, promise, benefits, content, form, faq).
//
// PATCH body:
//   {
//     "path": ["hero", "headline_l1"],              // edycja prostego pola
//     "value": "Nowy tytuł"
//   }
//   {
//     "path": ["benefits", "items", 2, "title"],    // edycja w tablicy
//     "value": "Nowy tytuł benefitu"
//   }
//   {
//     "path": ["hero", "barriers", 0],              // edycja stringu w tablicy
//     "value": "Bez kupowania drogiego oprogramowania"
//   }
//
// Charakterystyka:
//   - Atomic: korzysta z PostgreSQL jsonb_set, bez read-modify-write
//   - Bezkolizyjne: równoległe edycje różnych pól nie blokują się wzajemnie
//   - Authorization: tylko właściciel strony lub admin
//   - Walidacja: path musi zaczynać się od dozwolonej sekcji, value musi być stringiem
//
// GET (bonus): pobiera pageContent po pageId (dla wewnętrznych wywołań edytora).
// Publiczny widok LP korzysta z /api/pages/preview/[token].

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { SECTION_NAMES, isSectionName, type SectionName } from '@/types/landing-page';

// ─── Stałe lokalne ────────────────────────────────────────────────────────

/** Maksymalna głębokość ścieżki — chroni przed nadużyciem. */
const MAX_PATH_DEPTH = 6;

/** Maksymalna długość wartości (string) — chroni przed wstawianiem ogromnych payloadów. */
const MAX_VALUE_LENGTH = 5000;

// ─── Helpery ──────────────────────────────────────────────────────────────

/**
 * Konstruuje literał PostgreSQL `text[]` dla jsonb_set, np. ['items', 2, 'title']
 * → '{items,2,title}'. Walidacja per-element: tylko alfanumeryczne stringi i liczby.
 * Zwraca null jeśli ścieżka zawiera nielegalne znaki.
 */
function buildJsonbPathLiteral(subPath: Array<string | number>): string | null {
  const parts: string[] = [];
  for (const p of subPath) {
    if (typeof p === 'number') {
      if (!Number.isInteger(p) || p < 0 || p > 1000) return null;
      parts.push(String(p));
    } else if (typeof p === 'string') {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p)) return null;
      parts.push(p);
    } else {
      return null;
    }
  }
  return `{${parts.join(',')}}`;
}

/**
 * Sprawdza czy zalogowany użytkownik ma uprawnienia do edycji strony.
 * Tylko właściciel (page.userId === session.user.id) lub admin.
 */
async function authorizePageEdit(pageId: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Brak autoryzacji' };
  }

  const page = await prisma.pages.findUnique({
    where: { id: pageId },
    select: { id: true, userId: true },
  });

  if (!page) {
    return { ok: false, status: 404, error: 'Strona nie istnieje' };
  }

  const userRole = (session.user as any).role;
  const isOwner = page.userId === session.user.id;
  const isAdmin = userRole === 'admin';

  if (!isOwner && !isAdmin) {
    return { ok: false, status: 403, error: 'Brak uprawnień do edycji tej strony' };
  }

  return { ok: true, userId: session.user.id };
}

// ─── PATCH ────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: pageId } = await params;
    if (!pageId) {
      return NextResponse.json({ error: 'Brak pageId' }, { status: 400 });
    }

    // ─── Auth ────────────────────────────────────────────────────────────
    const auth = await authorizePageEdit(pageId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // ─── Parsuj body ────────────────────────────────────────────────────
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Niepoprawny JSON w body' }, { status: 400 });
    }

    const { path, value } = body as { path?: unknown; value?: unknown };

    // ─── Walidacja path ──────────────────────────────────────────────────
    if (!Array.isArray(path) || path.length === 0) {
      return NextResponse.json(
        { error: 'Pole "path" musi być niepustą tablicą' },
        { status: 400 },
      );
    }
    if (path.length > MAX_PATH_DEPTH) {
      return NextResponse.json(
        { error: `Ścieżka za głęboka (max ${MAX_PATH_DEPTH} elementów)` },
        { status: 400 },
      );
    }

    const [section, ...subPath] = path;
    if (!isSectionName(section)) {
      return NextResponse.json(
        {
          error: `Pierwszy element path musi być nazwą sekcji. Dozwolone: ${SECTION_NAMES.join(', ')}`,
        },
        { status: 400 },
      );
    }
    // section jest teraz typu SectionName (zawężone przez type guard)
    const sectionName: SectionName = section;

    // ─── Walidacja value ─────────────────────────────────────────────────
    if (typeof value !== 'string') {
      return NextResponse.json(
        { error: 'Pole "value" musi być stringiem (edytujemy teksty)' },
        { status: 400 },
      );
    }
    if (value.length > MAX_VALUE_LENGTH) {
      return NextResponse.json(
        { error: `Wartość za długa (max ${MAX_VALUE_LENGTH} znaków)` },
        { status: 400 },
      );
    }

    // ─── Special case: edycja całej sekcji jako jednego stringu ─────────
    // Nie pozwalamy — sekcje to obiekty, nie stringi. Path musi mieć min. 2 elementy.
    if (subPath.length === 0) {
      return NextResponse.json(
        { error: 'Path musi wskazywać konkretne pole wewnątrz sekcji (np. ["hero", "headline_l1"])' },
        { status: 400 },
      );
    }

    // ─── Buduj literał ścieżki dla jsonb_set ─────────────────────────────
    const pathLiteral = buildJsonbPathLiteral(subPath as Array<string | number>);
    if (!pathLiteral) {
      return NextResponse.json(
        { error: 'Path zawiera nielegalne znaki — dozwolone tylko alfanumeryczne klucze i indeksy 0-1000' },
        { status: 400 },
      );
    }

    // ─── Sprawdź czy page_content istnieje + czy ścieżka prowadzi do istniejącego pola ──
    const existing = await prisma.page_content.findUnique({
      where: { pageId },
      select: { id: true, [sectionName]: true } as any,
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Strona nie ma jeszcze wygenerowanej treści' },
        { status: 404 },
      );
    }

    const sectionData = (existing as any)[sectionName];
    if (sectionData == null) {
      return NextResponse.json(
        { error: `Sekcja "${sectionName}" nie ma jeszcze danych — wygeneruj treść AI najpierw` },
        { status: 400 },
      );
    }

    // Sprawdź czy ścieżka faktycznie prowadzi do istniejącego pola
    // (zapobiega tworzeniu nowych pól przez PATCH)
    let cursor: any = sectionData;
    for (let i = 0; i < subPath.length - 1; i++) {
      const key = subPath[i];
      if (cursor == null || typeof cursor !== 'object') {
        return NextResponse.json(
          { error: `Path nie prowadzi do istniejącego pola: zatrzymane na [${path.slice(0, i + 1).join('.')}]` },
          { status: 400 },
        );
      }
      cursor = cursor[key as any];
    }
    const lastKey = subPath[subPath.length - 1];
    if (cursor == null || typeof cursor !== 'object' || !(lastKey in cursor)) {
      return NextResponse.json(
        { error: `Path nie prowadzi do istniejącego pola: ${path.join('.')}` },
        { status: 400 },
      );
    }

    // ─── Atomic update przez raw SQL z jsonb_set ─────────────────────────
    // Bezpieczne — nazwa kolumny pochodzi z whitelisty (SECTION_NAMES),
    // pathLiteral zwalidowane, value przekazane jako parametr.
    const valueJson = JSON.stringify(value);

    const result = await prisma.$queryRaw<Array<{ updated_section: any; updatedAt: Date }>>(
      Prisma.sql`
        UPDATE page_contents
        SET
          ${Prisma.raw(`"${sectionName}"`)} = jsonb_set(
            ${Prisma.raw(`"${sectionName}"`)},
            ${pathLiteral}::text[],
            ${valueJson}::jsonb,
            false
          ),
          "updatedAt" = NOW()
        WHERE "pageId" = ${pageId}
        RETURNING ${Prisma.raw(`"${sectionName}"`)} AS updated_section, "updatedAt"
      `,
    );

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Aktualizacja nie powiodła się' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      pageId,
      section: sectionName,
      path,
      value,
      updatedAt: result[0].updatedAt,
      updatedSection: result[0].updated_section,
    });
  } catch (error) {
    console.error('[content PATCH] Błąd:', error);
    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────
// Pobiera pageContent po pageId — dla wewnętrznych wywołań edytora.
// Publiczny widok LP używa /api/pages/preview/[token].

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: pageId } = await params;
    if (!pageId) {
      return NextResponse.json({ error: 'Brak pageId' }, { status: 400 });
    }

    const auth = await authorizePageEdit(pageId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const pageContent = await prisma.page_content.findUnique({
      where: { pageId },
    });

    if (!pageContent) {
      return NextResponse.json(
        { error: 'Strona nie ma jeszcze wygenerowanej treści' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      id: pageContent.id,
      pageId: pageContent.pageId,
      schema_version: pageContent.schema_version,
      hero: pageContent.hero,
      problem: pageContent.problem,
      promise: pageContent.promise,
      benefits: pageContent.benefits,
      content: pageContent.content,
      form: pageContent.form,
      faq: pageContent.faq,
      createdAt: pageContent.createdAt,
      updatedAt: pageContent.updatedAt,
    });
  } catch (error) {
    console.error('[content GET] Błąd:', error);
    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}