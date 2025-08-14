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

// 🎯 ROZSZERZONA KONFIGURACJA DLA WSZYSTKICH PROVIDERÓW - GOOGLE + OPENAI
const PROMPT_CONFIGS = {
  // 🆕 GOOGLE MODELS - AI STUDIO COMPATIBLE
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
  },
  "imagen-4": {
    maxLength: 4000,
    optimalLength: 1500,
    targetLength: 1400,
    style: "premium-photorealistic",
    supportsComplexInstructions: true,
    qualityTarget: "premium_realism",
    provider: "google",
    costEstimate: 0.04,
    enhancement_level: "premium"
  },
  "imagen-4-ultra": {
    maxLength: 4000,
    optimalLength: 2000,
    targetLength: 1800,
    style: "ultra-photorealistic",
    supportsComplexInstructions: true,
    qualityTarget: "maximum_realism",
    provider: "google",
    costEstimate: 0.06,
    enhancement_level: "maximum"
  },
  // OPENAI MODELS - EXISTING
  "gpt-image-1": {
    maxLength: 4000,
    optimalLength: 900,  // 🔥 OPTYMALNE: 800-1000 znaków dla maksymalnego realizmu
    targetLength: 850,   // 🎯 SWEET SPOT dla photorealistic results
    style: "photorealistic-professional",
    supportsComplexInstructions: true,
    qualityTarget: "maximum_realism",
    provider: "openai",
    costEstimate: 0.19,
    enhancement_level: "optimal"
  },
  "dall-e-3": {
    maxLength: 400,
    optimalLength: 350,
    targetLength: 350,
    style: "concise-effective",
    supportsComplexInstructions: false,
    qualityTarget: "natural_style",
    provider: "openai",
    costEstimate: 0.08,
    enhancement_level: "standard"
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
      targetModel = "gpt-image-1",
      forceRegenerate = false,
      enableTransparency = true,
      maximumQuality = true
    } = body;

    // ✅ LOGIKA KLUCZY API
    let anthropicApiKey: string | null = null;
    let keySource: 'user' | 'env' | 'none' = 'none';
    let userAiSettings: any = null;
    let modelToUse: string = 'claude-3-5-haiku-20241022';

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
          ? 'claude-sonnet-4-20250514'
          : 'claude-3-5-haiku-20241022';
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

    // 🔥 BEZPIECZNY DOSTĘP DO KONFIGURACJI Z FALLBACK
    const config = PROMPT_CONFIGS[targetModel as keyof typeof PROMPT_CONFIGS] || {
      maxLength: 4000,
      optimalLength: 1000,
      targetLength: 900,
      style: "universal-fallback",
      supportsComplexInstructions: true,
      qualityTarget: "standard_quality",
      provider: "unknown",
      costEstimate: 0.00,
      enhancement_level: "fallback"
    };

    // Logowanie informacji o konfiguracji
    if (!PROMPT_CONFIGS[targetModel as keyof typeof PROMPT_CONFIGS]) {
      console.warn(`⚠️ Unknown model: ${targetModel}, using fallback config`);
    }

    console.log(`🔥 === PHOTOREALISTIC OPTIMIZATION ANALYSIS ===`);
    console.log(`   - Title: "${title}"`);
    console.log(`   - Chapter: "${chapterTitle}"`);
    console.log(`   - Content length: ${chapterContent?.length || 0} chars`);
    console.log(`   - Target model: ${targetModel} (${config.provider})`);
    console.log(`   - Force regenerate: ${forceRegenerate}`);
    console.log(`   - Enable transparency: ${enableTransparency}`);
    console.log(`   - Maximum quality: ${maximumQuality}`);
    console.log(`   - Optimal prompt length: ${config.optimalLength} chars`);
    console.log(`   - Enhancement level: ${config.enhancement_level}`);
    console.log(`   - Cost estimate: $${config.costEstimate}`);

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

    // 🔥 DYNAMICZNY PROMPT DOSTOSOWANY DO PROVIDERA I MODELU
    let providerSpecificInstructions = "";

    if (config.provider === "google") {
      providerSpecificInstructions = `
OPTYMALIZACJE DLA GOOGLE ${targetModel.toUpperCase()}:
- Wykorzystaj ${config.enhancement_level} level enhancement
- Maksymalna długość: ${config.optimalLength} znaków dla optymalnej jakości
- ${config.supportsComplexInstructions ? 'Używaj szczegółowych instrukcji technicznych' : 'Zachowaj prostotę opisu'}
- Skupienie na ${config.qualityTarget}
- Provider: Google AI Studio compatible`;
    } else if (config.provider === "openai") {
      providerSpecificInstructions = `
OPTYMALIZACJE DLA OPENAI ${targetModel.toUpperCase()}:
- Wykorzystaj ${config.enhancement_level} level enhancement
- Maksymalna długość: ${config.optimalLength} znaków dla photorealistic results
- ${config.supportsComplexInstructions ? 'Dodaj zaawansowane parametry fotograficzne' : 'Używaj zwięzłych opisów'}
- Skupienie na ${config.qualityTarget}
- Provider: OpenAI API compatible`;
    }

    // 🔥 UNIWERSALNY ZOPTYMALIZOWANY PROMPT
    const prompt = `Jesteś ekspertem w tworzeniu PHOTOREALISTIC promptów dla systemów generowania obrazów AI. Twoim zadaniem jest stworzenie PRECYZYJNEGO promptu (${config.optimalLength} znaków) który wygeneruje ULTRA-REALISTYCZNĄ ilustrację ebooka.

DANE EBOOKA:
Tytuł: "${title}"${subtitle ? `\nPodtytuł: "${subtitle}"` : ''}
Rozdział: "${chapterTitle}"${contextInfo}

TREŚĆ ROZDZIAŁU:
${chapterContent}

${providerSpecificInstructions}

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
   - "Square 1:1 composition for ebook"
   ${enableTransparency ? '- "transparent background, clean edges"' : ''}
   - "ABSOLUTELY NO TEXT anywhere in image"

${forceRegenerate ? `
🔄 REGENERATION MODE (Timestamp: ${timestamp}):
- Użyj INNYCH elementów fotograficznych niż wcześniej
- Zmień perspektywę i kompozycję dramatycznie
- Zastosuj INNE oświetlenie i nastrój
- Stwórz KOMPLETNIE RÓŻNĄ interpretację wizualną
` : ''}

📝 WZORZEC IDEALNEGO PROMPTU:

"Professional ebook illustration: [KONKRETNY OPIS GŁÓWNEJ SCENY z treści rozdziału]. Shot with [PARAMETRY APARATU], f/1.8, ISO 100. [KONKRETNE OŚWIETLENIE] with natural shadows and volumetric lighting. Photorealistic, hyperrealistic, 8K UHD resolution, professional photography, ultra-sharp focus${maximumQuality ? ', commercial quality, HDR' : ''}. [KOMPOZYCJA] with shallow depth of field. Square 1:1 composition for ebook${enableTransparency ? ', transparent background with clean edges' : ''}. Perfect visual representation of "${chapterTitle}" chapter. ABSOLUTELY NO TEXT anywhere in image."

KRYTYCZNE INSTRUKCJE:
- Prompt MUSI mieć ${config.optimalLength} znaków (OPTIMAL dla ${config.provider} ${targetModel})
- ZAWSZE dodaj parametry aparatu i oświetlenie
- ZAWSZE użyj "photorealistic, hyperrealistic, 8K UHD"
- ZAWSZE dodaj "ABSOLUTELY NO TEXT anywhere"
- Bazuj BEZPOŚREDNIO na treści rozdziału
- ${forceRegenerate ? 'STWÓRZ KOMPLETNIE INNĄ wizualną interpretację' : ''}
- ŻADNYCH komentarzy - tylko czysty prompt

NAPISZ PHOTOREALISTIC PROMPT (${config.optimalLength} znaków):`;

    // Temperatura dla regeneracji
    const temperature = forceRegenerate ? 0.5 : 0.2;

    const requestBody: AnthropicRequest = {
      model: modelToUse,
      max_tokens: 600,  // Krótsze dla precyzji
      temperature: temperature,
      messages: [{ role: 'user', content: prompt }]
    };

    console.log(`📸 === SENDING PHOTOREALISTIC REQUEST ===`);
    console.log(`   - Provider: ${config.provider}`);
    console.log(`   - Model: ${targetModel}`);
    console.log(`   - Temperature: ${temperature}`);
    console.log(`   - Target length: ${config.optimalLength} chars`);
    console.log(`   - Photo elements: ${JSON.stringify(photoElements, null, 2)}`);

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
      return NextResponse.json({ error: `Błąd podczas generowania promptu: ${errorText}` }, { status: response.status });
    }

    const responseData = await response.json();
    let imagePrompt = responseData.content[0].text.trim();

    // 🔥 NOWA WALIDACJA PHOTOREALISTIC ELEMENTS
    const photorealisticElements = {
      // KRYTYCZNE ELEMENTY REALIZMU
      'camera_params': /(?:Canon|Sony|Nikon|DSLR).+?(?:mm|f\/)/i.test(imagePrompt),
      'aperture': /f\/[0-9.]+/i.test(imagePrompt),
      'photorealistic': /(?:photorealistic|hyperrealistic|ultra-realistic)/i.test(imagePrompt),
      'resolution': /(?:8K|UHD|4K|high.resolution)/i.test(imagePrompt),
      'professional': /professional/i.test(imagePrompt),
      'lighting_specific': /(?:golden hour|studio|natural|soft|dramatic|cinematic|volumetric)/i.test(imagePrompt),
      'depth_of_field': /(?:shallow depth|bokeh|depth of field)/i.test(imagePrompt),
      'sharp_focus': /(?:sharp focus|ultra.sharp|crisp)/i.test(imagePrompt),

      // WYMAGANIA TECHNICZNE
      'no_text': /(?:no text|absolutely no text)/i.test(imagePrompt),
      'square_format': /(?:1:1|square)/i.test(imagePrompt),
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

      // Dodaj krytyczne elementy
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

      // Dodaj ważne opcjonalne
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

      // Sprawdź limit długości i skróć jeśli potrzeba
      if (correctedPrompt.length > config.maxLength) {
        const excess = correctedPrompt.length - config.maxLength;
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

    // 📊 METRYKI JAKOŚCI PHOTOREALISTIC - BEZPIECZNE
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
      (photorealisticElements['square_format'] ? 0.25 : 0) +
      (photorealisticElements['ebook'] ? 0.25 : 0) +
      (photorealisticElements['transparent_bg'] ? 0.25 : 0) +
      (photorealisticElements['chapter_ref'] ? 0.25 : 0)
    );

    const overallQuality = (realismScore * 0.7) + (technicalScore * 0.3);
    const isOptimalLength = imagePrompt.length >= (config.optimalLength - 100) &&
                           imagePrompt.length <= (config.optimalLength + 100);

    console.log(`📊 === PHOTOREALISTIC QUALITY METRICS ===`);
    console.log(`   Target Model: ${targetModel} (${config.provider || 'unknown'})`);
    console.log(`   Length: ${imagePrompt.length}/${config.maxLength} chars`);
    console.log(`   Optimal Length: ${isOptimalLength ? '✅ PERFECT' : '⚠️'} (target: ${config.optimalLength}±100)`);
    console.log(`   Realism Score: ${(realismScore * 100).toFixed(1)}% (Critical elements)`);
    console.log(`   Technical Score: ${(technicalScore * 100).toFixed(1)}% (Ebook requirements)`);
    console.log(`   Overall Quality: ${(overallQuality * 100).toFixed(1)}%`);
    console.log(`   Enhancement Level: ${config.enhancement_level}`);
    console.log(`   Cost Estimate: $${config.costEstimate}`);

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

    const qualityThreshold = 0.85; // 85% dla photorealistic
    if (overallQuality < qualityThreshold) {
      console.warn(`⚠️ QUALITY WARNING! Score: ${(overallQuality * 100).toFixed(1)}% (target: 85%+)`);
    } else {
      console.log(`✅ EXCELLENT PHOTOREALISTIC PROMPT! Ready for ${config.provider} ${targetModel} generation`);
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

      // 🔥 BEZPIECZNE INFORMACJE O KONFIGURACJI
      modelConfig: {
        provider: config.provider || 'unknown',
        maxLength: config.maxLength,
        optimalLength: config.optimalLength,
        style: config.style,
        enhancementLevel: config.enhancement_level,
        costEstimate: config.costEstimate,
        supportsComplexInstructions: config.supportsComplexInstructions
      },

      qualityValidation: {
        criticalElementsMissing: missingCritical,
        optionalElementsMissing: missingOptional,
        autoCorrectionsApplied: missingCritical.length > 0 || missingOptional.length > 2,
        readyForGeneration: overallQuality >= qualityThreshold,
        qualityThreshold: qualityThreshold,
        modelSupported: !!PROMPT_CONFIGS[targetModel as keyof typeof PROMPT_CONFIGS]
      },

      optimizationNote: isOptimalLength ?
        `✅ Prompt length OPTIMAL for ${config.provider} ${targetModel} generation` :
        `⚠️ Prompt length outside optimal range for ${targetModel} (target: ${config.optimalLength}±100 chars)`,

      // 🆕 INFORMACJE O PROVIDERZE
      providerInfo: {
        selected: config.provider || 'unknown',
        enhancementLevel: config.enhancement_level,
        costPerGeneration: `$${config.costEstimate}`,
        supportsTransparency: enableTransparency,
        complexInstructionsSupport: config.supportsComplexInstructions,
        qualityTarget: config.qualityTarget
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
    message: 'Multi-Provider Photorealistic Prompt Generator for Professional Ebook Illustrations',
    version: "7.1-imagen3-optimized",
    supportedProviders: {
      google: ['imagen-3', 'imagen-4', 'imagen-4-ultra'],
      openai: ['gpt-image-1', 'dall-e-3']
    },
    supportedModels: ['imagen-3', 'imagen-4', 'imagen-4-ultra', 'gpt-image-1', 'dall-e-3'],
    defaultProvider: 'google',
    defaultModel: 'imagen-3',
    costComparison: {
      'imagen-3': '$0.03 (Standard Plus)',
      'imagen-4': '$0.04 (Premium)',
      'imagen-4-ultra': '$0.06 (Maximum)',
      'dall-e-3': '$0.08 (OpenAI Standard)',
      'gpt-image-1': '$0.19 (OpenAI Premium)'
    },
    optimalPromptLengths: {
      'imagen-3': 1200,
      'imagen-4': 1500,
      'imagen-4-ultra': 2000,
      'gpt-image-1': 900,
      'dall-e-3': 350
    },
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
        'Square 1:1 format for ebook readers',
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
    bestPractices: {
      promptStructure: 'Direct scene description + Camera params + Lighting + Quality terms + Composition + Technical requirements',
      realismApproach: 'Professional photography simulation with specific equipment and techniques',
      providerOptimization: 'Dynamic prompt adaptation based on target provider capabilities',
      diversityGeneration: 'Randomized professional photography elements for unique results'
    }
  }, { status: 405 });
}