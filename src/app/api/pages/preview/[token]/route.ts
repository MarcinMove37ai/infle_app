// src/app/api/pages/preview/[token]/route.ts
//
// Preview endpoint dla strony zapisu (LP).
//
// Zwraca pełen kontekst potrzebny do renderowania LP:
//   - metadata strony (id, title, status, language, autor)
//   - pageContent: 7 sekcji jsonb (hero, problem, promise, benefits, content, form, faq)
//   - ebook: mockup + TOC (rozdziały z preview)
//
// Dostęp:
//   - ?view_mode=preview  → bez auth (kto zna token, ten widzi)
//   - bez parametru       → wymaga zalogowanego użytkownika
//
// Token to nanoid(10) z draft_url postaci "/preview/{token}".

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assetUrl } from '@/lib/asset-url';

// ─── Helpery ──────────────────────────────────────────────────────────────

// Wspólny, idempotentny helper — patrz src/lib/asset-url.ts.
// Stara lokalna kopia kończyła się catch-allem `/api/assets/uploads/${path}`, który
// doklejał prefiks do ścieżek już go mających, i nie umiała doklejać cache-bustu.
const buildAssetUrl = assetUrl;

/** Zwraca pierwsze N znaków treści rozdziału z normalizacją whitespace + ellipsis. */
function makeChapterPreview(content: string | null | undefined, maxLen = 120): string {
  if (!content) return '';
  const trimmed = content.replace(/\s+/g, ' ').trim();
  return trimmed.length > maxLen ? trimmed.substring(0, maxLen) + '…' : trimmed;
}

/** Estymuje liczbę stron e-booka — używa total_pages jeśli istnieje, w przeciwnym razie ze średniej 250 słów na stronę. */
function estimatePages(totalPages: number | null | undefined, chapters: Array<{ content: string | null }>): number {
  if (totalPages && totalPages > 0) return totalPages;
  const totalWords = chapters.reduce(
    (acc, ch) => acc + (ch.content?.split(/\s+/).filter(Boolean).length ?? 0),
    0,
  );
  return Math.max(1, Math.round(totalWords / 250));
}

// ─── GET ──────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const isPreviewMode = request.nextUrl.searchParams.get('view_mode') === 'preview';

  if (!token) {
    return NextResponse.json({ error: 'Nie podano tokenu' }, { status: 400 });
  }

  // Auth — pomijamy w view_mode=preview (token sam jest zabezpieczeniem)
  if (!isPreviewMode) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Użytkownik niezalogowany' }, { status: 401 });
    }
  }

  try {
    const draftUrl = `/preview/${token}`;

    const page = await prisma.pages.findFirst({
      where: { draft_url: draftUrl },
      include: {
        content: true,
        ebook: {
          include: {
            ebook_chapters: { orderBy: { position: 'asc' } },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            authorDisplayName: true,
            authorLogoUrl: true,
            profilePicture: true,
            // ─── Header configuration (z Settings → Landing Page Header Setup) ───
            // headerStyle: 'profile' | 'logo' | 'none' — co user wybrał w toggle'ach
            // activeProfileSource: 'custom' | 'google' — gdy ma oba, które pokazujemy
            // customProfilePicture: URL wgranego custom (Google original jest już w profilePicture wyżej)
            headerStyle: true,
            activeProfileSource: true,
            customProfilePicture: true,
            // Źródło cache-bustu dla logo i avatara — pliki mają stałe nazwy,
            // więc bez tego podgląd pokazuje wersję sprzed zmiany w Settings.
            updatedAt: true,
          },
        },
      },
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Nie znaleziono strony dla podanego tokenu' },
        { status: 404 },
      );
    }

    // ─── Autor — preferuj ebook.authorDisplayName, fallback do User ─────
    const authorDisplayName =
      (page.ebook as any)?.authorDisplayName ||
      page.user?.authorDisplayName ||
      [page.user?.firstName, page.user?.lastName].filter(Boolean).join(' ') ||
      null;

    const authorLogoUrl =
      (page.ebook as any)?.authorLogoUrl ||
      page.user?.authorLogoUrl ||
      null;

    // ─── E-book + TOC ───────────────────────────────────────────────────
    const ebook = page.ebook;
    const chapters = ebook?.ebook_chapters ?? [];
    const estimatedPages = ebook ? estimatePages(ebook.total_pages, chapters) : 0;

    // ─── Mockup URL — kaskada źródeł ─────────────────────────────────────
    const mockupCandidate =
      ebook?.final_mockup_url ||
      ebook?.cover_image_webp_url ||
      page.s3_file_key ||
      null;

    // Cache-bust na updated_at ebooka — plik mockupu (_finalMOK.png) ma stałą
    // nazwę, więc bez tego /_next/image serwuje starą zbuforowaną wersję po
    // regeneracji okładki. ?t=updated_at zmienia URL źródłowy → świeży obraz.
    const mockupBust = ebook?.updated_at ? new Date(ebook.updated_at).getTime() : '';
    const resolvedMockup = mockupCandidate
      ? (() => {
          const base = buildAssetUrl(mockupCandidate);
          if (!base || !mockupBust) return base;
          return `${base}${base.includes('?') ? '&' : '?'}t=${mockupBust}`;
        })()
      : '';

    // ─── Response ───────────────────────────────────────────────────────
    return NextResponse.json({
      // Metadata strony
      id: page.id,
      title: page.title,
      status: page.status,
      type: page.type,
      language: page.language ?? 'pl',
      color: page.color,
      url: page.url,
      draft_url: page.draft_url,
      visitors: page.visits ?? 0,
      userId: page.userId,
      ebookId: page.ebookId,
      authorDisplayName,
      // Cache-bust na updatedAt usera. Google (URL zewnętrzny) go nie potrzebuje —
      // jego adres zmienia się sam przy podmianie zdjęcia.
      authorLogoUrl: buildAssetUrl(authorLogoUrl, page.user?.updatedAt),
      profilePicture: buildAssetUrl(page.user?.profilePicture),
      userUpdatedAt: page.user?.updatedAt ?? null,

      // ─── Header configuration — Landing Page Header Setup z Settings ───────
      // Frontend (DemoView) używa tych pól żeby zdecydować co pokazać w nagłówku LP:
      //   • headerStyle === 'profile' → avatar (custom lub Google wg activeProfileSource) + podpis
      //   • headerStyle === 'logo'    → tylko brand logo (authorLogoUrl, bez podpisu)
      //   • headerStyle === 'none'    → tylko podpis "made by X with inflee.app"
      // Fallback dla legacy users (null w bazie) → 'profile' jeśli ma profilePicture, inaczej 'none'
      headerStyle: page.user?.headerStyle ?? null,
      activeProfileSource: page.user?.activeProfileSource ?? null,
      customProfilePicture: buildAssetUrl(page.user?.customProfilePicture, page.user?.updatedAt),

      // Treść strony (nowy schemat — 7 sekcji jsonb)
      pageContent: page.content
        ? {
            id: page.content.id,
            schema_version: page.content.schema_version,
            hero: page.content.hero,
            problem: page.content.problem,
            promise: page.content.promise,
            benefits: page.content.benefits,
            content: page.content.content,
            form: page.content.form,
            faq: page.content.faq,
            createdAt: page.content.createdAt,
            updatedAt: page.content.updatedAt,
          }
        : null,

      // E-book — okładka + spis treści
      ebook: ebook
        ? {
            id: ebook.id,
            title: ebook.title,
            subtitle: ebook.subtitle,
            total_pages: ebook.total_pages,
            estimatedPages,
            chapterCount: chapters.length,
            chapters: chapters.map(ch => ({
              position: ch.position,
              title: ch.title ?? '',
              preview: makeChapterPreview(ch.content),
            })),
          }
        : null,

      // Resolved mockup URL — gotowy do wstawienia w <Image src={...} />
      resolvedMockupUrl: resolvedMockup,
    });
  } catch (error) {
    console.error('[preview] Błąd:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas pobierania danych strony' },
      { status: 500 },
    );
  }
}