// src/app/api/scrape-urls/route.ts

import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';

export const runtime = 'nodejs';

interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  source?: string;
  error?: string;
}

// Helper function dla bezpiecznej obsługi błędów
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Helper function dla delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ✅ DODANA: Funkcja pomocnicza do lepszego logowania
function logExtractedContent(url: string, data: { title: string; content: string; source: string }) {
  console.log('\n' + '='.repeat(80));
  console.log(`📄 WYCIĄGNIĘTE DANE Z: ${url}`);
  console.log('📄 ŹRÓDŁO:', data.source);
  console.log('📄 TYTUŁ:', data.title);
  console.log('📄 DŁUGOŚĆ TREŚCI:', data.content.length, 'znaków');

  if (data.content.length === 0) {
    console.log('🚨 KRYTYCZNY PROBLEM: BRAK TREŚCI (0 ZNAKÓW)!');
    console.log('💡 Powód: Selektory nie znalazły odpowiedniej treści na stronie');
    console.log('🔧 Rozwiązanie: Zostanie użyta metoda Puppeteer jako fallback');
  } else if (data.content.length > 0 && data.content.length < 50) {
    console.log('⚠️ UWAGA: BARDZO KRÓTKA TREŚĆ!');
    console.log(`🔍 Treść: "${data.content}"`);
    console.log('🔧 Rozwiązanie: Zostanie użyta metoda Puppeteer jako fallback');
  } else if (data.content.length > 0) {
    console.log('\n📄 PIERWSZYCH 200 ZNAKÓW:');
    console.log('"' + data.content.substring(0, 200) + (data.content.length > 200 ? '...' : '') + '"');

    if (data.content.length > 200) {
      console.log('\n📄 OSTATNICH 200 ZNAKÓW:');
      const start = Math.max(0, data.content.length - 200);
      console.log('"...' + data.content.substring(start) + '"');
    }
  }
  console.log('='.repeat(80) + '\n');
}

// 🆕 NOWA: Funkcja do usuwania niepożądanych elementów
function removeUnwantedElements(document: Document): void {
  const unwantedSelectors = [
    'script', 'style', 'nav', 'header', 'footer',
    '.navigation', '.menu', '.sidebar', '.ads', '.advertisement',
    '.social', '.share', '.comments', '.related', '.popup',
    '.cookie', '.banner', '.modal', '.overlay', '.widget',
    '#navigation', '#menu', '#sidebar', '#footer', '#header',
    '[class*="nav"]', '[class*="menu"]', '[class*="ad"]',
    '[class*="sidebar"]', '[class*="widget"]', '[class*="social"]'
  ];

  unwantedSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => element.remove());
  });
}

// 🆕 NOWA: Funkcja do wyciągania structured data
function extractStructuredData(document: Document): { title?: string; content?: string; description?: string } {
  console.log('🔍 SZUKANIE STRUCTURED DATA...');

  // JSON-LD
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.textContent || '');
      if (data.headline || data.name) {
        console.log('✅ ZNALEZIONO JSON-LD DATA');
        return {
          title: data.headline || data.name,
          content: data.description || data.text,
          description: data.description
        };
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Open Graph
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content');

  if (ogTitle) {
    console.log('✅ ZNALEZIONO OPEN GRAPH DATA');
    return {
      title: ogTitle,
      description: ogDescription || undefined
    };
  }

  // Meta tags
  const metaTitle = document.querySelector('meta[name="title"]')?.getAttribute('content');
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content');

  if (metaTitle) {
    console.log('✅ ZNALEZIONO META DATA');
    return {
      title: metaTitle,
      description: metaDescription || undefined
    };
  }

  return {};
}

// Funkcja do czyszczenia i skracania tekstu
function cleanAndTruncateText(text: string, maxLength: number = 100000): string {
  const originalLength = text.length;

  let cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\u00A0/g, ' ') // Usuń non-breaking spaces
    // 🔧 NAPRAWIONY REGEX - obsługuje polskie znaki
    .replace(/[^\wąćęłńóśúżĄĆĘŁŃÓŚÚŻ\s\.\,\!\?\;\:\-\(\)\[\]]/g, ' ')
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + '...';
    console.log(`✂️ SKRÓCONO TEKST: ${originalLength} → ${cleaned.length} znaków`);
  }

  return cleaned;
}

// 🆕 POPRAWIONA: Funkcja specjalna dla EUR-Lex z lepszymi selektorami
function extractEurLexContent(document: Document, url: string): { title: string; content: string; source: string } {
  console.log('\n🇪🇺 ROZPOCZYNANIE EKSTRAKCJI EUR-LEX:', url);

  let title = '';
  let content = '';
  const source = 'EU Law';

  // 🎯 TYTUŁ - najpierw prostsze selektory
  console.log('🔍 EUR-LEX: Szukanie tytułu...');

  const eurLexTitleSelectors = [
    'title',
    'h1',
    'h2',
    '.doc-title',
    '.document-title'
  ];

  for (const selector of eurLexTitleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement) {
      const titleText = titleElement.textContent || titleElement.getAttribute('content') || '';
      if (titleText.trim().length > 5) {
        title = titleText.trim();
        console.log(`✅ EUR-LEX: Znaleziono tytuł przez "${selector}": ${title}`);
        break;
      }
    }
  }

  // 🎯 TREŚĆ - NOWE PODEJŚCIE: Najpierw spróbuj body, potem filtruj
  console.log('🔍 EUR-LEX: Wyciąganie treści z body...');

  const bodyText = document.body?.textContent || '';
  console.log(`📊 EUR-LEX: Długość całego body: ${bodyText.length} znaków`);

  if (bodyText.length > 5000) {
    // Znajdź początek głównej treści - szukaj pierwszego artykułu lub rozdziału
    const contentStartMarkers = [
      'ROZPORZĄDZENIE',
      'Artykuł 1',
      'ROZDZIAŁ I',
      'Artykuł',
      'Article 1',
      'CHAPTER I'
    ];

    let contentStart = -1;
    for (const marker of contentStartMarkers) {
      const markerIndex = bodyText.indexOf(marker);
      if (markerIndex !== -1) {
        contentStart = markerIndex;
        console.log(`✅ EUR-LEX: Znaleziono początek treści przez marker "${marker}" na pozycji ${markerIndex}`);
        break;
      }
    }

    if (contentStart !== -1) {
      // Wyciągnij treść od początku dokumentu do końca
      let mainContent = bodyText.substring(contentStart);

      // Wyczyść opcje językowe i nawigację
      mainContent = mainContent
        // Usuń typowe kody językowe na początku
        .replace(/^[A-Z]{2}\s+[A-Z]{2}\s+[A-Z]{2}.*?(?=\n|$)/gi, '')
        // Usuń pojedyncze kody językowe
        .replace(/\b(BG|ES|CS|DA|DE|ET|EL|EN|FR|GA|HR|IT|LV|LT|HU|MT|NL|PL|PT|RO|SK|SL|FI|SV)\b\s*/g, '')
        // Usuń linki nawigacyjne
        .replace(/Select language.*?(?=\n|$)/gi, '')
        .replace(/Choose language.*?(?=\n|$)/gi, '')
        .replace(/Language.*?(?=\n|$)/gi, '')
        .replace(/Need help\?.*?(?=\n|$)/gi, '')
        .replace(/This document is an excerpt.*?(?=\n|$)/gi, '')
        // Normalizuj białe znaki
        .replace(/\s+/g, ' ')
        .trim();

      // Sprawdź czy to nie są wciąż opcje językowe
      const languageCodesCount = (mainContent.match(/\b[A-Z]{2}\b/g) || []).length;
      const wordsCount = mainContent.split(' ').length;
      const languageRatio = languageCodesCount / wordsCount;

      console.log(`📊 EUR-LEX: Analiza treści - kody językowe: ${languageCodesCount}, słowa: ${wordsCount}, ratio: ${languageRatio.toFixed(3)}`);

      // Jeśli mniej niż 5% to kody językowe, traktuj jako prawdziwą treść
      if (languageRatio < 0.05 && mainContent.length > 1000) {
        content = mainContent;
        console.log(`✅ EUR-LEX: Użyto głównej treści dokumentu (${content.length} znaków)`);
      }
    }
  }

  // 🆕 FALLBACK 1: Szukaj dużych paragrafów w body
  if (!content || content.length < 1000) {
    console.log('🔄 EUR-LEX: Fallback 1 - szukanie dużych sekcji tekstu...');

    // Podziel body na większe sekcje
    const sections = bodyText.split(/\n\s*\n/);
    let bestSection = '';

    for (const section of sections) {
      const cleanSection = section.trim();
      if (cleanSection.length > 2000 &&
          // Sprawdź czy to nie nawigacja
          !cleanSection.includes('Select language') &&
          !cleanSection.includes('Need help') &&
          !cleanSection.includes('This document is an excerpt') &&
          // Sprawdź czy zawiera sensowną treść
          (cleanSection.includes('Rozporządzenie') ||
           cleanSection.includes('Artykuł') ||
           cleanSection.includes('ROZPORZĄDZENIE') ||
           cleanSection.includes('Article'))) {

        if (cleanSection.length > bestSection.length) {
          bestSection = cleanSection;
        }
      }
    }

    if (bestSection && bestSection.length > 1000) {
      content = bestSection.replace(/\s+/g, ' ').trim();
      console.log(`✅ EUR-LEX: Fallback 1 - użyto najlepszej sekcji (${content.length} znaków)`);
    }
  }

  // 🆕 FALLBACK 2: Użyj części body od pierwszego prawdziwego słowa
  if (!content || content.length < 1000) {
    console.log('🔄 EUR-LEX: Fallback 2 - część body od pierwszego słowa...');

    // Znajdź pierwsze prawdziwe słowo (nie kod językowy)
    const words = bodyText.split(/\s+/);
    let firstWordIndex = -1;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].trim();
      if (word.length > 2 &&
          !/^[A-Z]{2}$/.test(word) && // nie kod językowy
          !word.includes('Select') &&
          !word.includes('Language') &&
          word !== 'Need' &&
          word !== 'help') {
        firstWordIndex = i;
        break;
      }
    }

    if (firstWordIndex !== -1 && firstWordIndex < words.length - 100) {
      // Weź od pierwszego słowa do końca (ale max 10000 słów)
      const endIndex = Math.min(firstWordIndex + 10000, words.length);
      content = words.slice(firstWordIndex, endIndex).join(' ').trim();
      console.log(`✅ EUR-LEX: Fallback 2 - od słowa ${firstWordIndex} (${content.length} znaków)`);
    }
  }

  // 🆕 ULTIMATE FALLBACK: Surowy body z podstawowym czyszczeniem
  if (!content || content.length < 500) {
    console.log('🚨 EUR-LEX: Ultimate fallback - surowy body...');

    content = bodyText
      .replace(/Select language.*$/gi, '')
      .replace(/Need help\?.*$/gi, '')
      .replace(/This document is an excerpt.*$/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log(`✅ EUR-LEX: Ultimate fallback (${content.length} znaków)`);
  }

  const result = {
    title: title || 'Dokument EUR-Lex',
    content: content,
    source: source
  };

  logExtractedContent(url, result);
  return result;
}

// 🆕 NOWA: Funkcja do scrapowania z Puppeteer (JavaScript-heavy stron)
async function scrapeWithPuppeteer(url: string): Promise<{ title: string; content: string; source: string }> {
  console.log('\n🤖 ROZPOCZYNANIE SCRAPINGU Z PUPPETEER:', url);

  let browser;
  try {
    // --- POPRAWIONA KONFIGURACJA PUPPETEER ---
    let executablePath: string;
    const isProduction = process.env.NODE_ENV === 'production';

    console.log(`🔧 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`🔧 Platform: ${process.platform}`);

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
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ];
      executablePath = localPaths.find((p) => fs.existsSync(p)) || '';
      console.log(`🔧 Local Chrome path: ${executablePath}`);
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

    // BAZOWE ARGUMENTY
    let launchArgs = isProduction ? [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-extensions',
      '--disable-plugins',
      '--no-first-run',
      '--disable-default-apps'
    ] : chromium.args;

    console.log(`🚀 Launch args: ${launchArgs.join(' ')}`);

    console.log('🚀 URUCHAMIANIE PRZEGLĄDARKI...');
    browser = await puppeteer.launch({
      args: launchArgs,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
      timeout: 30000
    });

    const page = await browser.newPage();

    // Ustaw timeouty
    const timeoutValue = 60000;
    page.setDefaultTimeout(timeoutValue);
    page.setDefaultNavigationTimeout(timeoutValue);

    // USER AGENT
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    await page.setUserAgent(userAgent);

    // Ustaw viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // HEADERS
    const headers: Record<string, string> = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'DNT': '1'
    };

    await page.setExtraHTTPHeaders(headers);

    // ZACHOWANE: Specjalne ustawienia dla Eureka
    if (url.includes('eureka.mf.gov.pl')) {
      console.log('💰 EUREKA: Ustawianie specjalnych headers i cookies...');

      // Dodaj referer
      await page.setExtraHTTPHeaders({
        'Referer': 'https://eureka.mf.gov.pl/',
        'Origin': 'https://eureka.mf.gov.pl'
      });

      // Ustaw podstawowe cookies
      await page.setCookie({
        name: 'language',
        value: 'pl',
        domain: 'eureka.mf.gov.pl'
      });
    }

    // INTERCEPTION - standardowa dla stron które nie są Eureka
    if (!url.includes('eureka.mf.gov.pl')) {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.resourceType() === 'stylesheet' || req.resourceType() === 'font' || req.resourceType() === 'image') {
          req.abort();
        } else {
          req.continue();
        }
      });
    } else {
      console.log('💰 EUREKA: Pozwalam na wszystkie requesty (pełny JS)');
    }

    console.log('📡 NAWIGACJA DO STRONY...');

    // ZACHOWANE: Sprawdź czy URL ma dziwne kodowanie (dla Eureka)
    let targetUrl = url;
    if (url.includes('eureka.mf.gov.pl') && url.includes(';keyWords=')) {
      const baseUrl = url.split(';')[0];
      console.log(`💰 EUREKA: Spróbuję też prostszego URL: ${baseUrl}`);
    }

    // NAWIGACJA - standardowe strategie
    try {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      console.log('✅ Strategia 1: domcontentloaded - sukces');
    } catch (error) {
      console.log('❌ Strategia 1 nie powiodła się, próbuję strategię 2...');

      try {
        await page.goto(targetUrl, {
          waitUntil: 'load',
          timeout: 45000
        });
        console.log('✅ Strategia 2: load - sukces');
      } catch (error2) {
        console.log('❌ Strategia 2 nie powiodła się, próbuję strategię 3...');

        if (url.includes('eureka.mf.gov.pl') && url.includes(';keyWords=')) {
          // ZACHOWANE: Strategia 3 dla Eureka
          const simpleUrl = url.split(';')[0];
          console.log(`💰 EUREKA: Próbuję prostszy URL: ${simpleUrl}`);

          try {
            await page.goto(simpleUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 45000
            });
            console.log('✅ Strategia 3: prosty URL - sukces');
            targetUrl = simpleUrl;
          } catch (error3) {
            await page.goto(url, {
              waitUntil: 'networkidle0',
              timeout: 60000
            });
            console.log('✅ Strategia 4: networkidle0 - sukces');
          }
        } else {
          await page.goto(targetUrl, {
            waitUntil: 'networkidle0',
            timeout: 60000
          });
          console.log('✅ Strategia 3: networkidle0 - sukces');
        }
      }
    }

    console.log('⏳ CZEKANIE NA ZAŁADOWANIE TREŚCI...');

    // Czekaj na potencjalne elementy treści
    try {
      await page.waitForSelector('body', { timeout: 10000 });

      // ZACHOWANE: Specjalne czekanie dla Eureka
      if (url.includes('eureka.mf.gov.pl')) {
        console.log('💰 EUREKA: Sprawdzanie czy strona się załadowała...');

        const currentUrl = page.url();
        console.log(`🔗 EUREKA: Obecny URL: ${currentUrl}`);

        if (currentUrl.includes('eureka.mf.gov.pl') && !currentUrl.includes('podglad')) {
          console.log('💰 EUREKA: Przekierowano na stronę główną, próbuję nawigacji...');

          try {
            const searchForm = await page.$('input[type="text"], input[name*="search"], input[id*="search"]');
            if (searchForm) {
              console.log('💰 EUREKA: Znaleziono pole wyszukiwania, wpisuję ID...');
              await searchForm.type('311009');

              const submitBtn = await page.$('button[type="submit"], input[type="submit"], .btn-search');
              if (submitBtn) {
                await submitBtn.click();
                await delay(5000);
              }
            }
          } catch (navError) {
            const errorMessage = getErrorMessage(navError);
            console.log('❌ EUREKA: Nie udało się nawigować przez formularz:', errorMessage);
          }
        }

        // ZACHOWANE: Eureka selectors
        const selectors = [
          '.content-main',
          '.document-content',
          '.interpretation-content',
          'main',
          '[data-content]',
          '.panel-body',
          '.card-body',
          '.text-content',
          '.document-text',
          '.interpretation-text',
          '.content-wrapper',
          '[class*="content"]'
        ];

        let foundElement = false;
        for (const selector of selectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            console.log(`✅ EUREKA: Znaleziono element "${selector}"`);
            foundElement = true;
            break;
          } catch (e) {
            console.log(`❌ EUREKA: Brak elementu "${selector}"`);
          }
        }

        if (!foundElement) {
          console.log('⚠️ EUREKA: Nie znaleziono żadnych elementów treści, próbuję dłuższe czekanie...');
        }

        console.log('⏳ EUREKA: Czekanie na JavaScript (10s)...');
        await delay(10000);

        const bodyText = await page.evaluate(() => document.body.textContent || '');
        console.log(`💰 EUREKA: Długość tekstu po oczekiwaniu: ${bodyText.length} znaków`);

        if (bodyText.includes('INTERPRETACJA') || bodyText.includes('interpretacja')) {
          console.log('✅ EUREKA: Znaleziono słowa kluczowe interpretacji!');
        } else {
          console.log('⚠️ EUREKA: Brak słów kluczowych interpretacji w treści');
        }
      }

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.log('⚠️ TIMEOUT na elementy - kontynuowanie...', errorMessage);
    }

    console.log('📄 WYCIĄGANIE TREŚCI...');

    // STANDARDOWE WYCIĄGANIE TREŚCI
    const pageData = await page.evaluate((currentUrl) => {
      // Usuń niepotrzebne elementy
      const unwanted = document.querySelectorAll('script, style, nav, header, footer, .menu, .navigation, .cookie, .banner');
      unwanted.forEach(el => el.remove());

      let title = '';
      let content = '';

      // STANDARDOWE SELEKTORY
      // Tytuł - ZACHOWANE selektory
      const titleSelectors = [
        'h1', 'h2', '.page-title', '.document-title',
        '.interpretation-title', '.main-title', '.content-title', 'title'
      ];

      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 5) {
          title = element.textContent.trim();
          console.log(`Znaleziono tytuł przez: ${selector}`);
          break;
        }
      }

      // Treść - ZACHOWANE selektory + ulepszone dla Eureka
      const contentSelectors = [
        '.content-main', '.document-content', '.interpretation-content',
        '.main-content', '#content', '.text-content', 'main',
        '.panel-body', '.card-body', '.article-content', 'article',
        '.container .row .col'
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent && element.textContent.trim().length > 100) {
          content = element.textContent.trim();
          console.log(`Znaleziono treść przez: ${selector} (${content.length} znaków)`);
          break;
        }
      }

      // ZACHOWANE: Fallback
      if (!content || content.length < 200) {
        console.log('Fallback: zbieranie wszystkich elementów tekstowych...');
        const textElements = document.querySelectorAll('p, div, span, td');
        let combinedText = '';

        for (const el of textElements) {
          if (el.textContent && el.textContent.trim().length > 30) {
            const text = el.textContent.trim();
            if (!text.includes('Menu') &&
                !text.includes('Logowanie') &&
                !text.includes('©') &&
                !text.includes('JavaScript') &&
                !text.toLowerCase().includes('cookie') &&
                !text.toLowerCase().includes('nawigacja')) {
              combinedText += text + '\n\n';
            }
          }
        }

        if (combinedText.length > content.length) {
          content = combinedText.trim();
          console.log(`Użyto fallback (${content.length} znaków)`);
        }
      }

      // ZACHOWANE: Ultimate fallback
      if (!content || content.length < 100) {
        const bodyText = document.body?.textContent || '';
        if (bodyText.includes('INTERPRETACJA') ||
            bodyText.includes('interpretacja') ||
            bodyText.includes('UZASADNIENIE') ||
            bodyText.includes('uzasadnienie')) {
          content = bodyText;
          console.log(`Ultimate fallback - użyto body (${content.length} znaków)`);
        }
      }

      return {
        title: title || document.title || '',
        content: content || '',
        url: window.location.href,
        bodyLength: document.body?.textContent?.length || 0
      };
    }, url);

    console.log(`✅ PUPPETEER: Pozyskano dane:`);
    console.log(`   📖 Tytuł: ${pageData.title}`);
    console.log(`   📄 Treść: ${pageData.content.length} znaków`);
    console.log(`   📄 Body: ${pageData.bodyLength} znaków`);
    console.log(`   🔗 URL: ${pageData.url}`);

    // Określ źródło
    let source = 'Web (JS)';
    if (url.includes('eureka.mf.gov.pl')) {
      source = 'MF Interpretations (JS)';
    } else if (url.includes('.gov.pl')) {
      source = 'Polish Government (JS)';
    } else if (url.includes('.gov')) {
      source = 'Government (JS)';
    } else if (url.includes('eur-lex.europa.eu')) {
      source = 'EU Law (JS)';
    }

    return {
      title: pageData.title,
      content: pageData.content,
      source: source
    };

  } catch (error) {
    console.error('❌ BŁĄD PUPPETEER:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 ZAMKNIĘTO PRZEGLĄDARKĘ');
    }
  }
}

// 🔧 ULEPSZONA: Strategia dla stron rządowych z lepszą obsługą różnych typów
function extractGovernmentContent(document: Document, url: string): { title: string; content: string; source: string } {
  console.log('\n🏛️ ROZPOCZYNANIE EKSTRAKCJI RZĄDOWEJ:', url);

  // 🆕 SPECJALNA OBSŁUGA EUR-LEX
  if (url.includes('eur-lex.europa.eu')) {
    return extractEurLexContent(document, url);
  }

  let title = '';
  let content = '';
  let source = 'Government';

  // 🆕 OBSŁUGA EUREKA.MF.GOV.PL
  if (url.includes('eureka.mf.gov.pl')) {
    console.log('💰 WYKRYTO STRONĘ EUREKA.MF.GOV.PL - interpretacje podatkowe');
    source = 'MF Interpretations';

    // Usuń potencjalne elementy przeszkadzające
    removeUnwantedElements(document);

    // Specjalne selektory dla Eureka
    const eurekaContentSelectors = [
      '.content-main',
      '.content-wrapper',
      '.document-content',
      '.interpretation-content',
      '.main-content',
      '#content',
      '.text-content',
      'main',
      '[role="main"]',
      '.container .row .col',
      '.panel-body',
      '.card-body',
      '.article-content'
    ];

    console.log('🔍 EUREKA: Szukanie głównej treści...');
    for (const selector of eurekaContentSelectors) {
      const contentElement = document.querySelector(selector);
      if (contentElement && contentElement.textContent && contentElement.textContent.trim().length > 200) {
        content = contentElement.textContent.trim();
        console.log(`✅ EUREKA: Znaleziono treść przez "${selector}" (${content.length} znaków)`);
        break;
      }
    }

    // Fallback dla Eureka - zbierz wszystkie div-y z tekstem
    if (!content || content.length < 200) {
      console.log('📄 EUREKA: Fallback - zbieranie wszystkich div-ów...');

      const allDivs = document.querySelectorAll('div');
      let combinedText = '';

      for (const div of allDivs) {
        if (div.textContent && div.textContent.trim().length > 50) {
          // Sprawdź czy to nie jest nawigacja czy inne elementy UI
          const divText = div.textContent.trim();
          if (!divText.includes('Menu') &&
              !divText.includes('Logowanie') &&
              !divText.includes('Wyszukaj') &&
              (divText.includes('interpretacja') ||
               divText.includes('INTERPRETACJA') ||
               divText.includes('uzasadnienie') ||
               divText.includes('UZASADNIENIE') ||
               divText.length > 500)) {
            combinedText += divText + '\n\n';
          }
        }
      }

      if (combinedText.length > 200) {
        content = combinedText.trim();
        console.log(`✅ EUREKA: Fallback - zebrano treść z div-ów (${content.length} znaków)`);
      }
    }

    // Ultimate fallback dla Eureka - cały body minus nawigacja
    if (!content || content.length < 200) {
      console.log('🚨 EUREKA: Ultimate fallback - używanie całego body...');

      const bodyText = document.body?.textContent || '';
      if (bodyText.length > 300) {
        // Usuń typowe elementy nawigacji z tekstu
        let cleanedBody = bodyText
          .replace(/Menu główne.*?(?=\n|$)/gi, '')
          .replace(/Logowanie.*?(?=\n|$)/gi, '')
          .replace(/Wyszukaj.*?(?=\n|$)/gi, '')
          .replace(/Copyright.*?(?=\n|$)/gi, '')
          .replace(/Wszystkie prawa zastrzeżone.*?(?=\n|$)/gi, '')
          .trim();

        if (cleanedBody.length > 200) {
          content = cleanedBody;
          console.log(`✅ EUREKA: Ultimate fallback - oczyszczony body (${content.length} znaków)`);
        }
      }
    }

    // Tytuł dla Eureka
    const eurekaTitleSelectors = [
      'h1',
      'h2',
      '.page-title',
      '.document-title',
      '.interpretation-title',
      'title',
      '.main-title',
      '.content-title'
    ];

    console.log('🔍 EUREKA: Szukanie tytułu...');
    for (const selector of eurekaTitleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent && titleElement.textContent.trim().length > 5) {
        title = titleElement.textContent.trim();
        console.log(`✅ EUREKA: Znaleziono tytuł przez "${selector}":`, title);
        break;
      }
    }

    // Fallback dla tytułu z URL lub treści
    if (!title) {
      if (content.includes('INTERPRETACJA INDYWIDUALNA')) {
        title = 'Interpretacja indywidualna MF';
      } else if (content.includes('interpretacja')) {
        title = 'Interpretacja podatkowa';
      } else {
        title = 'Dokument MF';
      }
      console.log(`✅ EUREKA: Fallback tytuł:`, title);
    }
  }

  // 🔧 POPRAWIONA OBSŁUGA NSA
  else if (url.includes('orzeczenia.nsa.gov.pl') || url.includes('nsa.gov.pl')) {
    console.log('🏛️ WYKRYTO STRONĘ NSA - używam dedykowanych selektorów');
    source = 'NSA';

    // Strategia: Szukaj tekstu po słowie "Sentencja"
    console.log('🔍 NSA: Sprawdzanie całego tekstu strony...');

    const bodyText = document.body?.textContent || '';
    const sentencjaIndex = bodyText.indexOf('Sentencja');

    if (sentencjaIndex !== -1) {
      let sentencjaText = bodyText.substring(sentencjaIndex);

      const endMarkers = ['Sentencja', 'Uzasadnienie', 'Zarządzenie', 'Postanowienie'];
      let endIndex = sentencjaText.length;

      for (const marker of endMarkers) {
        const markerIndex = sentencjaText.indexOf(marker, 10);
        if (markerIndex !== -1 && markerIndex < endIndex) {
          endIndex = markerIndex;
        }
      }

      content = sentencjaText.substring(0, endIndex).trim();
      console.log(`✅ NSA: Znaleziono Sentencję (${content.length} znaków)`);
    }

    // Fallbacki dla NSA...
    if (!content || content.length < 100) {
      console.log('🔍 NSA: Fallback - sprawdzanie komórek tabeli...');

      const tableCells = document.querySelectorAll('td');
      for (const cell of tableCells) {
        if (cell.textContent && cell.textContent.length > 200) {
          const cellText = cell.textContent.trim();
          if (cellText.includes('Sentencja') ||
              cellText.includes('Sąd Administracyjny') ||
              cellText.includes('orzeka') ||
              cellText.includes('uchyla') ||
              cellText.length > 500) {
            content = cellText;
            console.log(`✅ NSA: Znaleziono treść w komórce tabeli (${content.length} znaków)`);
            break;
          }
        }
      }
    }

    // Tytuł dla NSA
    const nsaTitleSelectors = [
      'title',
      'h1',
      'td:first-child',
      '.case-number',
      '.court-name'
    ];

    for (const selector of nsaTitleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent && titleElement.textContent.trim().length > 5) {
        title = titleElement.textContent.trim();
        console.log(`✅ NSA: Znaleziono tytuł przez "${selector}":`, title);
        break;
      }
    }

    if (!title) {
      const urlMatch = url.match(/\/doc\/([A-F0-9]+)$/);
      if (urlMatch) {
        title = `Orzeczenie ${urlMatch[1]}`;
      } else {
        title = 'Orzeczenie NSA';
      }
    }
  }

  // 🆕 INNE STRONY RZĄDOWE (Sejm, etc.)
  else {
    // Wykryj typ strony rządowej
    if (url.includes('.gov.pl')) {
      source = 'Polish Government';
    } else if (url.includes('.gov')) {
      source = 'Government';
    }

    console.log('🏛️ WYKRYTY TYP ŹRÓDŁA:', source);

    // Usuń niepożądane elementy
    removeUnwantedElements(document);

    // Sprawdź structured data
    const structuredData = extractStructuredData(document);
    if (structuredData.title) {
      title = structuredData.title;
      console.log('✅ TYTUŁ Z STRUCTURED DATA:', title);
    }

    // Standardowe selektory dla stron rządowych
    const titleSelectors = [
      'h1.page-title',
      'h1.entry-title',
      'h1.post-title',
      'h1.article-title',
      '.page-header h1',
      '.content-header h1',
      '.main-title',
      'h1',
      '.title h1',
      '[role="heading"][aria-level="1"]'
    ];

    if (!title) {
      console.log('🔍 SZUKANIE TYTUŁU...');
      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement && titleElement.textContent && titleElement.textContent.trim().length > 5) {
          title = titleElement.textContent.trim();
          console.log(`✅ ZNALEZIONO TYTUŁ przez "${selector}":`, title);
          break;
        }
      }
    }

    // Standardowe selektory dla treści
    const contentSelectors = [
      '.page-content',
      '.entry-content',
      '.post-content',
      '.article-content',
      '.main-content',
      '.content-area',
      'main .content',
      '[role="main"]',
      '.text-content',
      '.article-body',
      '.document-content',
      '.legal-content',
      'article',
      'main'
    ];

    console.log('🔍 SZUKANIE TREŚCI...');
    for (const selector of contentSelectors) {
      const contentElement = document.querySelector(selector);
      if (contentElement && contentElement.textContent && contentElement.textContent.trim().length > 100) {
        content = contentElement.textContent.trim();
        console.log(`✅ ZNALEZIONO TREŚĆ przez "${selector}" (${content.length} znaków)`);
        break;
      }
    }

    // Fallback dla treści
    if (!content && structuredData.description) {
      content = structuredData.description;
      console.log('✅ UŻYTO OPISU Z STRUCTURED DATA');
    }
  }

  const result = {
    title: title || url,
    content: content,
    source: source
  };

  logExtractedContent(url, result);
  return result;
}

// 🆕 NOWA: Strategia dla blogów i artykułów
function extractBlogContent(document: Document, url: string): { title: string; content: string; source: string } {
  console.log('\n📝 ROZPOCZYNANIE EKSTRAKCJI BLOGA:', url);

  let title = '';
  let content = '';
  let source = 'Blog';

  // Wykryj typ bloga
  if (url.includes('medium.com')) {
    source = 'Medium';
  } else if (url.includes('wordpress.com') || url.includes('wp-content')) {
    source = 'WordPress';
  } else if (url.includes('blogger.com') || url.includes('blogspot.com')) {
    source = 'Blogger';
  }

  console.log('📝 WYKRYTY TYP ŹRÓDŁA:', source);

  // Usuń niepożądane elementy
  removeUnwantedElements(document);

  // Sprawdź structured data
  const structuredData = extractStructuredData(document);
  if (structuredData.title) {
    title = structuredData.title;
    console.log('✅ TYTUŁ Z STRUCTURED DATA:', title);
  }

  // Selektory specyficzne dla blogów
  const titleSelectors = [
    'h1.entry-title',
    'h1.post-title',
    'h1.article-title',
    '.post-header h1',
    '.entry-header h1',
    '.article-header h1',
    'header h1',
    'h1',
    '.title'
  ];

  if (!title) {
    console.log('🔍 SZUKANIE TYTUŁU BLOGA...');
    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent && titleElement.textContent.trim().length > 5) {
        title = titleElement.textContent.trim();
        console.log(`✅ ZNALEZIONO TYTUŁ przez "${selector}":`, title);
        break;
      }
    }
  }

  // Selektory dla treści blogów
  const contentSelectors = [
    '.entry-content',
    '.post-content',
    '.article-content',
    '.post-body',
    '.entry-body',
    '.article-body',
    '.content',
    '.post .content',
    'article .content',
    '[itemprop="articleBody"]',
    'main article',
    'article'
  ];

  console.log('🔍 SZUKANIE TREŚCI BLOGA...');
  for (const selector of contentSelectors) {
    const contentElement = document.querySelector(selector);
    if (contentElement && contentElement.textContent && contentElement.textContent.trim().length > 100) {
      content = contentElement.textContent.trim();
      console.log(`✅ ZNALEZIONO TREŚĆ przez "${selector}" (${content.length} znaków)`);
      break;
    }
  }

  const result = {
    title: title || url,
    content: content,
    source: source
  };

  logExtractedContent(url, result);
  return result;
}

// 🆕 ULEPSZONA: Funkcja dla stron Wiki
function extractWikiContent(document: Document, url: string): { title: string; content: string; source: string } {
  console.log('\n📚 ROZPOCZYNANIE EKSTRAKCJI WIKI:', url);

  let title = '';
  let content = '';
  let source = 'Wikipedia';

  // Wykryj typ wiki
  if (url.includes('wikipedia.org')) {
    source = 'Wikipedia';
  } else if (url.includes('wikimedia.org')) {
    source = 'Wikimedia';
  } else if (url.includes('wiki')) {
    source = 'Wiki';
  }

  console.log('📚 WYKRYTY TYP ŹRÓDŁA:', source);

  // Usuń niepożądane elementy + specyficzne dla wiki
  removeUnwantedElements(document);

  // Usuń elementy specyficzne dla Wiki
  const wikiUnwanted = [
    '.navbox', '.infobox', '.metadata', '.navigation-box',
    '.coordinates', '.dablink', '.hatnote', '#coordinates',
    '.mw-editsection', '.references', '.reflist'
  ];

  wikiUnwanted.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => element.remove());
  });

  // Tytuł z Wiki
  const titleSelectors = [
    '#firstHeading',
    'h1.firstHeading',
    'h1.page-title',
    'h1'
  ];

  console.log('🔍 SZUKANIE TYTUŁU WIKI...');
  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent) {
      title = titleElement.textContent.trim();
      console.log(`✅ ZNALEZIONO TYTUŁ przez "${selector}":`, title);
      break;
    }
  }

  // Treść z Wiki - pierwszych kilka paragrafów
  const contentSelectors = [
    '#mw-content-text .mw-parser-output',
    '.mw-parser-output',
    '#content .mw-content-ltr',
    '#bodyContent'
  ];

  console.log('🔍 SZUKANIE TREŚCI WIKI...');
  for (const selector of contentSelectors) {
    const contentElement = document.querySelector(selector);
    if (contentElement) {
      // Weź pierwsze 3-4 paragrafy z Wiki
      const paragraphs = contentElement.querySelectorAll('p');
      let textContent = '';
      let paragraphCount = 0;

      for (const paragraph of paragraphs) {
        if (paragraph.textContent && paragraph.textContent.trim().length > 50) {
          textContent += paragraph.textContent.trim() + '\n\n';
          paragraphCount++;
          if (paragraphCount >= 4) break;
        }
      }

      if (textContent.length > 200) {
        content = textContent.trim();
        console.log(`✅ ZNALEZIONO TREŚĆ WIKI przez "${selector}" (${content.length} znaków, ${paragraphCount} paragrafów)`);
        break;
      }
    }
  }

  const result = {
    title: title || url,
    content: content,
    source: source
  };

  logExtractedContent(url, result);
  return result;
}

// Specjalistyczna funkcja dla PubMed (zachowana jak była)
function extractPubMedContent(document: Document, url: string): { title: string; content: string; source: string } {
  console.log('\n🧬 ROZPOCZYNANIE EKSTRAKCJI PUBMED:', url);

  let title = '';
  let content = '';

  // Wyciągnij tytuł artykułu
  const titleSelectors = [
    'h1.heading-title',
    '.abstract-title h1',
    'h1',
    '.article-title',
    '[data-article-title]'
  ];

  console.log('🔍 SZUKANIE TYTUŁU...');
  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent) {
      title = titleElement.textContent.trim();
      console.log(`✅ ZNALEZIONO TYTUŁ przez selektor "${selector}":`, title);
      break;
    } else {
      console.log(`❌ Brak tytułu dla selektora: "${selector}"`);
    }
  }

  // Wyciągnij abstract - próbuj różnych selektorów
  const abstractSelectors = [
    '#eng-abstract',
    '#abstract',
    '.abstract-content',
    '.abstract-text',
    '[data-abstract]',
    '.abstract p',
    '.formatted-abstract'
  ];

  console.log('🔍 SZUKANIE ABSTRACT...');
  for (const selector of abstractSelectors) {
    const abstractElement = document.querySelector(selector);
    if (abstractElement && abstractElement.textContent) {
      let abstractText = abstractElement.textContent.trim();
      console.log(`✅ ZNALEZIONO ABSTRACT przez selektor "${selector}" (${abstractText.length} znaków)`);

      // Jeśli to structured abstract, zachowaj strukturę
      const structuredElements = abstractElement.querySelectorAll('strong, b, .label');
      if (structuredElements.length > 0) {
        console.log(`📋 WYKRYTO STRUCTURED ABSTRACT (${structuredElements.length} sekcji)`);

        // Przetwórz structured abstract zachowując nagłówki
        abstractText = Array.from(abstractElement.childNodes)
          .map(node => {
            if (node.nodeType === 3) { // Text node
              return node.textContent?.trim() || '';
            } else if (node.nodeType === 1) { // Element node
              const element = node as Element;
              if (element.tagName === 'STRONG' || element.tagName === 'B') {
                return `\n${element.textContent?.trim()}: `;
              }
              return element.textContent?.trim() || '';
            }
            return '';
          })
          .join('')
          .replace(/\n\s*\n/g, '\n')
          .trim();
      }

      content = abstractText;
      console.log(`📄 ABSTRACT PO PRZETWORZENIU: ${content.substring(0, 150)}...`);
      break;
    } else {
      console.log(`❌ Brak abstract dla selektora: "${selector}"`);
    }
  }

  // Fallback - szukaj tekstu w różnych lokalizacjach
  if (!content) {
    console.log('⚠️ FALLBACK: Szukanie treści w alternatywnych miejscach...');

    const fallbackSelectors = [
      '.abstract',
      '.article-abstract',
      '.summary',
      '[data-qa="abstract"]',
      '.content-abstract'
    ];

    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.length > 100) {
        content = element.textContent.trim();
        console.log(`✅ FALLBACK: Znaleziono treść przez "${selector}" (${content.length} znaków)`);
        break;
      } else {
        console.log(`❌ FALLBACK: Brak treści dla "${selector}"`);
      }
    }
  }

  // Dodatkowe metadane jeśli dostępne
  console.log('🔍 SZUKANIE METADANYCH...');
  const authors = document.querySelector('.authors')?.textContent?.trim();
  const journal = document.querySelector('.journal-title, .citation-journal')?.textContent?.trim();
  const year = document.querySelector('.citation-year, .pub-date')?.textContent?.trim();

  if (authors) console.log('👥 AUTORZY:', authors.substring(0, 100) + (authors.length > 100 ? '...' : ''));
  if (journal) console.log('📚 CZASOPISMO:', journal);
  if (year) console.log('📅 ROK:', year);

  // Wzbogać treść o podstawowe metadane
  let enrichedContent = content;
  if (authors && authors.length < 200) {
    enrichedContent = `Autorzy: ${authors}\n\n${enrichedContent}`;
    console.log('✅ DODANO AUTORÓW DO TREŚCI');
  }
  if (journal) {
    enrichedContent = `Źródło: ${journal}${year ? ` (${year})` : ''}\n\n${enrichedContent}`;
    console.log('✅ DODANO ŹRÓDŁO DO TREŚCI');
  }

  const result = {
    title: title || url,
    content: enrichedContent,
    source: 'PubMed'
  };

  logExtractedContent(url, result);
  return result;
}

// Funkcja dla innych naukowych źródeł (zachowana jak była)
function extractScientificContent(document: Document, url: string): { title: string; content: string; source: string } {
  let title = '';
  let content = '';
  let source = 'Scientific Article';

  console.log('\n📚 ROZPOCZYNANIE EKSTRAKCJI NAUKOWEJ:', url);

  // Wykryj typ źródła na podstawie URL
  if (url.includes('arxiv.org')) {
    source = 'arXiv';
  } else if (url.includes('doi.org') || url.includes('dx.doi.org')) {
    source = 'DOI';
  } else if (url.includes('springer.com')) {
    source = 'Springer';
  } else if (url.includes('sciencedirect.com')) {
    source = 'ScienceDirect';
  } else if (url.includes('nature.com')) {
    source = 'Nature';
  } else if (url.includes('science.org')) {
    source = 'Science';
  }

  console.log('🔬 WYKRYTY TYP ŹRÓDŁA:', source);

  // Wyciągnij tytuł
  const titleSelectors = [
    'h1',
    '.article-title',
    '.title',
    '.paper-title',
    '[data-testid="article-title"]',
    '.publication-title'
  ];

  console.log('🔍 SZUKANIE TYTUŁU...');
  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent) {
      title = titleElement.textContent.trim();
      console.log(`✅ ZNALEZIONO TYTUŁ przez "${selector}":`, title);
      break;
    }
  }

  // Wyciągnij abstract/summary
  const contentSelectors = [
    '.abstract',
    '.summary',
    '.article-abstract',
    '#abstract',
    '[data-testid="abstract"]',
    '.Prose', // arXiv
    '.abstract-content',
    '.article-section__content' // niektóre wydawnictwa
  ];

  console.log('🔍 SZUKANIE TREŚCI...');
  for (const selector of contentSelectors) {
    const contentElement = document.querySelector(selector);
    if (contentElement && contentElement.textContent && contentElement.textContent.length > 100) {
      content = contentElement.textContent.trim();
      console.log(`✅ ZNALEZIONO TREŚĆ przez "${selector}" (${content.length} znaków)`);
      break;
    }
  }

  const result = {
    title: title || url,
    content: content,
    source: source
  };

  logExtractedContent(url, result);
  return result;
}

// 🆕 ULEPSZONA: Funkcja do ogólnego wyciągania treści
function extractGeneralContent(document: Document, url: string): { title: string; content: string; source: string } {
  console.log('\n🌐 ROZPOCZYNANIE EKSTRAKCJI OGÓLNEJ:', url);

  let title = '';
  let content = '';

  // Usuń niepożądane elementy
  removeUnwantedElements(document);

  // Sprawdź structured data
  const structuredData = extractStructuredData(document);
  if (structuredData.title) {
    title = structuredData.title;
    console.log('✅ TYTUŁ Z STRUCTURED DATA:', title);
  }

  // Wyciągnij tytuł - więcej opcji
  const titleSelectors = [
    'h1',
    'title',
    '.page-title',
    '.entry-title',
    '.post-title',
    '.article-title',
    '[property="og:title"]',
    'meta[name="title"]'
  ];

  if (!title) {
    console.log('🔍 SZUKANIE TYTUŁU...');
    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement) {
        const titleText = titleElement.textContent || titleElement.getAttribute('content') || '';
        if (titleText.trim().length > 3) {
          title = titleText.trim();
          console.log(`✅ ZNALEZIONO TYTUŁ przez "${selector}":`, title);
          break;
        }
      }
    }
  }

  // Spróbuj znaleźć główną treść - więcej opcji
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '#content',
    '.main-content',
    '.page-content',
    '.text-content',
    '.article-body',
    '.post-body',
    '.entry-body'
  ];

  console.log('🔍 SZUKANIE GŁÓWNEJ TREŚCI...');
  for (const selector of contentSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.length > 200) {
      content = element.textContent;
      console.log(`✅ ZNALEZIONO TREŚĆ przez "${selector}" (${content.length} znaków)`);
      break;
    }
  }

  // 🆕 NOWY FALLBACK: Zbierz wszystkie paragrafy
  if (!content) {
    console.log('⚠️ FALLBACK: Zbieranie paragrafów...');
    const paragraphs = document.querySelectorAll('p');
    let paragraphContent = '';

    for (const p of paragraphs) {
      if (p.textContent && p.textContent.trim().length > 50) {
        paragraphContent += p.textContent.trim() + '\n\n';
      }
    }

    if (paragraphContent.length > 200) {
      content = paragraphContent;
      console.log(`✅ FALLBACK: Użyto paragrafów (${content.length} znaków)`);
    }
  }

  // Ostateczny fallback - użyj body
  if (!content) {
    console.log('⚠️ ULTIMATE FALLBACK: Używanie body jako źródła treści...');
    const bodyElement = document.querySelector('body');
    if (bodyElement) {
      content = bodyElement.textContent || '';
      console.log(`✅ ULTIMATE FALLBACK: Użyto body (${content.length} znaków)`);
    }
  }

  // Użyj opisu z structured data jeśli brak treści
  if (!content && structuredData.description) {
    content = structuredData.description;
    console.log('✅ UŻYTO OPISU Z STRUCTURED DATA');
  }

  const result = {
    title: title || url,
    content: content,
    source: 'General Web'
  };

  logExtractedContent(url, result);
  return result;
}

// 🆕 NOWA: Funkcja do wyboru strategii
function chooseExtractionStrategy(url: string): string {
  // PubMed
  if (url.includes('pubmed.ncbi.nlm.nih.gov')) {
    return 'pubmed';
  }

  // Naukowe
  if (url.includes('arxiv.org') || url.includes('doi.org') || url.includes('springer.com') ||
      url.includes('sciencedirect.com') || url.includes('nature.com') || url.includes('science.org')) {
    return 'scientific';
  }

  // Wiki
  if (url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wiki')) {
    return 'wiki';
  }

  // Rządowe i prawne
  if (url.includes('.gov') || url.includes('eur-lex.europa.eu') || url.includes('legislation.gov') ||
      url.includes('sejm.gov.pl') || url.includes('eureka.mf.gov.pl')) {
    return 'government';
  }

  // Blogi
  if (url.includes('medium.com') || url.includes('wordpress.com') || url.includes('blogger.com') ||
      url.includes('blogspot.com') || url.includes('wp-content')) {
    return 'blog';
  }

  return 'general';
}

// 🔧 ZMODYFIKOWANA funkcja scrapeUrl z uniwersalnym Puppeteer fallback
async function scrapeUrl(url: string): Promise<ScrapedContent> {
  console.log(`\n🚀 ROZPOCZYNANIE SCRAPINGU: ${url}`);

  // 🆕 NOWA LOGIKA: Próba podstawowej metody + uniwersalny Puppeteer fallback
  let basicMethodFailed = false;
  let basicMethodError = '';

  try {
    console.log('📡 PRÓBA PODSTAWOWEJ METODY SCRAPINGU...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'pl-PL,pl;q=0.9,en;q=0.8,en-US;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'DNT': '1',
      'Sec-GPC': '1'
    };

    if (url.includes('eureka.mf.gov.pl')) {
      headers['Referer'] = 'https://eureka.mf.gov.pl/';
      headers['Cookie'] = '';
      console.log('💰 EUREKA: Dodano specjalne headers');
    }

    if (url.includes('nsa.gov.pl')) {
      headers['Referer'] = 'https://orzeczenia.nsa.gov.pl/';
      console.log('🏛️ NSA: Dodano referer');
    }

    let response;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        console.log(`📡 PRÓBA ${retryCount + 1}/${maxRetries + 1}: ${url}`);

        response = await fetch(url, {
          headers,
          signal: controller.signal,
          redirect: 'follow'
        });

        if (response.ok) {
          break;
        } else {
          // 🆕 KAŻDY błąd HTTP oznacza że podstawowa metoda zawodzi
          console.log(`❌ HTTP ${response.status} - podstawowa metoda nie powiodła się`);
          basicMethodFailed = true;
          basicMethodError = `HTTP ${response.status}: ${response.statusText}`;

          if (retryCount < maxRetries) {
            console.log(`⏳ Próba ${retryCount + 1}, czekam i próbuję ponownie...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            retryCount++;
            continue;
          } else {
            throw new Error(basicMethodError);
          }
        }
      } catch (error) {
        if (retryCount === maxRetries) {
          throw error;
        }
        console.log(`⚠️ Błąd przy próbie ${retryCount + 1}, ponawiam...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        retryCount++;
      }
    }

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      basicMethodFailed = true;
      basicMethodError = `HTTP ${response?.status}: ${response?.statusText}`;
      throw new Error(basicMethodError);
    }

    console.log(`📥 POBRANO HTML (${response.status}): ${url}`);
    const html = await response.text();
    console.log(`📄 ROZMIAR HTML: ${html.length} znaków`);

    // Sprawdź czy strona wymaga JavaScript
    const needsJavaScript = html.length < 1000 ||
        html.includes('JavaScript is required') ||
        html.includes('Please enable JavaScript') ||
        html.includes('Включите JavaScript') ||
        html.includes('Bitte aktivieren Sie JavaScript') ||
        (html.includes('noscript') && html.includes('</noscript>')) ||
        // Specjalnie dla Eureka i innych stron SPA
        (url.includes('eureka.mf.gov.pl') && html.length < 5000) ||
        // Ogólne wykrywanie SPA
        html.includes('spa-') || html.includes('single-page') ||
        html.includes('app-root') || html.includes('react-root');

    if (needsJavaScript) {
      console.log('⚠️ UWAGA: Strona wymaga JavaScript - podstawowa metoda niewystarczająca');
      basicMethodFailed = true;
      basicMethodError = 'Strona wymaga JavaScript';
      throw new Error(basicMethodError);
    }

    // Kontynuuj ze standardowym scrapingiem...
    // Użyj require zamiast import dla JSDOM
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const document = dom.window.document;

    let extractedData: { title: string; content: string; source: string };

    const strategy = chooseExtractionStrategy(url);
    console.log(`🎯 WYBRANA STRATEGIA: ${strategy.toUpperCase()}`);

    switch (strategy) {
      case 'pubmed':
        extractedData = extractPubMedContent(document, url);
        break;
      case 'scientific':
        extractedData = extractScientificContent(document, url);
        break;
      case 'wiki':
        extractedData = extractWikiContent(document, url);
        break;
      case 'government':
        extractedData = extractGovernmentContent(document, url);
        break;
      case 'blog':
        extractedData = extractBlogContent(document, url);
        break;
      default:
        extractedData = extractGeneralContent(document, url);
    }

    // 🆕 SPRAWDZENIE CZY WYCIĄGNIĘTO JAKĄKOLWIEK TREŚĆ
    if (!extractedData.content || extractedData.content.trim().length === 0) {
      console.log(`❌ PODSTAWOWA METODA: Brak treści - wyciągnięto 0 znaków`);
      basicMethodFailed = true;
      basicMethodError = 'Brak treści - wyciągnięto 0 znaków z podstawowej metody';
      throw new Error(basicMethodError);
    }

    console.log('\n🧹 CZYSZCZENIE TREŚCI...');

    let cleanedContent = extractedData.content;

    if (strategy === 'government') {
      cleanedContent = cleanedContent
        .replace(/Drukuj\s*Wyślij\s*Zapisz/gi, '')
        .replace(/Menu główne.*?(?=\n|$)/gi, '')
        .replace(/Przejdź do.*?(?=\n|$)/gi, '')
        .replace(/Logowanie.*?(?=\n|$)/gi, '')
        .replace(/Copyright.*?(?=\n|$)/gi, '')
        .replace(/Wszystkie prawa zastrzeżone.*?(?=\n|$)/gi, '')
        .replace(/Ministerstwo.*?tel\.\s*\d+.*?(?=\n|$)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      console.log(`🧹 GOVERNMENT: Oczyszczono treść (${extractedData.content.length} → ${cleanedContent.length} znaków)`);
    }

    // 🆕 SPRAWDZENIE CZY TREŚĆ JEST WYSTARCZAJĄCA PO CZYSZCZENIU
    if (!cleanedContent || cleanedContent.trim().length === 0) {
      console.log(`❌ PODSTAWOWA METODA: Brak treści po czyszczeniu - 0 znaków`);
      basicMethodFailed = true;
      basicMethodError = 'Brak treści po czyszczeniu - 0 znaków';
      throw new Error(basicMethodError);
    } else if (cleanedContent.length < 50) {
      console.log(`❌ PODSTAWOWA METODA: Niewystarczająca treść (${cleanedContent.length} znaków)`);
      basicMethodFailed = true;
      basicMethodError = `Niewystarczająca treść - tylko ${cleanedContent.length} znaków`;
      throw new Error(basicMethodError);
    }

    const result: ScrapedContent = {
      url,
      title: cleanAndTruncateText(extractedData.title, 200),
      content: cleanAndTruncateText(cleanedContent, 100000),
      source: extractedData.source
    };

    console.log(`\n✅ SUKCES PODSTAWOWEJ METODY dla ${url}:`);
    console.log(`   📖 Tytuł: ${result.title}`);
    console.log(`   📄 Treść: ${result.content.length} znaków`);
    console.log(`   🏷️ Źródło: ${result.source}`);
    console.log(`   ✅ Status: SUKCES (Podstawowa metoda)`);

    return result;

  } catch (error) {
    // 🆕 KAŻDY BŁĄD PODSTAWOWEJ METODY URUCHAMIA PUPPETEER FALLBACK
    console.error(`❌ BŁĄD PODSTAWOWEJ METODY: ${getErrorMessage(error)}`);
    basicMethodFailed = true;
    basicMethodError = getErrorMessage(error);
  }

  // 🆕 UNIWERSALNY PUPPETEER FALLBACK
  if (basicMethodFailed) {
    console.log('\n🤖 PODSTAWOWA METODA ZAWIODŁA - PRÓBA Z PUPPETEER...');
    console.log(`🔍 Powód: ${basicMethodError}`);

    try {
      const puppeteerData = await scrapeWithPuppeteer(url);

      // 🆕 SPRAWDZENIE CZY PUPPETEER POZYSKAŁ TREŚĆ
      if (!puppeteerData.content || puppeteerData.content.trim().length === 0) {
        console.log('❌ PUPPETEER FALLBACK: Brak treści - wyciągnięto 0 znaków');
        throw new Error('Puppeteer fallback - brak treści (0 znaków)');
      } else if (puppeteerData.content.length < 20) {
        console.log(`⚠️ PUPPETEER FALLBACK: Bardzo krótka treść (${puppeteerData.content.length} znaków)`);
        console.log(`🔍 Treść: "${puppeteerData.content}"`);
        // Kontynuuj mimo krótkiej treści - może to być wszystko co da się wyciągnąć
      }

      if (puppeteerData.content && puppeteerData.content.length > 0) {
        console.log('🎉 SUKCES Z PUPPETEER FALLBACK!');

        const cleanedTitle = cleanAndTruncateText(puppeteerData.title, 200);
        const cleanedContent = cleanAndTruncateText(puppeteerData.content, 100000);

        // 🆕 SPRAWDZENIE CZY CZYSZCZENIE NIE USUNĘŁO CAŁEJ TREŚCI
        if (!cleanedContent || cleanedContent.trim().length === 0) {
          console.log('❌ PUPPETEER FALLBACK: Treść usunięta podczas czyszczenia');
          throw new Error('Puppeteer fallback - treść usunięta podczas czyszczenia');
        }

        const result: ScrapedContent = {
          url,
          title: cleanedTitle,
          content: cleanedContent,
          source: puppeteerData.source + ' (Fallback)'
        };

        console.log(`\n✅ KOŃCOWY WYNIK PUPPETEER FALLBACK dla ${url}:`);
        console.log(`   📖 Tytuł: ${result.title}`);
        console.log(`   📄 Treść: ${result.content.length} znaków`);
        console.log(`   🏷️ Źródło: ${result.source}`);
        console.log(`   ✅ Status: SUKCES (Puppeteer Fallback)`);

        return result;
      } else {
        console.log('❌ PUPPETEER FALLBACK: Nie udało się pozyskać treści lub treść zbyt krótka');
        console.log(`📊 Długość pozyskanej treści: ${puppeteerData.content?.length || 0} znaków`);
        if (puppeteerData.content?.length === 0) {
          throw new Error('Puppeteer fallback - brak treści (0 znaków)');
        } else {
          throw new Error(`Puppeteer fallback - treść zbyt krótka (${puppeteerData.content?.length || 0} znaków)`);
        }
      }
    } catch (puppeteerError) {
      const puppeteerErrorMessage = getErrorMessage(puppeteerError);
      console.error('❌ BŁĄD PUPPETEER FALLBACK:', puppeteerErrorMessage);

      // Jeśli to błąd z executable path, zwróć bardziej pomocną informację
      if (puppeteerErrorMessage.includes('executablePath') || puppeteerErrorMessage.includes('executable')) {
        console.log('💡 WSKAZÓWKA: Sprawdź czy Chrome/Chromium jest zainstalowany lub ustaw PUPPETEER_EXECUTABLE_PATH');
      }

      // Zwróć błąd zawierający informację o obu metodach
      const finalError = `Obie metody zawiodły - Podstawowa: ${basicMethodError}, Puppeteer: ${puppeteerErrorMessage}`;

      console.log(`   ❌ Status: BŁĄD - ${finalError}`);

      return {
        url,
        title: url,
        content: '',
        error: finalError
      };
    }
  }

  // Ten kod nie powinien się nigdy wykonać, ale dla bezpieczeństwa
  return {
    url,
    title: url,
    content: '',
    error: 'Nieoczekiwany błąd w funkcji scrapeUrl'
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { urls } = body;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: 'Brak prawidłowej listy URL-ów' },
        { status: 400 }
      );
    }

    if (urls.length > 5) {
      return NextResponse.json(
        { error: 'Maksymalna liczba URL-ów to 5' },
        { status: 400 }
      );
    }

    // Walidacja URL-ów
    const validUrls: string[] = [];
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        // Sprawdź czy to nie jest niebezpieczny protokół
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          validUrls.push(url);
        }
      } catch (error) {
        console.warn(`❌ NIEPRAWIDŁOWY URL: ${url}`);
      }
    }

    if (validUrls.length === 0) {
      return NextResponse.json(
        { error: 'Brak prawidłowych URL-ów' },
        { status: 400 }
      );
    }

    console.log(`\n🎯 ROZPOCZYNANIE POBIERANIA ${validUrls.length} URL-ów`);
    console.log('📋 LISTA URL-ów:', validUrls);

    // Pobierz treści równolegle z ograniczeniem czasu
    const scrapePromises = validUrls.map(url => scrapeUrl(url));
    const scrapedResults = await Promise.all(scrapePromises);

    // 🆕 ZMIENIONA logika - akceptuj treść od 20 znaków (była 50)
    const successfulScrapes = scrapedResults.filter(result =>
      result.content && result.content.length > 20 && !result.error
    );

    // Zbierz błędy dla diagnostyki
    const errors = scrapedResults.filter(result => result.error).map(result => ({
      url: result.url,
      error: result.error
    }));

    console.log(`\n📊 PODSUMOWANIE SCRAPINGU:`);
    console.log(`   ✅ Udane: ${successfulScrapes.length}/${validUrls.length}`);
    console.log(`   ❌ Błędy: ${errors.length}`);

    if (errors.length > 0) {
      console.log('💥 SZCZEGÓŁY BŁĘDÓW:', errors);
    }

    // ✅ FINALNE LOGOWANIE TREŚCI KTÓRE BĘDĄ PRZEKAZANE DO AI
    console.log('\n📤 TREŚCI PRZEKAZYWANE DO AI:');
    successfulScrapes.forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.source}: ${result.title}`);
      console.log(`    URL: ${result.url}`);
      console.log(`    Długość: ${result.content.length} znaków`);
      console.log(`    Preview: "${result.content.substring(0, 100)}..."`);
    });

    return NextResponse.json({
      success: true,
      scrapedContent: successfulScrapes,
      totalRequested: validUrls.length,
      successfullyScraped: successfulScrapes.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('💥 BŁĄD W ENDPOINT SCRAPE-URLS:', error);
    return NextResponse.json(
      { error: 'Błąd wewnętrzny serwera podczas pobierania treści' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Ta metoda nie jest obsługiwana. Użyj metody POST.' },
    { status: 405 }
  );
}