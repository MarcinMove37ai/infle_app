// src/app/api/anthropic/generate-cover-prompt/route.ts
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint } from '@/lib/user-api-keys';

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

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  timeout: number = 30000
): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempt ${attempt}/${maxRetries}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error.message);
      if (attempt === maxRetries) throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      const delay = 1000 * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unexpected retry loop exit');
}

export async function POST(request: Request) {
  const isInternalRequest = request.headers.get('x-internal-request') === 'true';

  if (!isInternalRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
  }

  console.log('🎨 === COVER PROMPT GENERATOR (Nano Banana Pro) ===');

  try {
    const body = await request.json();
    const { title, subtitle, intro } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Wymagany tytuł ebooka.' },
        { status: 400 }
      );
    }

    if (!intro || intro.trim().length === 0) {
      return NextResponse.json(
        { error: 'Brak treści wstępu (pole intro jest puste).' },
        { status: 400 }
      );
    }

    // Pobierz klucz Anthropic
    let anthropicApiKey: string | null = null;

    if (!isInternalRequest) {
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;
      if (userId) {
        const { apiKey } = await getApiKeyForEndpoint(userId, 'anthropic', 'ANTHROPIC_API_KEY');
        anthropicApiKey = apiKey;
      }
    } else {
      anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? null;
    }

    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: 'Brak klucza API Anthropic' },
        { status: 500 }
      );
    }

    const BASIC_AI_MODEL = process.env.BASIC_AI_MODEL || 'claude-haiku-4-5';

    // Przytnij intro do rozsądnej długości (model graficzny nie potrzebuje więcej)
    const introExcerpt = intro.trim().substring(0, 1500);

    const prompt = `Jesteś ekspertem w tworzeniu promptów dla modeli generowania obrazów AI, specjalizującym się w okładkach książek.

Stwórz szczegółowy prompt dla modelu Gemini 3 Pro Image (Nano Banana Pro), który wygeneruje KOMPLETNĄ, gotową okładkę ebooka — z tytułem i podtytułem wkomponowanymi bezpośrednio w grafikę.

DANE EBOOKA:
- Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}

WSTĘP DO EBOOKA (na podstawie którego określ tematykę i nastrój okładki):
${introExcerpt}

---

INSTRUKCJE TWORZENIA PROMPTU:

**Format wyjściowy obrazu:**
- Wymiary: format 3:4 (pionowy — standardowy format okładki książki)
- Rozdzielczość: 2K
- Wynik ma być finalną, drukowaną okładką — nie szkicem

**Tekst na okładce (OBOWIĄZKOWY):**
- TYTUŁ: "${title}" — umieszczony wyraźnie, czytelnie, w górnej lub centralnej części okładki
${subtitle ? `- PODTYTUŁ: "${subtitle}" — umieszczony w DOLNEJ części okładki, mniejszą czcionką, z wyraźnym odstępem od tytułu (nie bezpośrednio pod nim)` : ''}
- Podaj konkretny styl fontu (np. "bold serif font", "elegant sans-serif", "handwritten style")
- Określ kolor tekstu tak, aby kontrastował z tłem
- Tekst ma być integralną częścią kompozycji, nie naklejką

**Kompozycja wizualna:**
- Stwórz spójną kompozycję graficzną nawiązującą do tematyki wstępu
- Określ główny motyw wizualny, kolorystykę, nastrój i styl (np. fotograficzny, ilustracyjny, abstrakcyjny)
- Okładka ma wyglądać profesjonalnie i marketingowo atrakcyjnie
- Cała powierzchnia powinna być wypełniona — brak pustych margingesów
- Tytuł zajmuje górną część okładki, podtytuł dolną — między nimi przestrzeń wypełniona grafiką
- ZERO marginesów, ZERO obramowań, ZERO paddingu — grafika zaczyna się od absolutnej krawędzi obrazu
- Tło i elementy graficzne muszą dosięgać każdego piksela przy krawędzi — bez żadnych ciemnych obwódek ani ramek
- Nie dodawaj efektu "okładki książki w 3D" ani cienia sugerującego ramkę

**Długość promptu:** około 300-500 słów, w języku angielskim.

Napisz TYLKO gotowy prompt (bez komentarzy, nagłówków ani wyjaśnień):
Zawsze zaczynaj od: "Create a ..." bez prefiksu w formie "PROMPT: "`;

    const requestBody: AnthropicRequest = {
      model: BASIC_AI_MODEL,
      max_tokens: 1000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    };

    console.log(`📤 Wysyłanie do Claude (${BASIC_AI_MODEL})...`);
    console.log('📤 REQUEST TO ANTHROPIC:', JSON.stringify(requestBody, null, 2));
    const response = await fetchWithRetry(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      },
      3,
      30000
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Błąd Anthropic API:`, errorText);
      return NextResponse.json({ error: `Błąd generowania promptu: ${errorText}` }, { status: response.status });
    }

    const responseData = await response.json();
    let coverPrompt = responseData.content[0].text.trim();

    // Usuń ewentualne cudzysłowy okalające
    coverPrompt = coverPrompt.replace(/^#+\s*PROMPT:?\s*/i, '').trim();
    coverPrompt = coverPrompt.replace(/^['"]+|['"]+$/g, '').trim();

    console.log(`✅ Prompt wygenerowany (${coverPrompt.length} znaków)`);
    console.log(`🔍 Preview: ${coverPrompt.substring(0, 150)}...`);

    return NextResponse.json({
      success: true,
      coverPrompt,
      promptLength: coverPrompt.length,
      targetModel: 'gemini-3-pro-image-preview',
      sourceField: 'intro',
    });

  } catch (error) {
    console.error('❌ Błąd generowania promptu okładki:', error);
    return NextResponse.json({
      error: 'Błąd wewnętrzny serwera',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}