// src/lib/ai-settings.ts
// Funkcje pomocnicze do pobierania ustawień AI i danych autora z profilu użytkownika
import { prisma } from '@/lib/prisma';

export interface UserAiSettings {
  textAiProvider: string;
  textAiModel: string;
  imageAiProvider: string;
  imageAiModel: string;
}

export interface UserAuthorSettings {
  authorDisplayName: string | null;
  authorLogoUrl: string | null;
}

export interface UserEbookSettings extends UserAiSettings, UserAuthorSettings {}

/**
 * 🆕 ZAKTUALIZOWANE: Pobiera ustawienia AI użytkownika lub zwraca wartości domyślne
 * Domyślnie używa Google Gemini Image Generation (FREE - no API key needed)
 */
export async function getUserAiSettings(userId: string): Promise<UserAiSettings> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        textAiProvider: true,
        textAiModel: true,
        imageAiProvider: true,
        imageAiModel: true
      }
    });

    return {
      textAiProvider: user?.textAiProvider || 'anthropic',
      textAiModel: user?.textAiModel || 'claude-3-haiku',
      // 🆕 ZMIANA: Google Gemini Image Generation jako domyślny (FREE)
      imageAiProvider: user?.imageAiProvider || 'google',
      imageAiModel: user?.imageAiModel || 'gemini-image'
    };
  } catch (error) {
    console.warn('Błąd podczas pobierania ustawień AI, używam wartości domyślnych:', error);
    return {
      textAiProvider: 'anthropic',
      textAiModel: 'claude-3-haiku',
      // 🆕 ZMIANA: Google Gemini Image Generation jako fallback (FREE)
      imageAiProvider: 'google',
      imageAiModel: 'gemini-image'
    };
  }
}

/**
 * 🆕 ZAKTUALIZOWANE: Pobiera wszystkie ustawienia użytkownika (AI + dane autora) dla ebooka
 * Domyślnie używa Google Gemini Image Generation (FREE - no API key needed)
 */
export async function getUserEbookSettings(userId: string): Promise<UserEbookSettings> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        textAiProvider: true,
        textAiModel: true,
        imageAiProvider: true,
        imageAiModel: true,
        authorDisplayName: true,
        authorLogoUrl: true
      }
    });

    return {
      textAiProvider: user?.textAiProvider || 'anthropic',
      textAiModel: user?.textAiModel || 'claude-3-haiku',
      // 🆕 ZMIANA: Google Gemini Image Generation jako domyślny dla ebooków (FREE)
      imageAiProvider: user?.imageAiProvider || 'google',
      imageAiModel: user?.imageAiModel || 'gemini-image',
      authorDisplayName: user?.authorDisplayName || null,
      authorLogoUrl: user?.authorLogoUrl || null
    };
  } catch (error) {
    console.warn('Błąd podczas pobierania ustawień ebooka, używam wartości domyślnych:', error);
    return {
      textAiProvider: 'anthropic',
      textAiModel: 'claude-3-haiku',
      // 🆕 ZMIANA: Google Gemini Image Generation jako fallback dla ebooków (FREE)
      imageAiProvider: 'google',
      imageAiModel: 'gemini-image',
      authorDisplayName: null,
      authorLogoUrl: null
    };
  }
}