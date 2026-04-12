"use client";

import React, { useEffect } from 'react';
import DemoView, { colorSchemes } from '@/components/views/demo';
import DemoVideo from '@/components/views/demoVideo';

interface PageData {
  id: string;
  status: string;
  type: string;
  color?: string;
  userId?: string;
  x_amz_meta_title: string;
  x_amz_meta_page_type: string;
  s3_file_key: string;
  author_display_name: string;
  author_logo_url: string;
  visitors?: number;
  [key: string]: any;
}

// Testimonials usunięte — nie generujemy fikcji
interface EbookPageContent {
  s3_file_key: string;
  hero: {
    headline: string;
    subheadline: string;
    description: string;
    buttonText: string;
    stats: any[];
  };
  benefits: { title: string; items: any[] };
  content: { title: string; chapters: any[] };
  form: {
    title: string;
    subtitle: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    buttonText: string;
    privacyText: string;
  };
  guarantees: { items: any[] };
  faq: { title: string; items: any[] };
}

// Metadane e-booka z ebook_chapters — do stats bara i TOC
export interface EbookMeta {
  chapterCount: number;
  estimatedPages: number;
  chapters: Array<{
    position: number;
    title: string;
    preview: string; // pierwsze ~120 znaków treści
  }>;
}

type ColorSchemeKey = keyof typeof colorSchemes;

const isValidColorScheme = (color: any): color is ColorSchemeKey => {
  return typeof color === 'string' && color in colorSchemes;
};

const buildAssetUrl = (path?: string | null): string => {
  if (!path) return "";
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads/')) {
    const filename = path.substring('/uploads/'.length);
    return `/api/assets/uploads/${filename}`;
  }
  return `/api/assets/uploads/${path}`;
};

// ---------------------------------------------------------------------------
// Resolve mockup image URL — checks multiple possible sources
// ---------------------------------------------------------------------------
const resolveMockupUrl = (pageData: any): string => {
  // 0. URL obliczony na serwerze (page.tsx) — już przetworzony, użyj wprost
  if (pageData?.resolvedMockupUrl) return pageData.resolvedMockupUrl;

  const ebook = pageData?.ebook;

  // 1. Zagnieżdżone pola ebooka (final mockup > cover webp)
  const ebookUrl = ebook?.final_mockup_url || ebook?.cover_image_webp_url;
  if (ebookUrl) return buildAssetUrl(ebookUrl);

  // 2. Płaskie pole s3_file_key (tak jak w preview)
  if (pageData?.s3_file_key) return buildAssetUrl(pageData.s3_file_key);

  // 3. Ebook s3_file_key
  if (ebook?.s3_file_key) return buildAssetUrl(ebook.s3_file_key);

  // 4. Inne możliwe lokalizacje
  if (ebook?.mockup_url) return buildAssetUrl(ebook.mockup_url);
  if (pageData?.mockup_url) return buildAssetUrl(pageData.mockup_url);

  return "";
};

// ---------------------------------------------------------------------------
// Budowanie ebookMeta z ebook_chapters
// ---------------------------------------------------------------------------
const buildEbookMeta = (ebook: any): EbookMeta => {
  const chapters = ebook?.ebook_chapters ?? [];

  // Użyj rzeczywistej liczby stron jeśli dostępna (z API/bazy),
  // w przeciwnym razie estymuj z liczby słów
  let estimatedPages: number;

  if (ebook?.estimated_pages && ebook.estimated_pages > 0) {
    // Pole z serwera — ta sama wartość co w preview
    estimatedPages = ebook.estimated_pages;
  } else if (ebook?.page_count && ebook.page_count > 0) {
    // Alternatywna nazwa pola
    estimatedPages = ebook.page_count;
  } else if (ebook?.pages && ebook.pages > 0) {
    // Jeszcze inna możliwa nazwa
    estimatedPages = ebook.pages;
  } else {
    // Fallback — estymacja z treści rozdziałów
    const totalWords = chapters.reduce((acc: number, ch: any) => {
      return acc + (ch.content?.split(/\s+/).length ?? 0);
    }, 0);
    estimatedPages = Math.max(1, Math.round(totalWords / 250));
  }

  return {
    chapterCount: chapters.length,
    estimatedPages,
    chapters: chapters.map((ch: any) => ({
      position: ch.position,
      title: ch.title ?? "",
      preview: ch.content
        ? ch.content.replace(/\s+/g, ' ').trim().substring(0, 120) + (ch.content.length > 120 ? '…' : '')
        : "",
    })),
  };
};

// ---------------------------------------------------------------------------
// Formatowanie treści strony
// ---------------------------------------------------------------------------
const formatPageContent = (pageData: PageData | any): EbookPageContent => {
  if (!pageData) throw new Error("Brak danych strony");

  const content = pageData.content || {};
  const ebook   = pageData.ebook   || {};

  // Resolve mockup URL z wielu możliwych źródeł
  const mockupUrl = resolveMockupUrl(pageData);

  return {
    s3_file_key: mockupUrl,

    hero: {
      headline:    content.hero_headline    ?? "",
      subheadline: content.hero_subheadline ?? "",
      description: content.hero_description ?? "",
      buttonText:  "",   // renderowane przez ui.heroCta w demo.tsx
      stats: ebook.ebook_chapters?.length
        ? [
            { value: String(ebook.ebook_chapters.length), label: "" },
            { value: "PDF",  label: "" },
            { value: "",     label: "" },
          ]
        : [],
    },

    benefits: {
      title: "Co zyskasz dzięki temu przewodnikowi?",
      items: [
        { title: content.benefits_item_0_title ?? "", text: content.benefits_item_0_text ?? "" },
        { title: content.benefits_item_1_title ?? "", text: content.benefits_item_1_text ?? "" },
        { title: content.benefits_item_2_title ?? "", text: content.benefits_item_2_text ?? "" },
        { title: content.benefits_item_3_title ?? "", text: content.benefits_item_3_text ?? "" },
      ],
    },

    content: {
      title: "Co znajdziesz w środku?",
      chapters: [
        { number: "01", title: content.content_chapter_0_title ?? "", description: content.content_chapter_0_description ?? "" },
        { number: "02", title: content.content_chapter_1_title ?? "", description: content.content_chapter_1_description ?? "" },
        { number: "03", title: content.content_chapter_2_title ?? "", description: content.content_chapter_2_description ?? "" },
      ],
    },

    form: {
      title:            content.form_title ?? "",
      subtitle:         "",   // ui.formLeftText
      namePlaceholder:  "",   // ui.namePlaceholder
      emailPlaceholder: "",   // ui.emailPlaceholder
      phonePlaceholder: "",   // ui.phonePlaceholder
      buttonText:       "",   // ui.formSubmitBtn
      privacyText:      "",   // ui.privacyText
    },

    guarantees: { items: [] }, // ui.guaranteeFree/NoSpam/Pdf

    faq: {
      title: "Najczęściej zadawane pytania",
      items: [
        { question: content.faq_item_0_question ?? "", answer: content.faq_item_0_answer ?? "" },
        { question: content.faq_item_1_question ?? "", answer: content.faq_item_1_answer ?? "" },
        { question: content.faq_item_2_question ?? "", answer: content.faq_item_2_answer ?? "" },
      ],
    },
  };
};

// ---------------------------------------------------------------------------
// Komponent
// ---------------------------------------------------------------------------
const PublicPageClient = ({ initialPageData }: { initialPageData: any }) => {
  // ─── HOOKS ZAWSZE NA GÓRZE — przed jakimkolwiek return ───────────────────
  const language = (initialPageData?.language === 'pl' ? 'pl' : 'en') as 'pl' | 'en';

  useEffect(() => {
    if (initialPageData?.id) {
      fetch('/api/pages/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: initialPageData.id }),
      }).catch(err => console.error("Błąd podczas zliczania wizyty:", err));
    }
  }, [initialPageData]);

  // DEBUG — loguj strukturę danych żeby zidentyfikować pola mockupu
  useEffect(() => {
    if (initialPageData?.ebook) {
      console.log('[PublicPageClient] ebook fields:', {
        final_mockup_url: initialPageData.ebook.final_mockup_url,
        cover_image_webp_url: initialPageData.ebook.cover_image_webp_url,
        s3_file_key: initialPageData.ebook.s3_file_key,
        mockup_url: initialPageData.ebook.mockup_url,
        estimated_pages: initialPageData.ebook.estimated_pages,
        page_count: initialPageData.ebook.page_count,
        pages: initialPageData.ebook.pages,
      });
      console.log('[PublicPageClient] top-level s3_file_key:', initialPageData.s3_file_key);
      console.log('[PublicPageClient] resolved mockup URL:', resolveMockupUrl(initialPageData));
    }
  }, [initialPageData]);
  // ─────────────────────────────────────────────────────────────────────────

  if (!initialPageData) {
    return <div>Błąd: Nie udało się załadować danych strony.</div>;
  }

  const pageContent = formatPageContent(initialPageData);

  // Preferuj ebookMeta obliczone na serwerze (page.tsx),
  // fallback na kliencką estymację
  const ebookMeta   = initialPageData.ebookMeta ?? buildEbookMeta(initialPageData.ebook);

  const pageType    = initialPageData.type || 'ebook';

  const partnerName = `${initialPageData.user?.firstName || ''} ${initialPageData.user?.lastName || ''}`.trim() || "Omega Zdrowie";

  const colorSchemeName: ColorSchemeKey = isValidColorScheme(initialPageData.color)
    ? initialPageData.color
    : 'harmonia';

  const processedPageData = {
    ...initialPageData,
    author_logo_url: buildAssetUrl(initialPageData.user?.authorLogoUrl),
  };

  return (
    <>
      {pageType === 'ebook' ? (
        <DemoView
          pageContent={pageContent}
          ebookMeta={ebookMeta}
          language={language}
          colorSchemeName={colorSchemeName}
          partnerName={partnerName}
          visitors={initialPageData.visits || 0}
          pageId={initialPageData.id}
          pageData={processedPageData}
          isPreviewMode={false}
        />
      ) : (
        <DemoVideo
          pageContent={{
            title:            initialPageData.content?.hero_headline || "Strona wideo",
            videoEmbedUrl:    initialPageData.ebook?.video_embed_url || "",
            videoProvider:    initialPageData.ebook?.video_provider || "vimeo",
            description:      initialPageData.content?.hero_description,
            videoThumbnailUrl: initialPageData.ebook?.video_thumbnail_url,
            ctaButtonText:    initialPageData.content?.cta_button_text || "Obejrzyj teraz",
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