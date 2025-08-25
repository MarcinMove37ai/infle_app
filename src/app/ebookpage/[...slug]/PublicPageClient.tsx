"use client";

import React from 'react';
import DemoView, { colorSchemes } from '@/components/views/demo';
import DemoVideo from '@/components/views/demoVideo';

// Interfejsy i typy (bez zmian)
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
  [key: string]: any; // Pozwala na dostęp do dynamicznych pól
}

interface EbookPageContent {
  s3_file_key: string;
  hero: { headline: string; subheadline: string; description: string; buttonText: string; stats: any[] };
  benefits: { title: string; items: any[] };
  testimonials: { title: string; items: any[] };
  content: { title: string; chapters: any[] };
  form: { title: string; subtitle: string; namePlaceholder: string; emailPlaceholder: string; phonePlaceholder: string; buttonText: string; privacyText: string; };
  guarantees: { items: any[] };
  faq: { title: string; items: any[] };
}

// ====================================================================================
// DODANO: Typ dla kluczy colorSchemes
// ====================================================================================
type ColorSchemeKey = keyof typeof colorSchemes;

// Funkcja pomocnicza do sprawdzania czy kolor jest prawidłowym kluczem
const isValidColorScheme = (color: any): color is ColorSchemeKey => {
  return typeof color === 'string' && color in colorSchemes;
};
// ====================================================================================

// ====================================================================================
// NOWA FUNKCJA DO BUDOWANIA POPRAWNYCH URL-I
// ====================================================================================
/**
 * Tworzy pełny, publiczny URL do zasobu (obrazka) na podstawie jego ścieżki.
 * Jeśli ścieżka zaczyna się od "/uploads", dodaje prefix "/api/assets".
 * @param path Ścieżka do pliku (może być pusta lub null).
 * @returns Poprawny, publicznie dostępny URL do zasobu.
 */
const buildAssetUrl = (path?: string | null): string => {
  if (!path) {
    return ""; // Zwróć pusty string, jeśli ścieżka nie istnieje
  }
  // Sprawdź, czy to nasza lokalna ścieżka do uploadu
  if (path.startsWith('/uploads/')) {
    return `/api/assets${path}`;
  }
  // Jeśli to już jest pełny URL (np. z innego serwera), zwróć go bez zmian
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // W każdym innym przypadku zwróć oryginalną ścieżkę
  return path;
};
// ====================================================================================


/**
 * Zaktualizowana funkcja formatująca, używająca buildAssetUrl.
 */
const formatPageContent = (pageData: PageData | any): EbookPageContent => {
  if (!pageData) throw new Error("Brak danych strony");

  const content = pageData.content || {};
  const ebook = pageData.ebook || {};

  return {
    // Używamy nowej funkcji do zbudowania poprawnego URL-a dla mockupu
    s3_file_key: buildAssetUrl(ebook.final_mockup_url || ebook.cover_image_url),
    hero: {
      headline: content.hero_headline ?? "",
      subheadline: content.hero_subheadline ?? "",
      description: content.hero_description ?? "",
      buttonText: "Pobierz bezpłatny e-book",
      stats: [
        { value: "10,000+", label: "czytelników" },
        { value: "4.9/5", label: "ocena" },
        { value: "100%", label: "satysfakcji" }
      ]
    },
    benefits: {
      title: "Co zyskasz dzięki temu przewodnikowi?",
      items: [
        { title: content.benefits_item_0_title ?? "", text: content.benefits_item_0_text ?? "" },
        { title: content.benefits_item_1_title ?? "", text: content.benefits_item_1_text ?? "" },
        { title: content.benefits_item_2_title ?? "", text: content.benefits_item_2_text ?? "" },
        { title: content.benefits_item_3_title ?? "", text: content.benefits_item_3_text ?? "" }
      ]
    },
    testimonials: {
      title: "Opinie czytelników",
      items: [
        { avatar: "", text: content.testimonials_item_0_text ?? "", author: content.testimonials_item_0_author ?? "", role: content.testimonials_item_0_role ?? "", rating: 5 },
        { avatar: "", text: content.testimonials_item_1_text ?? "", author: content.testimonials_item_1_author ?? "", role: content.testimonials_item_1_role ?? "", rating: 5 },
        { avatar: "", text: content.testimonials_item_2_text ?? "", author: content.testimonials_item_2_author ?? "", role: content.testimonials_item_2_role ?? "", rating: 5 }
      ]
    },
    content: {
      title: "Co znajdziesz w środku?",
      chapters: [
        { number: "01", title: content.content_chapter_0_title ?? "", description: content.content_chapter_0_description ?? "" },
        { number: "02", title: content.content_chapter_1_title ?? "", description: content.content_chapter_1_description ?? "" },
        { number: "03", title: content.content_chapter_2_title ?? "", description: content.content_chapter_2_description ?? "" }
      ]
    },
    form: {
      title: content.form_title ?? "Pobierz bezpłatny e-book już teraz",
      subtitle: "Uzupełnij poniższy formularz, aby otrzymać e-book",
      namePlaceholder: "Twoje imię",
      emailPlaceholder: "Twój adres e-mail",
      phonePlaceholder: "Twój numer telefonu (opcjonalnie)",
      buttonText: "Wyślij mi e-book",
      privacyText: "Twoje dane są bezpieczne. Zapoznaj się z polityką prywatności."
    },
    guarantees: {
      items: [
        { text: "Sprawdzone badania naukowe" },
        { text: "Aktualizacja 2025" },
        { text: "Bezpieczne porady" }
      ]
    },
    faq: {
      title: "Najczęściej zadawane pytania",
      items: [
        { question: content.faq_item_0_question ?? "", answer: content.faq_item_0_answer ?? "" },
        { question: content.faq_item_1_question ?? "", answer: content.faq_item_1_answer ?? "" },
        { question: content.faq_item_2_question ?? "", answer: content.faq_item_2_answer ?? "" }
      ]
    }
  };
};

const PublicPageClient = ({ initialPageData }: { initialPageData: any }) => {
  if (!initialPageData) {
    return <div>Błąd: Nie udało się załadować danych strony.</div>;
  }

  const pageContent = formatPageContent(initialPageData);
  const pageType = initialPageData.type || 'ebook';

  const partnerName = `${initialPageData.user?.firstName || ''} ${initialPageData.user?.lastName || ''}`.trim() || "Omega Zdrowie";

  // ====================================================================================
  // POPRAWKA: Bezpieczne sprawdzanie i wybór schematu kolorów
  // ====================================================================================
  const colorSchemeName: ColorSchemeKey = isValidColorScheme(initialPageData.color)
    ? initialPageData.color
    : 'harmonia';
  // ====================================================================================

  // Przygotowujemy obiekt `pageData` dla DemoView, używając nowej funkcji dla logo
  const processedPageData = {
    ...initialPageData,
    author_logo_url: buildAssetUrl(initialPageData.user?.authorLogoUrl),
  };

  return (
    <>
      {pageType === 'ebook' ? (
        <DemoView
          pageContent={pageContent}
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
              title: initialPageData.content?.hero_headline || "Strona wideo",
              videoEmbedUrl: initialPageData.ebook?.video_embed_url || "",
              videoProvider: initialPageData.ebook?.video_provider || "vimeo",
              description: initialPageData.content?.hero_description,
              videoThumbnailUrl: initialPageData.ebook?.video_thumbnail_url,
              ctaButtonText: initialPageData.content?.cta_button_text || "Obejrzyj teraz"
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