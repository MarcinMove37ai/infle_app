// src/app/ebookpage/[...slug]/page.tsx

import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PublicPageClient from './PublicPageClient';

type PublicPageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

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
        ebook: {
          include: {
            ebook_chapters: { orderBy: { position: 'asc' } },
          },
        },
      },
    });

    if (!page) return null;

    // -----------------------------------------------------------------
    // DEBUG — wypisz klucze ebooka żeby zobaczyć dostępne pola
    // (usuń po zidentyfikowaniu prawidłowych pól)
    // -----------------------------------------------------------------
    if (page.ebook) {
      const ebookKeys = Object.keys(page.ebook);
      console.log('[ebookpage] ebook field names:', ebookKeys);
      console.log('[ebookpage] ebook mockup candidates:', {
        final_mockup_url: (page.ebook as any).final_mockup_url,
        cover_image_webp_url: (page.ebook as any).cover_image_webp_url,
        mockup_url: (page.ebook as any).mockup_url,
        s3_file_key: (page.ebook as any).s3_file_key,
        image_url: (page.ebook as any).image_url,
      });
      console.log('[ebookpage] ebook page count candidates:', {
        estimated_pages: (page.ebook as any).estimated_pages,
        page_count: (page.ebook as any).page_count,
        pages: (page.ebook as any).pages,
        total_pages: (page.ebook as any).total_pages,
      });
    }
    console.log('[ebookpage] page.s3_file_key:', page.s3_file_key);

    // -----------------------------------------------------------------
    // Buduj ebookMeta na serwerze — identycznie jak preview API
    // -----------------------------------------------------------------
    const ebook = page.ebook as any;
    const chapters = ebook?.ebook_chapters ?? [];

    const totalWords = chapters.reduce((acc: number, ch: any) => {
      return acc + (ch.content?.split(/\s+/).length ?? 0);
    }, 0);

    // Szukaj rzeczywistej liczby stron — preview używa total_pages
    const realPageCount = ebook?.total_pages ?? 0;

    const ebookMeta = {
      chapterCount: chapters.length,
      estimatedPages: realPageCount > 0
        ? realPageCount
        : Math.max(1, Math.round(totalWords / 250)),
      chapters: chapters.map((ch: any) => ({
        position: ch.position,
        title: ch.title ?? "",
        preview: ch.content
          ? ch.content.replace(/\s+/g, ' ').trim().substring(0, 120) +
            (ch.content.length > 120 ? '…' : '')
          : "",
      })),
    };

    // -----------------------------------------------------------------
    // Resolve mockup URL — identycznie jak preview API
    // -----------------------------------------------------------------
    const getAssetUrl = (imagePath: string | null | undefined): string => {
      if (!imagePath) return '';
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
      if (imagePath.startsWith('/uploads/')) {
        const filename = imagePath.substring('/uploads/'.length);
        return `/api/assets/uploads/${filename}`;
      }
      return `/api/assets/uploads/${imagePath}`;
    };

    const mockupUrl = getAssetUrl(
      ebook?.final_mockup_url || ebook?.cover_image_webp_url
    );

    console.log('[ebookpage] resolved mockupUrl:', mockupUrl);
    console.log('[ebookpage] ebookMeta:', ebookMeta);

    // Dołącz obliczone dane do obiektu strony
    return {
      ...page,
      ebookMeta,
      resolvedMockupUrl: mockupUrl,
    };

  } catch (error) {
    console.error('Błąd podczas pobierania danych strony publicznej:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const pageData = await getPageData(slug);

  if (!pageData || !pageData.content) {
    return { title: 'Strona nie została znaleziona' };
  }

  const content = pageData.content as any;
  const title = content.hero_headline || (pageData as any).title;
  const description = content.hero_description || 'Pobierz nasz przewodnik i dowiedz się więcej.';
  const imageUrl = (pageData.ebook as any)?.final_mockup_url || (pageData.ebook as any)?.cover_image_url || '/default-image.jpg';

  return {
    title: `e-book | ${title}`,
    description: description.substring(0, 160),
    other: {
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

export default async function PublicPage({ params }: PublicPageProps) {
  const { slug } = await params;
  const pageData = await getPageData(slug);

  if (!pageData) {
    notFound();
  }
  return <PublicPageClient initialPageData={JSON.parse(JSON.stringify(pageData))} />;
}