// src/app/api/ebooks/[ebookId]/chapters/[chapterId]/generate-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getApiKeyForEndpoint, getUserAiSettings } from '@/lib/user-api-keys';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

// Helper function to safely log API keys
function getMaskedApiKey(apiKey: string | null): string {
  if (!apiKey) {
    return "KLUCZ NIEOBECNY (null)";
  }
  if (apiKey.length < 8) {
    return "KLUCZ ZBYT KRÓTKI (prawdopodobnie nieprawidłowy)";
  }
  return `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
}

// 🆕 MULTI-PROVIDER MODEL CONFIGURATION - GOOGLE DEFAULT, OPENAI ALTERNATIVE
const MODEL_CONFIGS = {
  // 🆕 GOOGLE MODELS - POPRAWIONE KONFIGURACJE
  "imagen-3": {
    provider: "google",
    maxPromptLength: 4000,
    optimalLength: 1500,
    quality: "high" as const,
    costEstimate: 0.03,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "standard",
    supports_transparency: false,
    supports_text_rendering: true,
    always_returns_base64: true,
    requires_user_key: true,
    api_model: "imagen-3.0-generate-002", // ✅ POPRAWNE ID
    api_method: "generateImages" // ✅ METODA DLA IMAGEN
  ,
    max_images: 4
  },
  "imagen-4": {
    provider: "google",
    maxPromptLength: 4000,
    optimalLength: 1500,
    quality: "high" as const,
    costEstimate: 0.04,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "premium",
    supports_transparency: false,
    supports_text_rendering: true,
    always_returns_base64: true,
    requires_user_key: true,
    api_model: "imagen-4.0-generate-preview-06-06", // ✅ POPRAWNE ID
    api_method: "generateImages" // ✅ METODA DLA IMAGEN
  ,
    max_images: 4
  },
  "imagen-4-ultra": {
    provider: "google",
    maxPromptLength: 4000,
    optimalLength: 2000,
    quality: "ultra" as const,
    costEstimate: 0.06,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "maximum",
    supports_transparency: false,
    supports_text_rendering: true,
    prompt_adherence: "excellent",
    always_returns_base64: true,
    requires_user_key: true,
    api_model: "imagen-4.0-ultra-generate-preview-06-06", // ✅ POPRAWNE ID (może wymagać aktualizacji)
    api_method: "generateImages", // ✅ METODA DLA IMAGEN
    max_images: 1 // Ultra może generować tylko 1 obraz na raz
  },
  "gemini-image": {
    provider: "google",
    maxPromptLength: 4000,
    optimalLength: 1500,
    quality: "high" as const,
    costEstimate: 0.002, // Tańszy niż Imagen
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "standard",
    supports_transparency: false,
    supports_text_rendering: true,
    supports_conversational_edit: true, // Unikalna funkcja Gemini
    always_returns_base64: true,
    requires_user_key: true,
    api_model: "gemini-2.0-flash-preview-image-generation", // ✅ POPRAWNE ID
    api_method: "generateContent", // ✅ METODA DLA GEMINI
    requires_text_and_image: true // Gemini wymaga obu modalności
  },
  // OPENAI MODELS - BEZ ZMIAN
  "gpt-image-1": {
    provider: "openai",
    maxPromptLength: 4000,
    optimalLength: 1200,
    quality: "high" as const,
    output_format: "png" as const,
    background: "transparent" as const,
    moderation: "auto" as const,
    costEstimate: 0.19,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "optimal",
    detail_focus: "focused",
    render_quality: "professional",
    supports_transparency: true,
    supports_text_rendering: true,
    always_returns_base64: true,
    requires_user_key: true
  },
  "dall-e-3": {
    provider: "openai",
    maxPromptLength: 400,
    quality: "hd" as const,
    style: "natural" as const,
    costEstimate: 0.08,
    sizes: ['1024x1024', '1792x1024', '1024x1792'],
    supports_transparency: false,
    always_returns_base64: false,
    requires_user_key: false
  }
} as const;

// Sprawdzenie konfiguracji na starcie
console.log('🚀 === MULTI-PROVIDER CHAPTER GENERATOR ===');
console.log(`   - Google Models: Imagen 3 ($0.03), Imagen 4 ($0.04), Imagen 4 Ultra ($0.06), Gemini 2.0 Flash ($0.002)`);
console.log(`   - OpenAI Models: DALL-E 3 ($0.08), GPT-Image-1 ($0.19)`);
console.log(`   - Total Models: 6 available (4 Google, 2 OpenAI)`);
console.log(`   - API Compatibility: Google AI Studio keys (AIza...) supported`);
console.log('🚀 === MULTI-PROVIDER GENERATOR READY ===');

function logApiKey(apiKey: string | undefined): string {
  if (!apiKey) return 'MISSING';
  if (apiKey.length < 8) return 'INVALID';
  return `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
}

// ✅ POPRAWIONA FUNKCJA selectOptimalModel
const selectOptimalModel = async (userId: string | null): Promise<{
  model: string;
  provider: string;
  apiKey: string | null;
  keySource: 'user' | 'env' | 'none';
  reasoning: string;
}> => {
  console.log('🧠 === MULTI-PROVIDER MODEL SELECTION ===');

  if (!userId) {
    console.log('   - User: Not logged in, cannot select a model requiring a key.');
    return {
      model: 'imagen-3', // Domyślny model Google
      provider: 'google',
      apiKey: null,
      keySource: 'none',
      reasoning: 'No user logged in - API key cannot be fetched.'
    };
  }

  // Pobierz ustawienia AI użytkownika
  const userAiSettings = await getUserAiSettings(userId);
  const preferredProvider = userAiSettings.imageAiProvider;
  const preferredModel = userAiSettings.imageAiModel;

  console.log(`   - User Settings: ${preferredProvider}/${preferredModel}`);

  const modelConfig = MODEL_CONFIGS[preferredModel as keyof typeof MODEL_CONFIGS];

  if (!modelConfig) {
    console.log('   - Invalid model in settings, attempting fallback.');
    return {
      model: 'imagen-3',
      provider: 'google',
      apiKey: null,
      keySource: 'none',
      reasoning: 'Invalid model in user settings - API key cannot be fetched.'
    };
  }

  // Dla wszystkich modeli sprawdź dostępność kluczy
  const providerForKey = modelConfig.provider === 'google' ? 'google' : 'openai';
  const envKeyName = modelConfig.provider === 'google' ? 'GEMINI_API_KEY' : 'OPENAI_API_KEY';

  try {
    const { apiKey, source } = await getApiKeyForEndpoint(
      userId,
      providerForKey,
      envKeyName
    );

    if (apiKey) {
      console.log(`   - Using ${source.toUpperCase()} ${modelConfig.provider.toUpperCase()} API key for ${preferredModel}`);
      return {
        model: preferredModel,
        provider: preferredProvider,
        apiKey: apiKey,
        keySource: source,
        reasoning: `Using ${source} ${modelConfig.provider} key for ${preferredModel}`
      };
    } else {
       console.log(`   - No API key available for ${modelConfig.provider}/${preferredModel}`);
       return {
        model: preferredModel,
        provider: preferredProvider,
        apiKey: null,
        keySource: 'none',
        reasoning: `No API key found for the preferred model ${preferredModel}.`
      };
    }
  } catch (error) {
    console.log(`   - Error getting API key for ${modelConfig.provider}: ${error}`);
  }

  return {
    model: preferredModel,
    provider: preferredProvider,
    apiKey: null,
    keySource: 'none',
    reasoning: 'An error occurred during API key retrieval.'
  };
};

// ✅ POPRAWIONA FUNKCJA callGoogleImageGeneration
const callGoogleImageGeneration = async (
  model: string,
  prompt: string,
  size: string,
  apiKey: string | null
): Promise<any> => {
  console.log(`🎨 === GOOGLE ${model.toUpperCase()} GENERATION ===`);

  const modelConfig = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS];

  if (!modelConfig) {
    throw new Error(`Model configuration not found for: ${model}`);
  }

  console.log(`   - Identyfikacja użytego klucza API: ${getMaskedApiKey(apiKey)}`);
  console.log(`   - Model API: ${'api_model' in modelConfig ? modelConfig.api_model : 'N/A'}`);
  console.log(`   - Method: ${'api_method' in modelConfig ? modelConfig.api_method : 'N/A'}`);

  if (!apiKey) {
    throw new Error('API Key is null or not provided to callGoogleImageGeneration.');
  }

  // Określ endpoint i body na podstawie typu modelu
  let apiUrl: string;
  let requestBody: any;

  if (modelConfig.provider === 'google' && 'api_method' in modelConfig && (modelConfig as any).api_method === 'generateImages') {
    // DLA MODELI IMAGEN – REST :predict
    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${(modelConfig as any).api_model}:predict`;

    // Konwersja rozmiaru na format Imagen
    let aspectRatio = "1:1";
    if (size === "1024x1536") aspectRatio = "3:4";
    else if (size === "1536x1024") aspectRatio = "4:3";

    requestBody = {
      instances: [{ prompt: prompt }],
      parameters: {
        sampleCount: (modelConfig as any).max_images || 1,
        aspectRatio: aspectRatio,
        personGeneration: "allow_adult"
      }
    };
  } else {
    // DLA GEMINI 2.0 FLASH – :generateContent
    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${(modelConfig as any).api_model}:generateContent`;

    requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generation_config: {
        temperature: 0.8,
        responseModalities: ["TEXT", "IMAGE"] // Gemini wymaga obu
      }
    };
  }

  console.log(`   - API URL: ${apiUrl}`);
  console.log(`   - Request type: ${'api_method' in modelConfig ? (modelConfig as any).api_method : 'OpenAI'}`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`   - API Error Response: ${errorText}`);
    throw new Error(`Google API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`   - Response received, processing...`);

  // Parsowanie odpowiedzi
  if (modelConfig.provider === 'google' && 'api_method' in modelConfig && (modelConfig as any).api_method === 'generateImages') {
    // ODPOWIEDŹ IMAGEN (SDK i REST)
    if (result.generatedImages && result.generatedImages.length > 0) {
      console.log(`   - Found ${result.generatedImages.length} generated images (SDK schema)`);
      return {
        data: [{
          b64_json: result.generatedImages[0].image.imageBytes
        }]
      };
    }
    // REST :predict schema -> { predictions: [ { bytesBase64Encoded, mimeType } ] }
    if (result.predictions && result.predictions.length > 0) {
      console.log(`   - Found ${result.predictions.length} predictions (REST schema)`);
      const first = result.predictions[0];
      const b64 = first.bytesBase64Encoded || first.bytes || first.imageBytes;
      if (b64) {
        return { data: [{ b64_json: b64 }] };
      }
    }
  } else {
    // ODPOWIEDŹ GEMINI
    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0];
      const parts = candidate.content?.parts || [];
      // Szukamy inlineData z obrazem
      const imagePart = parts.find((p: any) => p.inlineData && p.inlineData.mimeType?.startsWith('image/'));
      if (imagePart) {
        console.log(`   - Found inline image data`);
        return {
          data: [{
            b64_json: imagePart.inlineData.data
          }]
        };
      }
    }
  }

  throw new Error('No image data found in Google API response');
};

// 🆕 UNIFIED REQUEST BODY PREPARATION (BEZ ZMIAN DLA OPENAI)
const prepareRequestBody = (model: string, prompt: string, size: string) => {
  const config = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS];

  if (config.provider === 'google') {
    return null; // Obsługiwane przez callGoogleImageGeneration
  } else if (model === "gpt-image-1") {
    return JSON.stringify({
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: size as "1024x1024" | "1024x1536" | "1536x1024",
      quality: "high",
      background: "transparent",
      moderation: "auto",
      output_format: "png",
    });
  } else { // dall-e-3
    return JSON.stringify({
      model: "dall-e-3",
      prompt: prompt.substring(0, 380) + "...",
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "hd",
      style: "natural",
      response_format: 'url'
    });
  }
};

// 📊 UNIVERSAL QUALITY METRICS - SUPPORTS ALL PROVIDERS
const calculateQualityMetrics = (imagePrompt: string, chapterTitle: string, model: string) => {
  const qualityElements: { [key: string]: boolean } = {
    'no text': imagePrompt.toLowerCase().includes('no text') || imagePrompt.toLowerCase().includes('absolutely no text'),
    'professional': imagePrompt.toLowerCase().includes('professional'),
    'ebook': imagePrompt.toLowerCase().includes('ebook'),
    'high quality': imagePrompt.toLowerCase().includes('photorealistic') || imagePrompt.toLowerCase().includes('high-quality'),
    'chapter reference': imagePrompt.toLowerCase().includes(chapterTitle.toLowerCase().substring(0, 15))
  };

  const config = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS];
  if ('supports_transparency' in config && (config as any).supports_transparency) {
    qualityElements['transparent background'] = imagePrompt.toLowerCase().includes('transparent');
  }
  if ('supports_text_rendering' in config && (config as any).supports_text_rendering) {
    qualityElements['text rendering optimized'] = imagePrompt.toLowerCase().includes('text') || imagePrompt.toLowerCase().includes('readable');
  }

  const baseScore = (
    (qualityElements['no text'] ? 0.25 : 0) +
    (qualityElements['professional'] ? 0.15 : 0) +
    (qualityElements['ebook'] ? 0.15 : 0) +
    (qualityElements['high quality'] ? 0.20 : 0) +
    (qualityElements['chapter reference'] ? 0.15 : 0)
  );

  const bonusScore = (
    (qualityElements['transparent background'] ? 0.05 : 0) +
    (qualityElements['text rendering optimized'] ? 0.05 : 0)
  );

  const totalScore = baseScore + bonusScore;

  return {
    elements: qualityElements,
    score: totalScore,
    length: imagePrompt.length,
    optimalLength: imagePrompt.length >= (('optimalLength' in config ? (config as any).optimalLength : null) || 200) &&
                   imagePrompt.length <= config.maxPromptLength,
    lengthUtilization: (imagePrompt.length / config.maxPromptLength) * 100,
    meetsStandard: totalScore >= 0.75,
    provider: config.provider,
    cost_estimate: config.costEstimate
  };
};

// 🎯 UNIVERSAL PROMPT OPTIMIZATION
const optimizePromptForModel = (prompt: string, chapterTitle: string, model: string): string => {
  console.log(`🔧 === PROMPT OPTIMIZATION FOR ${model.toUpperCase()} ===`);

  const config = MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS];
  console.log(`   - Provider: ${config.provider.toUpperCase()}`);
  console.log(`   - Input length: ${prompt.length} chars`);
  console.log(`   - Model limit: ${config.maxPromptLength} chars`);

  let finalPrompt = prompt;

  if (!finalPrompt.toLowerCase().includes('no text')) {
    finalPrompt += " Absolutely no text elements.";
    console.log(`🔧 Added NO TEXT clause`);
  }

  if (!finalPrompt.toLowerCase().includes(chapterTitle.toLowerCase().substring(0, 15))) {
    finalPrompt += ` Perfect illustration for "${chapterTitle}".`;
    console.log(`🔧 Added chapter reference`);
  }

  if (config.provider === 'google' && 'supports_text_rendering' in config && (config as any).supports_text_rendering && !prompt.toLowerCase().includes('clear')) {
    finalPrompt += " Clear, readable composition.";
    console.log(`🔧 Added clarity for Google model`);
  } else if (config.provider === 'openai' && 'supports_transparency' in config && (config as any).supports_transparency && !prompt.toLowerCase().includes('transparent')) {
    finalPrompt += " Transparent background with clean edges.";
    console.log(`🔧 Added transparency for OpenAI model`);
  }

  const maxLength = config.maxPromptLength;
  if (finalPrompt.length > maxLength) {
    const availableSpace = maxLength - 50;
    finalPrompt = prompt.substring(0, availableSpace) + " No text.";
    console.warn(`⚠️ Prompt trimmed to fit ${model} limit`);
  }

  console.log(`✅ Optimized for ${config.provider}/${model} (${finalPrompt.length} chars)`);
  return finalPrompt;
};

// Retry logic - unchanged
const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 2000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      console.log(`❌ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt === maxRetries) throw error;
      let delay = baseDelay * (error?.status >= 500 ? attempt : 1);
      if (error?.status === 429) delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
};

// 🔄 ENHANCED FALLBACK CONDITIONS
const shouldFallback = (error: any, currentModel: string): boolean => {
  // Nie próbuj fallback jeśli już używamy najtańszego modelu
  if (currentModel === 'gemini-2.0-flash' || currentModel === 'imagen-3') return false;

  const errorMsg = error?.message?.toLowerCase() || '';
  const status = error?.status;

  const conditions = [
    status === 404 && errorMsg.includes('model'),
    status === 400 && errorMsg.includes('model'),
    status === 403,
    status === 401,
    errorMsg.includes('api key'),
    errorMsg.includes('organization'),
    errorMsg.includes('verification'),
    errorMsg.includes('quota'),
    errorMsg.includes('billing')
  ];

  return conditions.some(Boolean);
};

// 🖼️ IMAGE OPTIMIZATION - unchanged
const optimizeImageForEbook = async (imageBuffer: ArrayBuffer): Promise<Buffer> => {
    const originalSize = (imageBuffer.byteLength / 1024).toFixed(1);
    const optimized = await sharp(Buffer.from(imageBuffer))
        .png({ quality: 95, compressionLevel: 3, adaptiveFiltering: true })
        .resize(1536, 1024, { fit: 'inside', withoutEnlargement: true })
        .sharpen({ sigma: 0.5 })
        .toBuffer();
    const optimizedSize = (optimized.length / 1024).toFixed(1);
    console.log(`🔧 Image optimization: ${originalSize}KB → ${optimizedSize}KB`);
    return optimized;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ebookId: string; chapterId: string }> }
) {
  const startTime = Date.now();
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { ebookId, chapterId } = await params;
    console.log(`🎨 === MULTI-PROVIDER CHAPTER GENERATION START | Ebook: ${ebookId}, Chapter: ${chapterId} ===`);

    const { forceRegenerate = false, size = '1536x1024' } = await request.json();
    const ebookIdNum = parseInt(ebookId), chapterIdNum = parseInt(chapterId);

    const modelSelection = await selectOptimalModel(session.user.id);
    console.log(`🎯 Model Selection: ${modelSelection.provider}/${modelSelection.model} (${modelSelection.reasoning})`);

    const chapter = await prisma.ebook_chapters.findFirst({
      where: { id: chapterIdNum, ebook_id: ebookIdNum, ebooks: { userId: session.user.id } },
      include: { ebooks: { select: { title: true, subtitle: true } } }
    });

    if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    if (!chapter.content?.trim()) return NextResponse.json({ error: 'Chapter has no content' }, { status: 400 });

    const { ebooks: { title: ebookTitle, subtitle: ebookSubtitle }, title: chapterTitle, content: chapterContent, image_prompt: existingImagePrompt } = chapter;
    console.log(`📖 Found: "${ebookTitle}" - "${chapterTitle}"`);

    let imagePrompt = existingImagePrompt;
    if (!imagePrompt || forceRegenerate) {
      console.log('🔥 === GENERATING OPTIMIZED PROMPT ===');
      const allChapters = await prisma.ebook_chapters.findMany({ where: { ebook_id: ebookIdNum }, select: { title: true }, orderBy: { position: 'asc' } });
      try {
        const promptResponse = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/anthropic/generate-image-prompt`, {
          title: ebookTitle, subtitle: ebookSubtitle, chapterTitle, chapterContent, allChapters,
          targetModel: modelSelection.model, forceRegenerate,
          enableTransparency: MODEL_CONFIGS[modelSelection.model as keyof typeof MODEL_CONFIGS]?.supports_transparency || false,
          maximumQuality: true
        }, { headers: { 'Content-Type': 'application/json', 'x-internal-request': 'true' }, timeout: 90000 });

        imagePrompt = promptResponse.data.imagePrompt;
        console.log(`✅ New prompt generated (${imagePrompt?.length || 0} chars)`);
        await prisma.ebook_chapters.update({ where: { id: chapterIdNum }, data: { image_prompt: imagePrompt, updated_at: new Date() } });
      } catch (error: any) {
        console.error('❌ Prompt generation failed:', error.message);
        return NextResponse.json({ error: 'Failed to generate image prompt', details: error.message }, { status: 500 });
      }
    }

    if (!imagePrompt) {
      console.error('❌ Image prompt is null or empty');
      return NextResponse.json({
        error: 'No image prompt available',
        details: 'Image prompt generation failed or returned null'
      }, { status: 500 });
    }

    const qualityMetrics = calculateQualityMetrics(imagePrompt, chapterTitle, modelSelection.model);
    console.log(`📊 Prompt quality: ${(qualityMetrics.score * 100).toFixed(1)}% (${qualityMetrics.provider})`);

    console.log(`🚀 === IMAGE GENERATION WITH ${modelSelection.provider.toUpperCase()}/${modelSelection.model.toUpperCase()} ===`);
    const config = MODEL_CONFIGS[modelSelection.model as keyof typeof MODEL_CONFIGS];
    const validSize = config.sizes.includes(size as any) ? size : config.sizes[0];
    let actualModelUsed = modelSelection.model;
    let imageResponse;
    let finalPrompt = optimizePromptForModel(imagePrompt, chapterTitle, modelSelection.model);

    console.log(`   - Model: ${modelSelection.model}, Key Source: ${modelSelection.keySource}, Size: ${validSize}, Cost: $${config.costEstimate}`);

    try {
      imageResponse = await executeWithRetry(async () => {
        console.log(`🎨 Generating with ${modelSelection.provider}/${modelSelection.model}...`);
        if (config.provider === 'google') {
          return await callGoogleImageGeneration(modelSelection.model, finalPrompt, validSize, modelSelection.apiKey);
        } else {
          const requestBody = prepareRequestBody(modelSelection.model, finalPrompt, validSize);
          const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${modelSelection.apiKey}`, 'Content-Type': 'application/json' },
            body: requestBody
          });
          if (!openaiResponse.ok) {
            const errorText = await openaiResponse.text();
            const error = new Error(`${modelSelection.model} API error: ${JSON.parse(errorText).error?.message || 'Unknown'}`);
            (error as any).status = openaiResponse.status;
            throw error;
          }
          return await openaiResponse.json();
        }
      });
      console.log(`✅ ${modelSelection.provider.toUpperCase()}/${modelSelection.model.toUpperCase()} SUCCESS!`);
    } catch (error: any) {
      console.error(`❌ ${modelSelection.provider}/${modelSelection.model} failed:`, error.message);

      // Próba fallback do tańszego modelu Google
      if (shouldFallback(error, modelSelection.model)) {
        console.log(`🔄 === FALLBACK TO CHEAPER GOOGLE MODEL ===`);

        // Wybierz fallback model
        const fallbackModel = modelSelection.model.includes('imagen') ? 'imagen-3' : 'gemini-2.0-flash';
        actualModelUsed = fallbackModel;
        finalPrompt = optimizePromptForModel(imagePrompt, chapterTitle, fallbackModel);

        try {
          // Użyj tego samego klucza API jeśli jest dostępny
          imageResponse = await executeWithRetry(() =>
            callGoogleImageGeneration(fallbackModel, finalPrompt, '1024x1024', modelSelection.apiKey)
          );
          console.log(`✅ FALLBACK TO ${fallbackModel.toUpperCase()} SUCCESS!`);
        } catch (fallbackError: any) {
          console.error(`❌ Fallback to ${fallbackModel} failed:`, fallbackError.message);
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }

    if (!imageResponse?.data?.[0]) throw new Error('No image data in response');

    let imageBuffer: ArrayBuffer;
    const imageData = imageResponse.data[0];
    if (imageData.b64_json) {
      console.log('🔥 Decoding from base64');
      imageBuffer = Buffer.from(imageData.b64_json, 'base64').buffer;
    } else if (imageData.url) {
      console.log(`🔥 Fetching from URL...`);
      const imageFetch = await fetch(imageData.url);
      if (!imageFetch.ok) throw new Error(`Failed to fetch image: ${imageFetch.status}`);
      imageBuffer = await imageFetch.arrayBuffer();
    } else {
      throw new Error('Invalid response format');
    }

    const processedImageBuffer = await optimizeImageForEbook(imageBuffer);
    const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
    const uploadsDir = path.join(storageBasePath, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const fileName = `EB${ebookIdNum}_CH${chapterIdNum}_${Date.now()}.png`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, processedImageBuffer);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const finalImageUrl = `${baseUrl}/api/assets/uploads/${fileName}`;
    console.log(`☁️ Image uploaded: ${fileName}`);

    const updatedChapter = await prisma.ebook_chapters.update({
      where: { id: chapterIdNum },
      data: { image_url: finalImageUrl, updated_at: new Date() },
      select: { id: true, title: true, image_url: true, image_prompt: true }
    });
    await prisma.ebooks.update({ where: { id: ebookIdNum }, data: { updated_at: new Date() } });

    const totalTime = Date.now() - startTime;
    const finalConfig = MODEL_CONFIGS[actualModelUsed as keyof typeof MODEL_CONFIGS];
    console.log(`📊 === GENERATION COMPLETE | Time: ${totalTime}ms | Cost: $${finalConfig.costEstimate.toFixed(3)} ===`);

    return NextResponse.json({
      success: true,
      image_url: finalImageUrl,
      chapter: updatedChapter,
      generation_metrics: {
        model_used: actualModelUsed,
        generation_time_ms: totalTime,
        cost_estimate: finalConfig.costEstimate,
        fallback_used: actualModelUsed !== modelSelection.model
      },
      model_info: {
        provider: finalConfig.provider,
        model: actualModelUsed,
        key_source: modelSelection.keySource
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ === GENERATION FAILED | Time: ${totalTime}ms ===`);
    console.error(`   - Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json({
      error: 'Image generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Multi-Provider Chapter Image Generator',
    version: "9.0-google-api-complete-fix"
  }, { status: 405 });
}