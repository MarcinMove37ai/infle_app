// src/lib/user-api-keys.ts
import { prisma } from '@/lib/prisma';
import { decryptApiKey, verifyKeyIntegrity } from '@/lib/encryption';

/**
 * Pobiera klucz API użytkownika dla konkretnego providera
 * @param userId - ID użytkownika z sesji
 * @param provider - Provider AI (anthropic, openai, gemini)
 * @returns Odszyfrowany klucz API lub null jeśli nie ma klucza/błąd
 */
export async function getUserApiKey(
  userId: string,
  provider: string
): Promise<string | null> {
  try {
    console.log(`🔍 Szukam klucza API dla userId=${userId}, provider=${provider}`);

    // Znajdź aktywny klucz dla providera w bazie danych
    const userApiKey = await prisma.userApiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider
        },
        isActive: true
      },
      select: {
        id: true,
        encryptedKey: true,
        keyHash: true,
        createdAt: true
      }
    });

    if (!userApiKey) {
      console.log(`ℹ️ Brak klucza API dla ${provider} - użyj fallback na env vars`);
      return null;
    }

    console.log(`🔑 Znaleziono klucz API dla ${provider}, weryfikuję integralność...`);

    // Weryfikuj integralność danych przed deszyfrowaniem
    const isIntegrityValid = verifyKeyIntegrity(
      userApiKey.encryptedKey,
      userApiKey.keyHash
    );

    if (!isIntegrityValid) {
      console.error(`🔥 BŁĄD: Integralność klucza ${provider} została naruszona!`);
      console.error(`KeyID: ${userApiKey.id}, Created: ${userApiKey.createdAt}`);
      return null;
    }

    // Odszyfruj klucz API
    const decryptedKey = decryptApiKey(userApiKey.encryptedKey);

    console.log(`✅ Pomyślnie odszyfrowano klucz ${provider} dla użytkownika`);
    return decryptedKey;

  } catch (error) {
    console.error(`❌ Błąd podczas pobierania klucza API ${provider}:`, error);
    console.error(`UserId: ${userId}, Provider: ${provider}`);

    // Graceful fallback - nie przerywaj działania aplikacji
    return null;
  }
}

/**
 * Pobiera ustawienia AI użytkownika (providery i modele)
 * @param userId - ID użytkownika z sesji
 * @returns Ustawienia AI lub wartości domyślne
 */
export async function getUserAiSettings(userId: string) {
  try {
    console.log(`⚙️ Pobieranie ustawień AI dla userId=${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        textAiProvider: true,
        textAiModel: true,
        imageAiProvider: true,
        imageAiModel: true
      }
    });

    if (!user) {
      console.warn(`⚠️ Użytkownik ${userId} nie został znaleziony - używam wartości domyślnych`);
      return getDefaultAiSettings();
    }

    const settings = {
      textAiProvider: user.textAiProvider || 'anthropic',
      textAiModel: user.textAiModel || 'claude-3-haiku',
      imageAiProvider: user.imageAiProvider || 'openai',
      imageAiModel: user.imageAiModel || 'dall-e-3'
    };

    console.log(`✅ Pobrano ustawienia AI:`, settings);
    return settings;

  } catch (error) {
    console.error(`❌ Błąd podczas pobierania ustawień AI:`, error);
    console.error(`UserId: ${userId}`);

    // Fallback na wartości domyślne
    return getDefaultAiSettings();
  }
}

/**
 * Zwraca domyślne ustawienia AI
 */
function getDefaultAiSettings() {
  return {
    textAiProvider: 'anthropic',
    textAiModel: 'claude-3-haiku',
    imageAiProvider: 'openai',
    imageAiModel: 'dall-e-3'
  };
}

/**
 * Sprawdza czy użytkownik ma klucz API dla danego providera
 * @param userId - ID użytkownika
 * @param provider - Provider AI
 * @returns true jeśli ma aktywny klucz
 */
export async function hasUserApiKey(
  userId: string,
  provider: string
): Promise<boolean> {
  try {
    const count = await prisma.userApiKey.count({
      where: {
        userId,
        provider,
        isActive: true
      }
    });

    return count > 0;

  } catch (error) {
    console.error(`❌ Błąd sprawdzania klucza API ${provider}:`, error);
    return false;
  }
}

/**
 * Helper do wyboru najlepszego klucza API dla endpointu
 * @param userId - ID użytkownika (może być null/undefined dla niezalogowanych)
 * @param provider - Provider AI
 * @param envVarKey - Klucz zmiennej środowiskowej jako fallback
 * @returns Klucz API do użycia w endpoincie
 */
export async function getApiKeyForEndpoint(
  userId: string | null | undefined,
  provider: string,
  envVarKey: string
): Promise<{ apiKey: string | null; source: 'user' | 'env' | 'none' }> {

  // Jeśli nie ma userId (niezalogowany), użyj env var
  if (!userId) {
    const envKey = process.env[envVarKey];
    return {
      apiKey: envKey || null,
      source: envKey ? 'env' : 'none'
    };
  }

  // Spróbuj pobrać klucz użytkownika
  const userApiKey = await getUserApiKey(userId, provider);

  if (userApiKey) {
    return {
      apiKey: userApiKey,
      source: 'user'
    };
  }

  // Fallback na env var
  const envKey = process.env[envVarKey];
  return {
    apiKey: envKey || null,
    source: envKey ? 'env' : 'none'
  };
}