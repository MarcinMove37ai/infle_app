// src/app/api/summarize-content/route.ts
// Skracanie tresci zrodla przez AI.
//
// Wybor modelu zalezy WYLACZNIE od docelowej dlugosci — decyduje serwer, nie front:
//   • do 5 000 znakow  → BASIC_AI_MODEL   (Haiku)
//   • powyzej 5 000    → PREMIUM_AI_MODEL (Opus)
//
// Jezyk podsumowania = jezyk interfejsu uzytkownika, niezaleznie od jezyka zrodla.

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getApiKeyForEndpoint } from '@/lib/user-api-keys';
import { getMaxSummaryLength } from '@/lib/planLimits';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Powyzej tej dlugosci schodzimy na model premium. */
const PREMIUM_THRESHOLD = 5000;

/** Twarde granice wejscia — niezalezne od planu. */
const MIN_TARGET = 100;
const MAX_TARGET = 10000;
const MIN_CONTENT = 100;

/** Timeout wywolania Anthropic (ms). Dlugie zrodla + Opus potrafia trwac. */
const API_TIMEOUT_MS = 180_000;

interface SummarizeRequest {
  content: string;
  targetLength: number;
  title: string;
  sourceType: 'web' | 'pdf';
  sourceUrl?: string;
  /** Jezyk interfejsu ('pl' | 'en'). Decyduje o jezyku podsumowania. */
  lang?: string;
}

// ── Prompt ──────────────────────────────────────────────────────────────────
//
// Swiadomie KROTKI. Poprzednia wersja w polowie skladala sie z instrukcji typu
// "POLICZ ZNAKI PRZED WYSLANIEM" — modele operuja na tokenach i znakow policzyc
// nie potrafia, wiec te zdania nie dzialaly, a kosztowaly tokeny w kazdym zadaniu.
// Dlugosc traktujemy jako cel przyblizony i weryfikujemy ja po stronie serwera.
function buildSummaryPrompt(
  content: string,
  targetLength: number,
  title: string,
  sourceType: 'web' | 'pdf',
  outputLanguage: string,
): string {
  const min = Math.max(MIN_TARGET, Math.round(targetLength * 0.9));
  const max = Math.round(targetLength * 1.1);

  return `You are condensing a source document so it can be used as background context for writing an ebook.

=== SOURCE ===
Title: ${title}
Type: ${sourceType === 'web' ? 'web page' : 'PDF document'}
Original length: ${content.length} characters

=== TASK ===
Write a summary of roughly ${targetLength} characters (anything between ${min} and ${max} is fine).

=== LANGUAGE ===
Write the summary in ${outputLanguage}, regardless of the language of the source material. Translate the substance rather than transliterating phrases.

=== WHAT TO KEEP ===
- Concrete facts: figures, dates, names, standards, model numbers, technical parameters.
- The logical structure and ordering of the original.
- Terminology the source itself uses, when an equivalent exists in ${outputLanguage}.

=== WHAT TO LEAVE OUT ===
- Your own commentary, evaluation or interpretation.
- Navigation text, cookie notices, calls to action and other page furniture.
- Any heading or lead-in such as "Summary:" — begin directly with the substance.

=== SOURCE CONTENT ===
${content}`;
}

/**
 * Odczyt odpowiedzi po TYPIE bloku, nie po indeksie.
 * Nowsze modele (Opus 5 i pozniejsze) maja rozszerzone myslenie wlaczone domyslnie
 * i moga zwrocic blok 'thinking' na pozycji zerowej — wtedy content[0].text jest
 * undefined i cala sciezka sie wywala.
 */
function extractText(data: any): string {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n')
    .trim();
}

export async function POST(request: NextRequest) {
  let pl = false; // jezyk komunikatow bledu; ustalany po sparsowaniu body

  try {
    // 1. Sesja
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You must be signed in to use this feature.' }, { status: 401 });
    }

    // 2. Body
    let body: SummarizeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const { content, targetLength, title, sourceType, lang } = body;
    pl = lang === 'pl';

    // 3. Walidacja wejscia
    if (!content || !targetLength || !title) {
      return NextResponse.json(
        { error: pl ? 'Wymagane: treść, długość docelowa i tytuł.' : 'Required: content, target length and title.' },
        { status: 400 },
      );
    }

    if (content.length < MIN_CONTENT) {
      return NextResponse.json(
        {
          error: pl
            ? `Treść jest za krótka do skrócenia (minimum ${MIN_CONTENT} znaków).`
            : `Content is too short to summarize (minimum ${MIN_CONTENT} characters).`,
        },
        { status: 400 },
      );
    }

    if (targetLength < MIN_TARGET || targetLength > MAX_TARGET) {
      return NextResponse.json(
        {
          error: pl
            ? `Długość docelowa musi mieścić się między ${MIN_TARGET} a ${MAX_TARGET} znaków.`
            : `Target length must be between ${MIN_TARGET} and ${MAX_TARGET} characters.`,
        },
        { status: 400 },
      );
    }

    // 4. Egzekucja planu PO STRONIE SERWERA.
    //    Wczesniej limit pilnowal wylacznie front, wiec zwyklym zadaniem HTTP
    //    dalo sie ominac ograniczenia planu.
    const role = (session.user as any).role as string | undefined;
    const maxForPlan = getMaxSummaryLength(role);
    if (targetLength > maxForPlan) {
      return NextResponse.json(
        {
          error: pl
            ? `Twój plan pozwala skracać do ${maxForPlan} znaków.`
            : `Your plan allows summaries up to ${maxForPlan} characters.`,
        },
        { status: 403 },
      );
    }

    // 5. Klucz API
    const { apiKey, source: keySource } = await getApiKeyForEndpoint(
      session.user.id,
      'anthropic',
      'ANTHROPIC_API_KEY',
    );
    if (!apiKey) {
      return NextResponse.json(
        { error: pl ? 'Brak konfiguracji klucza API Anthropic.' : 'Anthropic API key is not configured.' },
        { status: 500 },
      );
    }

    // 6. Model — wylacznie wg dlugosci docelowej.
    //    Fallbacki to biezaca generacja; wlasciwe wartosci ustawia srodowisko.
    const BASIC_AI_MODEL = process.env.BASIC_AI_MODEL || 'claude-haiku-4-5-20251001';
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-opus-5';
    const modelToUse = targetLength > PREMIUM_THRESHOLD ? PREMIUM_AI_MODEL : BASIC_AI_MODEL;

    const outputLanguage = pl ? 'Polish' : 'English';
    const prompt = buildSummaryPrompt(content, targetLength, title, sourceType, outputLanguage);

    console.log('✂️ [summarize-content]', {
      originalLength: content.length,
      targetLength,
      tier: targetLength > PREMIUM_THRESHOLD ? 'premium' : 'basic',
      model: modelToUse,
      outputLanguage,
      keySource,
      promptLength: prompt.length,
    });

    // 7. Wywolanie Anthropic.
    //    Bez 'temperature' — nowsza generacja odrzuca niedomyslne parametry
    //    samplingu i zwraca 400.
    //    max_tokens liczymy ze ZNAKOW na TOKENY (~2 znaki/token to bezpieczny
    //    zapas dla polskiego); poprzednio podstawiano znaki wprost jako tokeny.
    const maxTokens = Math.min(16000, Math.max(1024, Math.ceil(targetLength / 2)));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelToUse,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ [summarize-content] Anthropic ${response.status}:`, errorText.slice(0, 500));
      return NextResponse.json(
        {
          error: pl
            ? `Błąd podczas skracania treści (${response.status}).`
            : `Summarization failed (${response.status}).`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    const summary = extractText(data);

    if (!summary) {
      const types = (Array.isArray(data?.content) ? data.content : []).map((b: any) => b?.type).join(', ');
      console.error('❌ [summarize-content] brak bloku tekstowego. Typy:', types || 'brak', 'stop_reason:', data?.stop_reason);
      return NextResponse.json(
        { error: pl ? 'Model nie zwrócił podsumowania.' : 'The model returned no summary.' },
        { status: 500 },
      );
    }

    // 8. Kontrola dlugosci — na serwerze, nie w prompcie.
    //    Na razie tylko sygnalizujemy odchylenie w logach; jesli okaze sie czeste,
    //    kolejnym krokiem jest jedno ponowienie z korekta.
    const min = Math.max(MIN_TARGET, Math.round(targetLength * 0.9));
    const max = Math.round(targetLength * 1.1);
    if (summary.length < min || summary.length > max) {
      console.warn(
        `⚠️ [summarize-content] dlugosc poza zakresem: ${summary.length} (cel ${targetLength}, zakres ${min}-${max}, model ${modelToUse})`,
      );
    }

    const compressionRatio = summary.length / content.length;
    if (summary.length >= content.length) {
      console.warn('⚠️ [summarize-content] podsumowanie nie jest krotsze od oryginalu');
    }

    console.log(
      `✅ [summarize-content] ${content.length} → ${summary.length} znakow (${(compressionRatio * 100).toFixed(1)}%)`,
      data?.usage ?? {},
    );

    return NextResponse.json({
      success: true,
      summary,
      originalLength: content.length,
      summaryLength: summary.length,
      compressionRatio,
      modelUsed: modelToUse,
      keySource,
      tokensUsed: data?.usage || null,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    console.error('❌ [summarize-content] failed:', error);
    return NextResponse.json(
      {
        error: isTimeout
          ? (pl ? 'Skracanie trwało zbyt długo. Spróbuj ponownie.' : 'Summarization timed out. Please try again.')
          : (pl ? 'Wewnętrzny błąd serwera podczas skracania.' : 'Internal server error while summarizing.'),
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST.' }, { status: 405 });
}