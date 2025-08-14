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

// 🎯 MODEL-SPECIFIC PROMPT CONFIGURATIONS
const MODEL_PROMPT_CONFIGS = {
  // 🆕 GOOGLE MODELS - RÓŻNE DŁUGOŚCI I SZCZEGÓŁOWOŚĆ
  "imagen-3": {
    provider: "google",
    maxLength: 4000,
    optimalLength: 2000,
    detailLevel: "high",
    style: "detailed-artistic",
    supportsComplexInstructions: true,
    recommendedTokens: 1200
  },
  "imagen-4": {
    provider: "google",
    maxLength: 4000,
    optimalLength: 2500,
    detailLevel: "ultra-high",
    style: "premium-detailed",
    supportsComplexInstructions: true,
    recommendedTokens: 1400
  },
  "imagen-4-ultra": {
    provider: "google",
    maxLength: 4000,
    optimalLength: 3000,
    detailLevel: "maximum",
    style: "ultra-sophisticated",
    supportsComplexInstructions: true,
    recommendedTokens: 1600
  },
  "gemini-image": {
    provider: "google",
    maxLength: 4000,
    optimalLength: 1800,
    detailLevel: "medium-high",
    style: "conversational-detailed",
    supportsComplexInstructions: true,
    recommendedTokens: 1000
  },
  // OPENAI MODELS
  "gpt-image-1": {
    provider: "openai",
    maxLength: 4000,
    optimalLength: 2800,
    detailLevel: "ultra-high",
    style: "ultra-detailed-professional",
    supportsComplexInstructions: true,
    recommendedTokens: 1600
  },
  "dall-e-3": {
    provider: "openai",
    maxLength: 400,
    optimalLength: 350,
    detailLevel: "simple",
    style: "concise-effective",
    supportsComplexInstructions: false,
    recommendedTokens: 400
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

    if (!title || !chapters || !Array.isArray(chapters)) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe. Wymagany tytuł ebooka i lista rozdziałów.' },
        { status: 400 }
      );
    }

    // ✅ POBIERZ INFORMACJE O MODELU GRAFICZNYM UŻYTKOWNIKA
    let imageModel: string = targetModel || 'dall-e-3'; // fallback
    let anthropicApiKey: string | null = null;
    let keySource: 'user' | 'env' | 'none' = 'none';
    let userAiSettings: any = null;
    let textModelToUse: string = 'claude-3-5-haiku-20241022'; // fallback default

    if (!isInternalRequest) {
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;

      if (userId) {
        // Pobierz ustawienia AI użytkownika
        userAiSettings = await getUserAiSettings(userId);
        imageModel = userAiSettings.imageAiModel || 'dall-e-3';

        const { apiKey, source } = await getApiKeyForEndpoint(
          userId,
          'anthropic',
          'ANTHROPIC_API_KEY'
        );
        anthropicApiKey = apiKey;
        keySource = source;

        textModelToUse = userAiSettings.textAiModel === 'claude-3-sonnet'
          ? 'claude-sonnet-4-20250514'
          : 'claude-3-5-haiku-20241022';

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
      console.warn(`⚠️ Unknown image model: ${imageModel}, using DALL-E 3 config`);
      imageModel = 'dall-e-3';
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

    // 🎨 ADAPTIVE PROMPT GENERATION - RÓŻNE STYLE DLA RÓŻNYCH MODELI
    let prompt: string;

    if (finalConfig.detailLevel === "simple") {
      // DALL-E 3 - PROSTY, ZWIĘZŁY PROMPT
      prompt = `Jesteś ekspertem w tworzeniu prostych, zwięzłych promptów okładek książek dla DALL-E 3 (limit 400 znaków). Stwórz krótki, skuteczny prompt okładki dla ebooka.

INFORMACJE O EBOOKU:
- Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}

ROZDZIAŁY:
${chaptersContext}

${contentSamples ? `PRÓBKI TREŚCI:\n${contentSamples}` : ''}

INSTRUKCJE:
- Maksimum 350 znaków
- Prostota i klarowność
- Skupienie na głównym motywie
- Format kwadratowy 1024x1024 (OBOWIĄZKOWY)
- KRYTYCZNY ZAKAZ: ABSOLUTNIE ŻADEN TEKST, NAPISY, LITERY, CYFRY, SŁOWA
- TYLKO CZYSTA GRAFIKA 1:1 BEZ JAKICHKOLWIEK ELEMENTÓW TEKSTOWYCH
- Tylko czysty prompt bez komentarzy

PAMIĘTAJ: Efektem ma być CZYSTA GRAFIKA 1:1 BEZ TEKSTU!

Napisz TYLKO surowy prompt okładki (bez "Oto prompt:" czy innych komentarzy):`;

    } else if (finalConfig.detailLevel === "medium-high") {
      // GEMINI/IMAGEN-3 - ŚREDNIO SZCZEGÓŁOWY
      prompt = `Jesteś ekspertem w tworzeniu szczegółowych promptów okładek książek dla ${imageModel.toUpperCase()} (limit ${finalConfig.maxLength} znaków). Stwórz profesjonalny prompt okładki dla ebooka o długości około ${finalConfig.optimalLength} znaków.

INFORMACJE O EBOOKU:
- Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}

ROZDZIAŁY EBOOKA:
${chaptersContext}

${contentSamples ? `PRÓBKI TREŚCI Z ROZDZIAŁÓW:\n${contentSamples}` : ''}

INSTRUKCJE DLA ${imageModel.toUpperCase()}:
- Długość: ${finalConfig.optimalLength} znaków (cel)
- Szczegółowy opis kompozycji
- Profesjonalna jakość okładki
- Format kwadratowy 1024x1024 (OBOWIĄZKOWY)
- Przezroczyste tło preferowane
- KRYTYCZNY ZAKAZ: ABSOLUTNIE ŻADEN TEKST, NAPISY, LITERY, CYFRY, SŁOWA, TYTUŁY, SYMBOLE TEKSTOWE
- ZABRONIONE: wszelkie napisane elementy, etykiety, znaki, napisy na obiektach
- TYLKO CZYSTA GRAFIKA: bez jakichkolwiek elementów tekstowych
- Marketingowa atrakcyjność
- Gatunek-specyficzne elementy wizualne

PAMIĘTAJ: Efektem ma być CZYSTA GRAFIKA 1:1 BEZ TEKSTU!

Napisz TYLKO surowy prompt okładki (bez komentarzy czy nagłówków):`;

    } else {
      // IMAGEN-4/GPT-IMAGE-1 - ULTRA SZCZEGÓŁOWY
      prompt = `Jesteś ekspertem w tworzeniu ultra-szczegółowych promptów okładek książek dla ${imageModel.toUpperCase()} (limit ${finalConfig.maxLength} znaków). Stwórz bardzo długi, precyzyjny prompt okładki dla ebooka o długości ${finalConfig.optimalLength}-${finalConfig.maxLength} znaków.

INFORMACJE O EBOOKU:
- Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}

ROZDZIAŁY EBOOKA:
${chaptersContext}

${contentSamples ? `PRÓBKI TREŚCI Z ROZDZIAŁÓW:\n${contentSamples}` : ''}

INSTRUKCJE DLA ${imageModel.toUpperCase()} (${finalConfig.detailLevel.toUpperCase()} DETAIL):
- Długość: ${finalConfig.optimalLength}-${finalConfig.maxLength} znaków
- Ultra-szczegółowy opis każdego elementu kompozycji
- Zaawansowane specyfikacje techniczne
- Profesjonalna jakość wydawnicza
- Format kwadratowy 1024x1024 z przezroczystym tłem (OBOWIĄZKOWY)
- Seamless composition bez ramek
- Proper margins - wszystkie elementy oddalene od krawędzi
- Fotorealistyczna jakość z studio lighting
- Komercyjna atrakcyjność marketingowa
- Gatunek-specyficzny visual language
- Emocjonalny impact i storytelling

KRYTYCZNY ZAKAZ TEKSTU:
- ABSOLUTNIE ŻADEN TEKST, NAPISY, LITERY, CYFRY, SŁOWA, TYTUŁY
- ZABRONIONE: znaki, symbole tekstowe, etykiety, napisy na obiektach
- ZABRONIONE: readable content, written elements, typography
- ZABRONIONE: logos, brand names, captions, labels
- ZABRONIONE: signs, banners, posters z tekstem
- ZABRONIONE: książki z widocznym tekstem, gazety z napisami
- TYLKO CZYSTA GRAFIKA: pure visual composition without any textual elements
- Natural edge blending i borderless design

PAMIĘTAJ: Efektem ma być CZYSTA GRAFIKA 1:1 BEZ JAKICHKOLWIEK ELEMENTÓW TEKSTOWYCH!

Napisz TYLKO ultra-szczegółowy surowy prompt okładki (bez "Oto prompt:" czy innych komentarzy):`;
    }

    const requestBody: AnthropicRequest = {
      model: textModelToUse,
      max_tokens: finalConfig.recommendedTokens,
      temperature: finalConfig.detailLevel === "simple" ? 0.3 : 0.2,
      messages: [{ role: 'user', content: prompt }]
    };

    console.log(`🔥 Wysyłanie zapytania do Claude...`);
    console.log(`   - Text Model: ${textModelToUse}`);
    console.log(`   - Target Image Model: ${imageModel}`);
    console.log(`   - Max Tokens: ${finalConfig.recommendedTokens}`);
    console.log(`   - Temperature: ${requestBody.temperature}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

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

    // Oblicz ogólną jakość z priorytetem dla zakazu tekstu i formatu
    qualityMetrics.overallQuality = (
      (qualityMetrics.containsStrongTextBan ? 0.30 : 0) +    // NAJWAŻNIEJSZE: Mocny zakaz tekstu = 30%
      (qualityMetrics.containsSquareFormat ? 0.20 : 0) +     // Format 1:1 = 20%
      (qualityMetrics.containsPureVisual ? 0.15 : 0) +       // Pure visual = 15%
      (qualityMetrics.isOptimalLength ? 0.15 : 0) +          // Optymalna długość = 15%
      (qualityMetrics.containsBookCover ? 0.10 : 0) +        // Book cover = 10%
      (qualityMetrics.containsTitle ? 0.05 : 0) +            // Title ref = 5%
      (qualityMetrics.containsProfessional ? 0.05 : 0)       // Professional = 5%
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
      format: "square-1024x1024-1:1-no-text",
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
      optimizedFor: `${imageModel}-${finalConfig.style}-cover-design-no-text-1:1`,
      textBanEnforcement: {
        strongTextBan: qualityMetrics.containsStrongTextBan,
        pureVisualComposition: qualityMetrics.containsPureVisual,
        noWrittenElements: true,
        visualOnly: true
      },
      formatEnforcement: {
        squareFormat: qualityMetrics.containsSquareFormat,
        aspectRatio: "1:1",
        dimensions: "1024x1024",
        guaranteedSquare: true
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
    message: 'Adaptive Cover Prompt Generator - Model-Specific Optimization',
    version: "6.0-adaptive-model-optimization",
    supportedImageModels: ['imagen-3', 'imagen-4', 'imagen-4-ultra', 'gemini-image', 'gpt-image-1', 'dall-e-3'],
    adaptiveFeatures: [
      'Model-specific prompt length optimization',
      'Detail level adjustment based on model capabilities',
      'Provider-specific style adaptation',
      'Automatic length scaling for different models',
      'Complex instruction support detection',
      'Raw prompt output without comments'
    ],
    modelConfigurations: {
      'dall-e-3': { maxLength: 400, detailLevel: 'simple' },
      'gemini-image': { maxLength: 4000, detailLevel: 'medium-high' },
      'imagen-3': { maxLength: 4000, detailLevel: 'high' },
      'imagen-4': { maxLength: 4000, detailLevel: 'ultra-high' },
      'imagen-4-ultra': { maxLength: 4000, detailLevel: 'maximum' },
      'gpt-image-1': { maxLength: 4000, detailLevel: 'ultra-high' }
    },
    capabilities: [
      'Automatic model detection from user settings',
      'Length optimization per model limits',
      'Detail scaling based on model sophistication',
      'Clean prompt output without prefixes',
      'User API key integration',
      'Internal request support'
    ]
  }, { status: 405 });
}