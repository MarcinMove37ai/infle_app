// src/app/api/ebooks/[ebookId]/generate-cover/route.ts
import { NextResponse } from 'next/server';
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

// 🆕 MULTI-PROVIDER MODEL CONFIGURATION FOR COVERS
const COVER_MODEL_CONFIGS = {
  // 🆕 GOOGLE MODELS - OPTIMIZED FOR BOOK COVERS
  "imagen-3": {
    provider: "google",
    maxPromptLength: 4000,
    optimalLength: 2000,
    quality: "high" as const,
    costEstimate: 0.03,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "standard",
    supports_transparency: false,
    supports_text_rendering: true,
    always_returns_base64: true,
    requires_user_key: true,
    api_model: "gemini-2.5-flash-image-preview",
    api_method: "generateContent",
    max_images: 4,
    cover_optimized: true
  },
  "imagen-4": {
    provider: "google",
    maxPromptLength: 4000,
    optimalLength: 2000,
    quality: "high" as const,
    costEstimate: 0.04,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "premium",
    supports_transparency: false,
    supports_text_rendering: true,
    always_returns_base64: true,
    requires_user_key: true,
    api_model: "imagen-4.0-generate-preview-06-06",
    api_method: "generateImages",
    max_images: 4,
    cover_optimized: true
  },
  "imagen-4-ultra": {
    provider: "google",
    maxPromptLength: 4000,
    optimalLength: 2500,
    quality: "ultra" as const,
    costEstimate: 0.06,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "maximum",
    supports_transparency: false,
    supports_text_rendering: true,
    prompt_adherence: "excellent",
    always_returns_base64: true,
    requires_user_key: true,
    api_model: "imagen-4.0-ultra-generate-preview-06-06",
    api_method: "generateImages",
    max_images: 1,
    cover_optimized: true
  },
  "gemini-image": {
    provider: "google",
    maxPromptLength: 4000,
    optimalLength: 2000,
    quality: "high" as const,
    costEstimate: 0.002,
    sizes: ['1024x1024', '1024x1536', '1536x1024'],
    enhancement_level: "standard",
    supports_transparency: false,
    supports_text_rendering: true,
    supports_conversational_edit: true,
    always_returns_base64: true,
    requires_user_key: true,
    api_model: "gemini-2.0-flash-preview-image-generation",
    api_method: "generateContent",
    requires_text_and_image: true,
    cover_optimized: true
  },
  // OPENAI MODELS - ENHANCED FOR COVERS
  "gpt-image-1": {
    provider: "openai",
    maxPromptLength: 4000,
    optimalLength: 2000,
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
    requires_user_key: true,
    cover_optimized: true
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
    requires_user_key: false,
    cover_optimized: true
  }
} as const;

// Sprawdzenie konfiguracji na starcie
console.log('🚀 === MULTI-PROVIDER BOOK COVER GENERATOR ===');
console.log(`   - Google Models: Imagen 3 ($0.03), Imagen 4 ($0.04), Imagen 4 Ultra ($0.06), Gemini 2.0 Flash ($0.002)`);
console.log(`   - OpenAI Models: DALL-E 3 ($0.08), GPT-Image-1 ($0.19)`);
console.log(`   - Total Models: 6 available (4 Google, 2 OpenAI)`);
console.log(`   - Optimization: Professional book covers`);
console.log(`   - Background: Transparent preferred, seamless composition`);
console.log(`   - Raw API Logging: ENABLED`);
console.log('🚀 === MULTI-PROVIDER COVER GENERATOR READY ===');

function logApiKey(apiKey: string | undefined): string {
  if (!apiKey) return 'MISSING';
  if (apiKey.length < 8) return 'INVALID';
  return `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
}

// ✅ COVER MODEL SELECTION - BASED ON USER PREFERENCES
const selectOptimalCoverModel = async (userId: string | null): Promise<{
  model: string;
  provider: string;
  apiKey: string | null;
  keySource: 'user' | 'env' | 'none';
  reasoning: string;
}> => {
  console.log('🧠 === MULTI-PROVIDER COVER MODEL SELECTION ===');

  if (!userId) {
    console.log('   - User: Not logged in, using fallback model.');
    return {
      model: 'dall-e-3',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || null,
      keySource: 'env',
      reasoning: 'No user logged in - using environment DALL-E 3.'
    };
  }

  // Pobierz ustawienia AI użytkownika
  const userAiSettings = await getUserAiSettings(userId);
  const preferredProvider = userAiSettings.imageAiProvider;
  const preferredModel = userAiSettings.imageAiModel;

  console.log(`   - User Settings: ${preferredProvider}/${preferredModel}`);

  const modelConfig = COVER_MODEL_CONFIGS[preferredModel as keyof typeof COVER_MODEL_CONFIGS];

  if (!modelConfig) {
    console.log('   - Invalid model in settings, attempting fallback to DALL-E 3.');
    return {
      model: 'dall-e-3',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || null,
      keySource: 'env',
      reasoning: 'Invalid model in user settings - using DALL-E 3 fallback.'
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
       console.log(`   - No API key available for ${modelConfig.provider}/${preferredModel}, trying fallback`);

       // Fallback to environment DALL-E 3 if available
       if (process.env.OPENAI_API_KEY) {
         return {
           model: 'dall-e-3',
           provider: 'openai',
           apiKey: process.env.OPENAI_API_KEY,
           keySource: 'env',
           reasoning: `No API key for preferred model, using environment DALL-E 3.`
         };
       }

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

    // Fallback to environment DALL-E 3 if available
    if (process.env.OPENAI_API_KEY) {
      return {
        model: 'dall-e-3',
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        keySource: 'env',
        reasoning: `API key error for preferred model, using environment DALL-E 3.`
      };
    }
  }

  return {
    model: preferredModel,
    provider: preferredProvider,
    apiKey: null,
    keySource: 'none',
    reasoning: 'An error occurred during API key retrieval.'
  };
};

// ✅ GOOGLE IMAGE GENERATION FOR COVERS WITH RAW API LOGGING
const callGoogleCoverGeneration = async (
  model: string,
  prompt: string,
  size: string,
  apiKey: string | null
): Promise<any> => {
  console.log(`🎨 === GOOGLE ${model.toUpperCase()} COVER GENERATION ===`);

  const modelConfig = COVER_MODEL_CONFIGS[model as keyof typeof COVER_MODEL_CONFIGS];

  if (!modelConfig) {
    throw new Error(`Cover model configuration not found for: ${model}`);
  }

  console.log(`   - Identyfikacja użytego klucza API: ${getMaskedApiKey(apiKey)}`);
  console.log(`   - Model API: ${'api_model' in modelConfig ? (modelConfig as any).api_model : 'N/A'}`);
  console.log(`   - Method: ${'api_method' in modelConfig ? (modelConfig as any).api_method : 'N/A'}`);

  if (!apiKey) {
    throw new Error('API Key is null or not provided to callGoogleCoverGeneration.');
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
        sampleCount: 1,
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
        temperature: 1,
        responseModalities: ["TEXT", "IMAGE"],

        // ⬇️ --- DODANA SEKCJA --- ⬇️
        imageConfig: {
           aspectRatio: "1:1" // Wymagane dla okładki (kwadrat)
        }
        // ⬆️ --- KONIEC DODANEJ SEKCJI --- ⬆️
      }
    };
  }

  // 📝 RAW API REQUEST LOGGING
  console.log(`📝 === RAW GOOGLE API REQUEST ===`);
  console.log(`   - URL: ${apiUrl}`);
  console.log(`   - Method: POST`);
  console.log(`   - Headers:`);
  console.log(`     * Content-Type: application/json`);
  console.log(`     * x-goog-api-key: ${getMaskedApiKey(apiKey)}`);
  console.log(`   - Raw Request Body:`);
  console.log(JSON.stringify(requestBody, null, 2));
  console.log(`   - Prompt Length: ${prompt.length} chars`);
  console.log(`   - Full Prompt Text:`);
  console.log(`"${prompt}"`);
  console.log(`📝 === END RAW REQUEST ===`);

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

// 🆕 UNIFIED REQUEST BODY PREPARATION FOR COVERS WITH RAW LOGGING
const prepareCoverRequestBody = (model: string, prompt: string, size: string) => {
  const config = COVER_MODEL_CONFIGS[model as keyof typeof COVER_MODEL_CONFIGS];

  if (config.provider === 'google') {
    return null; // Obsługiwane przez callGoogleCoverGeneration
  } else if (model === "gpt-image-1") {
    const requestBody = {
      model: "gpt-image-1",
      prompt: prompt,
      n: 1,
      size: size as "1024x1024" | "1024x1536" | "1536x1024",
      quality: "high",
      background: "transparent",
      moderation: "auto",
      output_format: "png",
    };

    // 📝 RAW API REQUEST LOGGING for OpenAI
    console.log(`📝 === RAW OPENAI API REQUEST (GPT-IMAGE-1) ===`);
    console.log(`   - URL: https://api.openai.com/v1/images/generations`);
    console.log(`   - Method: POST`);
    console.log(`   - Headers:`);
    console.log(`     * Content-Type: application/json`);
    console.log(`     * Authorization: Bearer ${getMaskedApiKey(process.env.OPENAI_API_KEY || '')}`);
    console.log(`   - Raw Request Body:`);
    console.log(JSON.stringify(requestBody, null, 2));
    console.log(`   - Prompt Length: ${prompt.length} chars`);
    console.log(`   - Full Prompt Text:`);
    console.log(`"${prompt}"`);
    console.log(`📝 === END RAW REQUEST ===`);

    return JSON.stringify(requestBody);
  } else { // dall-e-3
    const requestBody = {
      model: "dall-e-3",
      prompt: prompt.substring(0, 380) + "...",
      n: 1,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "hd",
      style: "natural",
      response_format: 'url'
    };

    // 📝 RAW API REQUEST LOGGING for DALL-E 3
    console.log(`📝 === RAW OPENAI API REQUEST (DALL-E-3) ===`);
    console.log(`   - URL: https://api.openai.com/v1/images/generations`);
    console.log(`   - Method: POST`);
    console.log(`   - Headers:`);
    console.log(`     * Content-Type: application/json`);
    console.log(`     * Authorization: Bearer ${getMaskedApiKey(process.env.OPENAI_API_KEY || '')}`);
    console.log(`   - Raw Request Body:`);
    console.log(JSON.stringify(requestBody, null, 2));
    console.log(`   - Prompt Length: ${requestBody.prompt.length} chars (trimmed from ${prompt.length})`);
    console.log(`   - Full Prompt Text (trimmed):`);
    console.log(`"${requestBody.prompt}"`);
    console.log(`   - Original Prompt (before trimming):`);
    console.log(`"${prompt}"`);
    console.log(`📝 === END RAW REQUEST ===`);

    return JSON.stringify(requestBody);
  }
};

// 🎯 SIMPLIFIED COVER PROMPT OPTIMIZATION
const optimizePromptForModel = (prompt: string, bookTitle: string, model: string): string => {
  console.log(`🔧 === COVER PROMPT OPTIMIZATION FOR ${model.toUpperCase()} ===`);

  const config = COVER_MODEL_CONFIGS[model as keyof typeof COVER_MODEL_CONFIGS];
  console.log(`   - Provider: ${config.provider.toUpperCase()}`);
  console.log(`   - Input length: ${prompt.length} chars`);
  console.log(`   - Model limit: ${config.maxPromptLength} chars`);

  let finalPrompt = prompt;

  // ETAP 1: Dodanie elementów specyficznych dla okładek książek
  if (!finalPrompt.toLowerCase().includes('no text')) {
    finalPrompt += " Absolutely no text elements.";
    console.log(`🔧 Added NO TEXT clause`);
  }

  if (!finalPrompt.toLowerCase().includes(bookTitle.toLowerCase().substring(0, 15))) {
    finalPrompt += ` An artistic illustration inspired by the themes of "${bookTitle}".`;
    console.log(`🔧 Added book title reference`);
  }

  // ETAP 2: Optymalizacje specyficzne dla providera
  if (config.provider === 'google' && 'supports_text_rendering' in config && (config as any).supports_text_rendering && !prompt.toLowerCase().includes('clear')) {
    finalPrompt += " A clear, professional, and high-resolution artistic composition.";
    console.log(`🔧 Added clarity for Google model`);
  } else if (config.provider === 'openai' && 'supports_transparency' in config && (config as any).supports_transparency && !prompt.toLowerCase().includes('transparent')) {
    finalPrompt += " Transparent background with seamless edges for book cover.";
    console.log(`🔧 Added transparency for OpenAI model`);
  }

  // ETAP 3: Przycięcie do limitu modelu
  if (finalPrompt.length > config.maxPromptLength) {
    const availableSpace = config.maxPromptLength - 50;
    finalPrompt = prompt.substring(0, availableSpace) + " No text. Perfect cover.";
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
      console.log(`❌ Cover attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      if (attempt === maxRetries) throw error;
      let delay = baseDelay * (error?.status >= 500 ? attempt : 1);
      if (error?.status === 429) delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Cover generation max retries exceeded');
};

// 🔄 ENHANCED FALLBACK CONDITIONS FOR COVERS
const shouldFallback = (error: any, currentModel: string): boolean => {
  // Nie próbuj fallback jeśli już używamy najtańszego modelu
  if (currentModel === 'dall-e-3' || currentModel === 'gemini-image') return false;

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

// 🖼️ IMAGE OPTIMIZATION FOR BOOK COVERS - 🔄 UPDATED TO WEBP
const optimizeImageForBookCover = async (imageBuffer: ArrayBuffer): Promise<Buffer> => {
    const originalSharp = sharp(Buffer.from(imageBuffer));
    const originalMetadata = await originalSharp.metadata();
    const originalSize = (imageBuffer.byteLength / 1024).toFixed(1);
    const originalResolution = `${originalMetadata.width}x${originalMetadata.height}`;

    console.log(`🖼️  Odebrano obraz okładki: ${originalResolution} (${originalSize}KB)`);

    const optimizedBuffer = await originalSharp
        .resize(1024, 1024, {
            fit: 'cover',
            position: 'center',
            withoutEnlargement: false
        })
        .webp({
            quality: 90,        // Wysoka jakość dla okładki
            effort: 6           // Maksymalny wysiłek dla najlepszej kompresji
        })
        .sharpen({ sigma: 0.8, m1: 1.2, m2: 2.5 })
        .toBuffer();

    const optimizedMetadata = await sharp(optimizedBuffer).metadata();
    const optimizedSize = (optimizedBuffer.length / 1024).toFixed(1);
    const optimizedResolution = `${optimizedMetadata.width}x${optimizedMetadata.height}`;

    console.log(`🔧 Optymalizacja okładki (WebP): ${originalResolution} (${originalSize}KB) → ${optimizedResolution} (${optimizedSize}KB)`);

    return optimizedBuffer;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  const startTime = Date.now();

  try {
    // Autoryzacja przez session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const resolvedParams = await params;
    const ebookId = resolvedParams.ebookId;

    console.log(`🎨 === MULTI-PROVIDER BOOK COVER GENERATION ===`);
    console.log(`   - Ebook ID: ${ebookId}`);
    console.log(`   - User ID: ${session.user.id}`);
    console.log(`   - Timestamp: ${new Date().toISOString()}`);

    const { forceRegenerate = false, size = '1024x1024' } = await request.json();

    if (!ebookId) {
      return NextResponse.json({ error: 'Missing required parameter: ebookId' }, { status: 400 });
    }

    const ebookIdNum = parseInt(ebookId);
    if (isNaN(ebookIdNum)) {
      return NextResponse.json({ error: 'Invalid ebook identifier' }, { status: 400 });
    }

    // Model selection based on user preferences
    const modelSelection = await selectOptimalCoverModel(session.user.id);
    console.log(`🎯 Cover Model Selection: ${modelSelection.provider}/${modelSelection.model} (${modelSelection.reasoning})`);

    // Fetch ebook data using Prisma
    const ebook = await prisma.ebooks.findFirst({
      where: {
        id: ebookIdNum,
        userId: session.user.id
      },
      include: {
        ebook_chapters: {
          select: {
            title: true,
            content: true
          },
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook not found or access denied' }, { status: 404 });
    }

    const {
      title: ebookTitle,
      subtitle: ebookSubtitle,
      cover_image_prompt: existingCoverPrompt,
      ebook_chapters: chapters
    } = ebook;

    console.log(`📖 Found ebook: "${ebookTitle}" ${ebookSubtitle ? `- "${ebookSubtitle}"` : ''}`);

    if (chapters.length === 0) {
      return NextResponse.json({ error: 'Ebook has no chapters for cover generation' }, { status: 400 });
    }

    console.log(`📚 Found ${chapters.length} chapters for cover context`);

    // 🔧 FIX: Dodaj fallback dla null coverPrompt
    let coverPrompt = existingCoverPrompt || '';

    // ETAP 1: Generate ultra-detailed cover prompt via Claude
    console.log('🔥 === GENERATING COVER PROMPT ===');

    let promptData;
    try {
      const promptResponse = await axios.post(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/anthropic/generate-cover-prompt`, {
        title: ebookTitle,
        subtitle: ebookSubtitle,
        chapters: chapters,
        targetModel: modelSelection.model,
        enableTransparency: COVER_MODEL_CONFIGS[modelSelection.model as keyof typeof COVER_MODEL_CONFIGS] && 'supports_transparency' in COVER_MODEL_CONFIGS[modelSelection.model as keyof typeof COVER_MODEL_CONFIGS] && (COVER_MODEL_CONFIGS[modelSelection.model as keyof typeof COVER_MODEL_CONFIGS] as any).supports_transparency || false,
        forceRegenerate
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-request': 'true'
        },
        timeout: 90000
      });

      promptData = promptResponse.data;
    } catch (error: any) {
      console.error('❌ Claude cover prompt generation failed:', error.response?.data || error.message);
      return NextResponse.json({
        error: 'Failed to generate cover prompt',
        details: error.response?.data?.error || error.message
      }, { status: 500 });
    }

    coverPrompt = promptData.coverPrompt;

    if (!coverPrompt) {
      console.error('❌ Cover prompt is null or empty');
      return NextResponse.json({
        error: 'No cover prompt available',
        details: 'Cover prompt generation failed or returned null'
      }, { status: 500 });
    }

    console.log(`✅ Cover prompt generated:`);
    console.log(`   - Length: ${promptData.promptLength} chars`);
    console.log(`   - Quality: ${(promptData.qualityMetrics?.overallQuality * 100 || 0).toFixed(1)}%`);
    console.log(`   - Format: ${promptData.format || 'portrait'}`);

    // Save cover prompt to database using Prisma
    await prisma.ebooks.update({
      where: { id: ebookIdNum },
      data: {
        cover_image_prompt: coverPrompt,
        updated_at: new Date()
      }
    });
    console.log('💾 Cover prompt saved to database');

    // ETAP 2: Multi-Provider Cover Generation
    console.log(`🚀 === ${modelSelection.provider.toUpperCase()}/${modelSelection.model.toUpperCase()} COVER GENERATION ===`);

    const config = COVER_MODEL_CONFIGS[modelSelection.model as keyof typeof COVER_MODEL_CONFIGS];
    const validSize = config.sizes.includes(size as any) ? size : config.sizes[0];
    let actualModelUsed = modelSelection.model;
    let imageResponse;
    let finalPrompt = optimizePromptForModel(coverPrompt, ebookTitle, modelSelection.model);

    console.log(`   - Model: ${modelSelection.model}, Key Source: ${modelSelection.keySource}, Size: ${validSize}, Cost: $${config.costEstimate}`);

    try {
      imageResponse = await executeWithRetry(async () => {
        console.log(`🎨 Generating cover with ${modelSelection.provider}/${modelSelection.model}...`);
        if (config.provider === 'google') {
          return await callGoogleCoverGeneration(modelSelection.model, finalPrompt, validSize, modelSelection.apiKey);
        } else {
          const requestBody = prepareCoverRequestBody(modelSelection.model, finalPrompt, validSize);
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
      console.log(`✅ ${modelSelection.provider.toUpperCase()}/${modelSelection.model.toUpperCase()} COVER SUCCESS!`);
    } catch (error: any) {
      console.error(`❌ ${modelSelection.provider}/${modelSelection.model} failed:`, error.message);

      // Próba fallback do tańszego modelu
      if (shouldFallback(error, modelSelection.model)) {
        console.log(`🔄 === FALLBACK TO CHEAPER MODEL ===`);

        // Wybierz fallback model w zależności od providera
        const fallbackModel = modelSelection.provider === 'google' ? 'gemini-image' : 'dall-e-3';
        const fallbackConfig = COVER_MODEL_CONFIGS[fallbackModel as keyof typeof COVER_MODEL_CONFIGS];
        actualModelUsed = fallbackModel;
        finalPrompt = optimizePromptForModel(coverPrompt, ebookTitle, fallbackModel);

        try {
          if (fallbackConfig.provider === 'google') {
            // Użyj tego samego klucza Google API jeśli jest dostępny
            imageResponse = await executeWithRetry(() =>
              callGoogleCoverGeneration(fallbackModel, finalPrompt, '1024x1024', modelSelection.apiKey)
            );
          } else {
            // Fallback do DALL-E 3 z environment key
            const requestBody = prepareCoverRequestBody(fallbackModel, finalPrompt, '1024x1024');
            imageResponse = await executeWithRetry(async () => {
              const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
                body: requestBody
              });
              if (!openaiResponse.ok) {
                const errorText = await openaiResponse.text();
                throw new Error(`DALL-E 3 fallback error: ${JSON.parse(errorText).error?.message || 'Unknown'}`);
              }
              return await openaiResponse.json();
            });
          }
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
      console.log('🔥 Decoding cover from base64');
      imageBuffer = Buffer.from(imageData.b64_json, 'base64').buffer;
    } else if (imageData.url) {
      console.log(`🔥 Fetching cover from URL...`);
      const imageFetch = await fetch(imageData.url);
      if (!imageFetch.ok) throw new Error(`Failed to fetch cover image: ${imageFetch.status}`);
      imageBuffer = await imageFetch.arrayBuffer();
    } else {
      throw new Error('Invalid response format');
    }

    // Advanced image optimization for book covers
    const processedImageBuffer = await optimizeImageForBookCover(imageBuffer);

    // Railway storage upload
    const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
    const uploadsDir = path.join(storageBasePath, 'uploads');

    await fs.mkdir(uploadsDir, { recursive: true });

    // 🔄 ZMIANA NAZWY PLIKU NA .webp
    const fileName = `${session.user.id}_EB${ebookIdNum}_COVER.webp`;
    const filePath = path.join(uploadsDir, fileName);

    console.log(`💾 Zapisywanie okładki jako ${fileName} w Railway storage`);
    await fs.writeFile(filePath, processedImageBuffer);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const finalCoverUrl = `${baseUrl}/api/assets/uploads/${fileName}`;

    console.log(`☁️ Multi-provider cover uploaded to Railway: ${fileName}`);

    // Database updates using Prisma
    const updatedEbook = await prisma.ebooks.update({
      where: { id: ebookIdNum },
      data: {
        cover_image_url: finalCoverUrl,
        updated_at: new Date()
      },
      select: {
        id: true,
        title: true,
        subtitle: true,
        cover_image_url: true,
        cover_image_prompt: true
      }
    });

    const totalTime = Date.now() - startTime;
    const finalConfig = COVER_MODEL_CONFIGS[actualModelUsed as keyof typeof COVER_MODEL_CONFIGS];

    console.log(`📊 === MULTI-PROVIDER COVER GENERATION COMPLETE ===`);
    console.log(`   - Model: ${actualModelUsed} ${actualModelUsed !== modelSelection.model ? '(fallback)' : '(primary)'}`);
    console.log(`   - Provider: ${finalConfig.provider.toUpperCase()}`);
    console.log(`   - Total time: ${totalTime}ms`);
    console.log(`   - Cost: $${finalConfig.costEstimate.toFixed(3)}`);
    console.log(`   - Key source: ${modelSelection.keySource}`);

    return NextResponse.json({
      success: true,
      cover_image_url: finalCoverUrl,
      ebook: updatedEbook,
      generation_metrics: {
        model_used: actualModelUsed,
        model_attempted: modelSelection.model,
        generation_time_ms: totalTime,
        cost_estimate: finalConfig.costEstimate,
        prompt_length: finalPrompt?.length || coverPrompt.length,
        prompt_utilization: `${(((finalPrompt?.length || coverPrompt.length)/finalConfig.maxPromptLength)*100).toFixed(1)}%`,
        image_size_kb: Math.round(processedImageBuffer.length / 1024),
        fallback_used: actualModelUsed !== modelSelection.model,
        quality_setting: finalConfig.quality || "high",
        cover_format: validSize,
        background_type: ('supports_transparency' in finalConfig && (finalConfig as any).supports_transparency) ? "transparent" : "standard"
      },
      model_info: {
        provider: finalConfig.provider,
        model: actualModelUsed,
        key_source: modelSelection.keySource
      },
      prompt_used: coverPrompt,
      prompt_was_generated: !existingCoverPrompt || forceRegenerate,
      generation_timestamp: Date.now(),
      cache_bust_url: finalCoverUrl + '?t=' + Date.now()
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('❌ === MULTI-PROVIDER COVER GENERATION FAILED ===');
    console.error(`   - Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`   - Total time: ${totalTime}ms`);

    return NextResponse.json({
      error: 'Multi-provider book cover generation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      generation_time_ms: totalTime
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Multi-Provider Book Cover Generator',
    version: "8.0-multi-provider-no-restrictions",
    supportedProviders: ['google', 'openai'],
    supportedModels: ['imagen-3', 'imagen-4', 'imagen-4-ultra', 'gemini-image', 'gpt-image-1', 'dall-e-3'],
    maxPromptLength: 4000,
    recommendedFormat: 'square-1024x1024',
    backgroundType: 'transparent-preferred',
    compositionType: 'seamless-professional',
    qualityLevel: 'high',
    optimizedFor: 'professional-book-covers',
    userPreferences: 'automatically-detected',
    rawApiLogging: 'enabled'
  }, { status: 405 });
}