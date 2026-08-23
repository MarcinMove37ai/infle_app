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

    // Pobierz dane ebooka wraz z rozdziałami (do promptu okładki).
    const ebook = await prisma.ebooks.findFirst({
      where: { id: ebookIdNum, userId: session.user.id },
      include: {
        ebook_chapters: {
          orderBy: { position: 'asc' },
          select: { title: true, content: true, position: true }
        },
        user: { select: { role: true } }
      }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony' }, { status: 404 });
    }

    // Okladka opiera sie na TRESCI ksiazki. Rozdzialy sa zrodlem pierwszego wyboru,
    // wstep zapasowym — dokladnie tak, jak przyjmuje to generate-cover-prompt.
    // Wczesniej wymagany byl sam wstep, co po wprowadzeniu wstepu jako funkcji
    // planu Business+ blokowalo okladke calkowicie dla planu Starter.
    const hasIntro = !!ebook.intro && ebook.intro.trim().length > 0;
    const chaptersWithContent = (ebook.ebook_chapters ?? []).filter(
      (ch) => (ch.content ?? '').trim().length > 0
    );

    if (!hasIntro && chaptersWithContent.length === 0) {
      return NextResponse.json({
        error: 'Brak treści książki. Wygeneruj rozdziały (lub wstęp) przed generowaniem okładki.'
      }, { status: 400 });
    }

    console.log(`📖 Ebook: "${ebook.title}" ${ebook.subtitle ? `— "${ebook.subtitle}"` : ''}`);
    console.log(`📝 Zrodlo briefu: ${chaptersWithContent.length} rozdzialow z trescia, wstep: ${hasIntro ? `${ebook.intro!.length} znakow` : 'brak'}`);

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
          chapters: (ebook.ebook_chapters ?? []).map((ch) => ({
            position: ch.position,
            title: ch.title ?? '',
            content: ch.content ?? '',
          })),
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

    const uploadsDir = path.join(process.env.FILE_STORAGE_PATH || '/data/uploads', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    type CoverVariant = { url: string; prompt: string; createdAt: string; source: string };
    const batchStamp = Date.now();

    // MODEL "1 + Generate more" (spójny z grafikami rozdziałów): generujemy JEDEN wariant na wywołanie.
    // Kolejne warianty użytkownik dorabia z modalu (przycisk "Generate more"), aż do limitu planu.
    // Dzięki temu nie ma już 5× czasu/kosztu w jednym żądaniu (rozwiązuje też timeout orkiestratora).
    console.log('🔥 KROK 2-4: Generowanie JEDNEGO wariantu okładki...');

    const newVariants: CoverVariant[] = [];
    // Bufor aktywnej okładki zachowany do zbudowania mockupu — bez ponownego czytania z dysku.
    let activeCoverBuffer: Buffer | null = null;
    try {
      const base64Image = await callNanaBananaPro(coverPrompt, googleApiKey);
      const optimizedBuffer = await optimizeCoverImage(base64Image);
      activeCoverBuffer = optimizedBuffer;

      // Unikalna nazwa pliku — nic nie nadpisujemy, każdy wariant zostaje osobnym plikiem.
      const fileName = `${session.user.id}_EB${ebookIdNum}_COVER_v${batchStamp}_1.webp`;
      await fs.writeFile(path.join(uploadsDir, fileName), optimizedBuffer);

      const url = `${baseUrl}/api/assets/uploads/${fileName}`;
      console.log(`   ✅ Wariant zapisany: ${fileName}`);
      newVariants.push({
        url,
        prompt: coverPrompt,
        createdAt: new Date().toISOString(),
        source: 'generated',
      });
    } catch (variantError: any) {
      console.error(`   ❌ Generowanie wariantu nieudane:`, variantError?.message || variantError);
    }

    if (newVariants.length === 0) {
      return NextResponse.json({
        error: 'Nie udało się wygenerować wariantu okładki',
      }, { status: 500 });
    }

    // KROK 4.5: Mockup w ramce — ZAWSZE idzie za aktywną okładką.
    // Świeżo wygenerowany wariant staje się aktywny (cover_image_url niżej), więc mockup musi
    // powstać już tutaj, a nie dopiero przy ręcznym wyborze wariantu w modalu. Inaczej ebook
    // po pierwszej generacji nie ma final_mockup_url i landing nie ma czego pokazać.
    // Pracujemy na buforze z pamięci — bez czytania z dysku i bez self-calla HTTP do generate-mockups.
    let finalMockupUrl: string | null = null;
    let coverWebpUrl: string | null = null;

    if (activeCoverBuffer) {
      try {
        const stableCoverFileName = `${session.user.id}_EB${ebookIdNum}_COVER.webp`;
        const finalMockupFileName = `${session.user.id}_EB${ebookIdNum}_finalMOK.png`;
        const framePath = path.resolve('./public/templates/raw_mokup.png');

        // Stała nazwa _COVER.webp — czytają ją generate-mockups i inni konsumenci stałej nazwy.
        await fs.writeFile(path.join(uploadsDir, stableCoverFileName), activeCoverBuffer);

        // Ramka wczytana do bufora: sharp(ścieżka) trzyma deskryptor pliku i blokuje go na Windows.
        const frameBuffer = await fs.readFile(framePath);
        const resizedCoverBuffer = await sharp(activeCoverBuffer)
          .resize({ width: 600, height: 840, fit: 'cover' })
          .toBuffer();

        await sharp(frameBuffer)
          .composite([{
            input: resizedCoverBuffer,
            blend: 'dest-over',
            top: 220,
            left: 180,
          }])
          .toFile(path.join(uploadsDir, finalMockupFileName));

        // Format ścieżek identyczny jak w generate-mockups (względny) — tak czytają je landing i karty.
        coverWebpUrl = `/uploads/${stableCoverFileName}`;
        finalMockupUrl = `/uploads/${finalMockupFileName}`;
        console.log(`🖼️  Mockup w ramce zbudowany: ${finalMockupFileName}`);
      } catch (mockupError: any) {
        // Mockup nie jest blokerem — sama okładka i tak się zapisze.
        console.error('⚠️ Błąd budowania mockupu (niekrytyczny):', mockupError?.message || mockupError);
      }
    }

    // KROK 5: Dopisz nowy wariant do istniejącej listy (kumulacja — nie nadpisujemy archiwum).
    const existingVariants = Array.isArray(ebook.cover_variants)
      ? (ebook.cover_variants as unknown as CoverVariant[])
      : [];
    const allVariants = [...existingVariants, ...newVariants];

    // Aktywna okładka = URL nowego wariantu (unikalny, spójnie z select/upload i rozdziałami).
    // Modal rozpoznaje aktywny po cover_image_url === jeden z variants[].url.
    const activeUrl = newVariants[0].url;

    const updatedEbook = await prisma.ebooks.update({
      where: { id: ebookIdNum },
      data: {
        cover_image_url: activeUrl,
        cover_variants: allVariants as any,
        // Zapisywane tylko wtedy, gdy mockup faktycznie powstał — przy błędzie nie kasujemy
        // poprzednich, poprawnych wartości.
        ...(coverWebpUrl ? { cover_image_webp_url: coverWebpUrl } : {}),
        ...(finalMockupUrl ? { final_mockup_url: finalMockupUrl } : {}),
        updated_at: new Date()
      },
      select: {
        id: true,
        title: true,
        subtitle: true,
        cover_image_url: true,
        cover_image_prompt: true,
        cover_variants: true,
        final_mockup_url: true
      }
    });

    const totalTime = Date.now() - startTime;

    console.log(`✅ === OKŁADKA WYGENEROWANA ===`);
    console.log(`   - Model: ${MODEL_ID}`);
    console.log(`   - Wariantów łącznie w puli: ${allVariants.length}`);
    console.log(`   - Czas: ${totalTime}ms`);
    console.log(`   - Aktywny URL: ${activeUrl}`);
    console.log(`   - Mockup: ${finalMockupUrl ?? 'BRAK (błąd budowania)'}`);

    return NextResponse.json({
      success: true,
      cover_image_url: activeUrl,
      cache_bust_url: `${activeUrl}?t=${Date.now()}`,
      final_mockup_url: finalMockupUrl,
      variants: newVariants,          // świeżo wygenerowany wariant (1)
      all_variants: allVariants,      // pełna pula (z archiwum)
      ebook: updatedEbook,
      prompt_used: coverPrompt,
      generation_metrics: {
        model_used: MODEL_ID,
        generation_time_ms: totalTime,
        variants_generated: newVariants.length,
        variants_requested: 1,
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