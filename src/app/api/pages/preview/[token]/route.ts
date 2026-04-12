// src/app/api/pages/preview/[token]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const resolvedParams = await params;
  const token = resolvedParams.token;
  const isPreviewMode = request.nextUrl.searchParams.get('view_mode') === 'preview';

  console.log(`Obsługa zapytania dla tokenu: ${token}, tryb podglądu: ${isPreviewMode}`);

  if (!token) {
    return NextResponse.json(
      { error: 'Nie podano tokenu' },
      { status: 400 }
    );
  }

  try {
    // W trybie podglądu pomijamy pełną autoryzację
    if (!isPreviewMode) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Użytkownik niezalogowany' },
          { status: 401 }
        );
      }
    }

    // Konstruujemy draft_url - pamiętaj że w bazie zaczynają się od "/"
    const draftUrl = `/preview/${token}`;

    console.log(`Szukanie strony z draft_url: ${draftUrl}`);

    // Pobierz stronę wraz z powiązanymi danymi
    const page = await prisma.pages.findFirst({
      where: {
        draft_url: draftUrl
      },
      include: {
        content: true,  // Dane z tabeli page_content
        ebook: {
          include: {
            ebook_chapters: { orderBy: { position: 'asc' } }
          }
        },
        user: {         // Dane użytkownika
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    if (!page) {
      return NextResponse.json(
        { error: 'Nie znaleziono strony dla podanego tokenu' },
        { status: 404 }
      );
    }

    console.log('Znaleziono stronę:', {
      id: page.id,
      title: page.title,
      type: page.type,
      hasContent: !!page.content,
      hasEbook: !!page.ebook
    });

    // Mapowanie danych z page_content na format oczekiwany przez frontend
    const mappedData = mapPageContentToFrontend(page);

    return NextResponse.json(mappedData);

  } catch (error) {
    console.error('Błąd podczas pobierania danych strony:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas pobierania danych strony' },
      { status: 500 }
    );
  }
}

/**
 * Funkcja mapująca dane z bazy na format oczekiwany przez frontend
 */
function mapPageContentToFrontend(page: any) {
  const content = page.content;
  const ebook = page.ebook;

  // DEBUG - sprawdź dane ebook
  console.log('DEBUG - Dane ebook:', {
    exists: !!ebook,
    authorDisplayName: ebook?.authorDisplayName,
    authorLogoUrl: ebook?.authorLogoUrl,
    final_mockup_url: ebook?.final_mockup_url,
    cover_image_webp_url: ebook?.cover_image_webp_url
  });

  // DEBUG - sprawdź dane user
  console.log('DEBUG - Dane user:', {
    firstName: page.user?.firstName,
    lastName: page.user?.lastName,
    role: page.user?.role
  });

  // Funkcja pomocnicza do generowania URL-i assetów
  const getAssetUrl = (imagePath: string | null | undefined): string => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath; // już pełny URL
    }
    if (imagePath.startsWith('/uploads/')) {
      const filename = imagePath.substring('/uploads/'.length);
      return `/api/assets/uploads/${filename}`;
    }
    return `/api/assets/uploads/${imagePath}`;
  };

  // Podstawowe dane strony
  const mappedData: any = {
    id: page.id,
    status: page.status,
    type: page.type || 'ebook',
    color: page.color,
    userId: page.user?.id,
    x_amz_meta_title: page.title,
    x_amz_meta_page_type: page.type || 'ebook',

    // URL do mockupu ebook (już przetworzony)
    s3_file_key: getAssetUrl(ebook?.final_mockup_url || ebook?.cover_image_webp_url),

    // Dane autora z ebook (logo też przetwarzamy)
    author_display_name: ebook?.authorDisplayName || `${page.user?.firstName || ''} ${page.user?.lastName || ''}`.trim(),
    author_logo_url: getAssetUrl(ebook?.authorLogoUrl),
  };

  console.log('DEBUG - Zmapowane dane autora:', {
    author_display_name: mappedData.author_display_name,
    author_logo_url: mappedData.author_logo_url
  });

  // Jeśli nie ma zawartości w page_content, zwróć podstawowe dane
  if (!content) {
    console.warn(`Brak zawartości dla strony ${page.id}, zwracam podstawowe dane`);
    return mappedData;
  }

  // Mapowanie zawartości z page_content na format frontendowy
  const contentMapping = {
    // Hero section
    pagecontent_hero_headline: content.hero_headline,
    pagecontent_hero_subheadline: content.hero_subheadline,
    pagecontent_hero_description: content.hero_description,

    // Benefits section (4 elementy)
    pagecontent_benefits_items_0_title: content.benefits_item_0_title,
    pagecontent_benefits_items_0_text: content.benefits_item_0_text,
    pagecontent_benefits_items_1_title: content.benefits_item_1_title,
    pagecontent_benefits_items_1_text: content.benefits_item_1_text,
    pagecontent_benefits_items_2_title: content.benefits_item_2_title,
    pagecontent_benefits_items_2_text: content.benefits_item_2_text,
    pagecontent_benefits_items_3_title: content.benefits_item_3_title,
    pagecontent_benefits_items_3_text: content.benefits_item_3_text,

    // Testimonials section (3 elementy)
    pagecontent_testimonials_items_0_text: content.testimonials_item_0_text,
    pagecontent_testimonials_items_0_author: content.testimonials_item_0_author,
    pagecontent_testimonials_items_0_role: content.testimonials_item_0_role,
    pagecontent_testimonials_items_1_text: content.testimonials_item_1_text,
    pagecontent_testimonials_items_1_author: content.testimonials_item_1_author,
    pagecontent_testimonials_items_1_role: content.testimonials_item_1_role,
    pagecontent_testimonials_items_2_text: content.testimonials_item_2_text,
    pagecontent_testimonials_items_2_author: content.testimonials_item_2_author,
    pagecontent_testimonials_items_2_role: content.testimonials_item_2_role,

    // Content chapters section (3 rozdziały)
    pagecontent_content_chapters_0_title: content.content_chapter_0_title,
    pagecontent_content_chapters_0_description: content.content_chapter_0_description,
    pagecontent_content_chapters_1_title: content.content_chapter_1_title,
    pagecontent_content_chapters_1_description: content.content_chapter_1_description,
    pagecontent_content_chapters_2_title: content.content_chapter_2_title,
    pagecontent_content_chapters_2_description: content.content_chapter_2_description,

    // Form section
    pagecontent_form_title: content.form_title,

    // FAQ section (3 pytania)
    pagecontent_faq_items_0_question: content.faq_item_0_question,
    pagecontent_faq_items_0_answer: content.faq_item_0_answer,
    pagecontent_faq_items_1_question: content.faq_item_1_question,
    pagecontent_faq_items_1_answer: content.faq_item_1_answer,
    pagecontent_faq_items_2_question: content.faq_item_2_question,
    pagecontent_faq_items_2_answer: content.faq_item_2_answer,
  };

  // Język strony
  mappedData.language = page.language || 'en';

  // Dane rozdziałów dla spisu treści
  const chapters = ebook?.ebook_chapters ?? [];
  mappedData.ebookMeta = {
    chapterCount: chapters.length,
    estimatedPages: ebook?.total_pages ?? 0,
    chapters: chapters.map((ch: any) => ({
      position: ch.position,
      title: ch.title ?? '',
      preview: ch.content
        ? ch.content.replace(/\s+/g, ' ').trim().substring(0, 120) + (ch.content.length > 120 ? '…' : '')
        : '',
    })),
  };

  // Dodaj wszystkie zmapowane pola do wyniku
  return {
    ...mappedData,
    ...contentMapping
  };
}