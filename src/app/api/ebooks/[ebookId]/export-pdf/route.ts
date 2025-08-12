// src/app/api/ebooks/[ebookId]/export-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  try {
    // Autoryzacja przez session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // --- Pobierz ebookId z params ---
    const resolvedParams = await params;
    const ebookId = resolvedParams.ebookId;

    if (!ebookId) {
      return NextResponse.json({ error: 'Brak ebookId w ścieżce URL.' }, { status: 400 });
    }

    const ebookIdNum = parseInt(ebookId);
    if (isNaN(ebookIdNum)) {
      return NextResponse.json({ error: 'Nieprawidłowy ebookId.' }, { status: 400 });
    }

    console.log(`📄 Rozpoczęcie eksportu PDF dla ebooka ${ebookId}`);

    // --- Pobierz dane ebooka z okładką przez Prisma ---
    const ebook = await prisma.ebooks.findFirst({
      where: {
        id: ebookIdNum,
        userId: session.user.id
      },
      include: {
        ebook_chapters: {
          select: {
            id: true,
            title: true,
            content: true,
            image_url: true,
            position: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony lub nie masz uprawnień' }, { status: 404 });
    }

    const { title, subtitle, cover_image_url, ebook_chapters: chapters, authorDisplayName, authorLogoUrl } = ebook;

    console.log(`📚 Ebook: "${title}"${subtitle ? ` - ${subtitle}` : ''}`);
    console.log(`🖼️  Okładka: ${cover_image_url ? 'dostępna' : 'brak'}`);
    console.log(`📖 Rozdziały: ${chapters?.length || 0}`);

    // --- Generowanie HTML dla PDF z okładką ---
    const htmlContent = generateHTMLContent(title, subtitle, chapters, cover_image_url, authorDisplayName, authorLogoUrl);

    // --- POPRAWIONA KONFIGURACJA PUPPETEER DLA RAILWAY ---
    let browser;
    let executablePath: string;

    const isProduction = process.env.NODE_ENV === 'production';

    console.log(`🔍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`🔍 Platform: ${process.platform}`);

    if (isProduction) {
      try {
        executablePath = await chromium.executablePath();
        console.log(`✅ Chromium path (production): ${executablePath}`);
      } catch (error) {
        console.error(`❌ Failed to get chromium path:`, error);
        throw new Error('Cannot find Chromium executable in production');
      }
    } else {
      const localPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
      ];
      executablePath = localPaths.find((p) => fs.existsSync(p)) || '';
      console.log(`🔍 Local Chrome path: ${executablePath}`);
    }

    if (!executablePath) {
      console.log(`⚠️ No executable path found, trying chromium fallback...`);
      try {
        executablePath = await chromium.executablePath();
        console.log(`✅ Fallback chromium path: ${executablePath}`);
      } catch (error) {
        console.error(`❌ Fallback chromium failed:`, error);
        throw new Error('Cannot find any Chrome/Chromium executable');
      }
    }

    console.log(`🚀 Final executable path: ${executablePath}`);

    console.log(`🚀 Uruchamianie Puppeteer (${isProduction ? 'produkcja' : 'rozwój'})`);

    const launchArgs = isProduction ? [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-images',
      '--disable-javascript',
      '--disable-fonts',
      '--no-first-run',
      '--disable-default-apps'
    ] : chromium.args;

    console.log(`🚀 Launch args: ${launchArgs.join(' ')}`);

    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      ignoreDefaultArgs: false,
      timeout: 30000
    });

    const page = await browser.newPage();

    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    console.log(`🔄 Generowanie PDF...`);

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '25mm',
        left: '20mm',
      },
      printBackground: true,
      displayHeaderFooter: false,
      preferCSSPageSize: true,
      timeout: 60000,
      scale: 1,
      tagged: false,
      outline: false,
      omitBackground: false,
      landscape: false,
      pageRanges: '',
    });

    await browser.close();

    let fileName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (subtitle && subtitle.trim()) {
      fileName += '_' + subtitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }
    fileName = fileName.substring(0, 100);

    console.log(`✅ PDF wygenerowany: ${fileName}.pdf (${pdfBuffer.length} bajtów)`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('❌ Błąd podczas generowania PDF:', error);
    return NextResponse.json(
      {
        error: 'Wystąpił błąd podczas generowania PDF',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

// ========================================================================
//                    FUNKCJE POMOCNICZE - INTELIGENTNA KONTROLA GRAFIK
// ========================================================================

function generateHTMLContent(title: string, subtitle: string | null, chapters: any[], coverImageUrl?: string | null, authorDisplayName?: string | null, authorLogoUrl?: string | null): string {
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet">
      <style>
        ${generateAdvancedCSS(title, subtitle, authorDisplayName)}
      </style>
    </head>
    <body>
      ${generateCoverPage(title, subtitle, coverImageUrl, authorLogoUrl)}
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
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Poppins', sans-serif;
      font-size: 18px;
      line-height: 1.6;
      color: #000;
      background: white;
    }

    /* ========== STOPKA PRZEZ CSS ========== */
    @page {
      margin: 20mm;
      counter-increment: page;
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
      counter-reset: page 0;
      @bottom-left { content: none; }
      @bottom-right { content: none; }
    }

    @page first {
      margin: 20mm;
      counter-reset: page 1;
      @bottom-left { content: none; }
      @bottom-right { content: none; }
    }

    /* ========== NAPRAWIONA KONTROLA PRZEŁAMAŃ STRON ========== */
    .chapter {
      padding: 1rem 0;
      margin-bottom: 2rem;
      position: relative;
    }

    .chapter:first-of-type {
      page: first;
      page-break-before: avoid;
    }

    /* KLUCZOWA NAPRAWA: Usunięcie wymuszania nowych stron dla każdego rozdziału */
    .chapter:not(:first-of-type) {
      page-break-before: always; /* ZMIEŃ z 'auto' na 'always' */
      margin-top: 0;
    }

    .chapter-content {
      position: relative;
    }

    .chapter-content:empty {
      display: none;
    }

    .chapter-content::after {
      content: "";
      display: block;
      height: 1px;
      clear: both;
    }

    /* ZACHOWANY ORYGINALNY MARGINES PO TYTULE ROZDZIAŁU */
    .chapter-header {
      text-align: center;
      margin-top: 2rem;
      margin-bottom: 18rem; /* ZACHOWANE zgodnie z życzeniem użytkownika */
      page-break-inside: avoid;
      page-break-after: avoid;
    }

    .chapter:first-of-type .chapter-header {
      margin-top: 5rem;
      margin-bottom: 18rem; /* ZACHOWANE zgodnie z życzeniem użytkownika */
    }

    /* ========== ZAAWANSOWANA KONTROLA GRAFIK - PEŁNE PREZENTOWANIE ========== */
    .chapter-image-container {
      width: 100%;
      margin: 2.5rem 0;
      page-break-inside: avoid;
      page-break-before: auto;
      page-break-after: auto;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    /* KLUCZOWA ZMIANA: Grafiki prezentowane w pełnym rozmiarze */
    .chapter-image {
      width: 100%;
      max-width: 100%;
      height: auto;
      display: block;
      border-radius: 8px;
      object-fit: contain;
      object-position: center;
      max-height: calc(100vh - 8rem);
    }

    /* Inteligentne zarządzanie wielkimi grafikami */
    .chapter-image-container.large-image {
      page-break-before: always;
      margin: 1rem 0;
    }

    .chapter-image-container.large-image .chapter-image {
      max-height: calc(100vh - 6rem);
    }

    /* Zabezpieczenie przed zbyt małymi grafikami na końcu strony */
    .chapter-image-container.avoid-page-end {
      page-break-before: always;
    }

    /* Kontrola obrazów na końcu rozdziału */
    .chapter-image-container.end-image {
      margin: 2rem 0 1rem 0;
      page-break-before: auto;
    }

    /* Kontrola obrazów na początku rozdziału */
    .chapter-image-container.start-image {
      margin: 1rem 0 2rem 0;
      page-break-after: auto;
    }

    /* Zabezpieczenie przed samotnymi obrazami na stronie */
    .chapter-image-container + .chapter-image-container {
      margin-top: 0.5rem;
    }

    /* ========== ELEGANCKA KONTROLA TEKSTU WOKÓŁ GRAFIK ========== */
    .text-block {
      margin-bottom: 1.5rem;
    }

    .text-block:last-child {
      margin-bottom: 0;
    }

    .pre-image-text {
      margin-bottom: 2rem;
      page-break-after: auto;
    }

    .post-image-text {
      margin-top: 2rem;
      page-break-before: avoid;
    }

    /* Zabezpieczenie przed sierotkami przy grafikach */
    .text-before-image {
      orphans: 3;
      page-break-after: auto;
    }

    .text-after-image {
      widows: 3;
      page-break-before: avoid;
    }

    /* Ulepszona kontrola pierwszego i ostatniego paragrafu */
    .paragraph.first-paragraph {
      margin-top: 0;
    }

    .paragraph.last-paragraph {
      margin-bottom: 2rem;
      page-break-after: auto;
    }

    /* ========== INTELIGENTNE ZARZĄDZANIE PRZESTRZENIĄ W DRUKU ========== */
    @media print {
      .chapter {
        page-break-inside: auto;
        orphans: 2; /* ZMNIEJSZONE z 3 - mniej restrykcyjne */
        widows: 2;  /* ZMNIEJSZONE z 3 - mniej restrykcyjne */
      }

      .chapter-header {
        page-break-after: avoid;
        page-break-inside: avoid;
      }

      .section-header {
        page-break-after: avoid;
        page-break-inside: avoid;
      }

      .cover-page {
        page-break-inside: avoid;
        page-break-after: always;
      }

      .paragraph {
        orphans: 2; /* ZMIENIONE z 3 na 2 */
        widows: 2;  /* ZMIENIONE z 3 na 2 */
      }

      /* NAPRAWA: Usunięcie wymuszania nowych stron dla rozdziałów */
      .chapter:not(:first-of-type) {
        page-break-before: always; /* ZMIEŃ z 'auto' na 'always' */
      }

      /* KLUCZOWA ZMIANA: Inteligentna kontrola grafik w druku */
      .chapter-image-container {
        page-break-inside: avoid;
        page-break-before: auto;
        margin: 1.5rem 0;
      }

      .chapter-image {
        max-height: calc(100vh - 8rem);
        object-fit: contain;
        width: 100%;
        height: auto;
      }

      /* Specjalne zasady dla dużych grafik */
      .chapter-image-container.large-image {
        page-break-before: always;
        margin: 1rem 0;
      }

      .chapter-image-container.large-image .chapter-image {
        max-height: calc(100vh - 6rem);
      }

      /* Elastyczne zarządzanie tekstem wokół grafik */
      .pre-image-text {
        page-break-after: auto;
      }

      .post-image-text {
        page-break-before: avoid;
      }

      /* Zabezpieczenie przed pustymi końcami stron */
      .text-block:has(+ .chapter-image-container) {
        page-break-after: auto;
        orphans: 4;
      }
    }

    /* ========== OKŁADKA ========== */
    .cover-page {
      page: cover;
      page-break-after: always;
      page-break-inside: avoid;
      height: 100vh;
      width: 100vw;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
      background: white;
      margin: 0;
      padding: 0;
    }

    .cover-logo {
      position: absolute;
      top: 2%;
      left: 50%;
      transform: translateX(-50%);
      width: auto;
      height: 40px;
      z-index: 25;
    }

    .cover-title-section {
      position: absolute;
      top: 6%;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 20;
      width: 100%;
      background: linear-gradient(to bottom,
        rgba(255, 255, 255, 1) 0%,
        rgba(255, 255, 255, 1) 70%,
        rgba(255, 255, 255, 0.95) 85%,
        rgba(255, 255, 255, 0) 100%
      );
      padding: 1rem 3rem 1rem 3rem;
    }

    .cover-subtitle-section {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      z-index: 20;
      width: 100%;
      background: linear-gradient(to top,
        rgba(255, 255, 255, 1) 0%,
        rgba(255, 255, 255, 1) 70%,
        rgba(255, 255, 255, 0.95) 85%,
        rgba(255, 255, 255, 0) 100%
      );
      padding: 1rem 2rem 1rem 2rem;
    }

    .cover-header {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 1.2rem;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: #555;
    }

    .cover-title {
      font-size: clamp(28px, 5vw, 42px);
      font-weight: 800;
      margin-bottom: 1rem;
      line-height: 1.5;
      letter-spacing: 0.01em;
      word-wrap: break-word;
      hyphens: manual;
      color: #1a1a1a;
      position: relative;
      padding: 1.5rem 0;
    }

    .cover-title::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 95%;
      height: 1px;
      background-color: #4a4a4a;
      opacity: 0.8;
    }

    .cover-title::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 95%;
      height: 1px;
      background-color: #4a4a4a;
      opacity: 0.8;
    }

    .cover-title.very-long {
      font-size: clamp(24px, 4vw, 32px);
      line-height: 1.5;
    }

    .cover-subtitle {
      font-size: clamp(20px, 4vw, 35px);
      font-weight: 500;
      margin-bottom: 0;
      line-height: 1.7;
      letter-spacing: 0.01em;
      color: #2a2a2a;
      text-shadow:
        0 0 15px rgba(255, 255, 255, 1),
        0 0 30px rgba(255, 255, 255, 0.8);
      position: relative;
      padding: 1.5rem 0;
      margin: 1rem auto;
      display: inline-block;
    }

    .cover-subtitle::before {
      content: '';
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 95%;
      height: 1px;
      background-color: #4a4a4a;
      opacity: 0.8;
    }

    .cover-subtitle::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 95%;
      height: 1px;
      background-color: #4a4a4a;
      opacity: 0.8;
    }

    .cover-image-container {
      position: absolute;
      top: 54%;
      left: 50%;
      transform: translateX(-50%) translateY(-50%);
      width: 95%;
      aspect-ratio: 1024 / 1024;
      z-index: 5;
    }

    .cover-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      display: block;
      position: relative;
      z-index: 0;
    }

    .cover-fallback {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 85%;
      aspect-ratio: 1024 / 1536;
      background: linear-gradient(145deg, #4a5568 0%, #2d3748 50%, #1a202c 100%);
      color: white;
      border-radius: 20px;
      box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.4),
        0 0 100px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 3rem;
      z-index: 5;
      position: relative;
      overflow: hidden;
    }

    .cover-fallback::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(
        circle at 20% 30%,
        rgba(255, 255, 255, 0.03) 0%,
        transparent 50%
      );
      transform: rotate(45deg);
    }

    .cover-fallback .cover-header {
      color: rgba(255, 255, 255, 0.95);
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .cover-fallback .cover-title {
      color: white;
      text-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
      font-size: clamp(32px, 5vw, 48px);
      margin-bottom: 1.2rem;
      position: relative;
      z-index: 1;
    }

    .cover-fallback .cover-subtitle {
      color: rgba(255, 255, 255, 0.9);
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      position: relative;
      z-index: 1;
    }

    /* ========== STYLE ROZDZIAŁÓW ========== */
    .chapter-number {
      font-size: 14px;
      font-weight: 400;
      color: #666;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .chapter-title {
      font-size: 24px;
      font-weight: 700;
      color: #000;
      line-height: 1.2;
      margin: 0;
    }

    .paragraph {
      margin-bottom: 20px;
      text-align: justify;
      line-height: 1.8;
    }

    .section-header {
      font-size: 16px;
      font-weight: 700;
      margin: 30px 0 15px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .no-content {
      font-style: italic;
      color: #666;
      text-align: center;
      padding: 2rem;
    }

    .drop-cap {
      position: relative;
    }

    .drop-cap::first-letter {
      float: left;
      font-size: 4em;
      line-height: 0.8;
      padding-right: 8px;
      padding-top: 4px;
      font-weight: 700;
      color: #333;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
    }

    /* ========== KONTROLA SIEROT I WDÓW ========== */
    p {
      orphans: 2; /* ZMNIEJSZONE z 3 - mniej restrykcyjne */
      widows: 2;  /* ZMNIEJSZONE z 3 - mniej restrykcyjne */
      page-break-inside: auto;
    }

    h1, h2, h3, h4, h5, h6 {
      page-break-after: avoid;
      page-break-inside: avoid;
      orphans: 2;
      widows: 2;
    }

    div:empty {
      display: none;
    }

    .chapter + .chapter {
      margin-top: 3rem;
    }
  `;
}

function generateCoverPage(title: string, subtitle: string | null, coverImageUrl?: string | null, authorLogoUrl?: string | null): string {
  const titleClass = title.length > 60 ? 'cover-title very-long' : 'cover-title';

  if (coverImageUrl && coverImageUrl.trim()) {
    return `
      <div class="cover-page">
        ${authorLogoUrl
            ? `<img src="${authorLogoUrl}" alt="Logo Autora" class="cover-logo" />`
            : ''
        }

        <div class="cover-title-section">
          <h1 class="${titleClass}">${escapeHtml(title)}</h1>
        </div>

        <div class="cover-image-container">
          <img
            src="${coverImageUrl}"
            alt="Okładka ebooka"
            class="cover-image"
            loading="eager"
            onerror="this.parentElement.style.display='none'; document.querySelector('.cover-fallback').style.display='flex';"
          />
        </div>

        ${subtitle && subtitle.trim() ? `
        <div class="cover-subtitle-section">
          <h2 class="cover-subtitle">${escapeHtml(subtitle)}</h2>
        </div>
        ` : ''}

        <div class="cover-fallback" style="display: none;">
          <h1 class="${titleClass}">${escapeHtml(title)}</h1>
          ${subtitle && subtitle.trim() ? `<h2 class="cover-subtitle">${escapeHtml(subtitle)}</h2>` : ''}
        </div>
      </div>
    `;
  } else {
    return `
      <div class="cover-page">
        ${authorLogoUrl
            ? `<img src="${authorLogoUrl}" alt="Logo Autora" class="cover-logo" />`
            : ''
        }

        <div class="cover-fallback" style="display: flex;">
          <h1 class="${titleClass}">${escapeHtml(title)}</h1>
          ${subtitle && subtitle.trim() ? `<h2 class="cover-subtitle">${escapeHtml(subtitle)}</h2>` : ''}
        </div>
      </div>
    `;
  }
}

function generateChaptersContent(chapters: any[]): string {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return '<div class="no-content">Brak rozdziałów do wyświetlenia.</div>';
  }

  return chapters
    .map((chapter, index) => {
      const chapterNumber = `Rozdział ${index + 1}.`;
      const chapterTitle = chapter.title || '';
      const content = chapter.content || '';
      const imageUrl = chapter.image_url;

      return `
      <div class="chapter">
        <div class="chapter-header">
          <div class="chapter-number">${escapeHtml(chapterNumber)}</div>
          <h2 class="chapter-title">${escapeHtml(chapterTitle)}</h2>
        </div>
        <div class="chapter-content">
          ${generateChapterContent(content, imageUrl, index)}
        </div>
      </div>
    `;
    })
    .join('');
}

// UPROSZCZONA FUNKCJA generateChapterContent - grafika zawsze po 2. akapicie
function generateChapterContent(
  content: string,
  imageUrl: string | null,
  chapterIndex: number
): string {
  if (!content.trim()) {
    return '<p class="no-content">Brak treści dla tego rozdziału.</p>';
  }

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

  // NAJPROSTSZE: Grafika zawsze po 2. akapicie
  const imagePosition = 2;

  console.log(`📍 Rozdział ${chapterIndex + 1}: ${contentParagraphs.length} paragrafów, obraz po ${imagePosition}. akapicie`);

  for (let i = 0; i < contentParagraphs.length; i++) {
    const paragraph = contentParagraphs[i].trim();
    if (!paragraph) continue;

    // Wstaw obraz po 2. akapicie
    if (imageUrl && !imageInserted && i === imagePosition) {
      htmlContent += `
        <div class="chapter-image-container">
          <img src="${imageUrl}" alt="Ilustracja rozdziału ${chapterIndex + 1}" class="chapter-image" />
        </div>
      `;
      imageInserted = true;
    }

    // Przetwarzaj paragraf
    if (isSectionHeader(paragraph)) {
      htmlContent += `<h3 class="section-header">${escapeHtml(paragraph)}</h3>`;
      firstContentParagraph = true;
    } else {
      const paragraphClass = firstContentParagraph ? 'paragraph drop-cap' : 'paragraph';
      htmlContent += `<p class="${paragraphClass}">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`;
      firstContentParagraph = false;
    }
  }

  // Grafika zostanie zawsze wstawiona po 2. akapicie (jeśli istnieje)
  // Nie ma potrzeby dodawania na końcu

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
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}