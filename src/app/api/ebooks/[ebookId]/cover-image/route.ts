// src/app/api/ebooks/[ebookId]/cover-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

/**
 * Obsługa przesyłania okładki dla ebooka (POST)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ebookId: string }> }
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

    console.log(`🖼️ Przesyłanie okładki dla ebookId=${ebookId}`);

    if (isNaN(ebookId)) {
      return NextResponse.json({ error: 'Nieprawidłowy parametr ebookId' }, { status: 400 });
    }

    // Sprawdzenie typu zawartości
    const contentType = request.headers.get('content-type') || '';
    console.log('Content-Type okładki:', contentType);

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
        imageFile = new File([blob], 'cover-image.jpg', {
          type: contentType.includes('image/') ? contentType : 'image/jpeg'
        });
        console.log('Przetworzono okładkę bezpośrednio z body requestu');
      } catch (bodyError) {
        console.error('Błąd podczas odczytu body:', bodyError);
        return NextResponse.json({
          error: 'Nie można przetworzyć pliku okładki',
          contentTypeReceived: contentType
        }, { status: 400 });
      }
    }

    if (!imageFile) {
      return NextResponse.json({ error: 'Brak pliku okładki' }, { status: 400 });
    }

    // Sprawdzenie typu pliku
    const fileType = imageFile.type;
    console.log('Typ pliku okładki:', fileType);

    if (!fileType.startsWith('image/') && !contentType.startsWith('image/')) {
      return NextResponse.json({
        error: 'Wybrany plik nie jest obrazem',
        fileType,
        contentType
      }, { status: 400 });
    }

    // Weryfikacja uprawnień - sprawdź czy ebook należy do użytkownika
    const ebook = await prisma.ebooks.findFirst({
      where: {
        id: ebookId,
        userId: session.user.id
      },
      select: {
        id: true,
        title: true,
        subtitle: true,
        cover_image_url: true,
        cover_variants: true
      }
    });

    if (!ebook) {
      return NextResponse.json({
        error: 'Ebook nie został znaleziony lub nie masz uprawnień'
      }, { status: 404 });
    }

    // Konwersja pliku do ArrayBuffer
    const buffer = await imageFile.arrayBuffer();

    // 🔄 ZMIANA: Ujednolicona konwersja wszystkich obrazów do formatu WebP
    console.log('⚙️  Konwersja obrazu okładki do formatu WebP...');

    const processedImageBuffer = await sharp(Buffer.from(buffer))
      .resize(1024, 1365, {    // Format 3:4 — spójny z okładką generowaną przez AI
        fit: 'cover',
        position: 'center',
        withoutEnlargement: false
      })
      .webp({
        quality: 90,           // Wysoka jakość dla okładki
        effort: 6              // Dobra kompresja
      })
      .toBuffer();

    const fileExtension = 'webp';

    // Przygotowanie ścieżki zapisu w Railway storage
    const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
    const uploadsDir = path.join(storageBasePath, 'uploads');

    // Upewnij się, że folder istnieje
    await fs.mkdir(uploadsDir, { recursive: true });

    // Nazwa UNIKALNA — upload to kolejny wariant, nie nadpisujemy poprzednich okładek.
    const uploadStamp = Date.now();
    const fileName = `${session.user.id}_EB${ebookId}_COVER_upl_${uploadStamp}.${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);

    console.log(`💾 Zapisywanie wgranej okładki jako ${fileName} w Railway storage`);

    // Zapisanie pliku w Railway storage
    await fs.writeFile(filePath, processedImageBuffer);

    // Skopiuj też do stałej nazwy _COVER.webp, by generate-mockups (czytający stałą nazwę)
    // zbudował mockup z TEJ wgranej okładki.
    try {
      const stableCoverPath = path.join(uploadsDir, `${session.user.id}_EB${ebookId}_COVER.${fileExtension}`);
      await fs.writeFile(stableCoverPath, processedImageBuffer);
      console.log(`🧩 Skopiowano wgraną okładkę → stała _COVER.${fileExtension}`);
    } catch (copyErr: any) {
      console.warn(`⚠️ Nie udało się zapisać stałej _COVER.${fileExtension}:`, copyErr?.message || copyErr);
    }

    // Generowanie publicznego URL dla okładki (wskazuje na unikalny plik wariantu)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const imageUrl = `${baseUrl}/api/assets/uploads/${fileName}`;

    // Upload NIE kumuluje się — w puli jest maks. JEDEN wariant 'uploaded' (najnowszy).
    // Warianty AI ('generated') zostają nietknięte.
    type CoverVariant = { url: string; prompt?: string; createdAt?: string; source?: string };
    const existingVariants: CoverVariant[] = Array.isArray(ebook.cover_variants)
      ? (ebook.cover_variants as unknown as CoverVariant[])
      : [];

    // Skasuj z dysku pliki poprzednich uploadów (sprzątanie) — zanim odfiltrujemy je z listy.
    const previousUploads = existingVariants.filter((v) => v.source === 'uploaded');
    for (const prev of previousUploads) {
      try {
        const noQuery = prev.url.split('?')[0];
        const prevName = noQuery.split('/').pop();
        if (prevName && prevName !== fileName) {
          await fs.unlink(path.join(uploadsDir, prevName));
          console.log(`🗑️ Usunięto stary plik uploadu: ${prevName}`);
        }
      } catch (unlinkErr: any) {
        // Brak pliku / już usunięty — nie przerywamy.
        console.warn(`⚠️ Nie udało się usunąć starego uploadu:`, unlinkErr?.message || unlinkErr);
      }
    }

    // Zachowaj tylko warianty AI, dołóż nowy upload jako jedyny 'uploaded'.
    const aiVariants = existingVariants.filter((v) => v.source !== 'uploaded');
    const uploadedVariant: CoverVariant = {
      url: imageUrl,
      createdAt: new Date().toISOString(),
      source: 'uploaded',
    };
    const allVariants = [...aiVariants, uploadedVariant];

    // Aktualizacja: wgrany plik staje się aktywną okładką + dopisany do wariantów.
    const updatedEbook = await prisma.ebooks.update({
      where: {
        id: ebookId
      },
      data: {
        cover_image_url: imageUrl,
        cover_variants: allVariants as any,
        updated_at: new Date()
      },
      select: {
        id: true,
        title: true,
        subtitle: true,
        cover_image_url: true,
        cover_variants: true
      }
    });

    console.log(`✅ Wgrana okładka dodana jako wariant i ustawiona jako aktywna (ebook ID=${ebookId}). Wariantów łącznie: ${allVariants.length}`);

    // Przegeneruj mockup z nowej okładki (best-effort).
    try {
      const mockupRes = await fetch(`${baseUrl}/api/ebooks/${ebookId}/generate-mockups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('cookie') || '',
        },
      });
      if (!mockupRes.ok) {
        console.warn(`⚠️ Mockup po uploadzie nie został przegenerowany (status ${mockupRes.status})`);
      }
    } catch (mockErr: any) {
      console.warn('⚠️ Błąd przy przegenerowaniu mockupu po uploadzie:', mockErr?.message || mockErr);
    }

    return NextResponse.json({
      success: true,
      image_url: imageUrl,
      all_variants: updatedEbook.cover_variants,
      ebook: updatedEbook
    });

  } catch (error) {
    console.error('❌ Błąd podczas przesyłania okładki:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas przesyłania okładki',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}