// src/app/api/anthropic/generate-cover-prompt/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint, getUserAiSettings } from '@/lib/user-api-keys';

export const runtime = 'nodejs';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  temperature?: number;
}

// 🔄 FETCH WITH RETRY AND TIMEOUT
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  timeout: number = 30000
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} to ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(`✅ Fetch succeeded on attempt ${attempt}`);
      return response;

    } catch (error: any) {
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }

      const delay = 1000 * Math.pow(2, attempt - 1);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unexpected retry loop exit');
}

// 🎯 MODEL-SPECIFIC PROMPT CONFIGURATIONS
const MODEL_PROMPT_CONFIGS = {
  "imagen-3": {
    provider: "google",
    maxLength: 4000,
    optimalLength: 2000,
    detailLevel: "high",
    style: "detailed-artistic",
    supportsComplexInstructions: true,
    recommendedTokens: 1200
  }
} as const;

export async function POST(request: Request) {
  // ✅ SPRAWDŹ CZY TO WEWNĘTRZNE WYWOŁANIE
  const isInternalRequest = request.headers.get('x-internal-request') === 'true';

  if (!isInternalRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
  } else {
    console.log('🔗 Internal request detected - skipping session auth');
  }

  console.log('🎨 === ADAPTIVE COVER PROMPT GENERATOR ===');

  try {
    const body = await request.json();
    const { title, subtitle, chapters, targetModel } = body;

    const BASIC_AI_MODEL = process.env.BASIC_AI_MODEL || 'claude-haiku-4-5';
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-5';

    if (!title || !chapters || !Array.isArray(chapters)) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe. Wymagany tytuł ebooka i lista rozdziałów.' },
        { status: 400 }
      );
    }

    // ✅ POBIERZ INFORMACJE O MODELU GRAFICZNYM UŻYTKOWNIKA
    let imageModel: string = targetModel || 'imagen-3'; // fallback
    let anthropicApiKey: string | null = null;
    let keySource: 'user' | 'env' | 'none' = 'none';
    let userAiSettings: any = null;
    let textModelToUse: string = BASIC_AI_MODEL; // fallback default

    if (!isInternalRequest) {
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;

      if (userId) {
        // Pobierz ustawienia AI użytkownika
        userAiSettings = await getUserAiSettings(userId);
        imageModel = userAiSettings.imageAiModel || 'imagen-3';

        const { apiKey, source } = await getApiKeyForEndpoint(
          userId,
          'anthropic',
          'ANTHROPIC_API_KEY'
        );
        anthropicApiKey = apiKey;
        keySource = source;

        textModelToUse = userAiSettings.textAiModel === 'claude-3-sonnet'
          ? PREMIUM_AI_MODEL
          : BASIC_AI_MODEL;

        console.log(`🖼️ Image Model (target): ${imageModel}`);
        console.log(`🤖 Text Model: ${textModelToUse} (provider: ${userAiSettings.textAiProvider})`);
        console.log(`🔑 API Key Source: ${keySource}`);
      }
    } else {
      // Internal request - sprawdź czy targetModel został podany
      if (targetModel) {
        imageModel = targetModel;
        console.log(`🖼️ Target Image Model (from request): ${imageModel}`);
      }

      // Use env var only
      anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? null;
      keySource = anthropicApiKey ? 'env' : 'none';
      console.log(`🔑 Internal request - using env var: ${keySource}`);
    }

    if (!anthropicApiKey) {
      console.error('❌ Brak dostępnego klucza Anthropic API');
      return NextResponse.json(
        { error: 'Błąd konfiguracji - brak klucza API Anthropic' },
        { status: 500 }
      );
    }

    // 🎯 KONFIGURACJA NA PODSTAWIE MODELU GRAFICZNEGO
    const modelConfig = MODEL_PROMPT_CONFIGS[imageModel as keyof typeof MODEL_PROMPT_CONFIGS];

    if (!modelConfig) {
      console.warn(`⚠️ Unknown image model: ${imageModel}, using Imagen-3 config`);
      imageModel = 'imagen-3';
    }

    const finalConfig = MODEL_PROMPT_CONFIGS[imageModel as keyof typeof MODEL_PROMPT_CONFIGS];

    console.log(`🎯 === MODEL-ADAPTIVE CONFIGURATION ===`);
    console.log(`   - Target Image Model: ${imageModel}`);
    console.log(`   - Provider: ${finalConfig.provider.toUpperCase()}`);
    console.log(`   - Max Length: ${finalConfig.maxLength} chars`);
    console.log(`   - Optimal Length: ${finalConfig.optimalLength} chars`);
    console.log(`   - Detail Level: ${finalConfig.detailLevel}`);
    console.log(`   - Style: ${finalConfig.style}`);
    console.log(`   - Complex Instructions: ${finalConfig.supportsComplexInstructions}`);
    console.log(`🎯 === END CONFIGURATION ===`);

    console.log(`📖 Ebook: "${title}" ${subtitle ? `- "${subtitle}"` : ''}`);
    console.log(`📚 Rozdziały: ${chapters.length} chapters`);

    // Przygotowanie kontekstu - dostosowane do modelu
    const maxChapters = finalConfig.supportsComplexInstructions ? 10 : 5;
    const maxContentLength = finalConfig.supportsComplexInstructions ? 300 : 150;

    const chaptersContext = chapters
      .slice(0, maxChapters)
      .map((ch: any, index: number) => `${index + 1}. ${ch.title}`)
      .join('\n');

    const contentSamples = chapters
      .slice(0, finalConfig.supportsComplexInstructions ? 5 : 3)
      .map((ch: any) => {
        if (ch.content && ch.content.trim()) {
          return ch.content.trim().substring(0, maxContentLength) + '...';
        }
        return '';
      })
      .filter(content => content.length > 0)
      .join('\n\n');

    // 🎨 PROMPT GENERATION FOR IMAGEN-3 - FULL FRAME COMPOSITION
    const prompt = `Jesteś ekspertem w tworzeniu szczegółowych promptów okładek książek dla ${imageModel.toUpperCase()} (limit ${finalConfig.maxLength} znaków). Stwórz profesjonalny prompt okładki dla ebooka o długości około ${finalConfig.optimalLength} znaków.

INFORMACJE O EBOOKU:
- Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}

ROZDZIAŁY EBOOKA:
${chaptersContext}

${contentSamples ? `PRÓBKI TREŚCI Z ROZDZIAŁÓW:\n${contentSamples}` : ''}

KRYTYCZNE INSTRUKCJE KOMPOZYCJI DLA ${imageModel.toUpperCase()}:
- Długość: ${finalConfig.optimalLength} znaków (cel)
- Format kwadratowy 1024x1024 (OBOWIĄZKOWY)

KOMPOZYCJA - ABSOLUTNIE KRYTYCZNE:
- FULL FRAME COMPOSITION - kompozycja wypełnia CAŁY obraz od krawędzi do krawędzi
- EDGE-TO-EDGE DESIGN - wszystkie elementy rozciągają się na całą powierzchnię
- ZERO MARGINESÓW - żadnych marginesów, żadnych pustych przestrzeni przy krawędziach
- FULL BLEED - grafika rozlewa się na całą powierzchnię 1024x1024
- NO FLOATING OBJECTS - żadnych obiektów "unoszących się" na tle
- NO CENTERED SMALL ELEMENTS - żadnych małych wycentrowanych elementów
- BACKGROUND FILLS EVERYTHING - tło wypełnia całkowicie cały obszar
- SEAMLESS EDGES - elementy mogą wychodzić poza ramkę, bez widocznych granic

TŁO I WYPEŁNIENIE:
- Solidne, pełne tło (gradients, textures, scenes - ale WYPEŁNIAJĄCE CAŁOŚĆ)
- Żadnych przezroczystych obszarów
- Żadnych cieni wokół całej kompozycji
- Żadnego efektu "kartki papieru" z cieniem
- Kompozycja to PEŁNY obraz, nie obiekt na tle

ZAKAZ TEKSTU (BEZ WYJĄTKÓW):
- ABSOLUTNIE ŻADEN TEKST, NAPISY, LITERY, CYFRY, SŁOWA, TYTUŁY
- ZABRONIONE: wszelkie napisane elementy, etykiety, znaki, napisy na obiektach
- TYLKO CZYSTA GRAFIKA: bez jakichkolwiek elementów tekstowych
- ZABRONIONE: readable content, written elements, typography
- ZABRONIONE: logos, brand names, captions, labels

STYL I JAKOŚĆ:
- Szczegółowy opis kompozycji wypełniającej całą przestrzeń
- Profesjonalna jakość wydawnicza
- Marketingowa atrakcyjność
- Gatunek-specyficzne elementy wizualne
- Emocjonalny impact i storytelling

PAMIĘTAJ: 
- Efektem ma być PEŁNA GRAFIKA wypełniająca CAŁĄ przestrzeń 1024x1024
- BEZ marginesów, BEZ przezroczystości, BEZ obiektów na tle
- FULL FRAME, EDGE-TO-EDGE, ZERO MARGINS
- To jest OKŁADKA KSIĄŻKI - pełna kompozycja, nie logo na tle!

Napisz TYLKO surowy prompt okładki (bez komentarzy czy nagłówków):`;

    const requestBody: AnthropicRequest = {
      model: textModelToUse,
      max_tokens: finalConfig.recommendedTokens,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    };

    console.log(`🔥 Wysyłanie zapytania do Claude...`);
    console.log(`   - Text Model: ${textModelToUse}`);
    console.log(`   - Target Image Model: ${imageModel}`);
    console.log(`   - Max Tokens: ${finalConfig.recommendedTokens}`);
    console.log(`   - Temperature: ${requestBody.temperature}`);

    const response = await fetchWithRetry(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      },
      3,
      30000
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Błąd API Anthropic:`, errorText);
      return NextResponse.json({ error: `Błąd podczas generowania promptu okładki: ${errorText}` }, { status: response.status });
    }

    const responseData = await response.json();
    let coverPrompt = responseData.content[0].text.trim();

    // 🧹 CZYSZCZENIE Z KOMENTARZY I NAGŁÓWKÓW
    const unwantedPrefixes = [
      'Oto ultra-szczegółowy prompt',
      'Oto szczegółowy prompt',
      'Oto prompt',
      'Ultra-szczegółowy prompt',
      'Szczegółowy prompt',
      'Prompt okładki',
      'Create a',
      'Design a',
      'Generate a'
    ];

    // Usuń niechciane prefiksy
    unwantedPrefixes.forEach(prefix => {
      const regex = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^:]*:?\\s*`, 'gi');
      coverPrompt = coverPrompt.replace(regex, '');
    });

    // Usuń cudzysłowy z początku i końca jeśli są
    coverPrompt = coverPrompt.replace(/^["']|["']$/g, '').trim();

    // Sprawdź czy prompt zaczyna się od "Create" i jest to właściwy start
    if (!coverPrompt.toLowerCase().startsWith('create') &&
        !coverPrompt.toLowerCase().startsWith('design') &&
        !coverPrompt.toLowerCase().startsWith('ultra-sophisticated') &&
        !coverPrompt.toLowerCase().startsWith('professional')) {
      // Dodaj "Create a" jeśli prompt nie ma odpowiedniego początku
      coverPrompt = `Create a ${coverPrompt}`;
    }

    // Sprawdzenie długości - przytnij tylko jeśli naprawdę przekracza limit
    if (coverPrompt.length > finalConfig.maxLength) {
      console.warn(`⚠️ Prompt przekracza ${finalConfig.maxLength} znaków (${coverPrompt.length}), przycinanie...`);
      coverPrompt = coverPrompt.substring(0, finalConfig.maxLength - 3) + '...';
    }

    // Sprawdź czy prompt zawiera MOCNY zakaz tekstu
    const hasStrongTextBan = coverPrompt.toLowerCase().includes('absolutely no text') ||
                            coverPrompt.toLowerCase().includes('no text elements') ||
                            coverPrompt.toLowerCase().includes('no written') ||
                            coverPrompt.toLowerCase().includes('no letters');

    if (!hasStrongTextBan) {
      coverPrompt += " CRITICAL: Absolutely no text, letters, words, numbers, symbols, signs, or any written elements whatsoever.";
    }

    // Sprawdź czy prompt wymusza FULL FRAME
    const hasFullFrame = coverPrompt.toLowerCase().includes('full frame') ||
                        coverPrompt.toLowerCase().includes('edge-to-edge') ||
                        coverPrompt.toLowerCase().includes('full bleed') ||
                        coverPrompt.toLowerCase().includes('fills entire');

    if (!hasFullFrame) {
      coverPrompt += " Full frame composition filling entire 1024x1024 canvas edge-to-edge with zero margins.";
    }

    // Sprawdź czy prompt wymusza format kwadratowy 1:1
    const hasSquareFormat = coverPrompt.includes('1024x1024') ||
                           coverPrompt.toLowerCase().includes('square format') ||
                           coverPrompt.toLowerCase().includes('1:1 ratio');

    if (!hasSquareFormat) {
      coverPrompt += " Perfect square 1024x1024 format (1:1 ratio).";
    }

    // Dodaj dodatkowe wzmocnienie zakazu tekstu
    if (!coverPrompt.toLowerCase().includes('pure visual')) {
      coverPrompt += " Pure visual composition without any textual elements.";
    }

    // Dodaj referencję do tytułu jeśli brak
    if (!coverPrompt.toLowerCase().includes(title.toLowerCase().substring(0, 15))) {
      coverPrompt += ` Perfect illustration for "${title}".`;
    }

    // Finalne sprawdzenie długości po dodatkach
    if (coverPrompt.length > finalConfig.maxLength) {
      const excess = coverPrompt.length - finalConfig.maxLength;
      const trimIndex = coverPrompt.lastIndexOf('.', coverPrompt.length - excess - 10);
      if (trimIndex > finalConfig.maxLength * 0.8) {
        coverPrompt = coverPrompt.substring(0, trimIndex + 1);
      } else {
        coverPrompt = coverPrompt.substring(0, finalConfig.maxLength - 3) + '...';
      }
    }

    // Zaawansowane metryki jakości
    const qualityMetrics = {
      length: coverPrompt.length,
      targetLength: finalConfig.optimalLength,
      maxLength: finalConfig.maxLength,
      lengthUtilization: (coverPrompt.length / finalConfig.maxLength) * 100,
      containsStrongTextBan: coverPrompt.toLowerCase().includes('absolutely no text') ||
                            coverPrompt.toLowerCase().includes('no text elements') ||
                            coverPrompt.toLowerCase().includes('no written') ||
                            coverPrompt.toLowerCase().includes('critical') ||
                            coverPrompt.toLowerCase().includes('forbidden'),
      containsFullFrame: coverPrompt.toLowerCase().includes('full frame') ||
                        coverPrompt.toLowerCase().includes('edge-to-edge') ||
                        coverPrompt.toLowerCase().includes('full bleed') ||
                        coverPrompt.toLowerCase().includes('fills entire'),
      containsSquareFormat: coverPrompt.includes('1024x1024') ||
                           coverPrompt.toLowerCase().includes('square') ||
                           coverPrompt.toLowerCase().includes('1:1'),
      containsPureVisual: coverPrompt.toLowerCase().includes('pure visual') ||
                         coverPrompt.toLowerCase().includes('visual composition'),
      containsBookCover: coverPrompt.toLowerCase().includes('book cover') || coverPrompt.toLowerCase().includes('cover'),
      containsTitle: coverPrompt.toLowerCase().includes(title.toLowerCase().substring(0, 15)),
      containsProfessional: coverPrompt.toLowerCase().includes('professional'),
      isOptimalLength: coverPrompt.length >= finalConfig.optimalLength * 0.8 && coverPrompt.length <= finalConfig.maxLength,
      overallQuality: 0
    };

    // Oblicz ogólną jakość z priorytetem dla zakazu tekstu, full frame i formatu
    qualityMetrics.overallQuality = (
      (qualityMetrics.containsStrongTextBan ? 0.25 : 0) +    // Mocny zakaz tekstu = 25%
      (qualityMetrics.containsFullFrame ? 0.25 : 0) +        // FULL FRAME = 25%
      (qualityMetrics.containsSquareFormat ? 0.15 : 0) +     // Format 1:1 = 15%
      (qualityMetrics.containsPureVisual ? 0.10 : 0) +       // Pure visual = 10%
      (qualityMetrics.isOptimalLength ? 0.10 : 0) +          // Optymalna długość = 10%
      (qualityMetrics.containsBookCover ? 0.08 : 0) +        // Book cover = 8%
      (qualityMetrics.containsTitle ? 0.04 : 0) +            // Title ref = 4%
      (qualityMetrics.containsProfessional ? 0.03 : 0)       // Professional = 3%
    );

    console.log(`📊 === ADAPTIVE PROMPT QUALITY METRICS ===`);
    console.log(`   Target Model: ${imageModel} (${finalConfig.provider})`);
    console.log(`   Length: ${coverPrompt.length}/${finalConfig.maxLength} chars (${qualityMetrics.lengthUtilization.toFixed(1)}%)`);
    console.log(`   Target Range: ${finalConfig.optimalLength}-${finalConfig.maxLength} chars`);
    console.log(`   Detail Level: ${finalConfig.detailLevel}`);
    console.log(`   Quality Score: ${(qualityMetrics.overallQuality * 100).toFixed(1)}%`);
    console.log(`   Text Model Used: ${textModelToUse}`);
    console.log(`   Key Source: ${keySource}`);
    console.log(`   🚫 STRONG Text Ban: ${qualityMetrics.containsStrongTextBan ? '✅ ENFORCED' : '❌ MISSING'}`);
    console.log(`   🖼️ FULL FRAME: ${qualityMetrics.containsFullFrame ? '✅ ENFORCED' : '❌ MISSING'}`);
    console.log(`   📐 Square Format 1:1: ${qualityMetrics.containsSquareFormat ? '✅ ENFORCED' : '❌ MISSING'}`);
    console.log(`   🎨 Pure Visual: ${qualityMetrics.containsPureVisual ? '✅' : '❌'}`);
    console.log(`   📏 Optimal Length: ${qualityMetrics.isOptimalLength ? '✅' : '❌'}`);
    console.log(`   📖 Book Cover: ${qualityMetrics.containsBookCover ? '✅' : '❌'}`);
    console.log(`📊 === END METRICS ===`);

    console.log(`🔍 Prompt Preview: ${coverPrompt.substring(0, 200)}...`);

    return NextResponse.json({
      success: true,
      coverPrompt: coverPrompt,
      promptLength: coverPrompt.length,
      targetModel: imageModel,
      format: "square-1024x1024-full-frame-no-margins",
      modelConfig: {
        provider: finalConfig.provider,
        maxLength: finalConfig.maxLength,
        optimalLength: finalConfig.optimalLength,
        detailLevel: finalConfig.detailLevel,
        style: finalConfig.style
      },
      qualityMetrics: qualityMetrics,
      utilization: `${qualityMetrics.lengthUtilization.toFixed(1)}% of ${imageModel} capacity`,
      textModelUsed: textModelToUse,
      keySource: keySource,
      userAiSettings: !isInternalRequest ? userAiSettings : null,
      optimizedFor: `${imageModel}-${finalConfig.style}-full-frame-cover-design`,
      textBanEnforcement: {
        strongTextBan: qualityMetrics.containsStrongTextBan,
        pureVisualComposition: qualityMetrics.containsPureVisual,
        noWrittenElements: true,
        visualOnly: true
      },
      formatEnforcement: {
        squareFormat: qualityMetrics.containsSquareFormat,
        fullFrame: qualityMetrics.containsFullFrame,
        aspectRatio: "1:1",
        dimensions: "1024x1024",
        composition: "edge-to-edge",
        margins: "zero"
      }
    });

  } catch (error) {
    console.error('❌ Błąd generowania promptu okładki:', error);
    return NextResponse.json({
      error: 'Błąd wewnętrzny serwera',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Adaptive Cover Prompt Generator - Imagen-3 Full Frame',
    version: "8.0-full-frame-composition",
    supportedImageModels: ['imagen-3'],
    adaptiveFeatures: [
      'Full frame edge-to-edge composition',
      'Zero margins design',
      'No transparency backgrounds',
      'Automatic retry with exponential backoff',
      'Clean prompt output without comments'
    ],
    modelConfigurations: {
      'imagen-3': { maxLength: 4000, detailLevel: 'high', composition: 'full-frame' }
    },
    capabilities: [
      'Full canvas utilization',
      'Edge-to-edge design enforcement',
      'Zero margin composition',
      'Retry logic with 3 attempts',
      '30s timeout per attempt',
      'User API key integration'
    ]
  }, { status: 405 });
}