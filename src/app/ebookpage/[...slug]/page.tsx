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
    __landing?: string;
  }>;
};

const APP_HOST = process.env.APP_HOST || 'app.inflee.app';

// Origin hosts — infrastruktura Cloudflare for SaaS, NIE powinny być
// publicznie indeksowane. Bezpośrednie wejście na te hosty (poza Plan B
// flow) dostaje noindex w generateMetadata.
const ORIGIN_HOSTS = new Set([
  'connect.inflee.app',
  'fallback.inflee.app',
]);

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
    } else {
      // ----- Direct app.inflee.app flow -----
      // Includes customDomain so PublicPage can decide if 301 redirect to
      // canonical custom domain is needed (per-page, not per-user).
      const fullPath = `/ebookpage/${slug.join('/')}`;
      page = await prisma.pages.findFirst({
        where: {
          url: { contains: fullPath },
          status: 'published',
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
    }

    if (!page) return null;


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

export async function generateMetadata({ params, searchParams }: PublicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { __landing } = await searchParams;
  const pageData = await getPageData(slug, __landing === '1');

  if (!pageData || !pageData.content) {
    return { title: 'Page not found' };
  }

  const content = pageData.content as any;
  const title = content.hero_headline || (pageData as any).title;
  const description = content.hero_description || 'Get our guide and learn more.';

  // -----------------------------------------------------------------
  // metadataBase — kanoniczny host dla resolve OG/Twitter image URLs.
  // Priorytet:
  //  1. customDomain.domain (Plan B landing flow — request przyszedł
  //     z atlas.legalgpt.pl, ale Host header to connect.inflee.app)
  //  2. APP_HOST (direct hit on app.inflee.app)
  //  3. fallback http://localhost:3000 (dev)
  // -----------------------------------------------------------------
  const customDomain = (pageData as any).customDomain?.domain as string | undefined;
  const baseUrl = customDomain
    ? `https://${customDomain}`
    : `https://${APP_HOST}`;

  // -----------------------------------------------------------------
  // imageUrl resolved as absolute URL on the canonical host
  // -----------------------------------------------------------------
  const rawImage = (pageData.ebook as any)?.final_mockup_url
    || (pageData.ebook as any)?.cover_image_url
    || '/default-image.jpg';

  // Konwersja relative -> absolute path (przez /api/assets/ jeśli /uploads/)
  const resolveImagePath = (path: string): string => {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/uploads/')) {
      return `${baseUrl}/api/assets/uploads/${path.substring('/uploads/'.length)}`;
    }
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const imageUrl = resolveImagePath(rawImage);

  // -----------------------------------------------------------------
  // Detect direct hit on origin host (connect/fallback.inflee.app).
  // Plan B requests come with __landing=1 set by middleware. Direct
  // origin hits don't — those should be noindex,nofollow to prevent
  // Google from indexing infrastructure URLs that compete with custom
  // domains in SERP.
  // -----------------------------------------------------------------
  const hdrs = await headers();
  const requestHost = (hdrs.get('host') || '').toLowerCase().split(':')[0];
  const isDirectOriginHit = ORIGIN_HOSTS.has(requestHost) && __landing !== '1';
  console.log('[metadata DEBUG] requestHost:', requestHost, 'isDirectOriginHit:', isDirectOriginHit);

  return {
    metadataBase: new URL(baseUrl),
    title: `e-book | ${title}`,
    description: description.substring(0, 160),
    robots: isDirectOriginHit
      ? { index: false, follow: false }
      : undefined,
    // Preload usunięty — wskazywał na ebook.final_mockup_url (oryginalny
    // upload), ale Next.js Image renderuje przez /_next/image?url=...&w=...&q=...
    // (resize + WebP conversion). Browser ściągał plik którego nikt nie używał.
    // Zamiast tego polegamy na <Image priority> które Next.js sam preloaduje
    // (poprawnie, na właściwy URL z resize parametrami).
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
  const { __landing } = await searchParams;
  const pageData = await getPageData(slug, __landing === '1');

  if (!pageData) {
    notFound();
  }

  // ─────────────────────────────────────────────────────────────────
  // Canonical redirect: when the page is hit directly under app.inflee.app
  // and THIS page has an active custom domain assigned (per-page, Phase 6),
  // 301 the visitor to canonical URL on that domain.
  // Direct app.inflee.app hit detected by absence of __landing flag
  // (set by middleware only for custom/landing host requests).
  // ─────────────────────────────────────────────────────────────────
  if (__landing !== '1') {
    const hdrs = await headers();
    const requestHost = (hdrs.get('host') || '').toLowerCase().split(':')[0];
    const isAppHost = requestHost === APP_HOST;

    if (isAppHost) {
      const pageCustomDomain = (pageData as any).customDomain as
        | { domain: string; status: string }
        | null
        | undefined;

      if (pageCustomDomain && pageCustomDomain.status === 'active') {
        // Last segment of slug is the page-slug used on the custom domain
        const pageSlug = slug[slug.length - 1];
        const target = `https://${pageCustomDomain.domain}/${pageSlug}`;
        console.log('[ebookpage] 301 redirect to canonical custom domain:', target);
        redirect(target);
      }
    }
  }

  return <PublicPageClient initialPageData={JSON.parse(JSON.stringify(pageData))} />;
}