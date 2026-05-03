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
    __landing?: string;
  }>;
};

const APP_HOST = process.env.APP_HOST || 'app.inflee.app';

/**
 * Resolves the page record from one of three flows:
 *
 *  1) Plan B — Landing host flow (CF for SaaS non-Enterprise):
 *     - searchParams.__landing === '1' (set by middleware rewrite)
 *     - slug is a single segment (e.g. "dieta-keto-abc123")
 *     - We can't know which custom domain handles this request because
 *       Cloudflare for SaaS w trybie SNI nie przekazuje oryginalnej domeny
 *       klienta do origin (Host jest nadpisany na connect.inflee.app,
 *       cf-custom-hostname leci tylko do Workers, SNI ginie na Railway proxy).
 *     - Strategia: znaleźć stronę po slug + customDomainId not null +
 *       customDomain.status = 'active' + status = 'published'.
 *       Slug z random suffix (-abc123) gwarantuje unikalność w praktyce.
 *
 *  2) Custom domain flow (legacy — middleware już nie ustawia __host,
 *     ale zostawiamy branch dla bezpieczeństwa cache'a):
 *     - searchParams.__host is set
 *     - lookup customDomain by host, then page by userId + slug.
 *
 *  3) Direct app.inflee.app flow (existing behavior):
 *     - Brak flag, slug to pełna ścieżka po /ebookpage/.
 *     - Match po full path containment, jak wcześniej.
 */
async function getPageData(
  slug: string[],
  hostFromRewrite?: string,
  isLandingFlow?: boolean,
) {
  if (!slug || slug.length === 0) {
    return null;
  }

  try {
    let page;

    if (isLandingFlow) {
      // ----- Plan B: Landing host flow (CF for SaaS non-Enterprise) -----
      //
      // Cloudflare for SaaS w trybie SNI nie przekazuje oryginalnej domeny
      // klienta (atlas.legalgpt.pl) do origin — Host header jest nadpisany na
      // connect.inflee.app (custom_origin_server), a `cf-custom-hostname` leci
      // tylko do Workers, nie do bezpośredniego Node origin. SNI ginie na
      // Railway proxy. Z tego powodu nie wiemy KTÓRA custom domena obsługuje
      // ten request — middleware oznaczył tylko `__landing=1`.
      //
      // Strategia: zaufać unikalności sluga (każdy slug ma random suffix typu
      // -abc123, więc kolizje praktycznie niemożliwe) i znaleźć stronę po:
      //   1. slug w pages.url (contains '/<slug>' bo ścieżka zawiera /by-author/)
      //   2. customDomainId != null (strona jest podpięta pod jakąś custom domenę)
      //   3. customDomain.status === 'active' (domena zweryfikowana w CF)
      //   4. status === 'published'
      //
      // Filtr customDomainId not null + status active to zabezpieczenie żeby
      // bezpośrednie wejście na connect.inflee.app/<slug> NIE pokazało strony
      // która powinna być serwowana TYLKO pod custom domeną.
      const pageSlug = slug[slug.length - 1];
      page = await prisma.pages.findFirst({
        where: {
          url: { contains: `/${pageSlug}` },
          customDomainId: { not: null },
          status: 'published',
          customDomain: {
            status: 'active',
          },
        },
        include: {
          content: true,
          user: true,
          customDomain: { select: { id: true, domain: true, status: true } },
          ebook: {
            include: {
              ebook_chapters: { orderBy: { position: 'asc' } },
            },
          },
        },
      });

      if (page) {
        console.log('[ebookpage] LANDING flow matched:', {
          slug: pageSlug,
          pageId: page.id,
          customDomain: (page as any).customDomain?.domain,
        });
      } else {
        console.log('[ebookpage] LANDING flow MISS for slug:', pageSlug);
      }
    } else if (hostFromRewrite) {
      // ----- Legacy custom domain flow -----
      // Middleware obecnie nie ustawia już __host (zastąpione przez __landing),
      // ale zostawiamy ten branch na wypadek starego cache'a / przejściowych
      // requestów w trakcie deployu.
      const pageSlug = slug[slug.length - 1];
      const customDomain = await prisma.customDomain.findUnique({
        where: { domain: hostFromRewrite.toLowerCase() },
        select: { userId: true, status: true },
      });

      if (!customDomain || customDomain.status !== 'active') {
        return null;
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
    console.log('[ebookpage] page.s3_file_key:', (page as any).s3_file_key);

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
  const { __host, __landing } = await searchParams;
  const pageData = await getPageData(slug, __host, __landing === '1');

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
  const { __host, __landing } = await searchParams;
  const pageData = await getPageData(slug, __host, __landing === '1');

  if (!pageData) {
    notFound();
  }

  // ─────────────────────────────────────────────────────────────────
  // Canonical redirect: when the page is hit directly under app.inflee.app
  // and the page owner has an active primary custom domain, 301 the visitor
  // to the canonical URL on their custom domain.
  // We detect a "direct app.inflee.app hit" by absence of BOTH __host AND
  // __landing flags (oba ustawiane przez middleware tylko dla custom/landing).
  // ─────────────────────────────────────────────────────────────────
  if (!__host && __landing !== '1') {
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