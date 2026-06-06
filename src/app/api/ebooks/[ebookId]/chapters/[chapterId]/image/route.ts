// src/app/api/ebooks/[ebookId]/chapters/[chapterId]/image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Obsługa przesyłania obrazu dla rozdziału (POST)
 * 🆕 WSZYSTKIE OBRAZY SĄ TERAZ KONWERTOWANE DO WEBP
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ebookId: string; chapterId: string }> }
) {
  try {
    // Autoryzacja przez session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // Rozwiązanie parametrów z URL
    const resolvedParams = await params;
    const ebookId = parseInt(resolvedParams.ebookId);
    const chapterId = parseInt(resolvedParams.chapterId);

    console.log(`🖼️ Przesyłanie obrazu dla ebookId=${ebookId}, chapterId=${chapterId}`);

    if (isNaN(ebookId) || isNaN(chapterId)) {
      return NextResponse.json({ error: 'Nieprawidłowe parametry' }, { status: 400 });
    }

    // Sprawdzenie typu zawartości
    const contentType = request.headers.get('content-type') || '';
    let imageFile: File | null = null;

    // Obsługa różnych typów zawartości
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      imageFile = formData.get('image') as File | null;
    } else if (contentType.startsWith('image/')) {
      const buffer = await request.arrayBuffer();
      const blob = new Blob([buffer]);
      imageFile = new File([blob], 'uploaded-image', { type: contentType });
      console.log('Przetworzono plik bezpośrednio z body requestu');
    }

    if (!imageFile) {
      return NextResponse.json({ error: 'Brak pliku obrazu lub nieprawidłowy Content-Type' }, { status: 400 });
    }

    // Sprawdzenie, czy plik jest obrazem
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Wybrany plik nie jest obrazem', fileType: imageFile.type }, { status: 400 });
    }

    // Weryfikacja uprawnień
    const chapter = await prisma.ebook_chapters.findFirst({
      where: {
        id: chapterId,
        ebook_id: ebookId,
        ebooks: { userId: session.user.id },
      },
    });

    if (!chapter) {
      return NextResponse.json({ error: 'Rozdział nie został znaleziony lub nie masz uprawnień' }, { status: 404 });
    }

    // Konwersja pliku do ArrayBuffer
    const buffer = await imageFile.arrayBuffer();

    // 🆕 UJEDNOLICONA OPTYMALIZACJA DO WEBP
    console.log('⚙️  Rozpoczynanie konwersji obrazu do formatu WebP...');

    // Logowanie oryginalnych wymiarów
    const originalMetadata = await sharp(Buffer.from(buffer)).metadata();
    console.log(`🖼️  Oryginalny obraz: ${originalMetadata.width}x${originalMetadata.height} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);

    // Przetwarzanie obrazu: format 16:9 (spójny z grafikami AI rozdziałów) + WebP.
    // fit:cover wypełnia kadr 16:9 (może przyciąć brzegi nietypowych zdjęć — świadoma decyzja, jak przy okładce).
    const processedImageBuffer = await sharp(Buffer.from(buffer))
      .resize(1536, 864, {
        fit: 'cover',
        position: 'center',
        withoutEnlargement: false,
      })
      .webp({
        quality: 85,
        effort: 6,
      })
      .toBuffer();

    const finalMetadata = await sharp(processedImageBuffer).metadata();
    console.log(`✅ Obraz przekonwertowany na WebP 16:9: ${finalMetadata.width}x${finalMetadata.height} (${(processedImageBuffer.length / 1024).toFixed(1)} KB)`);

    const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
    const uploadsDir = path.join(storageBasePath, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Wariant uploadu pod UNIKALNĄ nazwą (timestamp) — nie nadpisuje wariantów AI.
    const uplStamp = Date.now();
    const variantFileName = `${session.user.id}_EB${ebookId}_CH${chapterId}_upl_${uplStamp}.webp`;
    await fs.writeFile(path.join(uploadsDir, variantFileName), processedImageBuffer);
    const variantUrl = `${baseUrl}/api/assets/uploads/${variantFileName}`;

    // Kopia pod STAŁĄ nazwę — dla ewentualnych konsumentów stałej nazwy (np. PDF).
    const fileName = `${session.user.id}_EB${ebookId}_CH${chapterId}.webp`;
    await fs.writeFile(path.join(uploadsDir, fileName), processedImageBuffer);
    // image_url = URL WARIANTU uploadu (unikalny) — spójnie z generatorem/select i okładką.
    const imageUrl = variantUrl;
    console.log(`💾 Upload zapisany jako wariant ${variantFileName} (image_url=wariant, + kopia do stałej ${fileName})`);

    // W puli image_variants trzymamy MAX JEDEN wariant 'uploaded' — nowy upload nadpisuje stary
    // (usuwamy poprzedni wpis 'uploaded' z listy i kasujemy jego plik z dysku). Warianty 'generated' nietknięte.
    const existingVariants = Array.isArray((chapter as any).image_variants) ? (chapter as any).image_variants : [];
    const previousUpload = existingVariants.find((v: any) => v?.source === 'uploaded');
    if (previousUpload?.url) {
      const prevName = String(previousUpload.url).split('?')[0].split('/').pop();
      if (prevName && prevName !== variantFileName) {
        try { await fs.unlink(path.join(uploadsDir, prevName)); } catch { /* plik mógł już nie istnieć */ }
      }
    }
    const keptVariants = existingVariants.filter((v: any) => v?.source !== 'uploaded');
    const updatedVariants = [...keptVariants, {
      url: variantUrl,
      createdAt: new Date().toISOString(),
      source: 'uploaded'
    }];

    // Aktualizacja URL obrazu + puli wariantów w bazie danych
    const updatedChapter = await prisma.ebook_chapters.update({
      where: { id: chapterId },
      data: { image_url: imageUrl, image_variants: updatedVariants, updated_at: new Date() },
    });

    await prisma.ebooks.update({
      where: { id: ebookId },
      data: { updated_at: new Date() },
    });

    console.log(`✅ Pomyślnie zaktualizowano URL obrazu dla rozdziału ID=${chapterId}`);

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      all_variants: updatedVariants,   // pełna pula wariantów rozdziału (AI + ten upload)
      chapter: {
        id: updatedChapter.id,
        title: updatedChapter.title,
        image_url: updatedChapter.image_url,
      },
    });
  } catch (error) {
    console.error('❌ Błąd podczas przesyłania obrazu:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas przesyłania obrazu',
      details: error instanceof Error ? error.message : 'Nieznany błąd',
    }, { status: 500 });
  }
}