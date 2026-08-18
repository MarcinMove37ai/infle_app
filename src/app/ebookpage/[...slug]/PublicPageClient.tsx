"use client";

import React, { useEffect } from 'react';
import DemoView, { colorSchemes } from '@/components/views/demo';
import DemoVideo from '@/components/views/demoVideo';
import type { PageContent } from '@/types/landing-page';

// ───────────────────────────────────────────────────────────────────────────
// Typy
// ───────────────────────────────────────────────────────────────────────────

/**
 * EbookMeta — meta e-booka dla TOC i statsów (chapter count, pages count).
 * Re-eksportujemy żeby demo.tsx mógł importować bez kolizji nazw.
 */
export interface EbookMeta {
  chapterCount: number;
  estimatedPages: number;
  chapters: Array<{
    position: number;
    title: string;
    preview: string;
  }>;
}

type ColorSchemeKey = keyof typeof colorSchemes;

const isValidColorScheme = (color: any): color is ColorSchemeKey =>
  typeof color === 'string' && color in colorSchemes;

// ───────────────────────────────────────────────────────────────────────────
// Helpery
// ───────────────────────────────────────────────────────────────────────────

const buildAssetUrl = (path?: string | null, bust?: string | Date | null): string => {
  if (!path) return '';

  // NASZ asset poznajemy po ścieżce /api/assets/, NIE po tym czy URL ma host.
  // Endpointy author-settings i profile-picture zapisują do bazy pełny
  // `${baseUrl}/api/assets/...`, więc test "zaczyna się od https" wyrzucał je
  // razem z Google i gubił cache-bust — stąd logo i avatar nie reagowały na zmiany.
  const assetsIdx = path.indexOf('/api/assets/');

  // Prawdziwie zewnętrzne (Google) — bez zmian, ich URL zmienia się sam.
  if (assetsIdx === -1 && (path.startsWith('http://') || path.startsWith('https://'))) {
    return path;
  }

  // Ścinamy protokół+host → adres relatywny. Działa na app.inflee.app, na custom
  // domenie i na localhoście, niezależnie od tego, w którym środowisku powstał wiersz.
  const url =
    assetsIdx !== -1
      ? path.substring(assetsIdx)
      : path.startsWith('/uploads/')
        ? `/api/assets/uploads/${path.substring('/uploads/'.length)}`
        : `/api/assets/uploads/${path}`;

  // Assety użytkownika mają STAŁE nazwy (USER_{id}_AVATAR.png, ..._PROFILE.png).
  // Podmiana pliku nie zmienia URL-a → przeglądarka serwuje starą wersję bez końca.
  // Ten sam wzorzec co przy mockupie okładki: ?t=updated_at.
  if (bust) {
    const t = new Date(bust).getTime();
    if (!Number.isNaN(t)) return `${url}?t=${t}`;
  }
  return url;
};

/**
 * Resolve mockup URL — kaskada źródeł, fallback na wypadek gdy
 * server-side (page.tsx) nie ustawił resolvedMockupUrl.
 */
const resolveMockupUrl = (pageData: any): string => {
  if (pageData?.resolvedMockupUrl) return pageData.resolvedMockupUrl;

  const ebook = pageData?.ebook;
  const ebookUrl = ebook?.final_mockup_url || ebook?.cover_image_webp_url;
  if (ebookUrl) return buildAssetUrl(ebookUrl);

  if (pageData?.s3_file_key) return buildAssetUrl(pageData.s3_file_key);
  if (ebook?.s3_file_key) return buildAssetUrl(ebook.s3_file_key);
  if (ebook?.mockup_url) return buildAssetUrl(ebook.mockup_url);
  if (pageData?.mockup_url) return buildAssetUrl(pageData.mockup_url);

  return '';
};

/**
 * Buduje EbookMeta z ebook_chapters — używane gdy server-side ebookMeta
 * nie zostało wcześniej zbudowane (fallback).
 */
const buildEbookMeta = (ebook: any): EbookMeta => {
  const chapters = ebook?.ebook_chapters ?? [];

  let estimatedPages: number;
  if (ebook?.estimated_pages && ebook.estimated_pages > 0) {
    estimatedPages = ebook.estimated_pages;
  } else if (ebook?.total_pages && ebook.total_pages > 0) {
    estimatedPages = ebook.total_pages;
  } else if (ebook?.page_count && ebook.page_count > 0) {
    estimatedPages = ebook.page_count;
  } else {
    const totalWords = chapters.reduce(
      (acc: number, ch: any) => acc + (ch.content?.split(/\s+/).filter(Boolean).length ?? 0),
      0,
    );
    estimatedPages = Math.max(1, Math.round(totalWords / 250));
  }

  return {
    chapterCount: chapters.length,
    estimatedPages,
    chapters: chapters.map((ch: any) => ({
      position: ch.position,
      title: ch.title ?? '',
      preview: ch.content
        ? ch.content.replace(/\s+/g, ' ').trim().substring(0, 120) +
          (ch.content.length > 120 ? '…' : '')
        : '',
    })),
  };
};

// ───────────────────────────────────────────────────────────────────────────
// Komponent
// ───────────────────────────────────────────────────────────────────────────

const PublicPageClient = ({ initialPageData }: { initialPageData: any }) => {
  const language = (initialPageData?.language === 'pl' ? 'pl' : 'en') as 'pl' | 'en';

  // Zliczanie wizyty (fire-and-forget) — odpalane RAZ na cykl życia strony.
    // useRef guard zabezpiecza przed double-fetch który może wystąpić przy:
    //  - hydration mismatch
    //  - parent layout re-render
    //  - React Strict Mode (dev)
    //  - Suspense boundary remount
    // Klucz to pageId — przy nawigacji do innej strony useRef się resetuje
    // (komponent się unmount-uje), więc dla nowej strony fetch poleci normalnie.
    const visitCountedRef = React.useRef<string | null>(null);
    useEffect(() => {
      if (!initialPageData?.id) return;
      if (visitCountedRef.current === initialPageData.id) return;
      visitCountedRef.current = initialPageData.id;

      fetch('/api/pages/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: initialPageData.id }),
      }).catch(err => console.error('Visit count error:', err));
    }, [initialPageData?.id]);

  if (!initialPageData) {
    return <div>Error: Failed to load page data.</div>;
  }

  // ─── Treść strony — nowa struktura 7 sekcji jsonb prosto z bazy ───────
  // initialPageData.content jest typu PageContent (lub null jeśli treść
  // nie została jeszcze wygenerowana). Brak mapowania — przekazujemy 1:1.
  const pageContent: PageContent | null = initialPageData.content ?? null;

  // ─── Meta e-booka (TOC, stats) ─────────────────────────────────────────
  // Preferuj ebookMeta zbudowane na serwerze (page.tsx); fallback klienta.
  const ebookMeta: EbookMeta =
    initialPageData.ebookMeta ?? buildEbookMeta(initialPageData.ebook);

  // ─── Mockup okładki ────────────────────────────────────────────────────
  const mockupUrl = resolveMockupUrl(initialPageData);

  // ─── Pozostałe metadane ────────────────────────────────────────────────
  const pageType = initialPageData.type || 'ebook';

  // Imię autora wyświetlane na landingu — kaskada:
  // 1. authorDisplayName z User (publiczne imię "autora", edytowalne w Settings)
  // 2. firstName + lastName z User (legacy fallback dla kont które nie ustawiły authorDisplayName)
  // 3. 'Inflee' (ostateczny fallback gdy oba puste)
  // Spójne z `preview/[token]/page.tsx` które używa pageData.authorDisplayName.
  const partnerName =
    initialPageData.user?.authorDisplayName?.trim() ||
    `${initialPageData.user?.firstName || ''} ${initialPageData.user?.lastName || ''}`.trim() ||
    'Inflee';


  const colorSchemeName: ColorSchemeKey = isValidColorScheme(initialPageData.color)
    ? initialPageData.color
    : 'light';

  const processedPageData = {
    ...initialPageData,
    author_logo_url: buildAssetUrl(initialPageData.user?.authorLogoUrl, initialPageData.user?.updatedAt),
    resolvedMockupUrl: mockupUrl,
  };

  // ─── Header configuration z Settings → Landing Page Header Setup ──────
  // user może mieć null w bazie (legacy users przed dodaniem headerStyle).
  // Fallback: jeśli null → 'profile' gdy istnieje jakieś zdjęcie, inaczej 'none'.
  // To zachowuje aktualne zachowanie dla starych kont, dopóki nie wejdą w Settings.
  const userHeaderStyle = initialPageData.user?.headerStyle as 'profile' | 'logo' | 'none' | null;
  const userActiveSource = initialPageData.user?.activeProfileSource as 'custom' | 'google' | null;
  const hasAnyProfilePic = !!initialPageData.user?.profilePicture || !!initialPageData.user?.customProfilePicture;
  const resolvedHeaderStyle: 'profile' | 'logo' | 'none' = userHeaderStyle ?? (hasAnyProfilePic ? 'profile' : 'none');

  // Brand logo URL — pełne jak authorLogoUrl
  const brandLogoUrl = buildAssetUrl(initialPageData.user?.authorLogoUrl, initialPageData.user?.updatedAt);

  // Profile picture URLs — oba osobno, DemoView wybierze jaki pokazać wg activeProfileSource
  const googleProfilePicture = buildAssetUrl(initialPageData.user?.profilePicture);
  const customProfilePicture = buildAssetUrl(initialPageData.user?.customProfilePicture, initialPageData.user?.updatedAt);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <>
      {pageType === 'ebook' ? (
        <DemoView
          pageContent={pageContent as any}
          ebookMeta={ebookMeta}
          language={language}
          colorSchemeName={colorSchemeName}
          partnerName={partnerName}
          partnerLogoUrl={googleProfilePicture}
          visitors={initialPageData.visits || 0}
          pageId={initialPageData.id}
          pageData={processedPageData}
          isPreviewMode={false}
          // ─── NOWE: header config z user settings ──────────────────────
          headerStyle={resolvedHeaderStyle}
          activeProfileSource={userActiveSource ?? 'google'}
          googleProfilePicture={googleProfilePicture}
          customProfilePicture={customProfilePicture}
          brandLogoUrl={brandLogoUrl}
        />
      ) : (
        <DemoVideo
          pageContent={{
            title: initialPageData.content?.hero?.headline_l1 || 'Strona wideo',
            videoEmbedUrl: initialPageData.ebook?.video_embed_url || '',
            videoProvider: initialPageData.ebook?.video_provider || 'vimeo',
            description: initialPageData.content?.hero?.subheadline,
            videoThumbnailUrl: initialPageData.ebook?.video_thumbnail_url,
            ctaButtonText: initialPageData.content?.form?.cta || 'Obejrzyj teraz',
          }}
          colorSchemeName={colorSchemeName}
          partnerName={partnerName}
          pageId={initialPageData.id}
          pageData={initialPageData}
          isPreviewMode={false}
        />
      )}
    </>
  );
};

export default PublicPageClient;