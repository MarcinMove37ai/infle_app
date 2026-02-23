// src/app/api/ebooks/[ebookId]/generate-mockups/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ebookId: string }> }
) {
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

    console.log(`📸 Generowanie mockupu dla ebooka ${ebookIdNum}`);

    // Pobierz dane ebooka
    const ebook = await prisma.ebooks.findFirst({
      where: { id: ebookIdNum, userId: session.user.id }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony' }, { status: 404 });
    }

    // Ścieżki
    const uploadsDir = path.resolve(path.join(process.env.UPLOADS_DIR || '/data/uploads', 'uploads'));
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const finalMockupFileName = `${session.user.id}_EB${ebookIdNum}_finalMOK.png`;
    const finalMockupPath = path.join(uploadsDir, finalMockupFileName);

    const framePath = path.resolve('./public/templates/raw_mokup.png');
    const coverFilePath = path.join(uploadsDir, `${session.user.id}_EB${ebookIdNum}_COVER.webp`);

    // Sprawdź czy plik okładki istnieje
    if (!fs.existsSync(coverFilePath)) {
      console.warn(`⚠️ Brak pliku okładki: ${coverFilePath}`);
      return NextResponse.json({
        error: 'Brak pliku okładki COVER.webp — wygeneruj lub prześlij okładkę najpierw',
      }, { status: 404 });
    }

    // ✅ FIX: Wczytaj pliki do buforów PRZED przekazaniem do sharp
    // sharp(filePath) używa libvips memory-mapped I/O które trzyma deskryptor pliku
    // sharp(buffer) operuje na kopii w pamięci — nie blokuje pliku źródłowego
    const [coverFileBuffer, frameFileBuffer] = await Promise.all([
      fs.promises.readFile(coverFilePath),
      fs.promises.readFile(framePath),
    ]);

    const resizedCoverBuffer = await sharp(coverFileBuffer)
      .resize({ width: 600, height: 840, fit: 'cover' })
      .toBuffer();

    await sharp(frameFileBuffer)
      .composite([{
        input: resizedCoverBuffer,
        blend: 'dest-over',
        top: 220,
        left: 180,
      }])
      .toFile(finalMockupPath);

    // Zaktualizuj bazę
    const finalMockupUrl = `/uploads/${finalMockupFileName}`;

    await prisma.ebooks.update({
      where: { id: ebookIdNum },
      data: {
        cover_image_webp_url: `/uploads/${session.user.id}_EB${ebookIdNum}_COVER.webp`,
        final_mockup_url: finalMockupUrl,
      }
    });

    console.log(`✅ Mockup wygenerowany: ${finalMockupFileName}`);

    return NextResponse.json({
      success: true,
      finalMockupUrl
    });

  } catch (error: any) {
    console.error('❌ Błąd mockupu:', error);
    return NextResponse.json({
      error: 'Błąd generowania mockupu',
      details: error.message
    }, { status: 500 });
  }
}