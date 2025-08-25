// src/app/api/ebooks/[ebookId]/generate-mockups/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

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
    const ebookIdNum = parseInt(resolvedParams.ebookId);

    if (isNaN(ebookIdNum)) {
      return NextResponse.json({ error: 'Nieprawidłowy ebookId' }, { status: 400 });
    }

    console.log(`📸 Regenerowanie mockupów dla ebooka ${ebookIdNum}`);

    // Pobierz dane ebooka
    const ebook = await prisma.ebooks.findFirst({
      where: { id: ebookIdNum, userId: session.user.id }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony' }, { status: 404 });
    }

    // Użyj tej samej logiki HTML co w export-pdf
    const htmlContent = generateMockupHTML(ebook.title, ebook.subtitle, ebook.cover_image_url, ebook.authorLogoUrl, ebook.authorDisplayName);

    // Konfiguracja Puppeteer (skopiowana z export-pdf)
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
      executablePath = localPaths.find((p) => fs.existsSync(p)) || await chromium.executablePath();
    }

    browser = await puppeteer.launch({
      args: isProduction ? chromium.args : chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      timeout: 30000
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 795, height: 1125 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 60000 });

    // Screenshot mockupu (z tekstem)
    const rawCoverBuffer = await page.screenshot({
      type: 'webp',
      quality: 85
    });

    // Ścieżki
    const uploadsDir = path.resolve(process.env.UPLOADS_DIR || '/data/uploads/uploads');
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const rawMockupFileName = `${session.user.id}_EB${ebookIdNum}_rawMOCK.webp`;
    const finalMockupFileName = `${session.user.id}_EB${ebookIdNum}_finalMOK.png`;

    const rawMockupPath = path.join(uploadsDir, rawMockupFileName);
    const finalMockupPath = path.join(uploadsDir, finalMockupFileName);

    // Przygotuj final mockup
    const framePath = path.resolve('./public/templates/raw_mokup.png');
    const resizedCoverBuffer = await sharp(rawCoverBuffer)
      .resize({ width: 600, height: 840, fit: 'cover' })
      .toBuffer();

    // Zapisz oba mockupy równolegle
    await Promise.all([
      fs.promises.writeFile(rawMockupPath, rawCoverBuffer),
      sharp(framePath)
        .composite([{
          input: resizedCoverBuffer,
          blend: 'dest-over',
          top: 220,
          left: 180,
        }])
        .toFile(finalMockupPath)
    ]);

    // Zaktualizuj bazę
    const rawMockupUrl = `/uploads/${rawMockupFileName}`;
    const finalMockupUrl = `/uploads/${finalMockupFileName}`;

    await prisma.ebooks.update({
      where: { id: ebookIdNum },
      data: {
        cover_image_webp_url: rawMockupUrl,
        final_mockup_url: finalMockupUrl,
      }
    });

    console.log(`✅ Mockupy wygenerowane: raw + final`);

    return NextResponse.json({
      success: true,
      rawMockupUrl,
      finalMockupUrl
    });

  } catch (error: any) {
    console.error('❌ Błąd mockupów:', error);
    return NextResponse.json({
      error: 'Błąd generowania mockupów',
      details: error.message
    }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}

// ✅ POPRAWIONA FUNKCJA HTML - skopiowana z export-pdf
function generateMockupHTML(title: string, subtitle: string | null, coverImageUrl?: string | null, authorLogoUrl?: string | null, authorDisplayName?: string | null): string {
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
        ${generateMockupCSS(title, subtitle, authorDisplayName)}
      </style>
    </head>
    <body>
      ${generateMockupCoverPage(title, subtitle, coverImageUrl, authorLogoUrl)}
    </body>
    </html>
  `;
}

// ✅ POPRAWIONA FUNKCJA CSS - skopiowana z export-pdf
function generateMockupCSS(title: string, subtitle: string | null, authorDisplayName?: string | null): string {
  const authorPart = authorDisplayName ? authorDisplayName.replace(/"/g, '\\"') : 'Health Pro System';
  let fullTitle = title;
  if (subtitle) {
      fullTitle += ` ${subtitle}`;
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

    /* ========== OKŁADKA ========== */
    .cover-page {
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
      top: 4%;
      left: 11;
      right: 5;
      text-align: center;
      z-index: 20;
      width: 97%;
      background: linear-gradient(to bottom,
        rgba(255, 255, 255, 1) 0%,
        rgba(255, 255, 255, 1) 70%,
        rgba(255, 255, 255, 0.95) 85%,
        rgba(255, 255, 255, 0) 100%
      );
      height: 230px;
      padding: 1rem 2rem 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cover-subtitle-section {
      position: absolute;
      bottom: 0;
      left: 11;
      right: 5;
      text-align: center;
      z-index: 20;
      width: 97%;
      background: linear-gradient(to top,
        rgba(255, 255, 255, 1) 0%,
        rgba(255, 255, 255, 1) 70%,
        rgba(255, 255, 255, 0.95) 85%,
        rgba(255, 255, 255, 0) 100%
      );
      height: 180px;
      padding: 0 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
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
      width: 95.5%;
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
      width: 95.5%;
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
      width: 95.5%;
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
      width: 95.5%;
      height: 1px;
      background-color: #4a4a4a;
      opacity: 0.8;
    }

    .cover-image-container {
      position: absolute;
      top: 54%;
      left: 50%;
      transform: translateX(-50%) translateY(-50%);
      width: 95.5%;
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
  `;
}

// ✅ POPRAWIONA FUNKCJA HTML OKŁADKI - skopiowana z export-pdf
function generateMockupCoverPage(title: string, subtitle: string | null, coverImageUrl?: string | null, authorLogoUrl?: string | null): string {
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

        <div class="cover-subtitle-section">
          ${subtitle && subtitle.trim() ? `<h2 class="cover-subtitle">${escapeHtml(subtitle)}</h2>` : ''}
        </div>

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

// ✅ DODANA BRAKUJĄCA FUNKCJA escapeHtml
function escapeHtml(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}