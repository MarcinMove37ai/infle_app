// src/app/api/ebooks/[ebookId]/select-cover-variant/route.ts
//
// Ustawia wskazany wariant okładki jako AKTYWNY, bez kasowania pozostałych.
// Aktywny obraz = pole cover_image_url (tak jak dotąd) — dzięki temu PDF, landing,
// karty i mockup czytają go bez żadnych zmian.
//
// PUŁAPKA, którą tu rozwiązujemy: generate-mockups buduje mockup z pliku o STAŁEJ
// nazwie {userId}_EB{id}_COVER.webp. Warianty mają nazwy z timestampem
// ({...}_COVER_v{stamp}_{i}.webp), więc plik o stałej nazwie nie istnieje.
// Dlatego przy wyborze KOPIUJEMY plik wybranego wariantu do stałej nazwy — cała
// maszyneria mockupu działa bez zmian, po prostu na zawartości wybranego wariantu.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

type CoverVariant = { url: string; prompt?: string; createdAt?: string; source?: string };

// Wyciąga nazwę pliku z URL-a wariantu (obcina ewentualny ?query i ścieżkę).
function fileNameFromUrl(url: string): string | null {
  try {
    const noQuery = url.split('?')[0];
    const parts = noQuery.split('/');
    const name = parts[parts.length - 1];
    return name && name.length > 0 ? name : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
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

    const body = await request.json();
    const variantUrl: string | undefined = body?.variantUrl;
    if (!variantUrl || typeof variantUrl !== 'string') {
      return NextResponse.json({ error: 'Brak variantUrl' }, { status: 400 });
    }

    // Pobierz ebooka wraz z listą wariantów.
    const ebook = await prisma.ebooks.findFirst({
      where: { id: ebookIdNum, userId: session.user.id },
      select: { id: true, cover_variants: true },
    });

    if (!ebook) {
      return NextResponse.json({ error: 'Ebook nie został znaleziony' }, { status: 404 });
    }

    const variants: CoverVariant[] = Array.isArray(ebook.cover_variants)
      ? (ebook.cover_variants as unknown as CoverVariant[])
      : [];

    // Walidacja: wybrany URL musi być jednym z zapisanych wariantów (bez ?query).
    const base = (u: string) => u.split('?')[0];
    const chosen = variants.find((v) => base(v.url) === base(variantUrl));
    if (!chosen) {
      return NextResponse.json(
        { error: 'Wskazany wariant nie należy do tego ebooka' },
        { status: 400 }
      );
    }

    // Skopiuj plik wybranego wariantu do stałej nazwy _COVER.webp,
    // żeby generate-mockups (czytający stałą nazwę) zbudował mockup z TEGO wariantu.
    const uploadsDir = path.join(process.env.FILE_STORAGE_PATH || '/data/uploads', 'uploads');
    const variantFileName = fileNameFromUrl(chosen.url);

    if (variantFileName) {
      const variantPath = path.join(uploadsDir, variantFileName);
      const stableCoverPath = path.join(uploadsDir, `${session.user.id}_EB${ebookIdNum}_COVER.webp`);
      try {
        await fs.copyFile(variantPath, stableCoverPath);
        console.log(`🧩 Skopiowano wariant → stała okładka: ${variantFileName} → _COVER.webp`);
      } catch (copyErr: any) {
        // Nie przerywamy — aktywny URL i tak ustawimy; mockup może spróbować później.
        console.warn(`⚠️ Nie udało się skopiować pliku wariantu do _COVER.webp:`, copyErr?.message || copyErr);
      }
    } else {
      console.warn('⚠️ Nie udało się wyznaczyć nazwy pliku z URL wariantu:', chosen.url);
    }

    // Ustaw wybrany wariant jako aktywny (wskaźnik aktywnego obrazu).
    const updated = await prisma.ebooks.update({
      where: { id: ebookIdNum },
      data: {
        cover_image_url: chosen.url,
        updated_at: new Date(),
      },
      select: {
        id: true,
        cover_image_url: true,
        cover_variants: true,
      },
    });

    // Przegeneruj mockup z nowo wybranej okładki (best-effort; nie blokuje odpowiedzi).
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    let mockupRegenerated = false;
    try {
      const mockupRes = await fetch(`${baseUrl}/api/ebooks/${ebookIdNum}/generate-mockups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: request.headers.get('Cookie') || '',
        },
      });
      mockupRegenerated = mockupRes.ok;
      if (!mockupRes.ok) {
        console.warn(`⚠️ Mockup nie został przegenerowany (status ${mockupRes.status})`);
      }
    } catch (mockErr: any) {
      console.warn('⚠️ Błąd przy przegenerowaniu mockupu:', mockErr?.message || mockErr);
    }

    console.log(`✅ Wybrano aktywny wariant okładki dla ebooka ${ebookIdNum}: ${chosen.url}`);

    return NextResponse.json({
      success: true,
      cover_image_url: updated.cover_image_url,
      cache_bust_url: `${updated.cover_image_url}?t=${Date.now()}`,
      all_variants: updated.cover_variants,
      mockup_regenerated: mockupRegenerated,
    });
  } catch (error: any) {
    console.error('❌ Błąd wyboru wariantu okładki:', error);
    return NextResponse.json(
      {
        error: 'Błąd wyboru wariantu okładki',
        details: error instanceof Error ? error.message : 'Nieznany błąd',
      },
      { status: 500 }
    );
  }
}