// src/app/api/ebooks/[ebookId]/generate-cover/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getApiKeyForEndpoint } from '@/lib/user-api-keys';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const MODEL_ID = 'gemini-3-pro-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;

/**
 * Wywołuje Gemini 3 Pro Image Preview (Nano Banana Pro) i zwraca base64 obrazu.
 */
async function callNanaBananaPro(prompt: string, apiKey: string): Promise<string> {
  console.log(`🎨 Wywołanie ${MODEL_ID}...`);
  console.log(`   - Długość promptu: ${prompt.length} znaków`);

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '3:4',   // Pionowy format okładki książki
        imageSize: '2K'       // Wysoka rozdzielczość
      }
    }
  };

  console.log(`📤 Request body:`, JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Gemini API error ${response.status}:`, errorText);
    throw new Error(`Gemini API error: ${response.status} — ${errorText}`);
  }

  const result = await response.json();

  // Wyciągnij obraz z odpowiedzi (inlineData w parts kandydata)
  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (p: any) => p.inlineData?.mimeType?.startsWith('image/')
  );

  if (!imagePart) {
    // Zaloguj całą odpowiedź dla debugowania
    console.error('❌ Brak danych obrazu w odpowiedzi:', JSON.stringify(result, null, 2));
    throw new Error('Brak danych obrazu w odpowiedzi Gemini API');
  }

  console.log(`✅ Obraz otrzymany (mimeType: ${imagePart.inlineData.mimeType})`);
  return imagePart.inlineData.data; // base64
}

/**
 * Optymalizuje obraz okładki przez sharp — konwertuje do WebP i skaluje do 1024×1365 (3:4).
 */
async function optimizeCoverImage(base64Data: string): Promise<Buffer> {
  const inputBuffer = Buffer.from(base64Data, 'base64');
  const metadata = await sharp(inputBuffer).metadata();
  console.log(`🖼️  Oryginalny obraz: ${metadata.width}x${metadata.height} (${metadata.format})`);

  const outputBuffer = await sharp(inputBuffer)
    .resize(1024, 1365, {      // 3:4 — standardowy format okładki
      fit: 'cover',
      position: 'center'
    })
    .webp({
      quality: 90,
      effort: 6
    })
    .toBuffer();

  console.log(`🔧 Po optymalizacji: 1024x1365 WebP (${(outputBuffer.length / 1024).toFixed(1)} KB)`);
  return outputBuffer;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ebookId: string }> }
) {
  const startTime = Date.now();

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

    const { forceRegenerate = false } = await request.json();

    console.log(`🎨 === GENEROWANIE OKŁADKI (${MODEL_ID}) ===`);
    console.log(`   - Ebook ID: ${ebookIdNum}`);
    console.log(`   - Force regenerate: ${forceRegenerate}`);

    // Pobierz dane ebooka — w tym pole intro
    const ebook = await prisma.ebooks.findFirst({
      where: { id: ebookIdNum, userId: session.user.id }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony' }, { status: 404 });
    }

    if (!ebook.intro || ebook.intro.trim().length === 0) {
      return NextResponse.json({
        error: 'Brak wstępu (pole intro jest puste). Dodaj intro przed generowaniem okładki.'
      }, { status: 400 });
    }

    console.log(`📖 Ebook: "${ebook.title}" ${ebook.subtitle ? `— "${ebook.subtitle}"` : ''}`);
    console.log(`📝 Intro: ${ebook.intro.length} znaków`);

    // Pobierz klucz Google API
    const { apiKey: googleApiKey } = await getApiKeyForEndpoint(
      session.user.id,
      'google',
      'GEMINI_API_KEY'
    );

    if (!googleApiKey) {
      return NextResponse.json({
        error: 'Brak klucza Google API. Dodaj klucz GEMINI_API_KEY w ustawieniach.'
      }, { status: 400 });
    }

    // KROK 1: Wygeneruj prompt okładki przez Claude
    console.log('🔥 KROK 1: Generowanie promptu okładki...');

    let coverPrompt: string;

    try {
      const promptResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/anthropic/generate-cover-prompt`,
        {
          title: ebook.title,
          subtitle: ebook.subtitle,
          intro: ebook.intro,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-internal-request': 'true'
          },
          timeout: 60000
        }
      );

      coverPrompt = promptResponse.data.coverPrompt;
      console.log(`✅ Prompt wygenerowany (${coverPrompt.length} znaków)`);
    } catch (error: any) {
      console.error('❌ Błąd generowania promptu:', error.response?.data || error.message);
      return NextResponse.json({
        error: 'Błąd generowania promptu okładki',
        details: error.response?.data?.error || error.message
      }, { status: 500 });
    }

    // Zapisz prompt w bazie
    await prisma.ebooks.update({
      where: { id: ebookIdNum },
      data: { cover_image_prompt: coverPrompt, updated_at: new Date() }
    });
    console.log('💾 Prompt zapisany w bazie');

    // KROK 2: Wygeneruj obraz przez Gemini 3 Pro Image
    console.log('🔥 KROK 2: Generowanie obrazu...');

    const base64Image = await callNanaBananaPro(coverPrompt, googleApiKey);

    // KROK 3: Optymalizuj obraz
    console.log('🔥 KROK 3: Optymalizacja obrazu...');
    const optimizedBuffer = await optimizeCoverImage(base64Image);

    // KROK 4: Zapisz plik
    const uploadsDir = path.join(process.env.FILE_STORAGE_PATH || '/data/uploads', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileName = `${session.user.id}_EB${ebookIdNum}_COVER.webp`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, optimizedBuffer);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const coverImageUrl = `${baseUrl}/api/assets/uploads/${fileName}`;

    console.log(`💾 Okładka zapisana: ${fileName}`);

    // KROK 5: Zaktualizuj bazę danych
    const updatedEbook = await prisma.ebooks.update({
      where: { id: ebookIdNum },
      data: {
        cover_image_url: coverImageUrl,
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

    console.log(`✅ === OKŁADKA WYGENEROWANA ===`);
    console.log(`   - Model: ${MODEL_ID}`);
    console.log(`   - Czas: ${totalTime}ms`);
    console.log(`   - URL: ${coverImageUrl}`);

    return NextResponse.json({
      success: true,
      cover_image_url: coverImageUrl,
      cache_bust_url: `${coverImageUrl}?t=${Date.now()}`,
      ebook: updatedEbook,
      prompt_used: coverPrompt,
      generation_metrics: {
        model_used: MODEL_ID,
        generation_time_ms: totalTime,
        image_size_kb: Math.round(optimizedBuffer.length / 1024),
        cover_format: '3:4',
        resolution: '2K → 1024x1365',
      }
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('❌ Błąd generowania okładki:', error);
    return NextResponse.json({
      error: 'Błąd generowania okładki',
      details: error instanceof Error ? error.message : 'Nieznany błąd',
      generation_time_ms: totalTime
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Cover Generator — Nano Banana Pro',
    model: MODEL_ID,
    format: '3:4 (portrait)',
    resolution: '2K',
    source: 'ebook.intro',
    textRendering: true
  }, { status: 405 });
}