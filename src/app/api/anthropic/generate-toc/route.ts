// src/app/api/anthropic/generate-toc/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint, getUserAiSettings } from '@/lib/user-api-keys';
import { getChapterLimits } from '@/lib/chapterLimits';

// Jawna definicja runtime
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

interface TocItem {
  id: string;
  title: string;
}

interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  source?: string;
}

// Funkcja POST zdefiniowana jako nazwana eksportowana funkcja
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, subtitle, description, scrapedContent, chapterCount, lang } = body;
    const pl = lang === 'pl'; // język aplikacji; brak → traktujemy jak EN

    if (!title || title.trim() === '') {
      return NextResponse.json(
        { error: 'Brak tytułu e-booka' },
        { status: 400 }
      );
    }

    // ✅ NOWA LOGIKA: Pobierz klucz API użytkownika z fallback na env var
    const userId = session.user.id;
    // POBIERAMY ROLĘ UŻYTKOWNIKA Z SESJI
    const userRole = (session.user as any).role || 'free';
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
    // Spis tresci to szkielet calego ebooka — jedno wywolanie, ktore przesadza
    // o strukturze kilkudziesieciu rozdzialow. Idziemy na PREMIUM swiadomie.
    // Wczesniej porownywano z 'claude-3-sonnet' — identyfikatorem sprzed kilku
    // generacji — wiec warunek byl zawsze falszywy i TOC leial na modelu podstawowym.
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-opus-5';
    const modelToUse = PREMIUM_AI_MODEL;

    const userAiSettings = await getUserAiSettings(userId);

    console.log(`🤖 Używam modelu: ${modelToUse} (provider: ${userAiSettings.textAiProvider})`);
    console.log(`🔑 Źródło klucza API: ${keySource} ${keySource === 'user' ? '(klucz użytkownika)' : '(klucz systemowy)'}`);

    // Funkcja do budowania sekcji kontekstu ze źródeł
    const buildSourcesContext = (sources: ScrapedContent[]): string => {
      if (!sources || sources.length === 0) {
        return '';
      }

      let context = '\n\n=== ŹRÓDŁA REFERENCYJNE ===\n';
      context += 'Poniższe źródła naukowe powinny być uwzględnione przy generowaniu spisu treści:\n\n';

      sources.forEach((source, index) => {
        context += `ŹRÓDŁO ${index + 1}:\n`;
        context += `• Tytuł: ${source.title}\n`;
        context += `• URL: ${source.url}\n`;
        if (source.source) {
          context += `• Źródło: ${source.source}\n`;
        }
        context += `• Treść/Abstract: ${source.content}\n\n`;
      });

      context += '=== INSTRUKCJE DLA ŹRÓDEŁ ===\n';
      context += '• Przeanalizuj powyższe źródła i uwzględnij ich główne tematy w strukturze spisu treści\n';
      context += '• Jeśli źródła dotyczą badań naukowych, rozważ utworzenie rozdziałów o:\n';
      context += '  - Metodologii badań\n';
      context += '  - Wynikach i analizie\n';
      context += '  - Praktycznych zastosowaniach\n';
      context += '  - Przyszłych kierunkach badań\n';
      context += '• Zachowaj spójność z tematyką główną ebooka\n';
      context += '• Nie kopiuj dosłownie tytułów z źródeł, ale inspiruj się ich treścią\n\n';

      return context;
    };

    // Funkcja do budowania sekcji z opisem użytkownika
    const buildUserContext = (userDescription: string): string => {
      if (!userDescription || userDescription.trim() === '') {
        return '';
      }

      return `\n\n=== PREFERENCJE UŻYTKOWNIKA ===\n${userDescription.trim()}\n\n=== INSTRUKCJE DLA PREFERENCJI ===\n• Uwzględnij powyższe preferencje przy generowaniu struktury spisu treści\n• Dostosuj poziom szczegółowości do grupy docelowej\n• Zachowaj spójność ze stylem pisania preferowanym przez użytkownika\n• Priorytetyzuj tematy wskazane przez użytkownika\n\n`;
    };

    // Limity rozdziałów per rola — JEDNO źródło prawdy (współdzielone z frontem).
    const role = userRole.toLowerCase();
    const { min: minChapters, max: maxChapters } = getChapterLimits(role);

    // Liczba rozdziałów wskazana przez użytkownika (step 1), przycięta TWARDO do limitów
    // jego roli — egzekwujemy server-side, nie do obejścia z frontu. Brak/niepoprawna
    // wartość → domyślnie maksimum (zachowanie jak dotychczas, bez regresji).
    const requestedCount = Number(chapterCount);
    const targetChapters = Number.isFinite(requestedCount)
      ? Math.max(minChapters, Math.min(maxChapters, Math.round(requestedCount)))
      : maxChapters;

    // Przygotowanie rozszerzonego promptu
    let prompt = `Wygeneruj spis treści do e-booka o tytule: "${title}"`;

    if (subtitle) {
      prompt += `, podtytuł: "${subtitle}"`;
    }

    prompt += '.\n\n';

    // Dodaj kontekst użytkownika jeśli jest dostępny
    if (description && description.trim()) {
      prompt += buildUserContext(description);
    }

    // Dodaj kontekst ze źródeł jeśli są dostępne
    if (scrapedContent && Array.isArray(scrapedContent) && scrapedContent.length > 0) {
      prompt += buildSourcesContext(scrapedContent);
    }

    // Dodaj podstawowe instrukcje generowania
    prompt += `=== WYMAGANIA SPISU TREŚCI ===\n`;
    prompt += `• Spis treści musi zawierać DOKŁADNIE ${targetChapters} rozdziałów — nie mniej i nie więcej. To wymaganie jest bezwzględne.\n`;
    prompt += `• Rozdziały powinny być logicznie uporządkowane i tworzyć spójną całość\n`;
    prompt += `• Każdy rozdział powinien mieć konkretny, praktyczny cel\n`;

    if (subtitle) {
      prompt += `• Uwzględnij informacje z podtytułu przy generowaniu spisu treści\n`;
    }

    if (scrapedContent && Array.isArray(scrapedContent) && scrapedContent.length > 0) {
      prompt += `• Wykorzystaj wiedzę z ${scrapedContent.length} źródeł referencyjnych do stworzenia wartościowego spisu\n`;
      prompt += `• Jeśli źródła dotyczą badań naukowych, uwzględnij metodologię i wyniki\n`;
    }

    if (description && description.trim()) {
      prompt += `• Dostosuj strukturę do preferencji użytkownika podanych wyżej\n`;
    }

    // Język outputu = język aplikacji (pl/en). Wymuszamy wprost.
    prompt += `\n=== JĘZYK ===\n`;
    prompt += pl
      ? `Wszystkie tytuły rozdziałów napisz w języku POLSKIM.\n`
      : `Write all chapter titles in ENGLISH.\n`;

    // Instrukcje formatowania
    prompt += `\n=== FORMAT ODPOWIEDZI ===\n`;
    prompt += `Format odpowiedzi: lista w formacie JSON zawierająca DOKŁADNIE ${targetChapters} elementów, gdzie każdy element ma strukturę { "title": "Tytuł rozdziału" }.\n`;
    prompt += `Odpowiedź MUSI być tylko w formie JSON, bez dodatkowego tekstu.\n`;
    prompt += `Nie używaj w nazwach rozdziałów żadnej formy ich numerowania takich jak "rozdział 1: ..."\n`;
    prompt += `Tytuły rozdziałów powinny być konkretne i wartościowe dla czytelnika.\n\n`;

    // Przykład
    prompt += `Przykład formatu:\n`;
    prompt += `[\n`;
    prompt += `  { "title": "Wprowadzenie do tematu" },\n`;
    prompt += `  { "title": "Kluczowe zagadnienia i pojęcia" },\n`;
    prompt += `  { "title": "Praktyczne zastosowania" }\n`;
    prompt += `]`;

    // Bez 'temperature' — nowsza generacja odrzuca niedomyslne parametry samplingu (400).
    // max_tokens z zapasem: 24 rozdzialy to ~700 tokenow JSON-a, ale przy wlaczonym
    // mysleniu jego tokeny tez licza sie do limitu.
    const requestBody: AnthropicRequest = {
      model: modelToUse,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    console.log('Wysyłanie zapytania do Anthropic API...');
    console.log('Kontekst:', {
      title,
      subtitle: subtitle || 'brak',
      hasDescription: !!description,
      sourcesCount: scrapedContent?.length || 0,
      userRole: role,
      chapterLimit: `${minChapters}-${maxChapters}`,
      targetChapters,
      promptLength: prompt.length,
      model: modelToUse,
      keySource: keySource
    });
    // Prompt zawiera pelna tresc wszystkich zrodel (do 100 tys. znakow kazde),
    // wiec wypisywanie go w calosci zapychalo logi Railway i utrudnialo
    // znalezienie czegokolwiek innego. Zostaje poczatek — reszta jest w bazie.
    console.log(`=== PROMPT (${prompt.length} znakow), poczatek ===`);
    console.log(prompt.slice(0, 600) + (prompt.length > 600 ? '\n…[obciete]' : ''));

    // Wykonaj zapytanie do API Anthropic z kluczem użytkownika lub systemowym
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey, // ✅ ZMIANA: Używaj pobranego klucza
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(180_000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Błąd API Anthropic:', errorText);
      console.error(`Status: ${response.status}, klucz z: ${keySource}`);
      return NextResponse.json(
        { error: 'Błąd podczas generowania spisu treści' },
        { status: response.status }
      );
    }

    const responseData = await response.json();

    // Odczyt po TYPIE bloku, nie po indeksie — Opus 5 i nowsze moga zwrocic
    // blok 'thinking' na pozycji zerowej i wtedy .text jest undefined.
    const blocks = Array.isArray(responseData?.content) ? responseData.content : [];
    const tocContent: string = blocks
      .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
      .trim();

    if (!tocContent) {
      const types = blocks.map((b: any) => b?.type).join(', ') || 'brak blokow';
      console.error('❌ [generate-toc] brak bloku tekstowego. Typy:', types, 'stop_reason:', responseData?.stop_reason);
      return NextResponse.json(
        { error: 'Model nie zwrócił spisu treści. Spróbuj ponownie.' },
        { status: 500 }
      );
    }

    console.log('Otrzymano odpowiedź z Anthropic API, długość:', tocContent.length);

    // Przetwarzanie odpowiedzi - wycinamy tylko część JSON
    try {
      // Szukamy JSON w odpowiedzi - uwzględniamy różne formaty
      const jsonPatterns = [
        /\[[\s\S]*?\]/,  // Standardowy format
        /```json\s*([\s\S]*?)\s*```/,  // JSON w bloku kodu
        /```\s*([\s\S]*?)\s*```/,  // Blok kodu bez specyfikacji języka
      ];

      let jsonContent = '';
      for (const pattern of jsonPatterns) {
        const match = tocContent.match(pattern);
        if (match) {
          jsonContent = match[1] || match[0];
          break;
        }
      }

      // Jeśli nie znaleziono JSON, spróbuj wyciąć wszystko między pierwszym [ a ostatnim ]
      if (!jsonContent) {
        const startIndex = tocContent.indexOf('[');
        const endIndex = tocContent.lastIndexOf(']');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          jsonContent = tocContent.substring(startIndex, endIndex + 1);
        } else {
          jsonContent = tocContent;
        }
      }

      // Oczyszczenie treści JSON
      jsonContent = jsonContent.trim();

      console.log('Wyciągnięto JSON:', jsonContent.substring(0, 200) + '...');

      let tocItems = JSON.parse(jsonContent);

      // Walidacja struktury
      if (!Array.isArray(tocItems)) {
        throw new Error('Odpowiedź nie jest tablicą');
      }

      // Sprawdź czy każdy element ma wymagane właściwości
      for (const item of tocItems) {
        if (!item.title || typeof item.title !== 'string') {
          throw new Error('Nieprawidłowa struktura elementu spisu treści');
        }
      }

      // Zabezpieczenie końcowe: gdyby model zwrócił inną liczbę niż żądana, docinamy nadmiar.
      // (Nie dorabiamy brakujących — lepiej mniej niż wymyślone wypełniacze.)
      if (tocItems.length > targetChapters) {
        console.warn(`⚠️ Model zwrócił ${tocItems.length} rozdziałów, przycinam do ${targetChapters}`);
        tocItems = tocItems.slice(0, targetChapters);
      }

      // Dodajemy unikalne ID dla każdego elementu
      const tocItemsWithIds: TocItem[] = tocItems.map((item: any, index: number) => ({
        id: (index + 1).toString(),
        title: item.title.trim()
      }));

      console.log(`✅ Pomyślnie wygenerowano spis treści z ${tocItemsWithIds.length} rozdziałami (cel: ${targetChapters}, ${keySource})`);

      return NextResponse.json({
        tocItems: tocItemsWithIds,
        contextUsed: {
          hasDescription: !!description,
          sourcesCount: scrapedContent?.length || 0,
          hasSubtitle: !!subtitle,
          // ✅ NOWE: Informacja o użytym modelu i źródle klucza
          modelUsed: modelToUse,
          keySource: keySource,
          targetChapters
        }
      });

    } catch (parseError) {
      console.error('Błąd parsowania JSON:', parseError);
      console.error('Oryginalna odpowiedź:', tocContent);

      return NextResponse.json(
        {
          error: 'Nie udało się przetworzyć odpowiedzi API. Spróbuj ponownie.',
          details: parseError instanceof Error ? parseError.message : 'Nieznany błąd parsowania'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Błąd wewnętrzny serwera:', error);
    return NextResponse.json(
      {
        error: 'Błąd wewnętrzny serwera',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

// Obsługa innych metod HTTP
export async function GET() {
  return NextResponse.json(
    { error: 'Ta metoda nie jest obsługiwana. Użyj metody POST.' },
    { status: 405 }
  );
}