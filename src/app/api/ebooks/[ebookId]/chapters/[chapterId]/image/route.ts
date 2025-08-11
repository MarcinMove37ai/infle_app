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
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ebookId: string, chapterId: string }> }
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
    console.log('Content-Type:', contentType);

    let imageFile;

    // Obsługa różnych typów zawartości
    if (contentType.includes('multipart/form-data')) {
      // Standardowa obsługa formData
      try {
        const formData = await request.formData();
        imageFile = formData.get('image') as File | null;
      } catch (formError) {
        console.error('Błąd podczas parsowania formData:', formError);
        return NextResponse.json({
          error: 'Nie można przetworzyć formularza',
          details: 'Upewnij się, że żądanie jest wysyłane jako multipart/form-data'
        }, { status: 400 });
      }
    } else {
      // Alternatywna metoda: bezpośrednie odczytanie pliku z request.body
      try {
        const buffer = await request.arrayBuffer();
        const blob = new Blob([buffer]);
        imageFile = new File([blob], 'uploaded-image.jpg', {
          type: contentType.includes('image/') ? contentType : 'image/jpeg'
        });
        console.log('Przetworzono plik bezpośrednio z body requestu');
      } catch (bodyError) {
        console.error('Błąd podczas odczytu body:', bodyError);
        return NextResponse.json({
          error: 'Nie można przetworzyć pliku',
          contentTypeReceived: contentType
        }, { status: 400 });
      }
    }

    if (!imageFile) {
      return NextResponse.json({ error: 'Brak pliku obrazu' }, { status: 400 });
    }

    // Sprawdzenie typu pliku
    const fileType = imageFile.type;
    console.log('Typ pliku:', fileType);

    if (!fileType.startsWith('image/') && !contentType.startsWith('image/')) {
      return NextResponse.json({
        error: 'Wybrany plik nie jest obrazem',
        fileType,
        contentType
      }, { status: 400 });
    }

    // Weryfikacja uprawnień - sprawdź czy rozdział należy do użytkownika
    const chapter = await prisma.ebook_chapters.findFirst({
      where: {
        id: chapterId,
        ebook_id: ebookId,
        ebooks: {
          userId: session.user.id
        }
      },
      include: {
        ebooks: {
          select: {
            id: true,
            title: true,
            userId: true
          }
        }
      }
    });

    if (!chapter) {
      return NextResponse.json({
        error: 'Rozdział nie został znaleziony lub nie masz uprawnień'
      }, { status: 404 });
    }

    // Konwersja pliku do ArrayBuffer
    const buffer = await imageFile.arrayBuffer();

    // Przetwarzanie obrazu za pomocą sharp
    let processedImageBuffer;
    let outputContentType;
    let fileExtension;

    if (fileType.includes('png') || contentType.includes('png') ||
        fileType.includes('webp') || contentType.includes('webp')) {
      // Przetwarzanie jako PNG z zachowaniem przezroczystości
      processedImageBuffer = await sharp(Buffer.from(buffer))
        .png({
          quality: 90,
          compressionLevel: 9,
          effort: 10  // Maksymalny effort dla najlepszej kompresji
        })
        .resize(1024, 1024, {
          fit: 'cover',
          position: 'center',
          withoutEnlargement: false
        })
        .toBuffer();
      outputContentType = 'image/png';
      fileExtension = 'png';
    } else {
      // Przetwarzanie jako JPEG
      processedImageBuffer = await sharp(Buffer.from(buffer))
        .jpeg({
          quality: 85,
          progressive: true
        })
        .resize(1024, 1024, {
          fit: 'cover',
          position: 'center',
          withoutEnlargement: false
        })
        .toBuffer();
      outputContentType = 'image/jpeg';
      fileExtension = 'jpg';
    }

    // Przygotowanie ścieżki zapisu w Railway storage
    const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
    const uploadsDir = path.join(storageBasePath, 'uploads');

    // Upewnij się, że folder istnieje
    await fs.mkdir(uploadsDir, { recursive: true });

    // Generowanie nazwy pliku zgodnie z konwencją
    const fileName = `EB${ebookId}_CH${chapterId}.${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    console.log(`💾 Zapisywanie obrazu jako ${fileName} w Railway storage`);

    // Zapisanie pliku w Railway storage
    await fs.writeFile(filePath, processedImageBuffer);

    // Generowanie publicznego URL dla obrazu
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const imageUrl = `${baseUrl}/api/assets/uploads/${fileName}`;

    // Aktualizacja URL obrazu w bazie danych przez Prisma
    const updatedChapter = await prisma.ebook_chapters.update({
      where: {
        id: chapterId
      },
      data: {
        image_url: imageUrl,
        updated_at: new Date()
      }
    });

    // Aktualizacja daty modyfikacji ebooka
    await prisma.ebooks.update({
      where: { id: ebookId },
      data: { updated_at: new Date() }
    });

    console.log(`✅ Pomyślnie zaktualizowano URL obrazu dla rozdziału ID=${chapterId} w ebooku ID=${ebookId}`);

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      chapter: {
        id: updatedChapter.id,
        title: updatedChapter.title,
        image_url: updatedChapter.image_url
      }
    });

  } catch (error) {
    console.error('❌ Błąd podczas przesyłania obrazu:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas przesyłania obrazu',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}