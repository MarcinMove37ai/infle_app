// src/app/api/pages/new-ai-content/route.ts
//
// Nowy generator treści strony zapisu — lepsza komunikacja wg DNA inflee.app.
// Stary endpoint /api/pages/ai-content pozostaje nienaruszony.
//
// ─── FLAGA TRYBU ────────────────────────────────────────────────────────────
// SAVE_TO_DB = false  →  tryb preview, zwraca JSON bez zapisu (do testów)
// SAVE_TO_DB = true   →  zapis do bazy (włączyć gdy DB będzie gotowa na nowe pola)
// ────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const SAVE_TO_DB = true;

// ---------------------------------------------------------------------------
// TYPY
// ---------------------------------------------------------------------------

interface AnthropicResponse {
  content: Array<{ text: string; type: string }>;
  id: string; model: string; role: string; type: string;
}

// Testimonials celowo pominięte
interface PageContentJSON {
  pageContent: {
    hero: {
      headline: string;       // Transformacja — stan przed → stan po
      subheadline: string;    // "Po przeczytaniu..." — konkretny rezultat
      description: string;    // "Zdanie.||Bez X||Bez Y||Bez Z" — lead + 3 bariery
    };
    benefits: {
      items: Array<{ title: string; text: string }>;
    };
    content: {
      chapters: Array<{ title: string; description: string }>;
    };
    form: { title: string };
    faq: {
      items: Array<{ question: string; answer: string }>;
    };
  };
}

type Language = 'pl' | 'en';

// ---------------------------------------------------------------------------
// FUNKCJE POMOCNICZE
// ---------------------------------------------------------------------------

async function callAnthropicAPI(
  apiKey: string,
  prompt: string,
  model: string
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
      max_tokens: 4000,
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

function parseJSONFromResponse(responseText: string): PageContentJSON {
  try {
    return JSON.parse(responseText.trim());
  } catch {
    const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      try { return JSON.parse(match[1].trim()); }
      catch { throw new Error('Nie udało się sparsować JSON z bloku kodu'); }
    }
    throw new Error('Nie udało się wyodrębnić poprawnego JSON z odpowiedzi');
  }
}

// Spłaszczenie do formatu DB — testimonials celowo pominięte
function flattenPageContent(
  jsonContent: PageContentJSON
): Record<string, string | null> {
  const f: Record<string, string | null> = {};
  const pc = jsonContent.pageContent;

  if (pc?.hero) {
    f.hero_headline    = pc.hero.headline    || null;
    f.hero_subheadline = pc.hero.subheadline || null;
    f.hero_description = pc.hero.description || null;
  }

  if (pc?.benefits?.items) {
    pc.benefits.items.slice(0, 4).forEach((item, i) => {
      f[`benefits_item_${i}_title`] = item.title || null;
      f[`benefits_item_${i}_text`]  = item.text  || null;
    });
  }

  if (pc?.content?.chapters) {
    pc.content.chapters.slice(0, 3).forEach((ch, i) => {
      f[`content_chapter_${i}_title`]       = ch.title       || null;
      f[`content_chapter_${i}_description`] = ch.description || null;
    });
  }

  if (pc?.form) {
    f.form_title = pc.form.title || null;
  }

  if (pc?.faq?.items) {
    pc.faq.items.slice(0, 3).forEach((item, i) => {
      f[`faq_item_${i}_question`] = item.question || null;
      f[`faq_item_${i}_answer`]   = item.answer   || null;
    });
  }

  return f;
}

// ---------------------------------------------------------------------------
// PROMPT — dwie wersje językowe
// ---------------------------------------------------------------------------

function buildPrompt(
  ebookTitle: string,
  ebookSubtitle: string | null,
  chaptersText: string,
  language: Language
): string {
  const isEN = language === 'en';

  // Dyrektywa języka outputu — zawsze na początku, niezależnie od języka rozdziałów
  const langDirective = isEN
    ? `⚠️ CRITICAL: Generate ALL JSON field values in ENGLISH. Every single word must be in English. The chapter content may be in Polish — ignore that and write everything in English.`
    : `⚠️ KRYTYCZNE: Wszystkie wartości pól JSON generuj po POLSKU. Każde słowo musi być po polsku.`;

  const rules = isEN ? `
RULE 1 — LANGUAGE OF RESULTS, NOT PROCESS
Never describe WHAT is in the e-book. Always say WHAT will change in the reader's life.
  ✗ BAD: "You will learn the basics of portrait photography"
  ✓ GOOD: "You will stop taking blurry photos that end up in the trash"

RULE 2 — TRANSFORMATION IN THE HEADLINE
Headline must show change: state BEFORE → state AFTER.
  ✗ BAD: "A complete guide to photography"
  ✓ GOOD: "Turn ordinary photos into shots that stop the scroll"

RULE 3 — PAIN NEGATIONS IN HERO
Three bullets = negations of the reader's biggest fears. Specific to the niche.
  ✗ BAD: "No specialist knowledge required"
  ✓ GOOD: "Without buying new equipment worth thousands of dollars"

RULE 4 — CONCRETE TIME ANCHORS
  ✗ BAD: "quickly", "easily", "instantly"
  ✓ GOOD: "in your first session", "after the first chapter", "within a week"

RULE 5 — PSYCHOLOGICAL OBJECTIONS IN FAQ
FAQ answers "is it worth it?" and "can I do it?", not technical questions.
  ✗ BAD: "What format is the e-book in?"
  ✓ GOOD: "Does this work if I'm just starting out and have no results yet?"

RULE 6 — WRITE TO ONE PERSON
Always "you", "your". Never "users", "readers", "people".
` : `
ZASADA 1 — JĘZYK REZULTATU, NIE PROCESU
Nigdy nie opisuj CO jest w e-booku. Zawsze mów CO się zmieni w życiu czytelnika.
  ✗ ŹLE: "Poznasz podstawy fotografii portretowej"
  ✓ DOBRZE: "Skończysz z rozmytymi zdjęciami które lądują w koszu"

ZASADA 2 — TRANSFORMACJA W NAGŁÓWKU
Headline musi pokazywać zmianę: stan przed → stan po.
  ✗ ŹLE: "Kompletny przewodnik po fotografii"
  ✓ DOBRZE: "Zamień zwykłe zdjęcia w kadry które zatrzymują wzrok"

ZASADA 3 — NEGACJE BÓLU W HERO
Trzy bullety = negacje największych obaw czytelnika. Konkretne dla niszy.
  ✗ ŹLE: "Bez specjalistycznej wiedzy"
  ✓ DOBRZE: "Bez kupowania drogiego sprzętu za kilka tysięcy złotych"

ZASADA 4 — KONKRETNE KOTWICE CZASOWE
  ✗ ŹLE: "szybko", "łatwo", "natychmiast"
  ✓ DOBRZE: "w pierwszej sesji", "po pierwszym rozdziale", "w ciągu tygodnia"

ZASADA 5 — OBIEKCJE PSYCHOLOGICZNE W FAQ
FAQ odpowiada na "czy warto?" i "czy dam radę?", nie na pytania techniczne.
  ✗ ŹLE: "W jakim formacie jest e-book?"
  ✓ DOBRZE: "Czy to działa też jeśli dopiero zaczynam i nie mam żadnych wyników?"

ZASADA 6 — PISZ DO JEDNEJ OSOBY
Zawsze "Ty", "Twoje", "Tobie". Nigdy "użytkownicy", "czytelnicy".
`;

  const fieldInstructions = isEN ? `
"hero.headline"
  One strong headline (max 10 words): state BEFORE → state AFTER.
  Active verb. To one person. Make the transformation vivid and specific.
  EXAMPLE STRUCTURE: "Turn [state before] into [state after]"

"hero.subheadline"
  Start with "After reading" + concrete measurable result (max 15 words).
  Something the reader will FEEL or NOTICE in their life — specific, not vague.
  EXAMPLE: "After reading you will have a working lead system that runs while you sleep"

"hero.description"
  MANDATORY FORMAT with || separator:
  "[Two sentences: reader's pain + promise of what changes]||[Without specific barrier 1]||[Without specific barrier 2]||[Without specific barrier 3]"
  - Opening: 2 sentences, describe the frustration the reader feels right now, then the transformation this e-book delivers
  - Each "Without..." must be a SPECIFIC, REAL barrier for this niche — not generic
  EXAMPLE: "You're losing potential clients every day because you don't have time or budget for marketing. This e-book shows you how AI delivers a steady flow of leads — without hiring anyone.||Without spending thousands on marketing agencies||Without any copywriting or design skills||Without hours of creating content from scratch"

"benefits.items[0-3].title"
  Final result, NOT chapter topic. Max 6 words.
  Pattern: "Stop X" / "Start Y" / "Gain Z" / "Never again X"

"benefits.items[0-3].text"
  Three sentences, max 50 words:
  1. The specific pain the reader has RIGHT NOW
  2. What changes after reading this e-book — concretely
  3. How the e-book makes it possible — the mechanism in plain words

"content.chapters[0-2].title"
  Short clear chapter title (max 7 words). Can adapt the original.

"content.chapters[0-2].description"
  Start with "You will learn" or "You will discover" + CONCRETE promise (max 20 words).
  Describe what the reader TAKES AWAY, not what the chapter "covers" or "discusses".
  Be specific — mention a concrete outcome or technique.
  EXAMPLE: "You will learn how to describe your business in 3 sentences that make ideal clients reach out first"

"form.title"
  The last push before they decide. Echo the main promise in imperative mood.
  Max 10 words. End with exclamation mark. Make it feel urgent and personal.

"faq.items[0-2].question"
  ONLY psychological objections specific to this niche.
  Think: what does someone worry about at 2am before deciding to download this?
  Examples: "Will this work if my business is very niche?", "I've tried lead gen before and it didn't work — why would this be different?"
  Never: "What format?", "When will I receive it?", "Is it free?"

"faq.items[0-2].answer"
  Empathetic response in 3 parts: (1) name the fear, (2) reframe it, (3) give a concrete reason to trust.
  Max 50 words. Sound like a knowledgeable friend, not a marketer.
` : `
"hero.headline"
  Jeden mocny nagłówek (max 10 słów): stan PRZED → stan PO.
  Aktywny czasownik. Do jednej osoby. Transformacja musi być żywa i konkretna.
  PRZYKŁAD STRUKTURY: "Zamień [stan przed] w [stan po]"

"hero.subheadline"
  Zacznij od "Po przeczytaniu" + konkretny mierzalny rezultat (max 15 słów).
  Co czytelnik POCZUJE lub ZAUWAŻY — specyficznie, nie ogólnikowo.
  PRZYKŁAD: "Po przeczytaniu będziesz mieć gotowy lejek który przyciąga klientów bez Twojego udziału"

"hero.description"
  FORMAT OBOWIĄZKOWY z separatorem ||:
  "[Dwa zdania: ból czytelnika teraz + obietnica co się zmieni]||[Bez konkretnej bariery 1]||[Bez konkretnej bariery 2]||[Bez konkretnej bariery 3]"
  - Część wstępna: 2 zdania — opisz frustrację którą czytelnik TERAZ czuje, potem transformację którą daje e-book
  - Każdy "Bez..." to KONKRETNA, REALNA bariera dla tej niszy — nie generyczna
  PRZYKŁAD: "Codziennie tracisz potencjalnych klientów bo nie masz czasu ani budżetu na marketing. Ten e-book pokazuje jak AI zapewni stały napływ leadów — bez zatrudniania specjalistów.||Bez wydawania tysięcy na agencje marketingowe||Bez znajomości copywritingu czy grafiki||Bez godzin spędzonych na tworzeniu treści od zera"

"benefits.items[0-3].title"
  Rezultat końcowy, NIE temat rozdziału. Max 6 słów.
  Wzorzec: "Skończysz z X" / "Zaczniesz Y" / "Zyskasz Z" / "Nigdy więcej X"

"benefits.items[0-3].text"
  Trzy zdania, max 50 słów:
  1. Konkretny ból który czytelnik MA TERAZ
  2. Co się zmieni po przeczytaniu e-booka — konkretnie
  3. Jak e-book to umożliwia — mechanizm prostymi słowami

"content.chapters[0-2].title"
  Krótki jasny tytuł rozdziału (max 7 słów). Możesz zaadaptować oryginał.

"content.chapters[0-2].description"
  Zacznij od "Dowiesz się" lub "Odkryjesz" + KONKRETNA obietnica (max 20 słów).
  Co czytelnik WYNIESIE, nie co rozdział "omawia" czy "porównuje".
  Bądź konkretny — wspomnij o konkretnym efekcie lub technice.
  PRZYKŁAD: "Dowiesz się jak opisać biznes w 3 zdaniach które sprawiają że idealni klienci sami do Ciebie piszą"

"form.title"
  Ostatni impuls przed decyzją. Echo głównej obietnicy w trybie rozkazującym.
  Max 10 słów. Zakończ wykrzyknikiem. Musi brzmieć pilnie i osobiście.

"faq.items[0-2].question"
  TYLKO obiekcje psychologiczne specyficzne dla tej niszy.
  Pomyśl: o czym ktoś martwi się o 2 w nocy przed pobraniem tego e-booka?
  Przykłady: "Próbowałem już różnych sposobów na leady i nic nie działało — czemu to miałoby być inne?", "Czy to zadziała jeśli prowadzę bardzo niszowy biznes?"
  Nigdy: "W jakim formacie?", "Kiedy dostanę?", "Czy to bezpłatne?"

"faq.items[0-2].answer"
  Empatyczna odpowiedź w 3 częściach: (1) nazwij obawę, (2) przeramuj ją, (3) daj konkretny powód do zaufania.
  Max 50 słów. Brzmij jak kompetentny znajomy, nie jak marketer.
`;

  const intro = isEN
    ? `You are an expert in conversion copywriting for small businesses and freelancers.
Your task is to create content for a landing page for a free e-book.
The page has one goal: convince the reader to leave their email address in exchange for the e-book.`
    : `Jesteś ekspertem od copywritingu konwersyjnego dla polskich małych biznesów i freelancerów.
Twoim zadaniem jest stworzenie treści strony zapisu (landing page) dla bezpłatnego e-booka.
Strona ma jeden cel: przekonać czytelnika do zostawienia adresu e-mail w zamian za e-book.`;

  const dataHeader  = isEN ? 'E-BOOK DATA'           : 'DANE E-BOOKA';
  const titleLabel  = isEN ? 'Title'                  : 'Tytuł';
  const subLabel    = isEN ? 'Subtitle'               : 'Podtytuł';
  const chapLabel   = isEN ? 'Chapter content'        : 'Treść rozdziałów';
  const rulesHeader = isEN ? 'COMMUNICATION RULES'    : 'ZASADY KOMUNIKACJI — PRZECZYTAJ UWAŻNIE';
  const instrHeader = isEN ? 'INSTRUCTIONS PER FIELD' : 'INSTRUKCJE DLA KAŻDEGO POLA';
  const jsonHeader  = isEN ? 'RETURN ONLY THIS JSON — NO OTHER WORDS' : 'ZWRÓĆ TYLKO TEN JSON — ZERO INNYCH SŁÓW';

  return `
${langDirective}

${intro}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dataHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${titleLabel}: ${ebookTitle}
${ebookSubtitle ? `${subLabel}: ${ebookSubtitle}` : ''}

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

{
  "pageContent": {
    "hero": {
      "headline": "",
      "subheadline": "",
      "description": ""
    },
    "benefits": {
      "items": [
        { "title": "", "text": "" },
        { "title": "", "text": "" },
        { "title": "", "text": "" },
        { "title": "", "text": "" }
      ]
    },
    "content": {
      "chapters": [
        { "title": "", "description": "" },
        { "title": "", "description": "" },
        { "title": "", "description": "" }
      ]
    },
    "form": { "title": "" },
    "faq": {
      "items": [
        { "question": "", "answer": "" },
        { "question": "", "answer": "" },
        { "question": "", "answer": "" }
      ]
    }
  }
}

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

    // Język: 'pl' domyślnie, akceptujemy 'en'
    const lang: Language = language === 'en' ? 'en' : 'pl';

    if (!pageId)  return NextResponse.json({ error: 'Brak pageId.'  }, { status: 400 });
    if (!ebookId) return NextResponse.json({ error: 'Brak ebookId.' }, { status: 400 });

    // Weryfikacja e-booka i uprawnień
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

    const chaptersText = ebook.ebook_chapters
      .map(ch => `Chapter ${ch.position} — ${ch.title}\n${ch.content || ''}`)
      .join('\n\n')
      .substring(0, 200000);

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'Brak klucza API.' }, { status: 500 });
    }

    console.log(`[new-ai-content] ebook=${ebookId} page=${pageId} lang=${lang} saveToDb=${SAVE_TO_DB} model=${PREMIUM_AI_MODEL}`);

    const prompt = buildPrompt(ebook.title, ebook.subtitle ?? null, chaptersText, lang);
    const apiResponse = await callAnthropicAPI(anthropicApiKey, prompt, PREMIUM_AI_MODEL);

    if (!apiResponse.content?.length) {
      throw new Error('Pusta odpowiedź z AI.');
    }

    const jsonContent = parseJSONFromResponse(apiResponse.content[0].text);

    // ─── SAVE_TO_DB = false → tylko preview ──────────────────────────────────
    if (!SAVE_TO_DB) {
      return NextResponse.json({
        success: true,
        preview: true,
        saveToDb: false,
        ebookTitle: ebook.title,
        language: lang,
        model: PREMIUM_AI_MODEL,
        generatedContent: jsonContent,
      });
    }

    // ─── SAVE_TO_DB = true → zapis do bazy ───────────────────────────────────

    const flattenedContent = flattenPageContent(jsonContent);

    const pageContent = await prisma.page_content.upsert({
      where: { pageId },
      create: { pageId, userId, ebookId: parseInt(ebookId), ...flattenedContent },
      update: { ...flattenedContent, updatedAt: new Date() },
    });

    // Aktualizacja statusu strony
    const page = await prisma.pages.findUnique({ where: { id: pageId } });
    await prisma.pages.update({
      where: { id: pageId },
      data: {
        status: 'pending',
        headline: flattenedContent.hero_headline ?? page?.headline,
        language: lang,
      },
    });

    return NextResponse.json({
      success: true,
      preview: false,
      saveToDb: true,
      language: lang,
      model: PREMIUM_AI_MODEL,
      pageContentId: pageContent.id,
      fieldsGenerated: Object.keys(flattenedContent).length,
    }, { status: 201 });

  } catch (error) {
    console.error('[new-ai-content] Błąd:', error);
    const msg = error instanceof Error ? error.message : 'Nieznany błąd';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — ping
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/pages/new-ai-content',
    saveToDb: SAVE_TO_DB,
    mode: SAVE_TO_DB ? 'zapis do DB aktywny' : 'preview — nie zapisuje do DB',
  });
}