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

    // Przetwarzanie obrazu: zmiana rozmiaru i konwersja do WebP
    const processedImageBuffer = await sharp(Buffer.from(buffer))
      .resize(1024, 1024, {
        fit: 'inside',
        position: 'center',
        withoutEnlargement: true, // Lepsza praktyka: nie powiększaj małych obrazów
      })
      .webp({
        quality: 85, // Dobry balans między jakością a rozmiarem
        effort: 6,   // Maksymalny wysiłek dla najlepszej kompresji
      })
      .toBuffer();

    // Logowanie nowych wymiarów
    const finalMetadata = await sharp(processedImageBuffer).metadata();
    console.log(`✅ Obraz przekonwertowany na WebP: ${finalMetadata.width}x${finalMetadata.height} (${(processedImageBuffer.length / 1024).toFixed(1)} KB)`);

    const fileExtension = 'webp'; // Zawsze zapisujemy jako .webp

    // Przygotowanie ścieżki zapisu w Railway storage
    const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
    const uploadsDir = path.join(storageBasePath, 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generowanie nazwy pliku z nowym rozszerzeniem
    const fileName = `${session.user.id}_EB${ebookId}_CH${chapterId}.${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    console.log(`💾 Zapisywanie obrazu jako ${fileName} w storage`);
    await fs.writeFile(filePath, processedImageBuffer);

    // Generowanie publicznego URL dla obrazu
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const imageUrl = `${baseUrl}/api/assets/uploads/${fileName}`;

    // Aktualizacja URL obrazu w bazie danych
    const updatedChapter = await prisma.ebook_chapters.update({
      where: { id: chapterId },
      data: { image_url: imageUrl, updated_at: new Date() },
    });

    await prisma.ebooks.update({
      where: { id: ebookId },
      data: { updated_at: new Date() },
    });

    console.log(`✅ Pomyślnie zaktualizowano URL obrazu dla rozdziału ID=${chapterId}`);

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
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