// src/app/preview/[token]/page.tsx
"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertCircle, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import DemoView, { colorSchemes } from '@/components/views/demo';
import DemoVideo from '@/components/views/demoVideo';

// Interface dla danych strony z API
interface PageData {
  id: string;
  status: string;
  type: string;
  x_amz_meta_title: string;
  x_amz_meta_page_type: string;
  s3_file_key: string;
  author_display_name: string;
  author_logo_url: string;

  // Wszystkie pola zawartości strony
  pagecontent_hero_headline?: string;
  pagecontent_hero_subheadline?: string;
  pagecontent_hero_description?: string;
  pagecontent_benefits_items_0_title?: string;
  pagecontent_benefits_items_0_text?: string;
  pagecontent_benefits_items_1_title?: string;
  pagecontent_benefits_items_1_text?: string;
  pagecontent_benefits_items_2_title?: string;
  pagecontent_benefits_items_2_text?: string;
  pagecontent_benefits_items_3_title?: string;
  pagecontent_benefits_items_3_text?: string;
  pagecontent_testimonials_items_0_text?: string;
  pagecontent_testimonials_items_0_author?: string;
  pagecontent_testimonials_items_0_role?: string;
  pagecontent_testimonials_items_1_text?: string;
  pagecontent_testimonials_items_1_author?: string;
  pagecontent_testimonials_items_1_role?: string;
  pagecontent_testimonials_items_2_text?: string;
  pagecontent_testimonials_items_2_author?: string;
  pagecontent_testimonials_items_2_role?: string;
  pagecontent_content_chapters_0_title?: string;
  pagecontent_content_chapters_0_description?: string;
  pagecontent_content_chapters_1_title?: string;
  pagecontent_content_chapters_1_description?: string;
  pagecontent_content_chapters_2_title?: string;
  pagecontent_content_chapters_2_description?: string;
  pagecontent_form_title?: string;
  pagecontent_faq_items_0_question?: string;
  pagecontent_faq_items_0_answer?: string;
  pagecontent_faq_items_1_question?: string;
  pagecontent_faq_items_1_answer?: string;
  pagecontent_faq_items_2_question?: string;
  pagecontent_faq_items_2_answer?: string;
}

// Interfejsy dla komponentów renderowania (bez zmian)
interface PageContent {
  s3_file_key: string;
  hero: {
    headline: string;
    subheadline: string;
    description: string;
    buttonText: string;
    stats: Array<{ value: string; label: string }>;
  };
  benefits: {
    title: string;
    items: Array<{ title: string; text: string }>;
  };
  testimonials: {
    title: string;
    items: Array<{
      avatar: string;
      text: string;
      author: string;
      role: string;
      rating: number;
    }>;
  };
  content: {
    title: string;
    chapters: Array<{
      number: string;
      title: string;
      description: string;
    }>;
  };
  form: {
    title: string;
    subtitle: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    buttonText: string;
    privacyText: string;
  };
  guarantees: {
    items: Array<{ text: string }>;
  };
  faq: {
    title: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
}

interface VideoPageContent {
  title: string;
  description?: string;
  videoEmbedUrl: string;
  videoThumbnailUrl?: string;
  videoProvider: "vimeo" | "voomly";
  ctaButtonText?: string;
}

// Baner trybu podglądu
const PreviewModeBanner = ({ onClose }: { onClose: () => void }) => {
  return (
    <>
      {/* Wodoznak informujący o trybie podglądu */}
      <div className="fixed inset-0 pointer-events-none z-30 flex items-center justify-center">
        <div className="text-gray-200 text-9xl font-bold opacity-5 transform -rotate-45 select-none">
          PODGLĄD
        </div>
      </div>

      {/* Główny baner na dole ekranu */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-indigo-700/90 backdrop-blur-sm py-3 px-4 text-white flex justify-between items-center shadow-lg">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 mr-3 text-yellow-300" />
          <div>
            <span className="font-bold block text-sm sm:text-base">TRYB PODGLĄDU (TYLKO DO ODCZYTU)</span>
            <span className="text-indigo-200 text-xs sm:text-sm">
              Ten link jest tymczasowy i nie powinien być udostępniany.
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center bg-white text-indigo-700 px-3 py-2 rounded text-sm font-medium hover:bg-indigo-50 transition-colors ml-2 cursor-pointer"
        >
          <X className="h-4 w-4 mr-1" />
          Zamknij podgląd
        </button>
      </div>
    </>
  );
};

// Wspólna klasa tła
const containerClass = "min-h-screen bg-white";

// Komponent ładowania
const LoadingState = () => (
  <div className={`${containerClass} flex items-center justify-center h-screen`}>
    <div className="text-center">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
      <p className="mt-4 text-gray-700">Ładowanie podglądu strony...</p>
    </div>
  </div>
);

// Komponent błędu
const ErrorState = ({ message, onRetry }: { message: string, onRetry?: () => void }) => (
  <div className={`${containerClass} flex items-center justify-center h-screen`}>
    <div className="text-center max-w-md p-6 bg-red-50 rounded-lg border border-red-200">
      <div className="flex justify-center mb-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
      </div>
      <h2 className="text-xl font-semibold text-red-800 mb-2">Wystąpił błąd</h2>
      <p className="text-red-700 mb-4">{message}</p>
      <div className="flex justify-center space-x-4">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Spróbuj ponownie
          </button>
        )}
        <Link
          href="/pages"
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Powrót do listy stron
        </Link>
      </div>
    </div>
  </div>
);

// Główny komponent strony podglądu
export default function PreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token as string;
  const isPreviewMode = searchParams.get('view_mode') === 'preview';

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Funkcja zamykania podglądu
  const closePreview = () => {
    window.close();

    setTimeout(() => {
      if (!window.closed) {
        const confirmation = window.confirm(
          'Ta przeglądarka nie pozwala na automatyczne zamknięcie zakładki. Czy chcesz wrócić do listy stron?'
        );
        if (confirmation) {
          window.location.href = '/pages';
        }
      }
    }, 300);
  };

  // Pobieranie danych strony
  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      console.log('Wywołanie API z trybem podglądu:', isPreviewMode);

      // Wywołanie nowego API endpoint
      const response = await fetch(`/api/pages/preview/${token}?${isPreviewMode ? 'view_mode=preview' : ''}`);

      if (!response.ok) {
        let errorMsg = 'Wystąpił błąd podczas pobierania danych';
        if (response.status === 404) {
          errorMsg = 'Nie znaleziono strony o podanym tokenie';
        } else if (response.status === 401) {
          errorMsg = 'Brak uprawnień do wyświetlenia tej strony';
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setPageData(data);
    } catch (error) {
      console.error('Błąd podczas pobierania danych:', error);
      setError((error instanceof Error) ? error.message : 'Wystąpił nieznany błąd');
    } finally {
      setLoading(false);
    }
  }, [token, isPreviewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Funkcja walidacji danych strony ebook
  const validatePageData = (data: PageData | null) => {
    if (!data) return false;

    const requiredFields = [
      'x_amz_meta_title',
      'pagecontent_hero_headline',
      'pagecontent_hero_subheadline',
      'pagecontent_hero_description'
    ];

    const validFieldsCount = requiredFields.filter(field =>
      data[field as keyof PageData]
    ).length;

    return validFieldsCount >= Math.floor(requiredFields.length * 0.7);
  };

  // Formatowanie danych dla komponentu DemoView
  const formatPageContent = (): PageContent | null => {
    if (!validatePageData(pageData)) {
      return null;
    }

    return {
      s3_file_key: pageData?.s3_file_key || "",
      hero: {
        headline: pageData?.pagecontent_hero_headline || "",
        subheadline: pageData?.pagecontent_hero_subheadline || "",
        description: pageData?.pagecontent_hero_description || "",
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
          {
            title: pageData?.pagecontent_benefits_items_0_title || "",
            text: pageData?.pagecontent_benefits_items_0_text || ""
          },
          {
            title: pageData?.pagecontent_benefits_items_1_title || "",
            text: pageData?.pagecontent_benefits_items_1_text || ""
          },
          {
            title: pageData?.pagecontent_benefits_items_2_title || "",
            text: pageData?.pagecontent_benefits_items_2_text || ""
          },
          {
            title: pageData?.pagecontent_benefits_items_3_title || "",
            text: pageData?.pagecontent_benefits_items_3_text || ""
          }
        ]
      },
      testimonials: {
        title: "Opinie czytelników",
        items: [
          {
            avatar: "/avatar1.jpg",
            text: pageData?.pagecontent_testimonials_items_0_text || "",
            author: pageData?.pagecontent_testimonials_items_0_author || "",
            role: pageData?.pagecontent_testimonials_items_0_role || "",
            rating: 5
          },
          {
            avatar: "/avatar2.jpg",
            text: pageData?.pagecontent_testimonials_items_1_text || "",
            author: pageData?.pagecontent_testimonials_items_1_author || "",
            role: pageData?.pagecontent_testimonials_items_1_role || "",
            rating: 5
          },
          {
            avatar: "/avatar3.jpg",
            text: pageData?.pagecontent_testimonials_items_2_text || "",
            author: pageData?.pagecontent_testimonials_items_2_author || "",
            role: pageData?.pagecontent_testimonials_items_2_role || "",
            rating: 5
          }
        ]
      },
      content: {
        title: "Co znajdziesz w środku?",
        chapters: [
          {
            number: "01",
            title: pageData?.pagecontent_content_chapters_0_title || "",
            description: pageData?.pagecontent_content_chapters_0_description || ""
          },
          {
            number: "02",
            title: pageData?.pagecontent_content_chapters_1_title || "",
            description: pageData?.pagecontent_content_chapters_1_description || ""
          },
          {
            number: "03",
            title: pageData?.pagecontent_content_chapters_2_title || "",
            description: pageData?.pagecontent_content_chapters_2_description || ""
          }
        ]
      },
      form: {
        title: pageData?.pagecontent_form_title || "Pobierz bezpłatny e-book już teraz",
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
          {
            question: pageData?.pagecontent_faq_items_0_question || "",
            answer: pageData?.pagecontent_faq_items_0_answer || ""
          },
          {
            question: pageData?.pagecontent_faq_items_1_question || "",
            answer: pageData?.pagecontent_faq_items_1_answer || ""
          },
          {
            question: pageData?.pagecontent_faq_items_2_question || "",
            answer: pageData?.pagecontent_faq_items_2_answer || ""
          }
        ]
      }
    };
  };

  // Obsługa ponownej próby
  const handleRetry = () => {
    fetchData();
  };

  // Renderowanie zawartości
  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (!pageData) {
    return <ErrorState message="Nie otrzymano danych z serwera" onRetry={handleRetry} />;
  }

  // Określamy typ strony
  const pageType = pageData.x_amz_meta_page_type || pageData.type || 'ebook';

  // Sprawdzenie poprawności danych
  if (pageType === 'ebook' && !validatePageData(pageData)) {
    return <ErrorState message="Dane strony e-book są niekompletne lub uszkodzone. Proszę sprawdzić konfigurację strony." />;
  }

  // Formatowanie danych
  const formattedContent = formatPageContent();
  if (!formattedContent) {
    return <ErrorState message="Nie udało się przetworzyć danych strony" />;
  }

  return (
    <div className={containerClass}>
      <div className="pb-24">
        <DemoView
          pageContent={formattedContent}
          colorSchemeName="harmonia"
          partnerName={pageData.author_display_name || "Autor"}
          pageId={pageData.id}
          pageData={pageData}
          isPreviewMode={isPreviewMode}
          isTextEditMode={false} // Zawsze false w trybie podglądu
          onTextUpdate={undefined} // Brak edycji w trybie podglądu
        />
      </div>

      {/* Baner podglądu - tylko w trybie podglądu */}
      {isPreviewMode && (
        <PreviewModeBanner onClose={closePreview} />
      )}
    </div>
  );
}