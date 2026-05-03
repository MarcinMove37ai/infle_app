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

const buildAssetUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads/')) {
    return `/api/assets/uploads/${path.substring('/uploads/'.length)}`;
  }
  return `/api/assets/uploads/${path}`;
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

  // Zliczanie wizyty (fire-and-forget)
  useEffect(() => {
    if (initialPageData?.id) {
      fetch('/api/pages/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: initialPageData.id }),
      }).catch(err => console.error('Błąd podczas zliczania wizyty:', err));
    }
  }, [initialPageData]);

  if (!initialPageData) {
    return <div>Błąd: Nie udało się załadować danych strony.</div>;
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

  const partnerName =
    `${initialPageData.user?.firstName || ''} ${initialPageData.user?.lastName || ''}`.trim() ||
    'Inflee';

  // 🔍 DIAGNOSTYKA — usunąć po naprawie
  console.log('🔍 user keys:', Object.keys(initialPageData.user ?? {}));
  console.log('🔍 profilePicture value:', initialPageData.user?.profilePicture);
  console.log('🔍 authorLogoUrl value:', initialPageData.user?.authorLogoUrl);

  const colorSchemeName: ColorSchemeKey = isValidColorScheme(initialPageData.color)
    ? initialPageData.color
    : 'light';

  const processedPageData = {
    ...initialPageData,
    author_logo_url: buildAssetUrl(initialPageData.user?.authorLogoUrl),
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
  const brandLogoUrl = buildAssetUrl(initialPageData.user?.authorLogoUrl);

  // Profile picture URLs — oba osobno, DemoView wybierze jaki pokazać wg activeProfileSource
  const googleProfilePicture = buildAssetUrl(initialPageData.user?.profilePicture);
  const customProfilePicture = buildAssetUrl(initialPageData.user?.customProfilePicture);

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