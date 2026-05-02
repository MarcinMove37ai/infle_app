// src/app/api/pages/new-ai-content/route.ts
//
// Generator treści strony zapisu — wersja 2.4 (production save).
//
// Sekcje wynikowe: hero, problem, promise, benefits, content, form, faq.
//
// ── ZMIANY vs v2.3 ──────────────────────────────────────────────────────────
//   • SAVE_TO_DB = true — zapis do nowych kolumn jsonb w page_contents
//   • Każda sekcja → osobna kolumna jsonb (atomic update friendly)
//   • Aktualizacja pages.headline z hero.headline_l1 + status='pending' + language
//
// ── WYMAGANIA WSTĘPNE ───────────────────────────────────────────────────────
//   Migracja schematu MUSI być wykonana PRZED uruchomieniem tego endpointu:
//     1. Podmień model `page_content` w schema.prisma na nowy
//     2. Uruchom migrację SQL (prisma/migrations/.../migration.sql)
//     3. Uruchom: npx prisma generate
//     4. Restart serwera
//
//   Bez migracji endpoint padnie na upsert z błędem Prisma o nieznanych polach.
// ────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const SAVE_TO_DB = true;
const SCHEMA_VERSION = 'v2';

// ---------------------------------------------------------------------------
// STAŁE
// ---------------------------------------------------------------------------

const ICON_WHITELIST = [
  'Target', 'Bell', 'Filter', 'Users', 'ListChecks', 'Calculator',
  'Shield', 'Zap', 'BookOpen', 'BrainCircuit', 'TrendingUp', 'Lightbulb',
  'Compass', 'Rocket', 'Database', 'Award',
] as const;

type IconName = typeof ICON_WHITELIST[number];

const WORD_LIMITS = {
  'hero.headline_l1': 12,
  'hero.headline_l2': 6,
  'hero.subheadline': 18,
  'hero.cta_primary': 5,
  'problem.headline': 8,
  'problem.intro': 40,
  'problem.summary': 25,
  'promise.label': 6,
  'promise.headline': 12,
  'promise.text': 60,
  'promise.outcomes': 16,  // pojedynczy outcome — z charakterem, ale bez kotwicy czasowej i dwukropków
  'benefits.headline': 6,
  'benefits.subheadline': 15,
  'content.headline': 6,
  'content.subheadline': 15,
  'form.headline': 12,
  'form.subheadline': 15,
  'form.cta': 5,
  'form.trust_line': 12,
  'faq.headline': 4,
  'pains.title': 12,
  'pains.text': 40,
  'benefits.items.title': 7,
  'benefits.items.text': 45,
  'content.items.title': 8,
  'content.items.text': 30,
  'faq.question': 25,
  'faq.answer': 60,
} as const;

// ---------------------------------------------------------------------------
// TYPY
// ---------------------------------------------------------------------------

interface AnthropicResponse {
  content: Array<{ text: string; type: string }>;
  id: string; model: string; role: string; type: string;
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface ParsedRawIntro {
  p1: string | null;
  p2: string | null;
  p3: string | null;
  ctas: string[];
}

interface PageContentJSON {
  pageContent: {
    hero: {
      headline_l1: string;
      headline_l2: string;
      subheadline: string;
      barriers: string[];
      cta_primary: string;
    };
    problem: {
      headline: string;
      intro: string;
      pains: Array<{ title: string; text: string }>;
      summary: string;
    };
    promise: {
      label: string;
      headline: string;
      text: string;
      outcomes: string[];
    };
    benefits: {
      headline: string;
      subheadline: string;
      items: Array<{ title: string; text: string; icon: IconName }>;
    };
    content: {
      headline: string;
      subheadline: string;
      items: Array<{ title: string; text: string }>;
    };
    form: {
      headline: string;
      subheadline: string;
      cta: string;
      trust_line: string;
    };
    faq: {
      headline: string;
      items: Array<{ question: string; answer: string }>;
    };
  };
}

type Language = 'pl' | 'en';

// ---------------------------------------------------------------------------
// FUNKCJE POMOCNICZE
// ---------------------------------------------------------------------------

function parseRawIntro(rawIntro: string | null | undefined): ParsedRawIntro | null {
  if (!rawIntro || typeof rawIntro !== 'string') return null;
  try {
    const parsed = JSON.parse(rawIntro);
    const ctas: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const v = parsed[`cta_${i}`];
      if (typeof v === 'string' && v.trim()) ctas.push(v.trim());
    }
    return {
      p1: parsed.p1 ?? null,
      p2: parsed.p2 ?? null,
      p3: parsed.p3 ?? null,
      ctas,
    };
  } catch {
    return null;
  }
}

async function callAnthropicAPI(
  apiKey: string,
  prompt: string,
  model: string,
): Promise<AnthropicResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    console.error('[new-ai-content] Anthropic error:', err);
    throw new Error(`API Anthropic zwróciło błąd: ${response.status}`);
  }
  return response.json();
}

function parseJSONFromResponse(responseText: string): {
  data: PageContentJSON;
  strategy: 'direct' | 'code-block' | 'brace-extraction' | 'comma-fix';
} {
  const text = responseText.trim();

  try {
    return { data: JSON.parse(text), strategy: 'direct' };
  } catch { /* try next */ }

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*)```/);
  if (codeBlockMatch?.[1]) {
    try {
      return { data: JSON.parse(codeBlockMatch[1].trim()), strategy: 'code-block' };
    } catch { /* try next */ }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.substring(firstBrace, lastBrace + 1);
    try {
      return { data: JSON.parse(candidate), strategy: 'brace-extraction' };
    } catch { /* try next */ }

    const fixed = candidate
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/,\s*,/g, ',');
    try {
      return { data: JSON.parse(fixed), strategy: 'comma-fix' };
    } catch { /* fall through */ }
  }

  throw new Error('Nie udało się sparsować JSON żadną z 4 strategii (direct/code-block/braces/comma-fix)');
}

function countWords(s: string | null | undefined): number {
  if (!s || typeof s !== 'string') return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function validatePageContent(data: PageContentJSON): { warnings: string[] } {
  const pc = data?.pageContent;
  if (!pc) throw new Error('Brak głównego klucza "pageContent" w odpowiedzi AI');

  if (!pc.hero?.headline_l1) throw new Error('Brak hero.headline_l1');
  if (!pc.hero?.headline_l2) throw new Error('Brak hero.headline_l2');
  if (!pc.hero?.subheadline) throw new Error('Brak hero.subheadline');
  if (!Array.isArray(pc.hero?.barriers) || pc.hero.barriers.length !== 3) {
    throw new Error(`hero.barriers musi mieć dokładnie 3 elementy (otrzymano ${pc.hero?.barriers?.length ?? 0})`);
  }

  if (!pc.problem?.headline) throw new Error('Brak problem.headline');
  if (!Array.isArray(pc.problem?.pains) || pc.problem.pains.length < 6) {
    throw new Error(`problem.pains musi mieć min 6 elementów (otrzymano ${pc.problem?.pains?.length ?? 0})`);
  }

  if (!pc.promise?.headline) throw new Error('Brak promise.headline');
  if (!Array.isArray(pc.promise?.outcomes) || pc.promise.outcomes.length !== 3) {
    throw new Error(`promise.outcomes musi mieć dokładnie 3 elementy (otrzymano ${pc.promise?.outcomes?.length ?? 0})`);
  }

  if (!Array.isArray(pc.benefits?.items) || pc.benefits.items.length < 6) {
    throw new Error(`benefits.items musi mieć min 6 elementów (otrzymano ${pc.benefits?.items?.length ?? 0})`);
  }
  const invalidIcons = pc.benefits.items
    .map((it, i) => ({ icon: it.icon, i }))
    .filter(x => !ICON_WHITELIST.includes(x.icon as IconName));
  if (invalidIcons.length > 0) {
    throw new Error(
      `Nieprawidłowe ikony w benefits.items: ${invalidIcons.map(x => `[${x.i}]=${x.icon}`).join(', ')}. ` +
      `Dozwolone: ${ICON_WHITELIST.join(', ')}`,
    );
  }

  if (!Array.isArray(pc.content?.items)) {
    throw new Error('content.items musi być tablicą');
  }
  if (pc.content.items.length !== 4) {
    throw new Error(`content.items musi mieć dokładnie 4 elementy (WIIFM milestones), otrzymano ${pc.content.items.length}`);
  }

  if (!pc.form?.headline || !pc.form?.cta) throw new Error('Brak form.headline lub form.cta');

  if (!Array.isArray(pc.faq?.items) || pc.faq.items.length < 7) {
    throw new Error(`faq.items musi mieć min 7 elementów (otrzymano ${pc.faq?.items?.length ?? 0})`);
  }

  const warnings: string[] = [];
  const checkLen = (path: string, value: string, key: keyof typeof WORD_LIMITS) => {
    const limit = WORD_LIMITS[key];
    const n = countWords(value);
    if (n > limit) warnings.push(`${path}: ${n} słów (limit ${limit})`);
  };

  checkLen('hero.headline_l1', pc.hero.headline_l1, 'hero.headline_l1');
  checkLen('hero.headline_l2', pc.hero.headline_l2, 'hero.headline_l2');
  checkLen('hero.subheadline', pc.hero.subheadline, 'hero.subheadline');
  checkLen('hero.cta_primary', pc.hero.cta_primary, 'hero.cta_primary');
  checkLen('problem.headline', pc.problem.headline, 'problem.headline');
  checkLen('problem.intro', pc.problem.intro, 'problem.intro');
  checkLen('problem.summary', pc.problem.summary, 'problem.summary');
  checkLen('promise.label', pc.promise.label, 'promise.label');
  checkLen('promise.headline', pc.promise.headline, 'promise.headline');
  checkLen('promise.text', pc.promise.text, 'promise.text');

  // Walidacja per-outcome — krótki, bez kotwicy czasowej, bez dwukropka
  pc.promise.outcomes.forEach((outcome, i) => {
    const path = `promise.outcomes[${i}]`;
    checkLen(path, outcome, 'promise.outcomes');
    if (outcome.includes(':')) {
      warnings.push(
        `${path}: zawiera dwukropek — outcomes powinny być pojedynczymi zdaniami bez "Label: opis"`,
      );
    }
  });
  checkLen('benefits.headline', pc.benefits.headline, 'benefits.headline');
  checkLen('benefits.subheadline', pc.benefits.subheadline ?? '', 'benefits.subheadline');
  checkLen('content.headline', pc.content.headline, 'content.headline');
  checkLen('content.subheadline', pc.content.subheadline ?? '', 'content.subheadline');
  checkLen('form.headline', pc.form.headline, 'form.headline');
  checkLen('form.subheadline', pc.form.subheadline ?? '', 'form.subheadline');
  checkLen('form.cta', pc.form.cta, 'form.cta');
  checkLen('form.trust_line', pc.form.trust_line ?? '', 'form.trust_line');
  checkLen('faq.headline', pc.faq.headline, 'faq.headline');

  pc.problem.pains.forEach((p, i) => {
    checkLen(`problem.pains[${i}].title`, p.title, 'pains.title');
    checkLen(`problem.pains[${i}].text`, p.text, 'pains.text');
  });
  pc.benefits.items.forEach((b, i) => {
    checkLen(`benefits.items[${i}].title`, b.title, 'benefits.items.title');
    checkLen(`benefits.items[${i}].text`, b.text, 'benefits.items.text');
  });
  pc.content.items.forEach((c, i) => {
    checkLen(`content.items[${i}].title`, c.title, 'content.items.title');
    checkLen(`content.items[${i}].text`, c.text, 'content.items.text');
  });
  pc.faq.items.forEach((f, i) => {
    checkLen(`faq.items[${i}].question`, f.question, 'faq.question');
    checkLen(`faq.items[${i}].answer`, f.answer, 'faq.answer');
  });

  return { warnings };
}

// ---------------------------------------------------------------------------
// PROMPT — bez zmian vs v2.3
// ---------------------------------------------------------------------------

function buildPrompt(args: {
  ebookTitle: string;
  ebookSubtitle: string | null;
  rawIntro: ParsedRawIntro | null;
  chaptersText: string;
  language: Language;
}): string {
  const { ebookTitle, ebookSubtitle, rawIntro, chaptersText, language } = args;
  const isEN = language === 'en';

  const langDirective = isEN
    ? `⚠️ CRITICAL: Generate ALL JSON field values in ENGLISH. Every single word must be in English. The chapter content may be in Polish — ignore that and write everything in English.`
    : `⚠️ KRYTYCZNE: Wszystkie wartości pól JSON generuj po POLSKU. Każde słowo musi być po polsku.`;

  const rules = isEN ? `
RULE 1 — RESULTS LANGUAGE, NOT PROCESS LANGUAGE
Never describe WHAT is in the e-book. Always say WHAT will change in the reader's life.
The "what changes" is universal — could be skill, peace of mind, money, relationships,
catch rate, fitness, freedom, status — adapt to the topic of THIS e-book.

RULE 2 — SEMANTIC SEPARATION OF "PROBLEM" vs "BENEFITS" vs "CONTENT/WIIFM"
Three different sections, three different perspectives:
  • PROBLEM section → PRESENT TENSE, you-perspective, PAIN
                      ("You spend hours on X with no results")
  • BENEFITS section → CONCRETE NOUN of what reader OWNS after reading + MECHANISM + RESULT
                      Could be a system, technique, framework, recipe, routine, map,
                      formula, checklist, sequence, tool — whatever fits this niche.
                      ("Method that does X — you achieve Y in Z time")
  • CONTENT section → 4 WIIFM milestones (What's In It For Me)
                      What the reader GETS for themselves in life — not features,
                      not process. The 4 angles of life-improvement.

  ❌ FORBIDDEN in benefits.items[].text — never start with present-tense pain phrasing
       like "Currently you...", "Right now you...", "You waste...", "Your team..."
       In BENEFITS the pain is already addressed above; here we describe what
       the reader OWNS after reading.

RULE 3 — TRANSFORMATION IN HEADLINE
Headline must show change: state BEFORE → state AFTER.

RULE 4 — PAIN NEGATIONS IN HERO BARRIERS
Three "Without..." bullets = specific real barriers/fears for THIS niche.
Pick three DIFFERENT dimensions of fear adequate to the topic — could be money,
time, skill, effort, social risk, complexity, prior failure, anything that
holds back the reader of THIS topic.

RULE 5 — CONCRETE TIME ANCHORS
  ✗ BAD: "quickly", "easily", "instantly"
  ✓ GOOD: "in your first session", "after the first chapter", "within a week",
          "on your next outing", "by the end of the day" — adapt to context

RULE 6 — FAQ = PSYCHOLOGICAL OBJECTIONS
FAQ answers "is it worth it?" and "can I do it?", not technical questions.

RULE 7 — WRITE TO ONE PERSON
Always "you", "your". Never "users", "readers", "people".

RULE 8 — ICONS FROM WHITELIST ONLY
benefits.items[].icon MUST be one of: ${ICON_WHITELIST.join(', ')}.
Pick the icon that semantically matches the benefit — works across topics
(Target=precision, Compass=direction, Award=quality, Lightbulb=insight, etc).

RULE 9 — TONAL CONSISTENCY LP ↔ EBOOK
The e-book intro (p1/p2/p3) was already written in a specific voice — direct,
warm, "knowledgeable friend" tone, no marketing buzzwords. Your LP output
MUST match that voice. The reader will see LP first, then download the e-book —
any tonal disconnect breaks trust immediately. Read p1/p2/p3 carefully and
mirror their register.

RULE 10 — SENTENCE CASE FOR hero.headline_l2
hero.headline_l2 is rendered as a stylized headline with color accent.
Use SENTENCE CASE: only the first word capitalized, rest lowercase
(except proper nouns). NOT Title Case.
  ✗ BAD: "Win Tenders On Autopilot" / "Catch More Fish Every Trip"
  ✓ GOOD: "Win tenders on autopilot" / "Catch more fish every trip"

RULE 11 — STRICT JSON OUTPUT
Return ONLY valid JSON inside a single \`\`\`json ... \`\`\` code block — nothing before, nothing after.
Do NOT use trailing commas. Use straight quotes (") not smart/curly quotes.
Escape any double quotes inside string values with backslash.
Make sure every opening brace/bracket has a matching closing one.
` : `
ZASADA 1 — JĘZYK REZULTATU, NIE PROCESU
Nigdy nie opisuj CO jest w e-booku. Zawsze mów CO się zmieni w życiu czytelnika.
"Co się zmieni" jest uniwersalne — może być umiejętność, spokój ducha, pieniądze,
relacje, skuteczność, kondycja, wolność, status — adaptuj pod tematykę TEGO e-booka.

ZASADA 2 — SEMANTYCZNE ROZDZIELENIE "PROBLEM" vs "BENEFITS" vs "CONTENT/WIIFM"
Trzy różne sekcje, trzy różne perspektywy:
  • Sekcja PROBLEM → CZAS TERAŹNIEJSZY, perspektywa "Ty", BÓL
                     ("Tracisz godziny na X bez efektów")
  • Sekcja BENEFITS → KONKRETNY RZECZOWNIK tego, co czytelnik MA po przeczytaniu
                     + MECHANIZM + REZULTAT. Może to być system, technika, framework,
                     przepis, rutyna, mapa, formuła, checklista, sekwencja, narzędzie
                     — cokolwiek pasuje do tej niszy.
                     ("Metoda która robi X — osiągasz Y w czasie Z")
  • Sekcja CONTENT → 4 milestone'y WIIFM (What's In It For Me)
                     Co czytelnik DOSTAJE dla siebie w życiu — nie ficzery, nie proces.
                     4 osie poprawy życia/sytuacji czytelnika.

  ❌ ZAKAZANE w benefits.items[].text — nigdy nie zaczynaj od sformułowań w czasie
       teraźniejszym opisujących ból, typu "Teraz...", "Obecnie...", "Tracisz...",
       "Twój zespół...". W BENEFITS ból został już przerobiony piętro wyżej —
       tu opisujesz CO CZYTELNIK MA po przeczytaniu.

ZASADA 3 — TRANSFORMACJA W NAGŁÓWKU
Headline musi pokazywać zmianę: stan przed → stan po.

ZASADA 4 — NEGACJE BÓLU W HERO BARRIERS
Trzy bullety "Bez ..." = konkretne, REALNE bariery/obawy dla TEJ niszy.
Wybierz trzy RÓŻNE wymiary obaw adekwatne do tematu — mogą to być pieniądze,
czas, umiejętności, wysiłek, ryzyko społeczne, złożoność, wcześniejsze
niepowodzenia, wszystko co blokuje czytelnika TEJ tematyki.

ZASADA 5 — KONKRETNE KOTWICE CZASOWE
  ✗ ŹLE: "szybko", "łatwo", "natychmiast"
  ✓ DOBRZE: "w pierwszej sesji", "po pierwszym rozdziale", "w ciągu tygodnia",
            "podczas najbliższego wyjazdu", "do końca dnia" — adaptuj do kontekstu

ZASADA 6 — FAQ = OBIEKCJE PSYCHOLOGICZNE
FAQ odpowiada na "czy warto?" i "czy dam radę?", nie na pytania techniczne.

ZASADA 7 — PISZ DO JEDNEJ OSOBY
Zawsze "Ty", "Twoje", "Tobie". Nigdy "użytkownicy", "czytelnicy", "ludzie".

ZASADA 8 — IKONY TYLKO Z WHITELISTY
benefits.items[].icon MUSI być jedną z: ${ICON_WHITELIST.join(', ')}.
Wybierz ikonę pasującą semantycznie do korzyści — działa cross-niszowo
(Target=precyzja, Compass=kierunek, Award=jakość, Lightbulb=wgląd, etc).

ZASADA 9 — TONALNA SPÓJNOŚĆ LP ↔ EBOOK
Intro e-booka (p1/p2/p3) napisane jest konkretnym głosem — bezpośrednim,
ciepłym, w tonie "kompetentny znajomy", bez marketingowych buzzwordów.
Twoje wyjście dla LP MUSI utrzymać ten głos. Czytelnik najpierw zobaczy LP,
potem pobierze ebook — każdy rozjazd tonalny zabija zaufanie natychmiast.
Przeczytaj uważnie p1/p2/p3 i naśladuj ich rejestr.

ZASADA 10 — SENTENCE CASE DLA hero.headline_l2
hero.headline_l2 jest renderowany jako stylizowany nagłówek z akcentem
kolorystycznym. Użyj SENTENCE CASE: tylko pierwsze słowo wielką literą,
reszta małą (chyba że nazwa własna). NIE Title Case.
  ✗ ŹLE: "Wygrywaj Przetargi Na Autopilocie" / "Łów Więcej Ryb Każdego Wyjazdu"
  ✓ DOBRZE: "Wygrywaj przetargi na autopilocie" / "Łów więcej ryb każdego wyjazdu"

ZASADA 11 — POPRAWNY JSON NA WYJŚCIU
Zwróć WYŁĄCZNIE poprawny JSON wewnątrz JEDNEGO bloku \`\`\`json ... \`\`\` — nic przed, nic po.
NIE używaj trailing comma (przecinka przed } lub ]). Używaj prostych cudzysłowów (")
nie typograficznych ("/"). Wewnątrz tekstu escape'uj cudzysłowy backslashem.
Upewnij się, że każdy { ma swój }, a każdy [ swój ] — JSON musi być kompletny.
`;

  const rawIntroBlock = (() => {
    if (!rawIntro || (!rawIntro.p1 && !rawIntro.p2 && !rawIntro.p3 && rawIntro.ctas.length === 0)) {
      return '';
    }
    const noteHeader = isEN ? 'E-BOOK INTRO NARRATIVE (use as primary source)'
                            : 'NARRACJA INTRO E-BOOKA (główne źródło)';
    const noteBody = isEN
      ? `[The intro narrative below was already crafted for this e-book.
It captures the reader's pain (p1), their actual desire (p2), and the e-book's
promise (p3), plus 5 micro-promise CTAs. This is your PRIMARY SOURCE for
PROBLEM and PROMISE sections — see the per-field instructions for exact mapping.
DO NOT copy verbatim — rewrite for LP context, but preserve voice and substance.]`
      : `[Poniższa narracja intro została już opracowana dla tego e-booka.
Opisuje ból czytelnika (p1), jego rzeczywiste pragnienie (p2), oraz obietnicę
e-booka (p3), plus 5 mikro-obietnic CTA. To jest GŁÓWNE ŹRÓDŁO dla sekcji
PROBLEM i PROMISE — zobacz instrukcje per-pole dla dokładnego mapowania.
NIE KOPIUJ dosłownie — przepisz pod kontekst LP, ale zachowaj głos i sens.]`;

    const ctaLabel = isEN ? 'Micro-promise CTAs (from ebook intro)'
                          : 'Mikro-obietnice CTA (z intro e-booka)';
    const ctaList = rawIntro.ctas.length
      ? rawIntro.ctas.map((c, i) => `  cta_${i + 1}: ${c}`).join('\n')
      : `  ${isEN ? '(none available)' : '(brak)'}`;

    return `
${noteHeader}
${noteBody}

  p1 (${isEN ? 'pain' : 'ból'}): ${rawIntro.p1 ?? '—'}
  p2 (${isEN ? 'desire' : 'pragnienie'}): ${rawIntro.p2 ?? '—'}
  p3 (${isEN ? 'promise' : 'obietnica'}): ${rawIntro.p3 ?? '—'}

${ctaLabel}:
${ctaList}
`;
  })();

  const fieldInstructions = isEN ? `
"hero.headline_l1"  (max 12 words)
  Strong transformation: state BEFORE → state AFTER. Active verb. Specific.
  Pattern: "Turn [state before] into [state after]" or "From X to Y in N units"

"hero.headline_l2"  (3-6 words, SENTENCE CASE — see Rule 10)
  Outcome statement — SHORT, punchy, accent-color word ready.
  Result-noun + mechanism-modifier. Avoid generic phrases ("Achieve Success").
  Pick wording adequate to the topic — keep it concrete and specific.

"hero.subheadline"  (max 18 words, ONE sentence — HARD LIMIT)
  The mechanism in plain words — what HAPPENS that delivers the headline.
  No "After reading..." prefix here (that goes in promise.label).
  Trim ruthlessly — 18 words is firm, not aspirational.

"hero.barriers"  (exactly 3 strings)
  Each starts with "Without..." — SPECIFIC, REAL barrier for this niche.
  Different dimensions — pick what holds back the reader of THIS topic.

"hero.cta_primary"  (max 5 words)
  Action-oriented button text. Concrete and verb-driven.
  If ebook intro CTAs are available (cta_1..cta_5), draw inspiration from them
  but render as a button label, not a full sentence.

"problem.headline"  (max 8 words)
  Hook for the section — question or statement that makes the reader nod.
  Adapt the format to the topic — could be a question, observation, or reframe.

"problem.intro"  (1-2 sentences, max 40 words)
  ⚙️ SOURCE: Inspired by p1 from ebook intro — but write a VIVID SCENE,
  not narrative summary. Sensory, concrete moment. Pick a setting adequate
  to the topic — could be a morning routine, a workout, a fishing trip, a meeting,
  whatever fits THIS reader's life.

"problem.pains[]"  (MIN 6, MAX 8 items)
  ⚙️ SOURCE: Distill p1 + chapters into 6-8 distinct pain axes.
  EACH item has TWO fields:
    - "title": one-line pain headline, max 12 words, specific situation/number
    - "text": 1-2 sentences expansion, max 40 words, present tense, you-perspective
  Each pain from a DIFFERENT axis. The axes themselves depend on the topic —
  could be time, money, missed opportunities, frustration, uncertainty,
  social pressure, physical fatigue, relationship strain, lack of progress —
  pick the 6-8 most relevant for THIS reader and topic.
  ❌ DO NOT REPEAT the same pain phrased differently.

"problem.summary"  (1 sentence, max 25 words)
  ⚙️ SOURCE: Synthesis of p1 in ONE punchy line. Names the core loss.
  This is the closing punch of the PROBLEM section before bridging to PROMISE.

"promise.label"  (eyebrow text, max 6 words)
  E.g. "After reading this e-book"

"promise.headline"  (max 12 words)
  ⚙️ SOURCE: Condensation of p3's main promise into one strong headline.
  Bridge from pain to solution. Active, what reader WILL HAVE / DO.

"promise.text"  (2-3 sentences, max 60 words)
  ⚙️ SOURCE: Rewrite of p3 in compressed form.
  Keep the "without X, without Y, without Z" refrain that p3 uses
  — echo barriers from hero. The "without X" content adapts to topic.

"promise.outcomes"  (exactly 3 strings, 12-16 words each — HARD LIMIT 16)
  ⚙️ SOURCE: Top 3 end-RESULTS the reader OWNS after finishing the e-book.
  Distill from p3 + cta_1..cta_5 — keep only the WHAT-YOU-GET, drop process.
  These are FULL, CHARACTERFUL statements — show texture and specificity,
  but stay punchy. Each outcome paints a vivid picture of the new reality.

  CRITICAL RULES:
    - 14-18 words each — enough room for character and specificity, but punchy
    - NO time anchors ("From tomorrow", "Within a week", "By end of season")
    - NO colons (":") — single statement, NOT "Label: description"
    - Each outcome = TANGIBLE END RESULT (not a step toward it)
    - Use second person ("You catch...", "You spend...", "You become...")
    - Each outcome from a different DIMENSION:
        capability / efficiency / identity / confidence / freedom
    - These are END EFFECTS, NOT THE PATH (the "content" section covers
      the journey — KEEP THESE TWO SECTIONS SEMANTICALLY DIFFERENT).

  ✅ GOOD: "You land cod on every Norwegian outing, even when the weather and tides keep shifting"
  ✅ GOOD: "You spend one evening planning instead of weeks of forum-scrolling and second-guessing yourself"
  ✅ GOOD: "You become the angler your friends consult before booking — the one with answers, not questions"
  ❌ BAD: "Next outing: you drop your line in the right spot..." (anchor + colon + too long)
  ❌ BAD: "Learn how to read fjord conditions" (this is a step, not a result)
  ❌ BAD: "Within a week: your catch rate climbs" (time anchor + colon)

"benefits.headline"  (max 6 words)
  Section title. Adapt to topic — "What you'll get", "What's in your hands after",
  "Tools you'll have", etc.

"benefits.subheadline"  (max 15 words)
  Sub-title — one line clarifying what the items below are.

"benefits.items[]"  (MIN 6, MAX 8 items)
  EACH item has THREE fields:
    - "title": CONCRETE THING the reader gets — a system, technique, framework,
              recipe, routine, map, formula, checklist, sequence, calculator,
              method, principle, or tool. Whatever the e-book actually delivers
              for THIS topic. Max 7 words. NOT a slogan or motivation.
    - "text": MECHANISM (how it works) + CONCRETE RESULT (what reader gets).
              2 sentences, max 45 words. ❌ FORBIDDEN — do not start with
              present-tense pain phrasing ("Currently...", "Right now...",
              "You waste..."). Pain belongs in PROBLEM section, above.
    - "icon": ONE name from ICON_WHITELIST that fits semantically.
  Each benefit from a DIFFERENT axis — pick what's most relevant for this topic.

"content.headline"  (max 6 words)
  Section title. Adapt to topic and tone. Examples: "What's inside",
  "What you'll get out of this", "Four things you walk away with".
  Pick wording that fits the e-book's voice.

"content.subheadline"  (max 15 words)
  Short intro to the 4 milestones below — what they collectively represent.

"content.items[]"  (EXACTLY 4 items — WIIFM milestones)
  ⚠️ THIS IS NOT A LIST OF CHAPTERS. It's 4 BENEFITS the reader gets for THEMSELVES,
  arranged as a logical progression of value (What's In It For Me).

  Each milestone = a DIFFERENT axis of personal benefit, ordered as a narrative.
  YOU decide how the progression flows — it could go from most tangible to most
  meaningful, from short-term to long-term, from physical to emotional, or any
  arc that fits the content. The dimensions of benefit themselves depend on the
  topic (could be time, peace of mind, skill, money, relationships, energy,
  freedom, status, capability, confidence — adapt to THIS e-book).

  EACH item has TWO fields:
    - "title" (max 8 words): the benefit phrased concretely, second-person
                             ("you have..." / "you stop..." / "you start...")
    - "text" (max 30 words): why this is good FOR YOU. Declarative.

  ❌ FORBIDDEN:
    - describing tools/features ("the algorithm does X", "the calculator shows Y",
      "the checklist contains Z") — that's BENEFITS, not WIIFM
    - describing the learning process ("you will learn...", "you will understand...",
      "you will discover...") — that's process, not WIIFM
    - describing the problem/pain — that's PROBLEM section
    - mapping to specific chapters — distill the whole content
    - repeating angles between milestones — each must be a different dimension

  ✅ CORRECT: declarative statement of what the reader GETS in their life
  (time, peace, certainty, money, connection, energy, freedom, status, skill —
  whatever fits THIS topic).

"form.headline"  (max 12 words)
  Imperative mood, last push before decision. End with exclamation mark.
  Echo the main promise.

"form.subheadline"  (max 15 words)
  Micro-encouragement under headline — what happens when they submit.
  Be honest — don't promise things that aren't true (e.g. don't say
  "no registration" if the form IS registration).

"form.cta"  (max 5 words)
  Button text. Outcome-focused, not "Submit".

"form.trust_line"  (max 12 words)
  Reassurance under button. Free / no spam / one-click unsubscribe / similar.

"faq.headline"  (max 4 words — HARD LIMIT)
  E.g. "Frequently asked questions" or "Questions before signing up"

"faq.items[]"  (MIN 7, MAX 9 items)
  EACH item:
    - "question": ONLY psychological objection, max 25 words.
                  What does the reader worry about at 2am before signing up?
                  Cover diverse angles — fit-for-me, prior failures, capability,
                  time, trust, payoff, applicability — pick what's most likely
                  to come up for THIS topic.
    - "answer": empathetic 3-part reply, max 60 words:
                (1) name the fear, (2) reframe it, (3) concrete reason to trust.
                Sound like a knowledgeable friend, not a marketer.
` : `
"hero.headline_l1"  (max 12 słów)
  Mocna transformacja: stan PRZED → stan PO. Aktywny czasownik. Konkret.
  Wzorzec: "Zamień [stan przed] w [stan po]" lub "Od X do Y w N jednostek"

"hero.headline_l2"  (3-6 słów, SENTENCE CASE — patrz Zasada 10)
  Outcome statement — KRÓTKI, mocny, gotowy pod akcent kolorystyczny.
  Rzeczownik-rezultatu + modyfikator-mechanizmu. Unikaj ogólników typu "Osiągnij Sukces".
  Dobierz słowa adekwatne do tematu — konkretne i specyficzne.

"hero.subheadline"  (max 18 słów, JEDNO zdanie — TWARDY LIMIT)
  Mechanizm prostymi słowami — co SIĘ DZIEJE, że dostarcza headline.
  BEZ prefiksu "Po przeczytaniu..." (to idzie w promise.label).
  Skracaj bezwzględnie — 18 słów to twarda granica, nie aspiracja.

"hero.barriers"  (dokładnie 3 stringi)
  Każdy zaczyna się od "Bez ..." — KONKRETNA, REALNA bariera dla TEJ niszy.
  Różne wymiary — wybierz co blokuje czytelnika TEJ tematyki.

"hero.cta_primary"  (max 5 słów)
  Tekst przycisku akcji. Konkretny, czasownikowy.
  Jeśli dostępne są CTA z intro e-booka (cta_1..cta_5), inspiruj się nimi —
  ale renderuj jako etykietę przycisku, nie pełne zdanie.

"problem.headline"  (max 8 słów)
  Hook sekcji — pytanie lub stwierdzenie zmuszające do skinięcia głową.
  Format dopasuj do tematu — może być pytanie, obserwacja, lub reframe.

"problem.intro"  (1-2 zdania, max 40 słów)
  ⚙️ ŹRÓDŁO: Inspirowane p1 z intro e-booka — ale napisz ŻYWĄ SCENĘ,
  nie streszczenie narracji. Zmysłowo, konkretny moment. Wybierz scenografię
  adekwatną do tematu — może być poranna rutyna, trening, wyjazd na ryby,
  spotkanie biznesowe, cokolwiek pasuje do życia TEGO czytelnika.

"problem.pains[]"  (MIN 6, MAX 8 elementów)
  ⚙️ ŹRÓDŁO: Destylacja p1 + rozdziałów na 6-8 odrębnych osi bólu.
  KAŻDY element ma DWA pola:
    - "title": jedno-zdaniowy nagłówek bólu, max 12 słów, konkretna sytuacja/liczba
    - "text": rozwinięcie 1-2 zdania, max 40 słów, czas teraźniejszy, perspektywa "Ty"
  Każdy ból z INNEJ osi. Same osie zależą od tematu — mogą to być czas, pieniądze,
  przegapione okazje, frustracja, niepewność, presja społeczna, zmęczenie fizyczne,
  napięcia w relacjach, brak postępu — wybierz 6-8 najbardziej istotnych dla
  TEGO czytelnika i tematu.
  ❌ NIE POWTARZAJ tego samego bólu sformułowanego inaczej.

"problem.summary"  (1 zdanie, max 25 słów)
  ⚙️ ŹRÓDŁO: Synteza p1 w JEDNĄ mocną linię. Nazywa rdzenną stratę.
  To jest puenta sekcji PROBLEM przed mostem do PROMISE.

"promise.label"  (eyebrow text, max 6 słów)
  Np. "Po przeczytaniu tego e-booka"

"promise.headline"  (max 12 słów)
  ⚙️ ŹRÓDŁO: Kondensacja głównej obietnicy z p3 w jeden mocny nagłówek.
  Most z bólu do rozwiązania. Aktywne, co czytelnik BĘDZIE MIAŁ / ROBIŁ.

"promise.text"  (2-3 zdania, max 60 słów)
  ⚙️ ŹRÓDŁO: Rewrite p3 w skondensowanej formie.
  Zachowaj refren "bez X, bez Y, bez Z" obecny w p3 — echo barier z hero.
  Treść "bez X" adaptuj do tematu.

"promise.outcomes"  (dokładnie 3 stringi, 12-16 słów każdy — TWARDY LIMIT 16)
  ⚙️ ŹRÓDŁO: Top 3 końcowe REZULTATY, które czytelnik MA po przeczytaniu e-booka.
  Destyluj z p3 + cta_1..cta_5 — zostaw tylko CO-DOSTAJESZ, odrzuć proces.
  To PEŁNE, CHARAKTERNE stwierdzenia — pokazują teksturę i konkret,
  ale wciąż mocno punktują. Każdy outcome maluje żywy obraz nowej rzeczywistości.

  KRYTYCZNE ZASADY:
    - 14-18 słów każde — dość miejsca na charakter i konkret, ale wciąż mocno
    - BRAK kotwicy czasowej ("Od jutra", "Za tydzień", "Do końca sezonu")
    - BRAK dwukropków (":") — pojedyncze zdanie, NIE "Label: opis"
    - Każdy outcome = NAMACALNY KOŃCOWY REZULTAT (nie krok do niego)
    - Druga osoba ("Łowisz...", "Spędzasz...", "Stajesz się...")
    - Każdy outcome z innego WYMIARU:
        zdolność / efektywność / tożsamość / pewność siebie / wolność
    - To są KOŃCOWE EFEKTY, NIE DROGA-DO-NICH (sekcja "content" pokaże drogę —
      DBAJ ŻEBY TE DWIE SEKCJE BYŁY SEMANTYCZNIE RÓŻNE).

  ✅ DOBRZE: "Łowisz dorsza na każdym wyjeździe do Norwegii, nawet gdy pogoda i przypływy ciągle się zmieniają"
  ✅ DOBRZE: "Spędzasz jeden wieczór na planowaniu zamiast tygodni przeszukiwania forów i wątpienia w siebie"
  ✅ DOBRZE: "Stajesz się tym wędkarzem, którego znajomi konsultują przed wyjazdem — tym z odpowiedziami, nie pytaniami"
  ❌ ŹLE: "Na najbliższym wyjeździe: zarzucasz w dobrym miejscu..." (kotwica + dwukropek + za długie)
  ❌ ŹLE: "Naucz się czytać warunki fjordu" (to jest krok, nie rezultat)
  ❌ ŹLE: "Za tydzień: Twoja skuteczność rośnie" (kotwica czasowa + dwukropek)

"benefits.headline"  (max 6 słów)
  Tytuł sekcji. Dopasuj do tematu — "Co dostaniesz", "Co masz w rękach po
  przeczytaniu", "Narzędzia, które będziesz mieć", etc.

"benefits.subheadline"  (max 15 słów)
  Pod-tytuł — jedna linia precyzująca, czym są elementy poniżej.

"benefits.items[]"  (MIN 6, MAX 8 elementów)
  KAŻDY element ma TRZY pola:
    - "title": KONKRETNA RZECZ, którą czytelnik dostaje — system, technika,
              framework, przepis, rutyna, mapa, formuła, checklista, sekwencja,
              kalkulator, metoda, zasada, narzędzie. Cokolwiek e-book faktycznie
              dostarcza dla TEGO tematu. Max 7 słów. NIE slogan ani motywacja.
    - "text": MECHANIZM (jak działa) + KONKRETNY REZULTAT (co czytelnik ma).
              2 zdania, max 45 słów. ❌ ZAKAZ — nie zaczynaj od sformułowań w
              czasie teraźniejszym opisujących ból ("Teraz...", "Obecnie...",
              "Tracisz..."). Ból należy do sekcji PROBLEM, powyżej.
    - "icon": JEDNA nazwa z ICON_WHITELIST, dopasowana semantycznie.
  Każdy benefit z INNEJ osi — wybierz co najbardziej istotne dla tego tematu.

"content.headline"  (max 6 słów)
  Tytuł sekcji. Dopasuj do tematu i tonu. Przykłady: "Co znajdziesz w środku",
  "Co Ci to da", "Cztery rzeczy, które dostaniesz".
  Wybierz brzmienie pasujące do głosu e-booka.

"content.subheadline"  (max 15 słów)
  Krótkie wprowadzenie do 4 milestone'ów poniżej — co wspólnie reprezentują.

"content.items[]"  (DOKŁADNIE 4 elementy — milestone'y WIIFM)
  ⚠️ TO NIE JEST SPIS ROZDZIAŁÓW. To 4 KORZYŚCI, które czytelnik dostaje
  dla SIEBIE, ułożone jako logiczna progresja wartości (What's In It For Me).

  Każdy milestone = INNA OŚ osobistej korzyści, ułożona jako narracja.
  TY decydujesz, jak progresja przebiega — może iść od bardziej namacalnej do
  bardziej znaczącej, od krótko- do długoterminowej, od fizycznej do emocjonalnej,
  lub jakkolwiek pasuje do treści. Same wymiary korzyści zależą od tematu
  (czas, spokój, umiejętność, pieniądze, relacje, energia, wolność, status,
  zdolność, pewność siebie — adaptuj do TEGO e-booka).

  KAŻDY element ma DWA pola:
    - "title" (max 8 słów): korzyść sformułowana konkretnie, druga osoba
                            ("masz...", "przestajesz...", "zaczynasz...")
    - "text" (max 30 słów): dlaczego to jest dla CIEBIE dobre. Deklaratywnie.

  ❌ ZAKAZY:
    - opisywanie narzędzi/ficzerów ("algorytm robi X", "kalkulator pokazuje Y",
      "checklista zawiera Z") — to są BENEFITS, nie WIIFM
    - opisywanie procesu nauki ("dowiesz się...", "zrozumiesz...", "nauczysz się...")
      — to proces, nie WIIFM
    - opisywanie problemu/bólu — to sekcja PROBLEM
    - mapowanie do konkretnych rozdziałów — destyluj całość treści
    - powtarzanie kątów między milestone'ami — każdy musi być innym wymiarem

  ✅ POPRAWNE: deklaratywne stwierdzenie tego, co czytelnik DOSTAJE w swoim życiu
  (czas, spokój, pewność, pieniądze, więzi, energia, wolność, status, umiejętność —
  cokolwiek pasuje do TEGO tematu).

"form.headline"  (max 12 słów)
  Tryb rozkazujący, ostatni impuls przed decyzją. Zakończ wykrzyknikiem.
  Echo głównej obietnicy.

"form.subheadline"  (max 15 słów)
  Mikro-zachęta pod headline — co się stanie po wysłaniu.
  Bądź uczciwy — nie obiecuj rzeczy, które nie są prawdą (np. nie pisz
  "bez rejestracji", skoro formularz JEST rejestracją).

"form.cta"  (max 5 słów)
  Tekst przycisku. Zorientowany na rezultat, nie "Wyślij".

"form.trust_line"  (max 12 słów)
  Zapewnienie pod przyciskiem. Bezpłatnie / bez spamu / wypisanie jednym
  kliknięciem / podobne.

"faq.headline"  (max 4 słowa — TWARDY LIMIT)
  Np. "Częste pytania" lub "Pytania przed pobraniem"

"faq.items[]"  (MIN 7, MAX 9 elementów)
  KAŻDY element:
    - "question": TYLKO obiekcja psychologiczna, max 25 słów.
                  O czym czytelnik martwi się o 2 w nocy przed zapisaniem się?
                  Pokryj różne kąty — czy to dla mnie, wcześniejsze niepowodzenia,
                  zdolność, czas, zaufanie, opłacalność, stosowalność — wybierz
                  najbardziej prawdopodobne dla TEGO tematu.
    - "answer": empatyczna 3-częściowa odpowiedź, max 60 słów:
                (1) nazwij obawę, (2) przeramuj, (3) konkretny powód do zaufania.
                Brzmij jak kompetentny znajomy, nie jak marketer.
`;

  const intro = isEN
    ? `You are an expert in conversion copywriting for landing pages.
Your task is to create content for a landing page for a free e-book.
The page has one goal: convince the reader to leave their email address in exchange for the e-book.

The e-book topic could be ANYTHING — business, hobby, health, relationships, finance,
craft, sport, parenting, cooking, gardening, technology, art, etc. Adapt your tone,
vocabulary, examples, and references to THIS specific e-book's topic and audience.

The page is structured in 7 sections (in this order on screen):
  1. HERO       — headline, sub-headline, 3 barriers, CTA button
  2. PROBLEM    — hook + scene + 6+ pains + summary  (PRESENT TENSE, pain-perspective)
  3. PROMISE    — bridge from pain to solution + 3 time-anchored outcomes
  4. BENEFITS   — 6+ concrete things the reader gets  (RESULT-perspective, NOT pain-perspective)
  5. CONTENT    — 4 WIIFM milestones (What's In It For Me — logical progression of personal benefits)
  6. FORM       — final push to convert
  7. FAQ        — 7+ psychological objections

The PROBLEM, BENEFITS, and CONTENT sections must be SEMANTICALLY DIFFERENT (see Rule 2).
The output voice must match the e-book intro voice (see Rule 9).`
    : `Jesteś ekspertem od copywritingu konwersyjnego dla stron zapisu (landing pages).
Twoim zadaniem jest stworzenie treści strony zapisu (landing page) dla bezpłatnego e-booka.
Strona ma jeden cel: przekonać czytelnika do zostawienia adresu e-mail w zamian za e-book.

Tematyka e-booka może być DOWOLNA — biznes, hobby, zdrowie, relacje, finanse,
rzemiosło, sport, rodzicielstwo, kuchnia, ogrodnictwo, technologia, sztuka, etc.
Dopasuj ton, słownictwo, przykłady i odwołania do specyfiki TEGO e-booka i jego odbiorcy.

Strona ma 7 sekcji (w tej kolejności na ekranie):
  1. HERO       — headline, sub-headline, 3 bariery "Bez...", przycisk CTA
  2. PROBLEM    — hook + scena + 6+ bólów + podsumowanie  (CZAS TERAŹNIEJSZY, perspektywa bólu)
  3. PROMISE    — most z bólu do rozwiązania + 3 outcomes z kotwicą czasową
  4. BENEFITS   — 6+ konkretnych rzeczy które czytelnik dostaje  (perspektywa REZULTATU, NIE bólu)
  5. CONTENT    — 4 milestone'y WIIFM (What's In It For Me — logiczna progresja osobistych korzyści)
  6. FORM       — ostatni impuls do konwersji
  7. FAQ        — 7+ obiekcji psychologicznych

Sekcje PROBLEM, BENEFITS i CONTENT muszą być SEMANTYCZNIE RÓŻNE (Zasada 2).
Głos wyjścia musi pasować do głosu intro e-booka (Zasada 9).`;

  const dataHeader   = isEN ? 'E-BOOK DATA'                     : 'DANE E-BOOKA';
  const titleLabel   = isEN ? 'Title'                            : 'Tytuł';
  const subLabel     = isEN ? 'Subtitle'                         : 'Podtytuł';
  const chapLabel    = isEN ? 'Chapter content (full — for distillation)'
                            : 'Treść rozdziałów (pełna — do destylacji)';
  const rulesHeader  = isEN ? 'COMMUNICATION RULES — READ CAREFULLY'
                            : 'ZASADY KOMUNIKACJI — PRZECZYTAJ UWAŻNIE';
  const instrHeader  = isEN ? 'INSTRUCTIONS PER FIELD'           : 'INSTRUKCJE DLA KAŻDEGO POLA';
  const jsonHeader   = isEN ? 'RETURN ONLY THIS JSON — NO OTHER WORDS'
                            : 'ZWRÓĆ TYLKO TEN JSON — ZERO INNYCH SŁÓW';

  const jsonTemplate = `{
  "pageContent": {
    "hero": {
      "headline_l1": "",
      "headline_l2": "",
      "subheadline": "",
      "barriers": ["", "", ""],
      "cta_primary": ""
    },
    "problem": {
      "headline": "",
      "intro": "",
      "pains": [
        { "title": "", "text": "" },
        { "title": "", "text": "" },
        { "title": "", "text": "" },
        { "title": "", "text": "" },
        { "title": "", "text": "" },
        { "title": "", "text": "" }
      ],
      "summary": ""
    },
    "promise": {
      "label": "",
      "headline": "",
      "text": "",
      "outcomes": ["", "", ""]
    },
    "benefits": {
      "headline": "",
      "subheadline": "",
      "items": [
        { "title": "", "text": "", "icon": "" },
        { "title": "", "text": "", "icon": "" },
        { "title": "", "text": "", "icon": "" },
        { "title": "", "text": "", "icon": "" },
        { "title": "", "text": "", "icon": "" },
        { "title": "", "text": "", "icon": "" }
      ]
    },
    "content": {
      "headline": "",
      "subheadline": "",
      "items": [
        { "title": "", "text": "" },
        { "title": "", "text": "" },
        { "title": "", "text": "" },
        { "title": "", "text": "" }
      ]
    },
    "form": {
      "headline": "",
      "subheadline": "",
      "cta": "",
      "trust_line": ""
    },
    "faq": {
      "headline": "",
      "items": [
        { "question": "", "answer": "" },
        { "question": "", "answer": "" },
        { "question": "", "answer": "" },
        { "question": "", "answer": "" },
        { "question": "", "answer": "" },
        { "question": "", "answer": "" },
        { "question": "", "answer": "" }
      ]
    }
  }
}`;

  return `
${langDirective}

${intro}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dataHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${titleLabel}: ${ebookTitle}
${ebookSubtitle ? `${subLabel}: ${ebookSubtitle}` : ''}
${rawIntroBlock}
${chapLabel}:
${chaptersText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rulesHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rules}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${instrHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fieldInstructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${jsonHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${jsonTemplate}

${langDirective}
`;
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
    }
    const userId = session.user.id;

    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-20250514';

    const body = await request.json();
    const { pageId, ebookId, language } = body;

    const lang: Language = language === 'en' ? 'en' : 'pl';

    if (!pageId)  return NextResponse.json({ error: 'Brak pageId.'  }, { status: 400 });
    if (!ebookId) return NextResponse.json({ error: 'Brak ebookId.' }, { status: 400 });

    const ebook = await prisma.ebooks.findUnique({
      where: { id: parseInt(ebookId) },
      include: { ebook_chapters: { orderBy: { position: 'asc' } } },
    });

    if (!ebook) {
      return NextResponse.json({ error: 'E-book nie istnieje.' }, { status: 404 });
    }
    if (ebook.userId !== userId && (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień do e-booka.' }, { status: 403 });
    }
    if (!ebook.ebook_chapters?.length) {
      return NextResponse.json({ error: 'E-book nie zawiera rozdziałów.' }, { status: 400 });
    }

    const chapterCount = ebook.ebook_chapters.length;

    const chaptersText = ebook.ebook_chapters
      .map(ch => `Chapter ${ch.position} — ${ch.title}\n${ch.content || ''}`)
      .join('\n\n')
      .substring(0, 200000);

    const rawIntro = parseRawIntro((ebook as any).raw_intro);

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'Brak klucza API.' }, { status: 500 });
    }

    console.log(
      `[new-ai-content] ebook=${ebookId} page=${pageId} lang=${lang} ` +
      `saveToDb=${SAVE_TO_DB} model=${PREMIUM_AI_MODEL} ` +
      `chapters=${chapterCount} hasRawIntro=${!!rawIntro} ` +
      `ctas=${rawIntro?.ctas.length ?? 0}`,
    );

    const prompt = buildPrompt({
      ebookTitle: ebook.title,
      ebookSubtitle: ebook.subtitle ?? null,
      rawIntro,
      chaptersText,
      language: lang,
    });

    const apiResponse = await callAnthropicAPI(anthropicApiKey, prompt, PREMIUM_AI_MODEL);

    if (!apiResponse.content?.length) {
      throw new Error('Pusta odpowiedź z AI.');
    }

    const rawText = apiResponse.content[0].text;
    const stopReason = apiResponse.stop_reason ?? 'unknown';
    const outputTokens = apiResponse.usage?.output_tokens ?? null;

    console.log(
      `[new-ai-content] AI response: ${rawText.length} chars, ` +
      `${outputTokens ?? '?'} output tokens, stop_reason=${stopReason}`,
    );

    let jsonContent: PageContentJSON;
    let parseStrategy: string;
    try {
      const result = parseJSONFromResponse(rawText);
      jsonContent = result.data;
      parseStrategy = result.strategy;
      if (parseStrategy !== 'direct') {
        console.warn(`[new-ai-content] Parser użył strategii fallback: ${parseStrategy}`);
      }
    } catch (parseError) {
      const errMsg = parseError instanceof Error ? parseError.message : 'Nieznany błąd parsowania';
      const head = rawText.substring(0, 400);
      const tail = rawText.substring(Math.max(0, rawText.length - 400));

      console.error('[new-ai-content] PARSE FAIL:', errMsg);
      console.error('[new-ai-content] stop_reason:', stopReason, 'output_tokens:', outputTokens);
      console.error('[new-ai-content] response head:\n', head);
      console.error('[new-ai-content] response tail:\n', tail);

      const isTruncation = stopReason === 'max_tokens';
      const hint = isTruncation
        ? 'Odpowiedź AI została UCIĘTA (stop_reason=max_tokens). Zwiększ max_tokens lub skróć prompt.'
        : 'AI zwróciło niepoprawny JSON. Sprawdź head/tail w logach serwera.';

      return NextResponse.json({
        error: errMsg,
        hint,
        debug: {
          stop_reason: stopReason,
          output_tokens: outputTokens,
          response_length_chars: rawText.length,
          response_head: head,
          response_tail: tail,
        },
      }, { status: 500 });
    }

    const { warnings } = validatePageContent(jsonContent);

    // ─── SAVE_TO_DB = false → tylko preview ──────────────────────────────────
    if (!SAVE_TO_DB) {
      return NextResponse.json({
        success: true,
        preview: true,
        saveToDb: false,
        ebookId: ebook.id,
        ebookTitle: ebook.title,
        pageId,
        language: lang,
        model: PREMIUM_AI_MODEL,
        hasRawIntro: !!rawIntro,
        ctaCount: rawIntro?.ctas.length ?? 0,
        chapterCount,
        parseStrategy,
        stopReason,
        outputTokens,
        warnings,
        generatedContent: jsonContent,
      });
    }

    // ─── SAVE_TO_DB = true → upsert do nowych kolumn jsonb ──────────────────
    const pc = jsonContent.pageContent;

    const sectionData = {
      hero:     pc.hero     as Prisma.InputJsonValue,
      problem:  pc.problem  as Prisma.InputJsonValue,
      promise:  pc.promise  as Prisma.InputJsonValue,
      benefits: pc.benefits as Prisma.InputJsonValue,
      content:  pc.content  as Prisma.InputJsonValue,
      form:     pc.form     as Prisma.InputJsonValue,
      faq:      pc.faq      as Prisma.InputJsonValue,
    };

    const pageContent = await prisma.page_content.upsert({
      where: { pageId },
      create: {
        pageId,
        userId,
        ebookId: parseInt(ebookId),
        schema_version: SCHEMA_VERSION,
        ...sectionData,
      },
      update: {
        ...sectionData,
        schema_version: SCHEMA_VERSION,
        updatedAt: new Date(),
      },
    });

    // Aktualizacja statusu strony + headline z hero.headline_l1
    const page = await prisma.pages.findUnique({ where: { id: pageId } });
    await prisma.pages.update({
      where: { id: pageId },
      data: {
        status: 'pending',
        headline: pc.hero?.headline_l1 ?? page?.headline,
        language: lang,
      },
    });

    return NextResponse.json({
      success: true,
      preview: false,
      saveToDb: true,
      ebookId: ebook.id,
      pageId,
      language: lang,
      model: PREMIUM_AI_MODEL,
      pageContentId: pageContent.id,
      schemaVersion: SCHEMA_VERSION,
      hasRawIntro: !!rawIntro,
      ctaCount: rawIntro?.ctas.length ?? 0,
      chapterCount,
      parseStrategy,
      stopReason,
      outputTokens,
      warnings,
    }, { status: 201 });

  } catch (error) {
    console.error('[new-ai-content] Błąd:', error);
    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — ping / status
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/pages/new-ai-content',
    version: 'v2.4-production',
    saveToDb: SAVE_TO_DB,
    schema_version: SCHEMA_VERSION,
    sections: ['hero', 'problem', 'promise', 'benefits', 'content', 'form', 'faq'],
    db_columns: {
      page_contents: ['hero', 'problem', 'promise', 'benefits', 'content', 'form', 'faq', 'schema_version'],
    },
    constraints: {
      'hero.barriers': 'exactly 3',
      'problem.pains': 'min 6, max 8',
      'promise.outcomes': 'exactly 3',
      'benefits.items': 'min 6, max 8',
      'content.items': 'exactly 4 (WIIFM milestones)',
      'faq.items': 'min 7, max 9',
    },
    api: {
      max_tokens: 16000,
      parser_strategies: ['direct', 'code-block', 'brace-extraction', 'comma-fix'],
    },
    iconWhitelist: ICON_WHITELIST,
  });
}