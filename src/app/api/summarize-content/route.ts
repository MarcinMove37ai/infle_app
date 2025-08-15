// src/app/api/summarize-content/route.ts
// Endpoint do podsumowywania treści przez AI
// Przyjmuje pełną treść + docelową liczbę znaków
// Przekazuje do AI z instrukcją skrócenia do określonej długości
// Używa modelu wybranego przez użytkownika (z fallback na haiku)

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getApiKeyForEndpoint, getUserAiSettings } from '@/lib/user-api-keys';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Funkcja budowania promptu dla podsumowania treści
function buildSummaryPrompt(
  content: string,
  targetLength: number,
  title: string,
  sourceType: 'web' | 'pdf'
): string {
  const minLength = Math.max(100, targetLength - Math.floor(targetLength * 0.1)); // -10%
  const maxLength = targetLength + Math.floor(targetLength * 0.1); // +10%

  let prompt = `ZADANIE: Stwórz podsumowanie o DOKŁADNIE ${targetLength} znaków (±10%).\n\n`;

  prompt += `============ INFORMACJE O ŹRÓDLE ============\n`;
  prompt += `Tytuł: ${title}\n`;
  prompt += `Typ: ${sourceType === 'web' ? 'Strona internetowa' : 'Dokument PDF'}\n`;
  prompt += `Długość oryginału: ${content.length} znaków\n`;
  prompt += `WYMAGANA długość podsumowania: ${targetLength} znaków\n`;
  prompt += `Dozwolony zakres: ${minLength} - ${maxLength} znaków\n\n`;

  prompt += `============ KRYTYCZNE WYMAGANIA DŁUGOŚCI ============\n`;
  prompt += `🚨 ABSOLUTNIE KLUCZOWE - DŁUGOŚĆ PODSUMOWANIA:\n`;
  prompt += `• Podsumowanie MUSI mieć między ${minLength} a ${maxLength} znaków\n`;
  prompt += `• Idealnie: DOKŁADNIE ${targetLength} znaków\n`;
  prompt += `• NIE WIĘCEJ niż ${maxLength} znaków - to jest MAKSIMUM BEZWZGLĘDNE\n`;
  prompt += `• NIE MNIEJ niż ${minLength} znaków - to jest MINIMUM BEZWZGLĘDNE\n`;
  prompt += `• Przed wysłaniem odpowiedzi POLICZ ZNAKI i upewnij się, że są w zakresie\n`;
  prompt += `• Jeśli przekraczasz limit - USUŃ najmniej ważne fragmenty\n`;
  prompt += `• Jeśli nie osiągasz minimum - DODAJ ważne szczegóły\n\n`;

  prompt += `============ STRATEGIA OSIĄGNIĘCIA DŁUGOŚCI ============\n`;
  prompt += `1. Najpierw wypisz GŁÓWNE TEMATY z treści\n`;
  prompt += `2. Oblicz ile znaków możesz przeznaczyć na każdy temat\n`;
  prompt += `3. Pisz podsumowanie, stale pilnując liczby znaków\n`;
  prompt += `4. Po napisaniu POLICZ ZNAKI i dostosuj długość\n`;
  prompt += `5. Usuń zbędne słowa jeśli za długie, dodaj szczegóły jeśli za krótkie\n\n`;

  prompt += `============ POZOSTAŁE WYMAGANIA ============\n`;
  prompt += `• Zachowaj najważniejsze informacje i kluczowe punkty\n`;
  prompt += `• Użyj jasnego, przystępnego języka polskiego\n`;
  prompt += `• Zachowaj strukturę logiczną treści\n`;
  prompt += `• Nie dodawaj własnych komentarzy czy interpretacji\n`;
  prompt += `• Skup się na faktach i głównych tezach\n`;
  prompt += `• Zachowaj najważniejsze szczegóły i dane liczbowe jeśli występują\n`;
  prompt += `• Priorytetyzuj merytorykę nad ozdobnikami językowymi\n\n`;

  prompt += `============ TREŚĆ DO PODSUMOWANIA ============\n${content}\n\n`;

  prompt += `============ FORMAT ODPOWIEDZI ============\n`;
  prompt += `🎯 PAMIĘTAJ: Twoja odpowiedź musi mieć ${minLength}-${maxLength} znaków!\n`;
  prompt += `Zwróć TYLKO podsumowanie bez dodatkowych komentarzy czy formatowania.\n`;
  prompt += `Nie dodawaj fraz typu "Podsumowanie:", "Treść:", itp.\n`;
  prompt += `Rozpocznij bezpośrednio od merytorycznej treści podsumowania.\n`;
  prompt += `PRZED WYSŁANIEM POLICZ ZNAKI I UPEWNIJ SIĘ, ŻE SĄ W ZAKRESIE ${minLength}-${maxLength}!`;

  return prompt;
}

// Interfejs dla request body - przyjmuje pełną treść do podsumowania
interface SummarizeRequest {
  content: string;        // Pełna zeskrapowana treść (bez skracania)
  targetLength: number;   // Docelowa liczba znaków dla podsumowania
  title: string;         // Tytuł źródła
  sourceType: 'web' | 'pdf'; // Typ źródła
  sourceUrl?: string;    // URL źródła (opcjonalny)
}

// Interfejs dla Anthropic API
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  temperature?: number;
}

// Interfejs dla response - zwracany do modala
interface SummarizeResponse {
  success: boolean;
  summary?: string;
  originalLength?: number;
  summaryLength?: number;
  compressionRatio?: number;
  modelUsed?: string;
  keySource?: string;
  tokensUsed?: any;
  error?: string;
}

export async function POST(request: NextRequest) {
  console.log('Rozpoczynam podsumowywanie treści...');

  try {
    // 1. AUTORYZACJA I SESJA (identycznie jak w generate-single-chapter)
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Nie jesteś zalogowany. Zaloguj się, aby korzystać z tej funkcji.' },
        { status: 401 }
      );
    }

    // 2. PARSOWANIE REQUEST BODY
    let body: SummarizeRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Nieprawidłowy format danych JSON.' },
        { status: 400 }
      );
    }

    const { content, targetLength, title, sourceType, sourceUrl } = body;

    // 3. WALIDACJA PODSTAWOWYCH DANYCH
    if (!content || !targetLength || !title) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe. Wymagana treść, długość docelowa i tytuł.' },
        { status: 400 }
      );
    }

    // 4. WALIDACJA DŁUGOŚCI
    if (content.length < 100) {
      return NextResponse.json(
        { error: 'Treść jest za krótka do podsumowania (minimum 100 znaków).' },
        { status: 400 }
      );
    }

    // Ograniczenie tylko dla docelowej długości (nie dla oryginalnej treści)
    if (targetLength < 100 || targetLength > 15000) {
      return NextResponse.json(
        { error: 'Długość docelowa musi być między 100 a 15000 znaków.' },
        { status: 400 }
      );
    }

    // Ostrzeżenie dla bardzo długich treści (ale nie blokujemy)
    if (content.length > 100000) {
      console.warn(`Bardzo długa treść do podsumowania: ${content.length} znaków`);
    }

    // 5. POBRANIE KLUCZA API ANTHROPIC (identycznie jak w generate-single-chapter)
    const userId = session.user.id;
    const { apiKey: anthropicApiKey, source: keySource } = await getApiKeyForEndpoint(
      userId,
      'anthropic',
      'ANTHROPIC_API_KEY'
    );

    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: 'Błąd konfiguracji - brak klucza API Anthropic' },
        { status: 500 }
      );
    }

    // 6. ✅ POPRAWKA: WYBÓR MODELU Z USTAWIEŃ UŻYTKOWNIKA (analogicznie jak w generate-toc)
    const userAiSettings = await getUserAiSettings(userId);
    const modelToUse = userAiSettings.textAiModel === 'claude-3-sonnet'
      ? 'claude-sonnet-4-20250514'
      : 'claude-3-5-haiku-20241022'; // fallback dla haiku

    console.log(`🤖 Używam modelu: ${modelToUse} (provider: ${userAiSettings.textAiProvider})`);
    console.log(`🔑 Źródło klucza API: ${keySource} ${keySource === 'user' ? '(klucz użytkownika)' : '(klucz systemowy)'}`);

    // 7. LOGGING KONTEKSTU
    console.log('Kontekst podsumowania:', {
      originalLength: content.length,
      targetLength: targetLength,
      title: title,
      sourceType: sourceType,
      modelUsed: modelToUse,
      keySource: keySource,
      willSendFullContent: true
    });

    // 8. BUDOWANIE PROMPTU dla podsumowania
    const prompt = buildSummaryPrompt(content, targetLength, title, sourceType);
    console.log(`Długość promptu: ${prompt.length} znaków`);

    // 9. ANTHROPIC API REQUEST
    const requestBody: AnthropicRequest = {
      model: modelToUse, // ✅ ZMIANA: Używaj modelu z ustawień użytkownika
      max_tokens: Math.min(4000, Math.ceil(targetLength * 1.3)), // 30% buffer na podsumowanie
      temperature: 0.3, // Niższa temperatura dla bardziej precyzyjnych podsumowań
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    // 10. WYWOŁANIE ANTHROPIC API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Błąd API Anthropic dla podsumowania:`, errorText);
      console.error(`Status: ${response.status}, klucz z: ${keySource}`);
      return NextResponse.json(
        { error: `Błąd podczas podsumowywania treści: ${response.status}` },
        { status: response.status }
      );
    }

    // 11. PRZETWARZANIE ODPOWIEDZI
    const responseData = await response.json();
    const rawSummary = responseData.content?.[0]?.text || '';

    if (!rawSummary) {
      return NextResponse.json(
        { error: 'AI nie zwróciło podsumowania treści.' },
        { status: 500 }
      );
    }

    // Czyszczenie podsumowania z ewentualnych artefaktów
    const cleanedSummary = rawSummary.trim();

    // Walidacja wygenerowanego podsumowania
    if (cleanedSummary.length === 0) {
      return NextResponse.json(
        { error: 'AI zwróciło puste podsumowanie.' },
        { status: 500 }
      );
    }

    if (cleanedSummary.length >= content.length) {
      console.warn('Podsumowanie nie jest krótsze od oryginału');
    }

    const compressionRatio = cleanedSummary.length / content.length;

    console.log('Otrzymano odpowiedź z API Anthropic');
    console.log(`Długość podsumowania: ${cleanedSummary.length} znaków`);
    console.log(`Użycie tokenów:`, responseData.usage);
    console.log(`Stopień kompresji: ${(compressionRatio * 100).toFixed(1)}%`);

    // 12. ZWRÓCENIE WYNIKU DO MODALA
    return NextResponse.json({
      success: true,
      summary: cleanedSummary,
      originalLength: content.length,
      summaryLength: cleanedSummary.length,
      compressionRatio: compressionRatio,
      modelUsed: modelToUse, // ✅ DODANO: Zwracamy informację o użytym modelu
      keySource: keySource,
      tokensUsed: responseData.usage || null
    });

  } catch (error) {
    console.error('Błąd podczas podsumowywania:', error);
    return NextResponse.json(
      { error: 'Wewnętrzny błąd serwera podczas podsumowywania treści.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Ta metoda nie jest obsługiwana. Użyj metody POST.' },
    { status: 405 }
  );
}