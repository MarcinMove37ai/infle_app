// src/app/api/anthropic/generate-content/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint } from '@/lib/user-api-keys';
import { callAnthropic, premiumModel } from '@/lib/anthropic';

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

    // Tresc rozdzialow to wlasciwy produkt — zawsze model premium.
    // Wczesniej decydowal warunek `textAiModel === 'claude-3-sonnet'`, czyli
    // porownanie z identyfikatorem sprzed kilku generacji — zawsze falszywe.
    // W praktyce cala tresc ebookow powstawala na modelu podstawowym.
    const modelToUse = premiumModel();

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

    console.log(`🤖 Model: ${modelToUse} | klucz: ${keySource}`);
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

      try {
        // max_tokens z zapasem: ~2500 znakow tresci to ok. 900 tokenow, ale przy
        // wlaczonym mysleniu jego tokeny tez licza sie do limitu.
        const { text: chapterContent } = await callAnthropic({
          apiKey: anthropicApiKey,
          model: modelToUse,
          prompt,
          maxTokens: 4000,
          label: `generate-content:${index + 1}/${chapters.length}`,
        });

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