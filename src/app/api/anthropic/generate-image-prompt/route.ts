// src/app/api/anthropic/generate-image-prompt/route.ts
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

// 🎯 PROMPT CONFIGURATION FOR IMAGEN-3
const PROMPT_CONFIGS = {
  "imagen-3": {
    maxLength: 4000,
    optimalLength: 1200,
    targetLength: 1100,
    style: "photorealistic-standard",
    supportsComplexInstructions: true,
    qualityTarget: "high_realism",
    provider: "google",
    costEstimate: 0.03,
    enhancement_level: "standard_plus"
  }
};

// ✅ Generator elementów fotograficznych dla realizmu
const generatePhotographicElements = () => {
  const cameras = [
    "Canon EOS R5, 85mm f/1.8 lens",
    "Sony A7R IV, 50mm f/1.4 lens",
    "Nikon D850, 70-200mm f/2.8 lens",
    "Canon EOS 5D Mark IV, 85mm f/1.4 lens",
    "Sony A7III, 35mm f/1.8 lens",
    "Canon R6, 24-70mm f/2.8 lens"
  ];

  const lighting = [
    "soft golden hour lighting with warm atmospheric glow",
    "professional studio lighting with softbox setup",
    "natural window lighting with gentle highlights",
    "dramatic chiaroscuro lighting with deep shadows",
    "diffused overcast lighting with even illumination",
    "cinematic three-point lighting with rim effects"
  ];

  const qualityTerms = [
    "photorealistic, hyperrealistic, 8K UHD resolution",
    "professional photography, ultra-sharp focus, HDR",
    "commercial photography quality, detailed textures",
    "magazine-quality photography, crisp details",
    "high-end editorial photography, premium finish",
    "studio photography quality, perfect clarity"
  ];

  const compositions = [
    "rule of thirds composition, shallow depth of field",
    "centered composition with balanced framing",
    "dynamic diagonal composition with leading lines",
    "portrait orientation with professional framing",
    "artistic composition with negative space",
    "symmetrical composition with perfect balance"
  ];

  return {
    camera: cameras[Math.floor(Math.random() * cameras.length)],
    lighting: lighting[Math.floor(Math.random() * lighting.length)],
    quality: qualityTerms[Math.floor(Math.random() * qualityTerms.length)],
    composition: compositions[Math.floor(Math.random() * compositions.length)]
  };
};

export async function POST(request: Request) {
  const isInternalRequest = request.headers.get('x-internal-request') === 'true';

  if (!isInternalRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
  }

  console.log('📸 === MULTI-PROVIDER PHOTOREALISTIC PROMPT GENERATOR ===');

  try {
    const body = await request.json();
    const {
      title,
      subtitle,
      chapterTitle,
      chapterContent,
      allChapters,
      targetModel = "imagen-3",
      forceRegenerate = false,
      enableTransparency = true,
      maximumQuality = true
    } = body;

    // ✅ LOGIKA KLUCZY API
    const BASIC_AI_MODEL = process.env.BASIC_AI_MODEL || 'claude-haiku-4-5';
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-5';

    let anthropicApiKey: string | null = null;
    let keySource: 'user' | 'env' | 'none' = 'none';
    let userAiSettings: any = null;
    let modelToUse: string = BASIC_AI_MODEL;

    if (!isInternalRequest) {
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;

      if (userId) {
        const { apiKey, source } = await getApiKeyForEndpoint(
          userId,
          'anthropic',
          'ANTHROPIC_API_KEY'
        );
        anthropicApiKey = apiKey;
        keySource = source;

        userAiSettings = await getUserAiSettings(userId);
        modelToUse = userAiSettings.textAiModel === 'claude-3-sonnet'
          ? PREMIUM_AI_MODEL
          : BASIC_AI_MODEL;
      }
    } else {
      anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? null;
      keySource = anthropicApiKey ? 'env' : 'none';
    }

    if (!anthropicApiKey) {
      console.error('❌ Brak dostępnego klucza Anthropic API');
      return NextResponse.json(
        { error: 'Błąd konfiguracji - brak klucza API Anthropic' },
        { status: 500 }
      );
    }

    // 🔥 KONFIGURACJA DLA IMAGEN-3
    const config = PROMPT_CONFIGS[targetModel as keyof typeof PROMPT_CONFIGS];

    if (!config) {
      console.warn(`⚠️ Unknown model: ${targetModel}, using Imagen-3 config`);
    }

    const finalConfig = config || PROMPT_CONFIGS["imagen-3"];

    console.log(`🔥 === PHOTOREALISTIC OPTIMIZATION ANALYSIS ===`);
    console.log(`   - Title: "${title}"`);
    console.log(`   - Chapter: "${chapterTitle}"`);
    console.log(`   - Content length: ${chapterContent?.length || 0} chars`);
    console.log(`   - Target model: ${targetModel} (${finalConfig.provider})`);
    console.log(`   - Force regenerate: ${forceRegenerate}`);
    console.log(`   - Enable transparency: ${enableTransparency}`);
    console.log(`   - Maximum quality: ${maximumQuality}`);
    console.log(`   - Optimal prompt length: ${finalConfig.optimalLength} chars`);
    console.log(`   - Enhancement level: ${finalConfig.enhancement_level}`);
    console.log(`   - Cost estimate: $${finalConfig.costEstimate}`);

    if (!title || !chapterTitle || !chapterContent) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe. Wymagany tytuł e-booka, tytuł rozdziału i treść.' },
        { status: 400 }
      );
    }

    // Generator elementów fotograficznych dla różnorodności
    const photoElements = generatePhotographicElements();
    const timestamp = new Date().toISOString();

    // Przygotowanie kontekstu
    let contextInfo = "";
    if (allChapters && Array.isArray(allChapters) && allChapters.length > 0) {
      const otherChapters = allChapters
        .filter(ch => ch.title !== chapterTitle)
        .map(ch => ch.title)
        .slice(0, 3);

      if (otherChapters.length > 0) {
        contextInfo = `\n\nKONTEKST EBOOKA - inne rozdziały: ${otherChapters.join(', ')}`;
      }
    }

    // 🔥 PROMPT DLA IMAGEN-3
    const prompt = `Jesteś ekspertem w tworzeniu PHOTOREALISTIC promptów dla systemów generowania obrazów AI. Twoim zadaniem jest stworzenie PRECYZYJNEGO promptu (${finalConfig.optimalLength} znaków) który wygeneruje ULTRA-REALISTYCZNĄ ilustrację ebooka.

DANE EBOOKA:
Tytuł: "${title}"${subtitle ? `\nPodtytuł: "${subtitle}"` : ''}
Rozdział: "${chapterTitle}"${contextInfo}

TREŚĆ ROZDZIAŁU:
${chapterContent}

OPTYMALIZACJE DLA GOOGLE IMAGEN-3:
- Wykorzystaj ${finalConfig.enhancement_level} level enhancement
- Maksymalna długość: ${finalConfig.optimalLength} znaków dla optymalnej jakości
- Używaj szczegółowych instrukcji technicznych
- Skupienie na ${finalConfig.qualityTarget}
- Provider: Google AI Studio compatible

🎯 KLUCZOWE WYMAGANIA PHOTOREALISTIC PROMPTU:

1. **PODSTAWOWA STRUKTURA (200-250 znaków):**
   - Rozpocznij od "Professional ebook illustration:"
   - Opisz GŁÓWNĄ SCENĘ w 1-2 konkretnych zdaniach
   - Bazuj BEZPOŚREDNIO na treści rozdziału "${chapterTitle}"

2. **PARAMETRY APARATU (150-200 znaków) - OBOWIĄZKOWE:**
   ${forceRegenerate ? `- Użyj: "${photoElements.camera}"` : '- Dodaj parametry aparatu: Canon/Sony/Nikon + obiektyw + przysłona'}
   - Zawsze dodaj "f/1.4-2.8, ISO 100-400"
   - To jest KLUCZOWE dla realizmu

3. **OŚWIETLENIE (100-150 znaków) - OBOWIĄZKOWE:**
   ${forceRegenerate ? `- Użyj: "${photoElements.lighting}"` : '- Określ konkretne oświetlenie: golden hour/studio/natural window'}
   - Dodaj "volumetric lighting" lub "natural shadows"

4. **JAKOŚĆ I STYL (150-200 znaków) - OBOWIĄZKOWE:**
   ${forceRegenerate ? `- Użyj: "${photoElements.quality}"` : '- Zawsze dodaj: "photorealistic, hyperrealistic, 8K UHD"'}
   - Dodaj "professional photography, ultra-sharp focus"
   - ${maximumQuality ? 'Dodaj "commercial photography quality, HDR"' : ''}

5. **KOMPOZYCJA (100-150 znaków):**
   ${forceRegenerate ? `- Użyj: "${photoElements.composition}"` : '- Dodaj kompozycję: "rule of thirds" lub "centered composition"'}
   - Zawsze dodaj "shallow depth of field" dla realizmu

6. **WYMAGANIA TECHNICZNE (100-150 znaków):**
   - "ABSOLUTELY NO TEXT anywhere in image"
   ${enableTransparency ? '- "transparent background, clean edges"' : ''}
   - "DO NOT include images of children, infants, or minors. Focus on symbolic or adult representations ONLY."

${forceRegenerate ? `
🔄 REGENERATION MODE (Timestamp: ${timestamp}):
- Użyj INNYCH elementów fotograficznych niż wcześniej
- Zmień perspektywę i kompozycję dramatycznie
- Zastosuj INNE oświetlenie i nastrój
- Stwórz KOMPLETNIE RÓŻNĄ interpretację wizualną
` : ''}

📝 WZORZEC IDEALNEGO PROMPTU:
"Professional ebook illustration: [KONKRETNY OPIS GŁÓWNEJ SCENY z treści rozdziału]. Shot with [PARAMETRY APARATU], f/1.8, ISO 100. [KONKRETNE OŚWIETLENIE] with natural shadows and volumetric lighting. Photorealistic, hyperrealistic, 8K UHD resolution, professional photography, ultra-sharp focus${maximumQuality ? ', commercial quality, HDR' : ''}. [KOMPOZYCJA] with shallow depth of field. Perfect visual representation of "${chapterTitle}" chapter. ABSOLUTELY NO TEXT anywhere in image. Image must not contain children or minors."

KRYTYCZNE INSTRUKCJE:
- Prompt MUSI mieć ${finalConfig.optimalLength} znaków (OPTIMAL dla ${finalConfig.provider} imagen-3)
- ZAWSZE dodaj parametry aparatu i oświetlenie
- ZAWSZE użyj "photorealistic, hyperrealistic, 8K UHD"
- ZAWSZE dodaj "ABSOLUTELY NO TEXT anywhere"
- ZAWSZE przestrzegaj zakazu generowania obrazów dzieci: "DO NOT include images of children or minors"
- Bazuj BEZPOŚREDNIO na treści rozdziału
- ${forceRegenerate ? 'STWÓRZ KOMPLETNIE INNĄ wizualną interpretację' : ''}
- ŻADNYCH komentarzy - tylko czysty prompt

NAPISZ PHOTOREALISTIC PROMPT (${finalConfig.optimalLength} znaków):`;

    // Temperatura dla regeneracji
    const temperature = forceRegenerate ? 0.5 : 0.2;

    const requestBody: AnthropicRequest = {
      model: modelToUse,
      max_tokens: 600,
      temperature: temperature,
      messages: [{ role: 'user', content: prompt }]
    };

    console.log(`📸 === SENDING PHOTOREALISTIC REQUEST ===`);
    console.log(`   - Provider: ${finalConfig.provider}`);
    console.log(`   - Model: ${targetModel}`);
    console.log(`   - Temperature: ${temperature}`);
    console.log(`   - Target length: ${finalConfig.optimalLength} chars`);
    console.log(`   - Photo elements: ${JSON.stringify(photoElements, null, 2)}`);

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
      return NextResponse.json({ error: `Błąd podczas generowania promptu: ${errorText}` }, { status: response.status });
    }

    const responseData = await response.json();
    let imagePrompt = responseData.content[0].text.trim();

    // 🔥 WALIDACJA PHOTOREALISTIC ELEMENTS
    const photorealisticElements = {
      'camera_params': /(?:Canon|Sony|Nikon|DSLR).+?(?:mm|f\/)/i.test(imagePrompt),
      'aperture': /f\/[0-9.]+/i.test(imagePrompt),
      'photorealistic': /(?:photorealistic|hyperrealistic|ultra-realistic)/i.test(imagePrompt),
      'resolution': /(?:8K|UHD|4K|high.resolution)/i.test(imagePrompt),
      'professional': /professional/i.test(imagePrompt),
      'lighting_specific': /(?:golden hour|studio|natural|soft|dramatic|cinematic|volumetric)/i.test(imagePrompt),
      'depth_of_field': /(?:shallow depth|bokeh|depth of field)/i.test(imagePrompt),
      'sharp_focus': /(?:sharp focus|ultra.sharp|crisp)/i.test(imagePrompt),
      'no_text': /(?:no text|absolutely no text)/i.test(imagePrompt),
      'ebook': /ebook/i.test(imagePrompt),
      'transparent_bg': enableTransparency ? /transparent/i.test(imagePrompt) : true,
      'chapter_ref': imagePrompt.toLowerCase().includes(chapterTitle.toLowerCase().substring(0, 10))
    };

    const missingCritical = Object.entries(photorealisticElements)
      .filter(([key, present]) => !present && ['camera_params', 'photorealistic', 'no_text'].includes(key))
      .map(([key]) => key);

    const missingOptional = Object.entries(photorealisticElements)
      .filter(([key, present]) => !present && !['camera_params', 'photorealistic', 'no_text'].includes(key))
      .map(([key]) => key);

    // AUTO-KOREKTA KRYTYCZNYCH ELEMENTÓW
    if (missingCritical.length > 0 || missingOptional.length > 2) {
      console.warn(`🔧 FIXING photorealistic elements - Critical: ${missingCritical.join(', ')}, Optional: ${missingOptional.join(', ')}`);

      let correctedPrompt = imagePrompt;

      if (!photorealisticElements['camera_params']) {
        correctedPrompt += ` Shot with ${photoElements.camera}, f/1.8, ISO 100.`;
        console.log(`🔧 Added CAMERA PARAMETERS`);
      }

      if (!photorealisticElements['photorealistic']) {
        correctedPrompt += ` Photorealistic, hyperrealistic, 8K UHD resolution.`;
        console.log(`🔧 Added PHOTOREALISTIC terms`);
      }

      if (!photorealisticElements['no_text']) {
        correctedPrompt += ` ABSOLUTELY NO TEXT anywhere in image.`;
        console.log(`🔧 Added NO TEXT clause`);
      }

      if (!photorealisticElements['lighting_specific']) {
        correctedPrompt += ` ${photoElements.lighting}.`;
        console.log(`🔧 Added LIGHTING`);
      }

      if (!photorealisticElements['depth_of_field']) {
        correctedPrompt += ` Shallow depth of field with bokeh effect.`;
        console.log(`🔧 Added DEPTH OF FIELD`);
      }

      if (enableTransparency && !photorealisticElements['transparent_bg']) {
        correctedPrompt += ` Transparent background with clean edges.`;
        console.log(`🔧 Added TRANSPARENT BACKGROUND`);
      }

      if (correctedPrompt.length > finalConfig.maxLength) {
        const excess = correctedPrompt.length - finalConfig.maxLength;
        const originalTrimmed = imagePrompt.substring(0, imagePrompt.length - excess - 100);

        correctedPrompt = originalTrimmed;
        if (!photorealisticElements['camera_params']) correctedPrompt += ` ${photoElements.camera.split(',')[0]}.`;
        if (!photorealisticElements['photorealistic']) correctedPrompt += ` Photorealistic, 8K UHD.`;
        if (!photorealisticElements['no_text']) correctedPrompt += ` NO TEXT.`;
        if (!photorealisticElements['lighting_specific']) correctedPrompt += ` ${photoElements.lighting.split(',')[0]}.`;
        if (enableTransparency && !photorealisticElements['transparent_bg']) correctedPrompt += ` Transparent background.`;

        console.log(`🔧 Trimmed and corrected to fit limit`);
      }

      imagePrompt = correctedPrompt;
    }

    // 📊 METRYKI JAKOŚCI PHOTOREALISTIC
    const realismScore = (
      (photorealisticElements['camera_params'] ? 0.20 : 0) +
      (photorealisticElements['photorealistic'] ? 0.20 : 0) +
      (photorealisticElements['lighting_specific'] ? 0.15 : 0) +
      (photorealisticElements['depth_of_field'] ? 0.10 : 0) +
      (photorealisticElements['sharp_focus'] ? 0.10 : 0) +
      (photorealisticElements['resolution'] ? 0.10 : 0) +
      (photorealisticElements['professional'] ? 0.05 : 0) +
      (photorealisticElements['no_text'] ? 0.10 : 0)
    );

    const technicalScore = (
      (photorealisticElements['ebook'] ? 0.33 : 0) +
      (photorealisticElements['transparent_bg'] ? 0.33 : 0) +
      (photorealisticElements['chapter_ref'] ? 0.34 : 0)
    );

    const overallQuality = (realismScore * 0.7) + (technicalScore * 0.3);
    const isOptimalLength = imagePrompt.length >= (finalConfig.optimalLength - 100) &&
                           imagePrompt.length <= (finalConfig.optimalLength + 100);

    console.log(`📊 === PHOTOREALISTIC QUALITY METRICS ===`);
    console.log(`   Target Model: ${targetModel} (${finalConfig.provider})`);
    console.log(`   Length: ${imagePrompt.length}/${finalConfig.maxLength} chars`);
    console.log(`   Optimal Length: ${isOptimalLength ? '✅ PERFECT' : '⚠️'} (target: ${finalConfig.optimalLength}±100)`);
    console.log(`   Realism Score: ${(realismScore * 100).toFixed(1)}% (Critical elements)`);
    console.log(`   Technical Score: ${(technicalScore * 100).toFixed(1)}% (Ebook requirements)`);
    console.log(`   Overall Quality: ${(overallQuality * 100).toFixed(1)}%`);
    console.log(`   Enhancement Level: ${finalConfig.enhancement_level}`);
    console.log(`   Cost Estimate: $${finalConfig.costEstimate}`);

    console.log(`   === PHOTOREALISTIC ELEMENTS ===`);
    console.log(`   📷 Camera Parameters: ${photorealisticElements['camera_params'] ? '✅' : '❌ CRITICAL!'}`);
    console.log(`   📸 Aperture Info: ${photorealisticElements['aperture'] ? '✅' : '❌'}`);
    console.log(`   📸 Photorealistic Terms: ${photorealisticElements['photorealistic'] ? '✅' : '❌ CRITICAL!'}`);
    console.log(`   📐 High Resolution: ${photorealisticElements['resolution'] ? '✅' : '❌'}`);
    console.log(`   💡 Specific Lighting: ${photorealisticElements['lighting_specific'] ? '✅' : '❌'}`);
    console.log(`   🎭 Depth of Field: ${photorealisticElements['depth_of_field'] ? '✅' : '❌'}`);
    console.log(`   ⚡ Sharp Focus: ${photorealisticElements['sharp_focus'] ? '✅' : '❌'}`);
    console.log(`   🚫 No Text Clause: ${photorealisticElements['no_text'] ? '✅' : '❌ CRITICAL!'}`);

    if (forceRegenerate) {
      console.log(`🔄 === DIVERSITY ELEMENTS ===`);
      console.log(`   - Camera: ${photoElements.camera}`);
      console.log(`   - Lighting: ${photoElements.lighting}`);
      console.log(`   - Quality: ${photoElements.quality}`);
      console.log(`   - Composition: ${photoElements.composition}`);
    }

    const qualityThreshold = 0.85;
    if (overallQuality < qualityThreshold) {
      console.warn(`⚠️ QUALITY WARNING! Score: ${(overallQuality * 100).toFixed(1)}% (target: 85%+)`);
    } else {
      console.log(`✅ EXCELLENT PHOTOREALISTIC PROMPT! Ready for ${finalConfig.provider} ${targetModel} generation`);
    }

    console.log(`📝 Preview: ${imagePrompt.substring(0, 150)}...`);

    return NextResponse.json({
      success: true,
      imagePrompt: imagePrompt,
      promptLength: imagePrompt.length,
      targetModel: targetModel,
      realismScore: realismScore,
      technicalScore: technicalScore,
      overallQuality: overallQuality,
      photorealisticElements: photorealisticElements,
      isOptimalLength: isOptimalLength,
      optimizedFor: `${targetModel}-photorealistic-ebook${maximumQuality ? '-ultra-quality' : ''}${enableTransparency ? '-transparent' : ''}`,
      photoElements: forceRegenerate ? photoElements : null,
      diversityApplied: forceRegenerate,
      transparencyApplied: enableTransparency,
      maximumQualityApplied: maximumQuality,
      modelUsed: modelToUse,
      keySource: keySource,
      modelConfig: {
        provider: finalConfig.provider,
        maxLength: finalConfig.maxLength,
        optimalLength: finalConfig.optimalLength,
        style: finalConfig.style,
        enhancementLevel: finalConfig.enhancement_level,
        costEstimate: finalConfig.costEstimate,
        supportsComplexInstructions: finalConfig.supportsComplexInstructions
      },
      qualityValidation: {
        criticalElementsMissing: missingCritical,
        optionalElementsMissing: missingOptional,
        autoCorrectionsApplied: missingCritical.length > 0 || missingOptional.length > 2,
        readyForGeneration: overallQuality >= qualityThreshold,
        qualityThreshold: qualityThreshold
      },
      optimizationNote: isOptimalLength ?
        `✅ Prompt length OPTIMAL for ${finalConfig.provider} ${targetModel} generation` :
        `⚠️ Prompt length outside optimal range for ${targetModel} (target: ${finalConfig.optimalLength}±100 chars)`,
      providerInfo: {
        selected: finalConfig.provider,
        enhancementLevel: finalConfig.enhancement_level,
        costPerGeneration: `$${finalConfig.costEstimate}`,
        supportsTransparency: enableTransparency,
        complexInstructionsSupport: finalConfig.supportsComplexInstructions,
        qualityTarget: finalConfig.qualityTarget
      }
    });

  } catch (error) {
    console.error('❌ Błąd generowania photorealistic promptu:', error);
    return NextResponse.json({
      error: 'Błąd wewnętrzny serwera',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Photorealistic Prompt Generator for Professional Ebook Illustrations - Imagen-3 Optimized',
    version: "8.0-imagen3-only-with-retry",
    supportedModels: ['imagen-3'],
    defaultModel: 'imagen-3',
    provider: 'google',
    costPerGeneration: '$0.03',
    optimalPromptLength: 1200,
    focusAreas: {
      photorealisticElements: [
        'Camera parameters (Canon/Sony/Nikon + lens + aperture) - 20% weight',
        'Photorealistic terminology (photorealistic, hyperrealistic, 8K UHD) - 20% weight',
        'Specific lighting conditions (golden hour, studio, natural) - 15% weight',
        'Depth of field specifications (shallow DOF, bokeh) - 10% weight',
        'Sharp focus requirements (ultra-sharp, crisp) - 10% weight',
        'High resolution specs (8K, UHD, 4K) - 10% weight',
        'Professional photography terms - 5% weight',
        'No text enforcement - 10% weight'
      ],
      technicalRequirements: [
        'Transparent background support (when enabled)',
        'Chapter content relevance',
        'Professional ebook illustration standards'
      ]
    },
    qualityThresholds: {
      excellent: '85%+ (Ready for photorealistic generation)',
      good: '70-84% (Acceptable with minor issues)',
      poor: '<70% (Requires manual review)'
    },
    autoCorrection: {
      criticalElements: ['camera_params', 'photorealistic', 'no_text'],
      optionalThreshold: 2,
      smartTrimming: 'Preserves essential photorealistic elements'
    },
    retryLogic: {
      maxAttempts: 3,
      timeoutPerAttempt: '30s',
      exponentialBackoff: true
    }
  }, { status: 405 });
}