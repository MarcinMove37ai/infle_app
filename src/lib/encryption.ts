// src/lib/encryption.ts
import crypto from 'crypto';

// Konfiguracja algorytmu szyfrowania
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bitów dla GCM
const TAG_LENGTH = 16; // 128 bitów auth tag
const KEY_LENGTH = 32; // 256 bitów dla AES-256

/**
 * Pobiera klucz główny do szyfrowania z zmiennej środowiskowej
 */
function getMasterKey(): Buffer {
  // Używamy dedykowanego klucza dla leadów, jeśli istnieje, w przeciwnym razie wracamy do ogólnego klucza
  const masterKey = process.env.LEAD_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!masterKey) {
    throw new Error('ENCRYPTION_KEY or LEAD_ENCRYPTION_KEY not configured in environment variables');
  }

  // Konwertujemy string na Buffer - klucz powinien być w formacie hex
  let keyBuffer: Buffer;
  try {
    // Sprawdzamy czy to 64-znakowy hex string (32 bajty * 2 znaki)
    if (masterKey.length === 64 && /^[0-9a-fA-F]+$/.test(masterKey)) {
      keyBuffer = Buffer.from(masterKey, 'hex');
    } else {
      throw new Error('Invalid format');
    }
  } catch (error) {
    throw new Error('Invalid ENCRYPTION_KEY format. Expected 64-character hex string');
  }

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (256 bits) long`);
  }

  return keyBuffer;
}

/**
 * Generuje bezpieczny hash SHA-256 klucza API do weryfikacji integralności
 */
export function generateKeyHash(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey, 'utf8')
    .digest('hex');
}

/**
 * Szyfruje klucz API używając AES-256-GCM
 * @param apiKey - Klucz API do zaszyfrowania
 * @returns Zaszyfrowany klucz w formacie base64 (IV + encrypted_data + auth_tag)
 */
export function encryptApiKey(apiKey: string): string {
  try {
    const masterKey = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
    let encrypted = cipher.update(apiKey, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, encrypted, authTag]);
    return combined.toString('base64');
  } catch (error) {
    console.error('Error encrypting API key:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Odszyfrowuje klucz API używając AES-256-GCM
 * @param encryptedData - Zaszyfrowane dane w formacie base64
 * @returns Odszyfrowany klucz API
 */
export function decryptApiKey(encryptedData: string): string {
  try {
    const masterKey = getMasterKey();
    const combined = Buffer.from(encryptedData, 'base64');
    if (combined.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Invalid encrypted data length');
    }
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - TAG_LENGTH);
    const encryptedKey = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedKey, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error decrypting API key:', error);
    throw new Error('Failed to decrypt API key - data may be corrupted or master key changed');
  }
}

/**
 * Weryfikuje integralność zaszyfrowanego klucza poprzez deszyfrowanie i ponowne hashowanie
 * @param encryptedData - Zaszyfrowane dane
 * @param expectedHash - Oczekiwany hash SHA-256
 * @returns true jeśli integralność jest zachowana
 */
export function verifyKeyIntegrity(encryptedData: string, expectedHash: string): boolean {
  try {
    const decryptedKey = decryptApiKey(encryptedData);
    const actualHash = generateKeyHash(decryptedKey);
    return actualHash === expectedHash;
  } catch (error) {
    console.error('Error verifying key integrity:', error);
    return false;
  }
}

/**
 * Waliduje format klucza API dla danego providera
 * @param provider - Provider API (anthropic, openai, google)
 * @param apiKey - Klucz API do walidacji
 * @returns true jeśli format jest prawidłowy
 */
export function validateApiKeyFormat(provider: string, apiKey: string): boolean {
  if (!apiKey || apiKey.length < 20) {
    return false;
  }
  switch (provider.toLowerCase()) {
    case 'anthropic':
      return apiKey.startsWith('sk-ant-');
    case 'openai':
      return apiKey.startsWith('sk-');
    case 'google':
      return apiKey.startsWith('AIza');
    case 'gemini':
      return apiKey.startsWith('AIza');
    default:
      return false;
  }
}

/**
 * Sprawdza czy master key jest skonfigurowany i prawidłowy
 * @returns true jeśli klucz główny jest dostępny i prawidłowy
 */
export function isEncryptionConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Generuje bezpieczny klucz główny (dla setupu aplikacji)
 * UWAGA: Używać tylko podczas pierwszego setupu aplikacji!
 * @returns Nowy 256-bit klucz w formacie hex (64 znaki)
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Dostępne providery AI i ich walidatory
 */
export const SUPPORTED_PROVIDERS = {
  anthropic: {
    name: 'Anthropic',
    validator: (key: string) => key.startsWith('sk-ant-'),
    example: 'sk-ant-...'
  },
  openai: {
    name: 'OpenAI',
    validator: (key: string) => key.startsWith('sk-'),
    example: 'sk-...'
  },
  google: {
    name: 'Google AI',
    validator: (key: string) => key.startsWith('AIza'),
    example: 'AIza...'
  }
} as const;

export type SupportedProvider = keyof typeof SUPPORTED_PROVIDERS;

// =================================================================
// NOWE, UNIWERSALNE FUNKCJE DO SZYFROWANIA DANYCH LEADÓW
// =================================================================

/**
 * Szyfruje dowolny tekst (np. dane leada) używając AES-256-GCM
 * @param text - Tekst do zaszyfrowania
 * @returns Zaszyfrowane dane w formacie hex
 */
export function encryptData(text: string): string {
  if (!text) return text;
  try {
    const masterKey = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Zmieniamy format na hex, aby był spójny
    return Buffer.concat([iv, authTag, encrypted]).toString('hex');
  } catch (error) {
    console.error('Error encrypting data:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Odszyfrowuje dowolny tekst (np. dane leada)
 * @param encryptedHex - Zaszyfrowane dane w formacie hex
 * @returns Odszyfrowany tekst
 */
export function decryptData(encryptedHex: string): string {
  if (!encryptedHex) return encryptedHex;
  try {
    const masterKey = getMasterKey();
    const combined = Buffer.from(encryptedHex, 'hex');

    if (combined.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Invalid encrypted data length');
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  } catch (error) {
    console.error(`Decryption failed for value: ${encryptedHex.substring(0, 20)}...`, error);
    return encryptedHex; // Zwróć oryginalny tekst w razie błędu deszyfracji
  }
}