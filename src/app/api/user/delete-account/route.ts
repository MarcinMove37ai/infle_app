// src/app/api/user/delete-account/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

const CONFIRMATION_PHRASE = 'delete my inflee.app account';
const FILE_STORAGE_PATH = process.env.FILE_STORAGE_PATH || './.uploads';

/**
 * Wyodrębnia relatywną ścieżkę pliku z URL lub ścieżki absolutnej
 * Zwraca null jeśli URL wskazuje na zewnętrzny zasób (http/https)
 */
function extractFilePath(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return null;
  // Usuń leading slash jeśli istnieje
  return url.startsWith('/') ? url.slice(1) : url;
}

/**
 * Bezpieczne usunięcie pliku z serwera — błędy nie przerywają procesu
 */
async function safeUnlink(relativePath: string): Promise<void> {
  try {
    const baseDir = path.resolve(FILE_STORAGE_PATH);
    const fullPath = path.resolve(path.join(baseDir, relativePath));

    // Ochrona przed path traversal
    if (!fullPath.startsWith(baseDir)) {
      console.warn(`⚠️ Zablokowano próbę usunięcia pliku poza baseDir: ${relativePath}`);
      return;
    }

    await fs.unlink(fullPath);
    console.log(`🗑️ Usunięto plik: ${relativePath}`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`⚠️ Plik nie istnieje (pomijam): ${relativePath}`);
    } else {
      console.error(`❌ Błąd usuwania pliku ${relativePath}:`, error);
    }
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // === KROK 1: Autoryzacja ===
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // === KROK 2: Weryfikacja frazy potwierdzającej ===
    const body = await request.json();
    const { confirmationPhrase } = body;

    if (!confirmationPhrase || confirmationPhrase.trim() !== CONFIRMATION_PHRASE) {
      return NextResponse.json({
        error: 'Nieprawidłowa fraza potwierdzająca',
        expected: CONFIRMATION_PHRASE,
      }, { status: 400 });
    }

    console.log(`🚨 Rozpoczęcie usuwania konta userId=${userId}`);

    // === KROK 3: Pobranie danych użytkownika ===
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
        ebooks: {
          select: {
            id: true,
            cover_image_url: true,
            cover_image_webp_url: true,
            final_mockup_url: true,
            ebook_chapters: {
              select: { image_url: true }
            }
          }
        },
        pages: {
          select: { coverImage: true }
        },
        reels: {
          select: {
            reelCover: true,
            audioURL: true,
            timestampURL: true,
            reelURL: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // === KROK 4: Zebranie ścieżek assetów do usunięcia ===
    const assetPaths: string[] = [];

    // Assety ebooków i rozdziałów
    for (const ebook of user.ebooks) {
      [ebook.cover_image_url, ebook.cover_image_webp_url, ebook.final_mockup_url].forEach(url => {
        const p = extractFilePath(url);
        if (p) assetPaths.push(p);
      });
      for (const chapter of ebook.ebook_chapters) {
        const p = extractFilePath(chapter.image_url);
        if (p) assetPaths.push(p);
      }
    }

    // Assety stron
    for (const page of user.pages) {
      const p = extractFilePath(page.coverImage);
      if (p) assetPaths.push(p);
    }

    // Assety reelsów
    for (const reel of user.reels) {
      [reel.reelCover, reel.audioURL, reel.timestampURL, reel.reelURL].forEach(url => {
        const p = extractFilePath(url);
        if (p) assetPaths.push(p);
      });
    }

    console.log(`📁 Znaleziono ${assetPaths.length} assetów do usunięcia`);

    // === KROK 5: Anulowanie subskrypcji Stripe ===
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        if (subscription.status !== 'canceled') {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
          console.log(`✅ Anulowano subskrypcję Stripe: ${user.stripeSubscriptionId}`);
        }
      } catch (stripeError) {
        // Logujemy ale nie przerywamy — konto musi zostać usunięte nawet jeśli Stripe zawiedzie
        console.error('❌ Błąd anulowania subskrypcji Stripe:', stripeError);
      }
    }

    // === KROK 6: Usuwanie rekordów z bazy danych (transakcja) ===
    await prisma.$transaction(async (tx) => {

      // 1. leads — brak cascade z User
      await tx.leads.deleteMany({
        where: { userId }
      });

      // 2. ebook_chapters — przez ebook_id powiązany z userowym ebookiem
      const ebookIds = user.ebooks.map(e => e.id);
      if (ebookIds.length > 0) {
        await tx.ebook_chapters.deleteMany({
          where: { ebook_id: { in: ebookIds } }
        });
      }

      // 3. ebook_sources — bezpośredni user_id
      await tx.ebookSource.deleteMany({
        where: { user_id: userId }
      });

      // 4. page_contents — cascade z User istnieje ale usuwamy explicite przed pages
      await tx.page_content.deleteMany({
        where: { userId }
      });

      // 5. reels — cascade z User istnieje ale usuwamy przed pages (FK do pages)
      await tx.reels.deleteMany({
        where: { userId }
      });

      // 6. pages — brak cascade z User
      await tx.pages.deleteMany({
        where: { userId }
      });

      // 7. ebooks — brak cascade z User
      await tx.ebooks.deleteMany({
        where: { userId }
      });

      // 8. users.delete — cascade usuwa automatycznie:
      //    user_api_keys, instagram_creator_analysis, linkedin_creator_analysis,
      //    instagram_creator_ai_analysis, linkedin_creator_ai_analysis
      await tx.user.delete({
        where: { id: userId }
      });
    });

    console.log(`✅ Rekord użytkownika i powiązane dane usunięte z bazy, userId=${userId}`);

    // === KROK 7: Usuwanie assetów z serwera (poza transakcją — nie blokuje sukcesu) ===
    await Promise.allSettled(assetPaths.map(safeUnlink));
    console.log(`✅ Zakończono usuwanie assetów z serwera`);

    console.log(`🏁 Konto userId=${userId} zostało pomyślnie usunięte`);

    return NextResponse.json({
      success: true,
      message: 'Konto zostało trwale usunięte',
    });

  } catch (error) {
    console.error('❌ Krytyczny błąd podczas usuwania konta:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas usuwania konta',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}