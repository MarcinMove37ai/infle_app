// src/app/ebookpage/[...slug]/page.tsx

import React from 'react';
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import PublicPageClient from './PublicPageClient';

type PublicPageProps = {
  params: Promise<{
    slug: string[];
  }>;
  searchParams: Promise<{
    __host?: string;
  }>;
};

const APP_HOST = process.env.APP_HOST || 'app.inflee.app';

/**
 * Resolves the page record from one of two flows:
 *
 *  1) Custom domain flow (rewrite from middleware):
 *     - searchParams.__host is set (passed by middleware rewrite)
 *     - slug is a single segment (just the page-slug, e.g. "dieta-keto-abc")
 *     - We look up the customDomain by host, then fetch the page that belongs
 *       to that user AND whose URL ends with that slug.
 *
 *  2) Direct app.inflee.app flow (existing behavior):
 *     - No __host param
 *     - slug is the full segments after /ebookpage/, e.g. ["by-john", "dieta-keto-abc"]
 *     - We match by full path containment, like before.
 */
async function getPageData(slug: string[], hostFromRewrite?: string) {
  if (!slug || slug.length === 0) {
    return null;
  }

  try {
    let page;

    if (hostFromRewrite) {
      // ----- Custom domain flow -----
      // slug is one segment, look it up under the user owning hostFromRewrite.
      const pageSlug = slug[slug.length - 1]; // defensive: take last segment
      const customDomain = await prisma.customDomain.findUnique({
        where: { domain: hostFromRewrite.toLowerCase() },
        select: { userId: true, status: true },
      });

      if (!customDomain || customDomain.status !== 'active') {
        return null; // unknown or unverified domain
      }

      page = await prisma.pages.findFirst({
        where: {
          userId: customDomain.userId,
          url: { contains: `/${pageSlug}` },
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
    } else {
      // ----- Direct app.inflee.app flow (unchanged) -----
      const fullPath = `/ebookpage/${slug.join('/')}`;
      page = await prisma.pages.findFirst({
        where: {
          url: { contains: fullPath },
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
    }

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

/**
 * Resolve the canonical primary domain for the page owner, if any.
 * Used to 301-redirect direct hits on app.inflee.app to the user's custom domain.
 */
async function getPrimaryDomainForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      primaryDomain: { select: { domain: true, status: true } },
    },
  });
  const pd = user?.primaryDomain;
  if (pd && pd.status === 'active') {
    return pd.domain;
  }
  return null;
}

export async function generateMetadata({ params, searchParams }: PublicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { __host } = await searchParams;
  const pageData = await getPageData(slug, __host);

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

export default async function PublicPage({ params, searchParams }: PublicPageProps) {
  const { slug } = await params;
  const { __host } = await searchParams;
  const pageData = await getPageData(slug, __host);

  if (!pageData) {
    notFound();
  }

  // ─────────────────────────────────────────────────────────────────
  // Canonical redirect: when the page is hit directly under app.inflee.app
  // and the page owner has an active primary custom domain, 301 the visitor
  // to the canonical URL on their custom domain.
  // We detect a "direct app.inflee.app hit" by absence of __host (which is
  // only set when middleware rewrites a custom-host request).
  // ─────────────────────────────────────────────────────────────────
  if (!__host) {
    const hdrs = await headers();
    const requestHost = (hdrs.get('host') || '').toLowerCase().split(':')[0];
    const isAppHost = requestHost === APP_HOST;

    if (isAppHost) {
      const primaryDomain = await getPrimaryDomainForUser((pageData as any).userId);
      if (primaryDomain) {
        // Last segment of slug is the page-slug used on the custom domain
        const pageSlug = slug[slug.length - 1];
        const target = `https://${primaryDomain}/${pageSlug}`;
        console.log('[ebookpage] 301 redirect to canonical custom domain:', target);
        redirect(target);
      }
    }
  }

  return <PublicPageClient initialPageData={JSON.parse(JSON.stringify(pageData))} />;
}