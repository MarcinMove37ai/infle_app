// src/app/api/ebooks/[ebookId]/chapters/[chapterId]/select-image-variant/route.ts
//
// Wybór aktywnego wariantu grafiki rozdziału spośród puli image_variants.
// Analogiczny do select-cover-variant (okładka).
//
// Mechanika:
//   - waliduje, że wskazany wariant należy do puli image_variants tego rozdziału
//   - KOPIUJE plik wybranego wariantu pod STAŁĄ nazwę {userId}_EB{id}_CH{chapterId}.webp
//     (to nazwa, którą czytają konsumenci przez image_url — karty/PDF)
//   - ustawia image_url na stałą nazwę
//   - NIC nie kasuje (pula wariantów zostaje bez zmian — to kapitał użytkownika)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

const base = (u: string) => (u ? u.split('?')[0] : u);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ebookId: string; chapterId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { ebookId, chapterId } = await params;
    const ebookIdNum = parseInt(ebookId);
    const chapterIdNum = parseInt(chapterId);

    const body = await request.json();
    const variantUrl: string | undefined = body?.variantUrl;
    if (!variantUrl) {
      return NextResponse.json({ error: 'Missing variantUrl' }, { status: 400 });
    }

    // Rozdział musi należeć do ebooka usera.
    const chapter = await prisma.ebook_chapters.findFirst({
      where: { id: chapterIdNum, ebook_id: ebookIdNum, ebooks: { userId: session.user.id } },
      select: { id: true, image_variants: true }
    });
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    // Walidacja: wybrany wariant musi być w puli (porównanie po URL bez query).
    const variants = Array.isArray((chapter as any).image_variants) ? (chapter as any).image_variants : [];
    const target = variants.find((v: any) => base(v?.url || '') === base(variantUrl));
    if (!target) {
      return NextResponse.json({ error: 'Variant does not belong to this chapter' }, { status: 400 });
    }

    // Skopiuj plik wybranego wariantu pod STAŁĄ nazwę (czytaną przez konsumentów).
    const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
    const uploadsDir = path.join(storageBasePath, 'uploads');

    const variantFileName = base(variantUrl).split('/').pop();
    if (!variantFileName) {
      return NextResponse.json({ error: 'Invalid variant URL' }, { status: 400 });
    }
    const variantPath = path.join(uploadsDir, variantFileName);

    const stableFileName = `${session.user.id}_EB${ebookIdNum}_CH${chapterIdNum}.webp`;
    const stablePath = path.join(uploadsDir, stableFileName);

    try {
      const buf = await fs.readFile(variantPath);
      await fs.writeFile(stablePath, buf);
    } catch (e: any) {
      console.error('❌ Nie udało się skopiować wariantu pod stałą nazwę:', e?.message);
      return NextResponse.json({ error: 'Failed to activate selected variant file' }, { status: 500 });
    }

    // image_url = URL WYBRANEGO WARIANTU (unikalny) — spójnie z okładką i generatorem.
    // Modal rozpoznaje aktywny po activeUrl === variants[].url; kopia pod stałą nazwę zostaje dla
    // ewentualnych konsumentów stałej (np. PDF), ale wskaźnikiem aktywnego jest URL wariantu.
    const activeImageUrl = base(variantUrl);

    await prisma.ebook_chapters.update({
      where: { id: chapterIdNum },
      data: { image_url: activeImageUrl, updated_at: new Date() }
    });
    await prisma.ebooks.update({ where: { id: ebookIdNum }, data: { updated_at: new Date() } });

    console.log(`✅ Wariant rozdziału ${chapterIdNum} aktywny (image_url=wariant, kopia → ${stableFileName})`);

    return NextResponse.json({
      success: true,
      image_url: activeImageUrl,
      image_variants: variants  // pula bez zmian (nic nie kasujemy)
    });

  } catch (error) {
    console.error('❌ select-image-variant error:', error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: 'Failed to select image variant',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}