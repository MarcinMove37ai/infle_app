// src/app/api/ebooks/[ebookId]/export-pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import path from 'path';

// --- NOWA FUNKCJA POMOCNICZA DO OPTYMALIZACJI GRAFIK ---
async function optimizeAndEncodeImages(chapters: any[], baseUrl: string): Promise<any[]> {
  const optimizedChapters = await Promise.all(
    chapters.map(async (chapter) => {
      if (!chapter.image_url) {
        return chapter;
      }

      try {
        const imageUrl = new URL(chapter.image_url, baseUrl).href;
        console.log(`🖼️  Optymalizowanie obrazu dla rozdziału "${chapter.title}": ${imageUrl}`);

        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Nie udało się pobrać obrazu: ${response.statusText}`);
        }
        const imageBuffer = await response.arrayBuffer();

        // Używamy sharp do zmiany rozmiaru i kompresji
        const optimizedBuffer = await sharp(Buffer.from(imageBuffer))
          .resize({
            width: 700, // Optymalna szerokość dla strony A4
            fit: 'inside', // Zachowaj proporcje, nie powiększaj mniejszych obrazów
            withoutEnlargement: true,
          })
          .webp({ quality: 75 }) // Dobra kompresja, zachowując jakość
          .toBuffer();

        const base64Image = optimizedBuffer.toString('base64');
        return {
          ...chapter,
          // Dodajemy nowe pole ze zoptymalizowanym obrazem w formacie Base64
          optimizedImageBase64: `data:image/webp;base64,${base64Image}`,
        };
      } catch (error) {
        console.warn(`⚠️ Nie udało się zoptymalizować obrazu dla rozdziału "${chapter.title}". Użycie oryginalnego URL. Błąd:`, error);
        // W razie błędu, wracamy do oryginalnego URL, aby nie przerwać całego procesu
        return chapter;
      }
    })
  );
  return optimizedChapters;
}
// --- KONIEC NOWEJ FUNKCJI ---

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  let browser;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

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

    const ebook = await prisma.ebooks.findFirst({
      where: { id: ebookIdNum, userId: session.user.id },
      include: {
        ebook_chapters: {
          select: { id: true, title: true, content: true, image_url: true, position: true },
          orderBy: { position: 'asc' }
        }
      }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony lub nie masz uprawnień' }, { status: 404 });
    }

    const { title, subtitle, cover_image_url, ebook_chapters: chapters, authorDisplayName, authorLogoUrl } = ebook;

    // --- KROK 1: Uruchomienie optymalizacji grafik przed generowaniem HTML ---
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const chaptersWithOptimizedImages = await optimizeAndEncodeImages(chapters, baseUrl);
    // --- KONIEC KROKU 1 ---

    console.log(`📚 Ebook: "${title}"${subtitle ? ` - ${subtitle}` : ''}`);
    console.log(`🖼️  Okładka: ${cover_image_url ? 'dostępna' : 'brak'}`);
    console.log(`📖 Rozdziały: ${chaptersWithOptimizedImages?.length || 0}`);

    // Przekazujemy rozdziały ze zoptymalizowanymi obrazami do generatora HTML
    const htmlContent = generateHTMLContent(title, subtitle, chaptersWithOptimizedImages, cover_image_url, authorDisplayName, authorLogoUrl);

    let executablePath: string;
    const isProduction = process.env.NODE_ENV === 'production';
    console.log(`🔍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`🔍 Platform: ${process.platform}`);

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
    }
     if (!executablePath) {
        executablePath = await chromium.executablePath();
    }
    console.log(`🚀 Final executable path: ${executablePath}`);
    console.log(`🚀 Uruchamianie Puppeteer (${isProduction ? 'produkcja' : 'rozwój'})`);

    const minimal_args = [
      '--autoplay-policy=user-gesture-required', '--disable-background-networking', '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows', '--disable-breakpad', '--disable-client-side-phishing-detection',
      '--disable-component-update', '--disable-default-apps', '--disable-dev-shm-usage', '--disable-domain-reliability',
      '--disable-extensions', '--disable-features=AudioServiceOutOfProcess', '--disable-hang-monitor', '--disable-ipc-flooding-protection',
      '--disable-notifications', '--disable-offer-store-unmasked-wallet-cards', '--disable-popup-blocking', '--disable-print-preview',
      '--disable-prompt-on-repost', '--disable-renderer-backgrounding', '--disable-setuid-sandbox', '--disable-speech-api',
      '--disable-sync', '--hide-scrollbars', '--ignore-gpu-blacklist', '--metrics-recording-only', '--mute-audio',
      '--no-default-browser-check', '--no-first-run', '--no-pings', '--no-sandbox', '--no-zygote', '--password-store=basic',
      '--use-gl=swiftshader', '--use-mock-keychain',
    ];
    const launchArgs = isProduction ? minimal_args : minimal_args.filter(arg => arg !== '--no-sandbox' && arg !== '--disable-setuid-sandbox');
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

    await page.setViewport({ width: 795, height: 1125 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log('🔄 Krok 1: Generowanie zrzutu ekranu dla mockupów (z tekstem)...');
    const rawCoverBuffer = await page.screenshot({ type: 'webp', quality: 85 });
    console.log('✅ Zrzut ekranu dla mockupów wygenerowany w pamięci.');

    console.log('🔄 Krok 2: Modyfikowanie DOM w celu ukrycia tekstu na okładce...');
    await page.evaluate(() => {
      const titleEl = document.querySelector('.cover-title');
      const subtitleEl = document.querySelector('.cover-subtitle');
      if (titleEl) (titleEl as HTMLElement).style.visibility = 'hidden';
      if (subtitleEl) (subtitleEl as HTMLElement).style.visibility = 'hidden';
    });

    console.log('🔄 Krok 2b: Generowanie zrzutu ekranu szablonu tła (bez tekstu)...');
    const coverTemplateBuffer = await page.screenshot({ type: 'webp', quality: 95 });
    console.log('✅ Szablon tła okładki wygenerowany w pamięci.');

    console.log('🔄 Krok 3: Modyfikowanie DOM w celu użycia tła i przywrócenia tekstu...');
    const coverTemplateDataUrl = `data:image/webp;base64,${(coverTemplateBuffer as Buffer).toString('base64')}`;
    await page.evaluate((dataUrl) => {
      const coverPage = document.querySelector('.cover-page') as HTMLElement | null;
      if (!coverPage) return;
      const elementsToHide = ['.cover-logo', '.cover-image-container', '.cover-fallback'];
      elementsToHide.forEach(selector => {
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
    console.log('✅ DOM przygotowany do generowania PDF.');

    const uploadsDir = path.resolve(process.env.UPLOADS_DIR || '/data/uploads/uploads');
    const coverImageFileName = `${session.user.id}_EB${ebookIdNum}_rawMOCK.webp`;
    const coverImageFullPath = path.join(uploadsDir, coverImageFileName);
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    console.log(`🔄 Rozpoczęcie równoległego generowania PDF i zapisu mockupu...`);
    const [pdfBuffer] = await Promise.all([
      page.pdf({ format: 'A4', margin: { top: '20mm', right: '20mm', bottom: '25mm', left: '20mm' }, printBackground: true, displayHeaderFooter: false, preferCSSPageSize: true, timeout: 60000 }),
      fs.promises.writeFile(coverImageFullPath, rawCoverBuffer),
    ]);
    console.log(`✅ PDF wygenerowany w pamięci.`);
    console.log(`🖼️  Surowa okładka WEBP zapisana w: ${coverImageFullPath}`);

    console.log(`🖌️  Łączenie okładki z ramką tabletu...`);
    const framePath = path.resolve('./public/templates/raw_mokup.png');
    const finalMockupFileName = `${session.user.id}_EB${ebookIdNum}_finalMOK.png`;
    const finalMockupFullPath = path.join(uploadsDir, finalMockupFileName);
    const resizedCoverBuffer = await sharp(rawCoverBuffer).resize({ width: 600, height: 840, fit: 'cover' }).toBuffer();
    await sharp(framePath).composite([{ input: resizedCoverBuffer, blend: 'dest-over', top: 220, left: 180 }]).toFile(finalMockupFullPath);
    console.log(`✅ Finalny mockup PNG zapisany w: ${finalMockupFullPath}`);

    const rawMockupUrlPath = `/uploads/${coverImageFileName}`;
    const finalMockupUrlPath = `/uploads/${finalMockupFileName}`;
    await prisma.ebooks.update({
      where: { id: ebookIdNum, userId: session.user.id },
      data: { status: 'completed', cover_image_webp_url: rawMockupUrlPath, final_mockup_url: finalMockupUrlPath }
    });

    let fileName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (subtitle && subtitle.trim()) {
      fileName += '_' + subtitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    }
    fileName = fileName.substring(0, 100);
    console.log(`✅ PDF wygenerowany: ${fileName}.pdf (${pdfBuffer.length} bajtów)`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}.pdf"` },
    });
  } catch (error: any) {
    console.error('❌ Błąd podczas generowania PDF:', error);
    return NextResponse.json({ error: 'Wystąpił błąd podczas generowania PDF', details: error.message, stack: error.stack }, { status: 500 });
  } finally {
    if (browser) {
      console.log('🧹 Zamykanie przeglądarki...');
      try {
        await browser.close();
        console.log('✅ Przeglądarka zamknięta pomyślnie.');
      } catch (closeError) {
        console.warn('⚠️ Wystąpił niekrytyczny błąd podczas zamykania przeglądarki.', closeError);
      }
    }
  }
}

function generateHTMLContent(title: string, subtitle: string | null, chapters: any[], coverImageUrl?: string | null, authorDisplayName?: string | null, authorLogoUrl?: string | null): string {
  // Ta funkcja i jej pomocnicy pozostają bez zmian, ale teraz otrzymają rozdziały z nowym polem `optimizedImageBase64`
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap" rel="stylesheet">
      <style>${generateAdvancedCSS(title, subtitle, authorDisplayName)}</style>
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
  const displayFullTitle = fullTitle.length > 80 ? fullTitle.substring(0, 80) + '...' : fullTitle;
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', sans-serif; font-size: 18px; line-height: 1.6; color: #000; background: white; }
    @page { margin: 20mm; counter-increment: page; size: A4; @bottom-left { content: "${authorPart} | ${displayFullTitle.replace(/"/g, '\\"')}"; font-family: 'Poppins', sans-serif; font-size: 9px; color: rgb(136, 136, 136); font-weight: 300; letter-spacing: 0.3px; margin-top: 12px; padding-top: 4px; background-image: linear-gradient(to right, rgb(136, 136, 136) 0%, rgb(136, 136, 136) 100%); background-size: 100% 1px; background-repeat: no-repeat; background-position: top; } @bottom-right { content: counter(page); font-family: 'Poppins', sans-serif; font-size: 9px; color: rgb(136, 136, 136); font-weight: 400; margin-top: 12px; padding-top: 4px; background-image: linear-gradient(to right, rgb(136, 136, 136) 0%, rgb(136, 136, 136) 100%); background-size: 100% 1px; background-repeat: no-repeat; background-position: top; } }
    @page cover { margin: 0; counter-reset: page 0; @bottom-left { content: none; } @bottom-right { content: none; } }
    @page first { margin: 20mm; counter-reset: page 1; @bottom-left { content: none; } @bottom-right { content: none; } }
    .chapter { padding: 1rem 0; margin-bottom: 2rem; position: relative; }
    .chapter:first-of-type { page: first; page-break-before: avoid; }
    .chapter:not(:first-of-type) { page-break-before: always; margin-top: 0; }
    .chapter-content { position: relative; } .chapter-content:empty { display: none; } .chapter-content::after { content: ""; display: block; height: 1px; clear: both; }
    .chapter-header { text-align: center; margin-top: 2rem; margin-bottom: 18rem; page-break-inside: avoid; page-break-after: avoid; }
    .chapter:first-of-type .chapter-header { margin-top: 5rem; margin-bottom: 18rem; }
    .chapter-image-container { width: 100%; margin: 2.5rem 0; page-break-inside: avoid; page-break-before: auto; page-break-after: auto; position: relative; display: flex; justify-content: center; align-items: center; }
    .chapter-image { width: 100%; max-width: 100%; height: auto; display: block; border-radius: 8px; object-fit: contain; object-position: center; max-height: calc(100vh - 8rem); }
    .text-block { margin-bottom: 1.5rem; } .text-block:last-child { margin-bottom: 0; }
    .paragraph { margin-bottom: 20px; text-align: justify; line-height: 1.8; }
    .cover-page { page: cover; page-break-after: always; page-break-inside: avoid; height: 100vh; width: 100vw; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative; background: white; margin: 0; padding: 0; }
    .cover-logo { position: absolute; top: 2%; left: 50%; transform: translateX(-50%); width: auto; height: 40px; z-index: 25; }
    .cover-title-section { position: absolute; top: 4%; left: 11; right: 5; text-align: center; z-index: 20; width: 97%; background: linear-gradient(to bottom, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 70%, rgba(255, 255, 255, 0.95) 85%, rgba(255, 255, 255, 0) 100%); height: 230px; padding: 1rem 2rem 1rem 2rem; display: flex; align-items: center; justify-content: center; }
    .cover-subtitle-section { position: absolute; bottom: 0; left: 11; right: 5; text-align: center; z-index: 20; width: 97%; background: linear-gradient(to top, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 70%, rgba(255, 255, 255, 0.95) 85%, rgba(255, 255, 255, 0) 100%); height: 180px; padding: 0 2rem; display: flex; align-items: center; justify-content: center; }
    .cover-title { font-size: clamp(28px, 5vw, 42px); font-weight: 800; margin-bottom: 1rem; line-height: 1.5; letter-spacing: 0.01em; word-wrap: break-word; hyphens: manual; color: #1a1a1a; position: relative; padding: 1.5rem 0; }
    .cover-title::before, .cover-title::after, .cover-subtitle::before, .cover-subtitle::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); width: 95.5%; height: 1px; background-color: #4a4a4a; opacity: 0.8; }
    .cover-title::before { top: 0; } .cover-title::after { bottom: 0; }
    .cover-title.very-long { font-size: clamp(24px, 4vw, 32px); line-height: 1.5; }
    .cover-subtitle { font-size: clamp(20px, 4vw, 35px); font-weight: 500; margin-bottom: 0; line-height: 1.7; letter-spacing: 0.01em; color: #2a2a2a; text-shadow: 0 0 15px rgba(255, 255, 255, 1), 0 0 30px rgba(255, 255, 255, 0.8); position: relative; padding: 1.5rem 0; margin: 1rem auto; display: inline-block; }
    .cover-subtitle::before { top: 0; } .cover-subtitle::after { bottom: 0; }
    .cover-image-container { position: absolute; top: 54%; left: 50%; transform: translateX(-50%) translateY(-50%); width: 95.5%; aspect-ratio: 1024 / 1024; z-index: 5; }
    .cover-image { width: 100%; height: 100%; object-fit: contain; object-position: center; display: block; position: relative; z-index: 0; }
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

function generateCoverPage(title: string, subtitle: string | null, coverImageUrl?: string | null, authorLogoUrl?: string | null): string {
  const titleClass = title.length > 60 ? 'cover-title very-long' : 'cover-title';
  if (coverImageUrl && coverImageUrl.trim()) {
    return `
      <div class="cover-page">
        ${authorLogoUrl ? `<img src="${authorLogoUrl}" alt="Logo Autora" class="cover-logo" />` : ''}
        <div class="cover-title-section"><h1 class="${titleClass}">${escapeHtml(title)}</h1></div>
        <div class="cover-image-container"><img src="${coverImageUrl}" alt="Okładka ebooka" class="cover-image" loading="eager" onerror="this.parentElement.style.display='none'; document.querySelector('.cover-fallback').style.display='flex';" /></div>
        <div class="cover-subtitle-section">${subtitle && subtitle.trim() ? `<h2 class="cover-subtitle">${escapeHtml(subtitle)}</h2>` : ''}</div>
        <div class="cover-fallback" style="display: none;"><h1 class="${titleClass}">${escapeHtml(title)}</h1>${subtitle && subtitle.trim() ? `<h2 class="cover-subtitle">${escapeHtml(subtitle)}</h2>` : ''}</div>
      </div>
    `;
  } else {
    return `
      <div class="cover-page">
        ${authorLogoUrl ? `<img src="${authorLogoUrl}" alt="Logo Autora" class="cover-logo" />` : ''}
        <div class="cover-fallback" style="display: flex;"><h1 class="${titleClass}">${escapeHtml(title)}</h1>${subtitle && subtitle.trim() ? `<h2 class="cover-subtitle">${escapeHtml(subtitle)}</h2>` : ''}</div>
      </div>
    `;
  }
}

function generateChaptersContent(chapters: any[]): string {
  if (!Array.isArray(chapters) || chapters.length === 0) {
    return '<div class="no-content">Brak rozdziałów do wyświetlenia.</div>';
  }
  return chapters.map((chapter, index) => {
    return `
      <div class="chapter">
        <div class="chapter-header">
          <div class="chapter-number">Rozdział ${index + 1}.</div>
          <h2 class="chapter-title">${escapeHtml(chapter.title || '')}</h2>
        </div>
        <div class="chapter-content">
          ${generateChapterContent(chapter.content || '', chapter, index)}
        </div>
      </div>
    `
  }).join('');
}

function generateChapterContent(content: string, chapter: any, chapterIndex: number): string {
  if (!content.trim()) {
    return '<p class="no-content">Brak treści dla tego rozdziału.</p>';
  }

  // --- KROK 2: Modyfikacja generowania HTML, aby używał zoptymalizowanych grafik ---
  // Sprawdzamy, czy istnieje zoptymalizowany obraz Base64. Jeśli nie, używamy oryginalnego.
  const imageUrl = chapter.optimizedImageBase64 || chapter.image_url;
  // --- KONIEC KROKU 2 ---

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
    if (imageUrl && !imageInserted && i === imagePosition) {
      htmlContent += `<div class="chapter-image-container"><img src="${imageUrl}" alt="Ilustracja rozdziału ${chapterIndex + 1}" class="chapter-image" /></div>`;
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