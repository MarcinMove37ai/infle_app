// src/app/ebookpage/[...slug]/page.tsx

import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PublicPageClient from './PublicPageClient';

// ====================================================================================
// POPRAWKA: W Next.js 15, params stały się asynchroniczne (Promise)
// ====================================================================================
type PublicPageProps = {
  params: Promise<{
    slug: string[];
  }>;
};
// ====================================================================================

// Zaktualizowana funkcja do pobierania danych strony na podstawie pełnej ścieżki
async function getPageData(slug: string[]) {
  if (!slug || slug.length === 0) {
    return null;
  }

  const fullPath = `/ebookpage/${slug.join('/')}`;

  try {
    const page = await prisma.pages.findFirst({
      where: {
        url: {
          contains: fullPath,
        },
        status: 'published',
      },
      include: {
        content: true,
        user: true,
        ebook: true,
      },
    });
    return page;
  } catch (error) {
    console.error('Błąd podczas pobierania danych strony publicznej:', error);
    return null;
  }
}

// Funkcja generująca metadane (dostosowana do asynchronicznych params)
export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { slug } = await params; // <-- POPRAWKA: Dodano await
  const pageData = await getPageData(slug);

  if (!pageData || !pageData.content) {
    return { title: 'Strona nie została znaleziona' };
  }

  const title = pageData.content.hero_headline || pageData.title;
  const description = pageData.content.hero_description || 'Pobierz nasz przewodnik i dowiedz się więcej.';
  const imageUrl = pageData.ebook?.final_mockup_url || pageData.ebook?.cover_image_url || '/default-image.jpg';

  return {
    title: `e-book | ${title}`,
    description: description.substring(0, 160),
    other: {
      // Preload głównego obrazu dla szybszego LCP
      preload: `<link rel="preload" as="image" href="${imageUrl}" fetchpriority="high" />`,
    },
    openGraph: {
        title: `e-book | ${title}`,
        description,
        images: [{ url: imageUrl }],
    },
    twitter: {
        card: 'summary_large_image',
        title: `e-book | ${title}`,
        description,
        images: [imageUrl],
    },
  };
}

// Główny komponent strony (dostosowany do asynchronicznych params)
export default async function PublicPage({ params }: PublicPageProps) {
  const { slug } = await params; // <-- POPRAWKA: Dodano await
  const pageData = await getPageData(slug);

  if (!pageData) {
    notFound();
  }
  return <PublicPageClient initialPageData={JSON.parse(JSON.stringify(pageData))} />;
}