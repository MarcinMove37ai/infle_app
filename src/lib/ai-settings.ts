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
 * Pobiera ustawienia AI użytkownika lub zwraca wartości domyślne
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
      imageAiProvider: user?.imageAiProvider || 'openai',
      imageAiModel: user?.imageAiModel || 'dall-e-3'
    };
  } catch (error) {
    console.warn('Błąd podczas pobierania ustawień AI, używam wartości domyślnych:', error);
    return {
      textAiProvider: 'anthropic',
      textAiModel: 'claude-3-haiku',
      imageAiProvider: 'openai',
      imageAiModel: 'dall-e-3'
    };
  }
}

/**
 * Pobiera wszystkie ustawienia użytkownika (AI + dane autora) dla ebooka
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
      imageAiProvider: user?.imageAiProvider || 'openai',
      imageAiModel: user?.imageAiModel || 'dall-e-3',
      authorDisplayName: user?.authorDisplayName || null,
      authorLogoUrl: user?.authorLogoUrl || null
    };
  } catch (error) {
    console.warn('Błąd podczas pobierania ustawień ebooka, używam wartości domyślnych:', error);
    return {
      textAiProvider: 'anthropic',
      textAiModel: 'claude-3-haiku',
      imageAiProvider: 'openai',
      imageAiModel: 'dall-e-3',
      authorDisplayName: null,
      authorLogoUrl: null
    };
  }
}