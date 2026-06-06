// src/app/api/anthropic/generate-content/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint, getUserAiSettings } from '@/lib/user-api-keys';

export const runtime = 'nodejs';

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

interface ChapterContent {
  id: string;
  title: string;
  content: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  console.log('Otrzymano żądanie POST do /api/anthropic/generate-content');

  try {
    const body = await request.json();
    const { title, subtitle, chapters, lang } = body; // Dodajemy pobranie podtytułu
    const pl = lang === 'pl'; // język aplikacji; brak → EN

    if (!title || !chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe. Wymagany tytuł e-booka i lista rozdziałów.' },
        { status: 400 }
      );
    }

    // ✅ DEFINICJE MODELI ZE ZMIENNYCH ŚRODOWISKOWYCH
    const BASIC_AI_MODEL = process.env.BASIC_AI_MODEL || 'claude-3-5-haiku-20241022';
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-20250514';

    // ✅ NOWA LOGIKA: Pobierz klucz API użytkownika z fallback na env var
    const userId = session.user.id;
    const { apiKey: anthropicApiKey, source: keySource } = await getApiKeyForEndpoint(
      userId,
      'anthropic',
      'ANTHROPIC_API_KEY'
    );

    if (!anthropicApiKey) {
      console.error('❌ Brak dostępnego klucza Anthropic API (ani użytkownika, ani env var)');
      return NextResponse.json(
        { error: 'Błąd konfiguracji - brak klucza API Anthropic' },
        { status: 500 }
      );
    }

    // ✅ NOWA LOGIKA: Pobierz ustawienia AI użytkownika
    const userAiSettings = await getUserAiSettings(userId);
    const modelToUse = userAiSettings.textAiModel === 'claude-3-sonnet'
      ? PREMIUM_AI_MODEL
      : BASIC_AI_MODEL;

    console.log(`🤖 Używam modelu: ${modelToUse} (provider: ${userAiSettings.textAiProvider})`);
    console.log(`🔑 Źródło klucza API: ${keySource} ${keySource === 'user' ? '(klucz użytkownika)' : '(klucz systemowy)'}`);
    console.log(`📚 Generowanie ${chapters.length} rozdziałów dla ebooka: "${title}"`);

    // Generowanie treści rozdziałów jeden po drugim
    const chaptersWithContent: ChapterContent[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const [index, chapter] of chapters.entries()) {
      console.log(`📝 Generowanie treści dla rozdziału ${index + 1}/${chapters.length}: ${chapter.title}`);

      // Przygotowanie promptu dla danego rozdziału - zmodyfikowane o podtytuł
      const prompt = `Napisz treść rozdziału "${chapter.title}" dla e-booka zatytułowanego "${title}"${subtitle ? `, z podtytułem "${subtitle}"` : ''}.

      Rozdział powinien zawierać około 2000-2500 znaków (objętość jednej strony A4).
      ${subtitle ? `Uwzględnij informacje z podtytułu przy generowaniu treści rozdziału, aby treść lepiej odzwierciedlała pełny kontekst ebooka.` : ''}
      Nie rozpoczynaj treści rozdziału od jego nazwy,
      Tekst powinien być:
      - Merytoryczny i szczegółowy
      - Podzielony na logiczne akapity
      - Zawierać wprowadzenie, rozwinięcie i podsumowanie
      - Napisany profesjonalnym, ale przystępnym językiem

      Nie używaj podtytułów, numeracji ani oznaczeń formatowania.

      ${pl ? 'Napisz całą treść rozdziału w języku POLSKIM.' : 'Write the entire chapter content in ENGLISH.'}`;

      const requestBody: AnthropicRequest = {
        model: modelToUse, // ✅ ZMIANA: Używaj modelu z ustawień użytkownika
        max_tokens: 2500,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      try {
        // Wykonanie zapytania do API Anthropic z kluczem użytkownika lub systemowym
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey, // ✅ ZMIANA: Używaj pobranego klucza
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Błąd API Anthropic dla rozdziału "${chapter.title}":`, errorText);
          console.error(`Status: ${response.status}, klucz z: ${keySource}`);
          errorCount++;
          continue; // Kontynuuj z następnym rozdziałem
        }

        const responseData = await response.json();
        const chapterContent = responseData.content[0].text;

        chaptersWithContent.push({
          id: chapter.id,
          title: chapter.title,
          content: chapterContent
        });

        successCount++;
        console.log(`✅ Pomyślnie wygenerowano rozdział ${index + 1}: "${chapter.title}" (${chapterContent.length} znaków)`);

      } catch (chapterError) {
        console.error(`❌ Błąd podczas generowania rozdziału "${chapter.title}":`, chapterError);
        errorCount++;
        continue;
      }
    }

    console.log(`📊 Podsumowanie generowania: ${successCount} sukces, ${errorCount} błędów`);

    // Sprawdź czy udało się wygenerować jakąkolwiek treść
    if (chaptersWithContent.length === 0) {
      return NextResponse.json(
        {
          error: 'Nie udało się wygenerować żadnej treści rozdziału',
          details: `Próbowano wygenerować ${chapters.length} rozdziałów, wszystkie zakończyły się błędem`
        },
        { status: 500 }
      );
    }

    // Zwróć wygenerowane treści rozdziałów z dodatkowymi metadanymi
    return NextResponse.json({
      chapters: chaptersWithContent,
      metadata: {
        totalRequested: chapters.length,
        totalGenerated: chaptersWithContent.length,
        successCount: successCount,
        errorCount: errorCount,
        modelUsed: modelToUse,
        keySource: keySource
      }
    });

  } catch (error) {
    console.error('❌ Błąd wewnętrzny serwera:', error);
    return NextResponse.json(
      {
        error: 'Błąd wewnętrzny serwera',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}