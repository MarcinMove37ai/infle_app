// src/lib/anthropic.ts
//
// Jedno miejsce, przez ktore rozmawiamy z Anthropic API.
// Powstalo, bo ten sam zestaw bledow powtarzal sie w kilku endpointach:
//
//   1. Odczyt `content[0].text` — Opus 5 i nowsze maja rozszerzone myslenie
//      wlaczone domyslnie i moga zwrocic blok 'thinking' na pozycji zerowej.
//      Wtedy `.text` jest undefined i cala sciezka wywala sie TypeError-em.
//      Tutaj filtrujemy bloki po TYPIE i sklejamy wszystkie tekstowe.
//
//   2. `temperature` (i inne parametry samplingu) — nowsza generacja odrzuca
//      wartosci niedomyslne i zwraca 400. Nie wysylamy ich w ogole.
//
//   3. Brak timeoutu — zadanie moglo wisiec bez ograniczenia.
//
//   4. Ponawianie bylo tylko w dwoch endpointach (wlasne fetchWithRetry),
//      a brakowalo go tam, gdzie generujemy rozdzialy rownolegle — czyli
//      dokladnie tam, gdzie zerwane polaczenie boli najbardziej.
//
// Kazdy nowy endpoint ma wolac `callAnthropic` zamiast pisac wlasny fetch.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Modele czytane z ENV przy KAZDYM wywolaniu (funkcje, nie stale) — dzieki temu
 * podmiana zmiennej na Railway dziala bez przebudowy.
 * Fallbacki to biezaca generacja; docelowe wartosci ustawia srodowisko.
 */
export const basicModel = () => process.env.BASIC_AI_MODEL || 'claude-haiku-4-5-20251001';
export const premiumModel = () => process.env.PREMIUM_AI_MODEL || 'claude-opus-5';

export interface AnthropicCallOptions {
  apiKey: string;
  model: string;
  prompt: string;
  maxTokens: number;
  timeoutMs?: number;
  /** Ile prob LACZNIE (1 = bez ponawiania). Domyslnie 3. */
  maxAttempts?: number;
  /** Etykieta do logow, np. 'generate-toc'. */
  label?: string;
}

export interface AnthropicResult {
  text: string;
  usage: any;
  model: string;
  /** Ktora proba sie powiodla — przydatne do diagnozy. */
  attempts: number;
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

/** Odczyt po TYPIE bloku, nie po indeksie — patrz punkt 1 w naglowku. */
function extractText(data: any): string {
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n')
    .trim();
}

/**
 * Ponawiamy tylko to, co ma szanse zadzialac za drugim razem:
 * bledy polaczenia, limit zadan (429) i awarie po stronie API (5xx).
 * Bledu 400 (zly model, zly parametr) ponawianie nie naprawi — lepiej
 * dostac go od razu niz po trzech probach i kilku sekundach czekania.
 */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callAnthropic(opts: AnthropicCallOptions): Promise<AnthropicResult> {
  const {
    apiKey,
    model,
    prompt,
    maxTokens,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    label = 'anthropic',
  } = opts;

  let lastError: AnthropicError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now();

    try {
      const response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        // Swiadomie BEZ 'temperature' — patrz punkt 2 w naglowku.
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const err = new AnthropicError(
          `Anthropic API ${response.status}`,
          response.status,
          detail.slice(0, 500),
        );

        if (!isRetryable(response.status) || attempt === maxAttempts) {
          console.error(`❌ [${label}] Anthropic ${response.status}:`, detail.slice(0, 500));
          throw err;
        }

        lastError = err;
        const backoff = 1000 * 2 ** (attempt - 1);
        console.warn(
          `⚠️ [${label}] proba ${attempt}/${maxAttempts} — status ${response.status}, ponawiam za ${backoff}ms`,
        );
        await sleep(backoff);
        continue;
      }

      const data = await response.json();
      const text = extractText(data);

      if (!text) {
        const types = (Array.isArray(data?.content) ? data.content : [])
          .map((b: any) => b?.type)
          .join(', ');
        console.error(
          `❌ [${label}] brak bloku tekstowego. Typy: ${types || 'brak'}, stop_reason: ${data?.stop_reason}`,
        );
        throw new AnthropicError('Model nie zwrócił treści.', 500);
      }

      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `✅ [${label}] ${model} → ${text.length} znakow w ${seconds}s (proba ${attempt}/${maxAttempts})`,
        data?.usage ?? {},
      );
      return { text, usage: data?.usage ?? null, model, attempts: attempt };
    } catch (e) {
      // Bledy, ktore sami rzucilismy wyzej, przepuszczamy bez ponawiania.
      if (e instanceof AnthropicError) throw e;

      const isTimeout = e instanceof Error && e.name === 'TimeoutError';
      const err = new AnthropicError(
        isTimeout ? 'Model nie odpowiedział w wyznaczonym czasie.' : 'Nie udało się połączyć z API Anthropic.',
        isTimeout ? 504 : 502,
        e instanceof Error ? e.message : String(e),
      );

      if (attempt === maxAttempts) {
        console.error(`❌ [${label}] polaczenie nieudane po ${maxAttempts} probach:`, e);
        throw err;
      }

      lastError = err;
      const backoff = 1000 * 2 ** (attempt - 1);
      console.warn(
        `⚠️ [${label}] proba ${attempt}/${maxAttempts} — ${err.detail}, ponawiam za ${backoff}ms`,
      );
      await sleep(backoff);
    }
  }

  // Nieosiagalne, ale TypeScript musi widziec zwrot na kazdej sciezce.
  throw lastError ?? new AnthropicError('Nieznany błąd wywołania Anthropic.', 500);
}