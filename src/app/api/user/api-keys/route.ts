// src/app/api/user/api-keys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  encryptApiKey,
  generateKeyHash,
  validateApiKeyFormat,
  isEncryptionConfigured,
  SUPPORTED_PROVIDERS,
  type SupportedProvider
} from '@/lib/encryption';

export const runtime = 'nodejs';

/**
 * Pobieranie informacji o kluczach API użytkownika (GET)
 * Zwraca listę providerów z informacją czy użytkownik ma aktywny klucz
 */
export async function GET() {
  try {
    // Sprawdzenie autoryzacji
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // Sprawdzenie konfiguracji szyfrowania
    if (!isEncryptionConfigured()) {
      return NextResponse.json({
        error: 'Szyfrowanie nie jest skonfigurowane na serwerze'
      }, { status: 500 });
    }

    console.log(`🔑 Pobieranie informacji o kluczach API dla userId=${session.user.id}`);

    // Pobranie aktywnych kluczy użytkownika (bez odszyfrowania - tylko info o dostępności)
    const userApiKeys = await prisma.userApiKey.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      select: {
        id: true,
        provider: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Przygotowanie odpowiedzi z informacją o dostępnych providerach
    const providersStatus: Record<string, { hasKey: boolean; lastUpdated?: Date }> = {};

    // Inicjalizacja wszystkich wspieranych providerów
    Object.keys(SUPPORTED_PROVIDERS).forEach(provider => {
      providersStatus[provider] = { hasKey: false };
    });

    // Oznaczenie providerów z aktywnymi kluczami
    userApiKeys.forEach(key => {
      if (key.provider in SUPPORTED_PROVIDERS) {
        providersStatus[key.provider] = {
          hasKey: true,
          lastUpdated: key.updatedAt
        };
      }
    });

    return NextResponse.json({
      success: true,
      providers: providersStatus,
      supportedProviders: Object.keys(SUPPORTED_PROVIDERS)
    });

  } catch (error) {
    console.error('❌ Błąd podczas pobierania informacji o kluczach API:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas pobierania informacji o kluczach API',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

/**
 * Zapisywanie/aktualizowanie klucza API (POST)
 */
export async function POST(request: NextRequest) {
  try {
    // Sprawdzenie autoryzacji
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // Sprawdzenie konfiguracji szyfrowania
    if (!isEncryptionConfigured()) {
      return NextResponse.json({
        error: 'Szyfrowanie nie jest skonfigurowane na serwerze'
      }, { status: 500 });
    }

    const userId = session.user.id;
    console.log(`💾 Zapisywanie klucza API dla userId=${userId}`);

    // Parsowanie request body
    const body = await request.json();
    const { provider, apiKey } = body;

    // Walidacja danych wejściowych
    if (!provider || !apiKey) {
      return NextResponse.json({
        error: 'Brak wymaganych danych',
        required: ['provider', 'apiKey']
      }, { status: 400 });
    }

    // Sprawdzenie czy provider jest wspierany
    if (!(provider in SUPPORTED_PROVIDERS)) {
      return NextResponse.json({
        error: 'Nieobsługiwany provider',
        supportedProviders: Object.keys(SUPPORTED_PROVIDERS)
      }, { status: 400 });
    }

    // Walidacja formatu klucza API
    if (!validateApiKeyFormat(provider, apiKey)) {
      const providerInfo = SUPPORTED_PROVIDERS[provider as SupportedProvider];
      return NextResponse.json({
        error: 'Nieprawidłowy format klucza API',
        expectedFormat: providerInfo.example,
        provider: providerInfo.name
      }, { status: 400 });
    }

    // Szyfrowanie klucza API
    let encryptedKey: string;
    let keyHash: string;

    try {
      encryptedKey = encryptApiKey(apiKey);
      keyHash = generateKeyHash(apiKey);
    } catch (encryptionError) {
      console.error('❌ Błąd szyfrowania klucza API:', encryptionError);
      return NextResponse.json({
        error: 'Nie udało się zaszyfrować klucza API',
        details: 'Błąd szyfrowania'
      }, { status: 500 });
    }

    // Zapisanie klucza do bazy danych (upsert - zastąp istniejący lub utwórz nowy)
    const savedKey = await prisma.userApiKey.upsert({
      where: {
        userId_provider: {
          userId: userId,
          provider: provider
        }
      },
      update: {
        encryptedKey: encryptedKey,
        keyHash: keyHash,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        provider: provider,
        encryptedKey: encryptedKey,
        keyHash: keyHash,
        isActive: true
      }
    });

    console.log(`✅ Pomyślnie zapisano klucz API dla providera ${provider}, userId=${userId}`);

    return NextResponse.json({
      success: true,
      message: `Klucz API dla ${SUPPORTED_PROVIDERS[provider as SupportedProvider].name} został zapisany`,
      provider: provider,
      saved: true,
      keyId: savedKey.id
    });

  } catch (error) {
    console.error('❌ Błąd podczas zapisywania klucza API:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas zapisywania klucza API',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

/**
 * Usuwanie klucza API (DELETE)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Sprawdzenie autoryzacji
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`🗑️ Usuwanie klucza API dla userId=${userId}`);

    // Parsowanie request body
    const body = await request.json();
    const { provider } = body;

    // Walidacja danych wejściowych
    if (!provider) {
      return NextResponse.json({
        error: 'Brak wymaganego parametru provider'
      }, { status: 400 });
    }

    // Sprawdzenie czy provider jest wspierany
    if (!(provider in SUPPORTED_PROVIDERS)) {
      return NextResponse.json({
        error: 'Nieobsługiwany provider',
        supportedProviders: Object.keys(SUPPORTED_PROVIDERS)
      }, { status: 400 });
    }

    // Sprawdzenie czy klucz istnieje
    const existingKey = await prisma.userApiKey.findUnique({
      where: {
        userId_provider: {
          userId: userId,
          provider: provider
        }
      }
    });

    if (!existingKey) {
      return NextResponse.json({
        error: 'Klucz API nie został znaleziony',
        provider: provider
      }, { status: 404 });
    }

    // Permanentne usunięcie z bazy danych
    await prisma.userApiKey.delete({
      where: {
        id: existingKey.id
      }
    });

    console.log(`✅ Pomyślnie usunięto klucz API dla providera ${provider}, userId=${userId}`);

    return NextResponse.json({
      success: true,
      message: `Klucz API dla ${SUPPORTED_PROVIDERS[provider as SupportedProvider].name} został usunięty`,
      provider: provider,
      deleted: true
    });

  } catch (error) {
    console.error('❌ Błąd podczas usuwania klucza API:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas usuwania klucza API',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

/**
 * Obsługa innych metod HTTP
 */
export async function PUT() {
  return NextResponse.json(
    { error: 'Metoda PUT nie jest obsługiwana. Użyj POST do aktualizacji klucza.' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'Metoda PATCH nie jest obsługiwana. Użyj POST do aktualizacji klucza.' },
    { status: 405 }
  );
}