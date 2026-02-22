// src/lib/pdfGenerator.ts

import { prisma } from '@/lib/prisma';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import sharp from 'sharp';

// --- FUNKCJA POMOCNICZA DO OPTYMALIZACJI GRAFIK ---
async function optimizeAndEncodeImages(chapters: Chapter[], baseUrl: string): Promise<any[]> {
  const optimizedChapters = await Promise.all(
    chapters.map(async (chapter) => {
      if (!chapter.image_url) {
        return chapter;
      }
      try {
        const imageUrl = new URL(chapter.image_url, baseUrl).href;
        console.log(`🖼️  Optymalizowanie obrazu dla rozdziału (pdfGenerator): "${chapter.title}"`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Nie udało się pobrać obrazu: ${response.statusText}`);
        }
        const imageBuffer = await response.arrayBuffer();

        const optimizedBuffer = await sharp(Buffer.from(imageBuffer))
          .resize({
            width: 700,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 75 })
          .toBuffer();

        const base64Image = optimizedBuffer.toString('base64');
        return {
          ...chapter,
          optimizedImageBase64: `data:image/webp;base64,${base64Image}`,
        };
      } catch (error) {
        console.warn(`⚠️ Nie udało się zoptymalizować obrazu dla rozdziału "${chapter.title}". Użycie oryginalnego URL. Błąd:`, error);
        return chapter;
      }
    })
  );
  return optimizedChapters;
}

// Interfejsy i typy
interface Chapter {
  id: number;
  title: string;
  content: string | null;
  image_url: string | null;
  position: number;
  optimizedImageBase64?: string;
}

interface EbookData {
  id: number;
  title: string;
  subtitle: string | null;
  cover_image_url: string | null;
  authorDisplayName: string | null;
  authorLogoUrl: string | null;
  intro: string | null;
  ebook_chapters: Chapter[];
}

interface PdfGeneratorResult {
  pdfBuffer: Buffer;
  ebook: EbookData;
}

interface ChapterPageMapping {
  [chapterId: number]: number;
}

interface PageDetectionResult {
  chapterPageMapping: ChapterPageMapping;
  introPageNumber: number;
}

// --- FUNKCJE POMOCNICZE ---

async function prepareCoverBackground(page: any): Promise<string> {
  await page.evaluate(() => {
    const titleEl = document.querySelector('.cover-title');
    const subtitleEl = document.querySelector('.cover-subtitle');
    if (titleEl) (titleEl as HTMLElement).style.visibility = 'hidden';
    if (subtitleEl) (subtitleEl as HTMLElement).style.visibility = 'hidden';
  });

  const coverTemplateBuffer = await page.screenshot({ type: 'webp', quality: 95 });
  const coverTemplateDataUrl = `data:image/webp;base64,${(coverTemplateBuffer as Buffer).toString('base64')}`;

  await page.evaluate((dataUrl: string) => {
    const coverPage = document.querySelector('.cover-page') as HTMLElement | null;
    if (!coverPage) return;

    ['.cover-logo', '.cover-image-container', '.cover-fallback'].forEach(selector => {
      const el = coverPage.querySelector(selector) as HTMLElement | null;
      if (el) el.style.display = 'none';
    });

    coverPage.style.backgroundImage = `url(${dataUrl})`;
    coverPage.style.backgroundSize = '100% 100%';
    coverPage.style.backgroundPosition = 'center';
    coverPage.style.backgroundRepeat = 'no-repeat';

    const titleSection = coverPage.querySelector('.cover-title-section') as HTMLElement | null;
    const subtitleSection = coverPage.querySelector('.cover-subtitle-section') as HTMLElement | null;
    if (titleSection) titleSection.style.background = 'none';
    if (subtitleSection) subtitleSection.style.background = 'none';

    const titleEl = coverPage.querySelector('.cover-title') as HTMLElement | null;
    const subtitleEl = coverPage.querySelector('.cover-subtitle') as HTMLElement | null;
    if (titleEl) titleEl.style.visibility = 'visible';
    if (subtitleEl) subtitleEl.style.visibility = 'visible';
  }, coverTemplateDataUrl);

  return coverTemplateDataUrl;
}

function applyCoverBackground(page: any, coverDataUrl: string): Promise<void> {
  return page.evaluate((dataUrl: string) => {
    const coverPage = document.querySelector('.cover-page') as HTMLElement | null;
    if (!coverPage) return;

    ['.cover-logo', '.cover-image-container', '.cover-fallback'].forEach(selector => {
      const el = coverPage.querySelector(selector) as HTMLElement | null;
      if (el) el.style.display = 'none';
    });

    coverPage.style.backgroundImage = `url(${dataUrl})`;
    coverPage.style.backgroundSize = '100% 100%';
    coverPage.style.backgroundPosition = 'center';
    coverPage.style.backgroundRepeat = 'no-repeat';

    const titleSection = coverPage.querySelector('.cover-title-section') as HTMLElement | null;
    const subtitleSection = coverPage.querySelector('.cover-subtitle-section') as HTMLElement | null;
    if (titleSection) titleSection.style.background = 'none';
    if (subtitleSection) subtitleSection.style.background = 'none';
  }, coverDataUrl);
}

const PDF_OPTIONS = {
  format: 'A4' as const,
  margin: { top: '20mm', right: '20mm', bottom: '25mm', left: '20mm' },
  printBackground: true,
  displayHeaderFooter: false,
  preferCSSPageSize: true,
  timeout: 60000,
};

async function generatePdfFromPage(page: any): Promise<Buffer> {
  return await page.pdf(PDF_OPTIONS) as Buffer;
}

async function countPdfPages(pdfBuffer: Buffer): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
  return doc.getPageCount();
}

// =====================================================================
//  PRECYZYJNE WYKRYWANIE STRON ROZDZIAŁÓW + INTRODUCTION
//  Metoda: ukryj rozdziały i intro → generuj mini-PDF → licz strony.
//  Żadnego parsowania tekstu. Żadnych markerów. Żadnych szacunków.
//  pdf-lib liczy strony z wygenerowanych PDF — 100% precyzja.
// =====================================================================

async function detectChapterPages(
  page: any,
  chapters: Chapter[],
  hasIntro: boolean
): Promise<PageDetectionResult> {
  const chapterPageMapping: ChapterPageMapping = {};
  let introPageNumber = 0;

  // KROK 1: Ukryj WSZYSTKIE rozdziały i Introduction → PDF = okładka + spis treści
  console.log('📏 Pomiar: okładka + spis treści...');
  await page.evaluate(() => {
    document.querySelectorAll('.chapter').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    const introEl = document.querySelector('.introduction-page');
    if (introEl) (introEl as HTMLElement).style.display = 'none';
  });

  const basePdf = await generatePdfFromPage(page);
  const basePages = await countPdfPages(basePdf);
  console.log(`   Okładka + spis treści = ${basePages} stron`);

  let previousTotal = basePages;

  // KROK 2: Pokaż Introduction (jeśli istnieje)
  if (hasIntro) {
    console.log('📏 Pomiar: Introduction...');
    await page.evaluate(() => {
      const introEl = document.querySelector('.introduction-page');
      if (introEl) (introEl as HTMLElement).style.display = '';
    });

    const introPdf = await generatePdfFromPage(page);
    const introTotal = await countPdfPages(introPdf);
    introPageNumber = previousTotal + 1;
    const introPages = introTotal - previousTotal;

    console.log(`   ✅ Introduction → strona ${introPageNumber} (zajmuje ${introPages} str.)`);
    previousTotal = introTotal;
  }

  // KROK 3: Pokazuj rozdziały jeden po drugim, za każdym razem
  //         generuj PDF i licz strony. Różnica = strony tego rozdziału.
  for (let i = 0; i < chapters.length; i++) {
    await page.evaluate((idx: number) => {
      const ch = document.getElementById(`chapter-${idx + 1}`);
      if (ch) ch.style.display = '';
    }, i);

    const pdf = await generatePdfFromPage(page);
    const currentTotal = await countPdfPages(pdf);

    const chapterStartPage = previousTotal + 1;
    const chapterPages = currentTotal - previousTotal;

    chapterPageMapping[chapters[i].id] = chapterStartPage;
    console.log(`   ✅ Rozdział ${i + 1}: "${chapters[i].title}" → strona ${chapterStartPage} (zajmuje ${chapterPages} str.)`);

    previousTotal = currentTotal;
  }

  // KROK 4: Przywróć widoczność wszystkich elementów
  await page.evaluate(() => {
    document.querySelectorAll('.chapter').forEach(el => {
      (el as HTMLElement).style.display = '';
    });
    const introEl = document.querySelector('.introduction-page');
    if (introEl) (introEl as HTMLElement).style.display = '';
  });

  return { chapterPageMapping, introPageNumber };
}

// =====================================================================
//  GŁÓWNA FUNKCJA
// =====================================================================

export async function generateEbookPdf(ebookId: number): Promise<PdfGeneratorResult> {
  let browser;
  try {
    // 1. POBRANIE DANYCH
    const ebook = await prisma.ebooks.findUnique({
      where: { id: ebookId },
      include: {
        ebook_chapters: { orderBy: { position: 'asc' } },
      },
    });

    if (!ebook) {
      throw new Error(`Ebook o ID ${ebookId} nie został znaleziony.`);
    }

    const { title, subtitle, cover_image_url, ebook_chapters: chapters, authorDisplayName, authorLogoUrl, intro } = ebook;

    // 2. OPTYMALIZACJA OBRAZÓW
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const chaptersWithOptimizedImages = await optimizeAndEncodeImages(chapters, baseUrl);

    // 3. URUCHOMIENIE PRZEGLĄDARKI
    const isProduction = process.env.NODE_ENV === 'production';
    let executablePath: string;

    if (isProduction) {
      executablePath = await chromium.executablePath();
    } else {
      const localPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
      ];
      executablePath = localPaths.find((p) => fs.existsSync(p)) || '';
      if (!executablePath) {
        executablePath = await chromium.executablePath();
      }
    }

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });

    const hasIntro = !!(intro && intro.trim());

    // ================================================================
    //  PIERWSZY PRZEBIEG: Renderuj HTML ze spisem treści (strony = 0)
    // ================================================================
    console.log('📊 PIERWSZY PRZEBIEG: Renderowanie HTML ze spisem treści...');

    const placeholderMapping: ChapterPageMapping = {};
    for (const chapter of chaptersWithOptimizedImages) {
      placeholderMapping[chapter.id] = 0;
    }

    const htmlContent = generateHTMLContent(
      title, subtitle, chaptersWithOptimizedImages,
      cover_image_url, authorDisplayName, authorLogoUrl,
      placeholderMapping, intro, 0
    );

    const page1 = await browser.newPage();
    await page1.setViewport({ width: 795, height: 1125 });
    await page1.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });

    // Screenshot okładki
    const coverDataUrl = await prepareCoverBackground(page1);

    // ================================================================
    //  WYKRYWANIE STRON: Ukryj/pokaż rozdziały + intro, licz strony PDF
    // ================================================================
    console.log('🔍 Precyzyjne wykrywanie numerów stron...');

    const { chapterPageMapping, introPageNumber } = await detectChapterPages(
      page1, chaptersWithOptimizedImages, hasIntro
    );

    console.log('✅ Wykrywanie stron zakończone:', { chapterPageMapping, introPageNumber });

    await page1.close();

    // ================================================================
    //  DRUGI PRZEBIEG: Finalny PDF z poprawnymi numerami stron
    // ================================================================
    console.log('📊 DRUGI PRZEBIEG: Generowanie finalnego PDF...');

    const finalHtml = generateHTMLContent(
      title, subtitle, chaptersWithOptimizedImages,
      cover_image_url, authorDisplayName, authorLogoUrl,
      chapterPageMapping, intro, introPageNumber
    );

    const page2 = await browser.newPage();
    await page2.setViewport({ width: 795, height: 1125 });
    await page2.setContent(finalHtml, { waitUntil: 'networkidle0', timeout: 60000 });

    await applyCoverBackground(page2, coverDataUrl);

    const finalPdfBuffer = await generatePdfFromPage(page2);
    await page2.close();

    console.log('✅ Finalny PDF wygenerowany pomyślnie!');

    return { pdfBuffer: finalPdfBuffer, ebook: ebook as EbookData };

  } catch (error) {
    console.error(`Błąd podczas generowania PDF dla ebooka ${ebookId}:`, error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// =====================================================================
//  GENEROWANIE HTML
// =====================================================================

function generateHTMLContent(
  title: string,
  subtitle: string | null,
  chapters: Chapter[],
  coverImageUrl?: string | null,
  authorDisplayName?: string | null,
  authorLogoUrl?: string | null,
  chapterPageMapping?: ChapterPageMapping | null,
  introText?: string | null,
  introPageNumber?: number
): string {
  const hasIntro = !!(introText && introText.trim());

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap" rel="stylesheet">
      <style>
        ${generateAdvancedCSS(title, subtitle, authorDisplayName)}
      </style>
    </head>
    <body>
      ${generateCoverPage(coverImageUrl!, title, subtitle)}
      ${chapterPageMapping ? generateTableOfContents(chapters, chapterPageMapping, introPageNumber) : ''}
      ${hasIntro ? generateIntroductionPage(introText!) : ''}
      ${generateChaptersContent(chapters)}
    </body>
    </html>
  `;
}

function generateAdvancedCSS(ebookTitle: string, ebookSubtitle: string | null, authorDisplayName?: string | null): string {
  const authorPart = authorDisplayName ? authorDisplayName.replace(/"/g, '\\"') : 'Health Pro System';
  let fullTitle = ebookTitle;
  if (ebookSubtitle) {
    fullTitle += ` ${ebookSubtitle}`;
  }
  const displayFullTitle = fullTitle.length > 80
    ? fullTitle.substring(0, 80) + '...'
    : fullTitle;

  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; font-size: 18px; line-height: 1.6; color: #000; background: white; }

    @page {
      margin: 20mm;
      size: A4;
      @bottom-left {
        content: "${authorPart} | ${displayFullTitle.replace(/"/g, '\\"')}";
        font-family: 'Poppins', sans-serif;
        font-size: 9px;
        color: rgb(136, 136, 136);
        font-weight: 300;
        letter-spacing: 0.3px;
        margin-top: 12px;
        padding-top: 4px;
        background-image: linear-gradient(to right, rgb(136, 136, 136) 0%, rgb(136, 136, 136) 100%);
        background-size: 100% 1px;
        background-repeat: no-repeat;
        background-position: top;
      }
      @bottom-right {
        content: counter(page);
        font-family: 'Poppins', sans-serif;
        font-size: 9px;
        color: rgb(136, 136, 136);
        font-weight: 400;
        margin-top: 12px;
        padding-top: 4px;
        background-image: linear-gradient(to right, rgb(136, 136, 136) 0%, rgb(136, 136, 136) 100%);
        background-size: 100% 1px;
        background-repeat: no-repeat;
        background-position: top;
      }
    }

    @page cover {
      margin: 0;
      padding: 0;
      @bottom-left { content: none; }
      @bottom-right { content: none; }
    }

    @page toc {
      margin: 20mm;
    }

    @page intro {
      margin: 20mm;
    }

    @page first {
      margin: 20mm;
      counter-reset: page 1;
    }

    .toc-page {
      page: toc;
      page-break-after: always;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: calc(100vh - 40mm);
      padding: 0;
    }

    .toc-title {
      font-size: 22px;
      font-weight: 700;
      color: #000;
      line-height: 1.5;
      margin: 0 0 7rem 0;
      text-align: left;
      padding-bottom: 0.6rem;
      border-bottom: 1.5px solid #000;
    }

    .toc-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .toc-item {
      margin-bottom: 1rem;
      page-break-inside: avoid;
    }

    .toc-chapter-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #000;
      margin-bottom: 0.15rem;
      line-height: 1.4;
    }

    .toc-item-body {
      display: block;
      position: relative;
      padding-right: 8rem;
      line-height: 1.6;
    }

    .toc-item-body::before {
      content: "";
      position: absolute;
      bottom: 0.45em;
      left: 0;
      right: 0;
      border-bottom: 1.5px dotted #999;
    }

    .toc-chapter-title {
      font-size: 13px;
      font-weight: 400;
      color: #000;
      background: white;
      position: relative;
      z-index: 1;
      padding-right: 3px;
    }

    .toc-page-number {
      position: absolute;
      right: 0;
      bottom: 0;
      font-size: 13px;
      font-weight: 500;
      color: #000;
      background: white;
      z-index: 1;
      padding-left: 3px;
      line-height: 1.6;
    }

    /* --- INTRODUCTION PAGE --- */
    .introduction-page {
      page: intro;
      page-break-before: always;
      page-break-after: always;
      padding: 1rem 0;
    }

    .introduction-title {
      font-size: 22px;
      font-weight: 700;
      color: #000;
      line-height: 1.5;
      margin: 0 0 1.8rem 0;
      text-align: left;
      padding-bottom: 0.6rem;
      border-bottom: 1.5px solid #000;
    }

    .introduction-content {
      margin-top: 1rem;
    }

    .introduction-content .paragraph {
      margin-bottom: 20px;
      text-align: justify;
      line-height: 1.8;
    }

    .introduction-content .drop-cap::first-letter {
      float: left;
      font-size: 4em;
      line-height: 0.8;
      padding-right: 8px;
      padding-top: 4px;
      font-weight: 700;
      color: #333;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
    }

    .chapter { padding: 1rem 0; margin-bottom: 2rem; position: relative; }
    .chapter:first-of-type { page: first; page-break-before: always; }
    .chapter:not(:first-of-type) { page-break-before: always; margin-top: 0; }
    .chapter-content { position: relative; }
    .chapter-content:empty { display: none; }
    .chapter-content::after { content: ""; display: block; height: 1px; clear: both; }
    .chapter-header { text-align: center; margin-top: 2rem; margin-bottom: 18rem; page-break-inside: avoid; page-break-after: avoid; }
    .chapter:first-of-type .chapter-header { margin-top: 5rem; margin-bottom: 18rem; }
    .chapter-image-container { width: 100%; margin: 2.5rem 0; page-break-inside: avoid; page-break-before: auto; page-break-after: auto; position: relative; display: flex; justify-content: center; align-items: center; }
    .chapter-image { width: 100%; max-width: 100%; height: auto; display: block; border-radius: 8px; object-fit: contain; object-position: center; max-height: calc(100vh - 8rem); }
    .text-block { margin-bottom: 1.5rem; }
    .text-block:last-child { margin-bottom: 0; }
    .paragraph { margin-bottom: 20px; text-align: justify; line-height: 1.8; }
    .cover-page { page: cover; page-break-after: always; page-break-inside: avoid; position: relative; width: 210mm; height: 297mm; margin: 0; padding: 0; overflow: hidden; }
    .cover-page > img.cover-image { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    .cover-logo { position: absolute; top: 2%; left: 50%; transform: translateX(-50%); width: auto; height: 40px; z-index: 25; }
    .cover-title-section { position: absolute; top: 4%; left: 11; right: 5; text-align: center; z-index: 20; width: 97%; background: linear-gradient(to bottom, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 70%, rgba(255, 255, 255, 0.95) 85%, rgba(255, 255, 255, 0) 100%); height: 230px; padding: 1rem 2rem 1rem 2rem; display: flex; align-items: center; justify-content: center; }
    .cover-subtitle-section { position: absolute; bottom: 0; left: 11; right: 5; text-align: center; z-index: 20; width: 97%; background: linear-gradient(to top, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 70%, rgba(255, 255, 255, 0.95) 85%, rgba(255, 255, 255, 0) 100%); height: 180px; padding: 0 2rem; display: flex; align-items: center; justify-content: center; }
    .cover-title { font-size: clamp(28px, 5vw, 42px); font-weight: 800; margin-bottom: 1rem; line-height: 1.5; letter-spacing: 0.01em; word-wrap: break-word; hyphens: manual; color: #1a1a1a; position: relative; padding: 1.5rem 0; }
    .cover-title::before, .cover-title::after, .cover-subtitle::before, .cover-subtitle::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: 95.5%; height: 1px; background-color: #4a4a4a; opacity: 0.8; }
    .cover-title::before { top: 0; }
    .cover-title::after { bottom: 0; }
    .cover-title.very-long { font-size: clamp(24px, 4vw, 32px); line-height: 1.5; }
    .cover-subtitle { font-size: clamp(20px, 4vw, 35px); font-weight: 500; margin-bottom: 0; line-height: 1.7; letter-spacing: 0.01em; color: #2a2a2a; text-shadow: 0 0 15px rgba(255, 255, 255, 1), 0 0 30px rgba(255, 255, 255, 0.8); position: relative; padding: 1.5rem 0; margin: 1rem auto; display: inline-block; }
    .cover-subtitle::before { top: 0; }
    .cover-subtitle::after { bottom: 0; }
    .cover-image-container { position: absolute; top: 54%; left: 50%; transform: translateX(-50%) translateY(-50%); width: 95.5%; aspect-ratio: 1024 / 1024; z-index: 5; }
    .cover-image { width: 100%; height: 100%; object-fit: cover; display: block; }
    .cover-fallback { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 85%; aspect-ratio: 1024 / 1536; background: linear-gradient(145deg, #4a5568 0%, #2d3748 50%, #1a202c 100%); color: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 100px rgba(0, 0, 0, 0.2); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 3rem; z-index: 5; position: relative; overflow: hidden; }
    .cover-fallback::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.03) 0%, transparent 50%); transform: rotate(45deg); }
    .cover-fallback .cover-header, .cover-fallback .cover-title, .cover-fallback .cover-subtitle { position: relative; z-index: 1; }
    .cover-fallback .cover-header { color: rgba(255, 255, 255, 0.95); text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5); }
    .cover-fallback .cover-title { color: white; text-shadow: 0 4px 12px rgba(0, 0, 0, 0.6); font-size: clamp(32px, 5vw, 48px); }
    .cover-fallback .cover-subtitle { color: rgba(255, 255, 255, 0.9); text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5); }
    .chapter-number { font-size: 14px; font-weight: 400; color: #666; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px; }
    .chapter-title { font-size: 24px; font-weight: 700; color: #000; line-height: 2; margin: 0; }
    .section-header { font-size: 16px; font-weight: 700; margin: 30px 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .no-content { font-style: italic; color: #666; text-align: center; padding: 2rem; }
    .drop-cap::first-letter { float: left; font-size: 4em; line-height: 0.8; padding-right: 8px; padding-top: 4px; font-weight: 700; color: #333; text-shadow: 1px 1px 2px rgba(0,0,0,0.1); }
    p { orphans: 2; widows: 2; page-break-inside: auto; }
    h1, h2, h3, h4, h5, h6 { page-break-after: avoid; page-break-inside: avoid; orphans: 2; widows: 2; }
    div:empty { display: none; }
  `;
}

function generateCoverPage(coverImageUrl: string): string {
  return `
    <div class="cover-page">
      <img src="${coverImageUrl}" alt="Okładka" class="cover-image" />
    </div>
  `;
}

function generateTableOfContents(chapters: Chapter[], chapterPageMapping: ChapterPageMapping, introPageNumber?: number): string {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return '';
  }

  // Introduction jako pierwszy wpis w TOC
  const introItem = introPageNumber && introPageNumber > 0 ? `
    <li class="toc-item">
      <span class="toc-item-body">
        <span class="toc-chapter-title">Introduction</span>
        <span class="toc-page-number">s.${introPageNumber}</span>
      </span>
    </li>
  ` : '';

  const tocItems = chapters.map((chapter, index) => {
    const pageNumber = chapterPageMapping[chapter.id] || 0;
    const pageDisplay = pageNumber > 0 ? `s.${pageNumber}` : 's.0';

    return `
      <li class="toc-item">
        <span class="toc-chapter-label">Chapter ${index + 1}.</span>
        <span class="toc-item-body">
          <span class="toc-chapter-title">${escapeHtml(chapter.title || '')}</span>
          <span class="toc-page-number">${pageDisplay}</span>
        </span>
      </li>
    `;
  }).join('');

  return `
    <div class="toc-page">
      <h2 class="toc-title">Table of content:</h2>
      <ul class="toc-list">
        ${introItem}
        ${tocItems}
      </ul>
    </div>
  `;
}

// =====================================================================
//  GENEROWANIE STRONY INTRODUCTION
// =====================================================================

function generateIntroductionPage(introText: string): string {
  const paragraphs = introText.split('\n\n').filter(p => p.trim());

  let htmlContent = '';
  let firstContentParagraph = true;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (isSectionHeader(trimmed)) {
      htmlContent += `<h3 class="section-header">${escapeHtml(trimmed)}</h3>`;
      firstContentParagraph = true;
    } else {
      const paragraphClass = firstContentParagraph ? 'paragraph drop-cap' : 'paragraph';
      htmlContent += `<p class="${paragraphClass}">${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
      firstContentParagraph = false;
    }
  }

  return `
    <div class="introduction-page">
      <h2 class="introduction-title">Introduction</h2>
      <div class="introduction-content">
        ${htmlContent}
      </div>
    </div>
  `;
}

function generateChaptersContent(chapters: Chapter[]): string {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return '<div class="no-content">Brak rozdziałów do wyświetlenia.</div>';
  }
  return chapters.map((chapter, index) => `
      <div class="chapter" id="chapter-${index + 1}">
        <div class="chapter-header">
          <div class="chapter-number">Rozdział ${index + 1}.</div>
          <h2 class="chapter-title">${escapeHtml(chapter.title || '')}</h2>
        </div>
        <div class="chapter-content">
          ${generateChapterContent(chapter.content || '', chapter.image_url, chapter, index)}
        </div>
      </div>
    `).join('');
}

function generateChapterContent(content: string, imageUrl: string | null, chapter: any, chapterIndex: number): string {
  if (!content.trim()) {
    return '<p class="no-content">Brak treści dla tego rozdziału.</p>';
  }

  const finalImageUrl = chapter.optimizedImageBase64 || imageUrl;

  const paragraphs = content.split('\n\n').filter((p) => p.trim());
  let startIndex = 0;
  if (paragraphs.length > 0) {
    const firstParagraph = paragraphs[0].trim();
    if (firstParagraph.match(/^\d+\.\s+/) || firstParagraph.length < 100) {
      startIndex = 1;
    }
  }
  let htmlContent = '';
  let imageInserted = false;
  let firstContentParagraph = true;
  const contentParagraphs = paragraphs.slice(startIndex);
  const imagePosition = 2;
  for (let i = 0; i < contentParagraphs.length; i++) {
    const paragraph = contentParagraphs[i].trim();
    if (!paragraph) continue;
    if (finalImageUrl && !imageInserted && i === imagePosition) {
      htmlContent += `<div class="chapter-image-container"><img src="${finalImageUrl}" alt="Ilustracja rozdziału ${chapterIndex + 1}" class="chapter-image" /></div>`;
      imageInserted = true;
    }
    if (isSectionHeader(paragraph)) {
      htmlContent += `<h3 class="section-header">${escapeHtml(paragraph)}</h3>`;
      firstContentParagraph = true;
    } else {
      const paragraphClass = firstContentParagraph ? 'paragraph drop-cap' : 'paragraph';
      htmlContent += `<p class="${paragraphClass}">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`;
      firstContentParagraph = false;
    }
  }
  return htmlContent;
}

function isSectionHeader(text: string): boolean {
  const trimmedText = text.trim();
  return (
    trimmedText.split('\n').length === 1 &&
    trimmedText.length > 0 &&
    trimmedText.length < 80 &&
    !trimmedText.endsWith('.') &&
    !trimmedText.endsWith(':') &&
    trimmedText === trimmedText.toUpperCase()
  );
}

function escapeHtml(text: string): string {
  if (typeof text !== 'string') return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}