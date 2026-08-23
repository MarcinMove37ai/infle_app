// src/app/api/admin/generate-seeds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getApiKeyForEndpoint } from '@/lib/user-api-keys';

export const runtime = 'nodejs';

// ── Typy wejścia/wyjścia ────────────────────────────────────────────────────
interface Seed {
  title: string;
  subtitle: string;
  description: string;
}

// Zagregowany kontekst twórcy, którym karmimy LLM.
interface CreatorContext {
  handle?: string;
  fullName?: string;
  bio?: string;
  followers?: number | null;
  posts: string[];            // captiony (IG)
  webContent: string[];       // treści ze stron (scrape)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// Wyciąga username z handla ('@nick') lub URL instagrama.
function extractIgUsername(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // @handle
  if (trimmed.startsWith('@')) return trimmed.slice(1).replace(/\/+$/, '');
  // URL instagrama
  const m = trimmed.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  if (m && m[1]) return m[1].replace(/\/+$/, '');
  // goły nick (bez spacji, sensowna długość)
  if (/^[a-zA-Z0-9._]{1,40}$/.test(trimmed)) return trimmed;
  return null;
}

// Normalizuje URL (dodaje https:// jeśli brak).
function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// Czy wejście to link/handle LinkedIn.
function isLinkedInInput(input: string): boolean {
  return /linkedin\.com\/in\//i.test(input.trim());
}

// Pozyskuje kontekst z LinkedIn (profil zawodowy) — best-effort.
async function fetchLinkedInContext(
  baseUrl: string,
  cookie: string,
  liInput: string,
): Promise<Partial<CreatorContext>> {
  const url = normalizeUrl(liInput.trim());
  const ctx: Partial<CreatorContext> = { posts: [] };
  try {
    const profile = await internalFetch(baseUrl, '/api/linkedin-profile', { url }, cookie);
    if (profile?.exist) {
      ctx.fullName = profile.full_name || undefined;
      ctx.followers = profile.followers ?? profile.connections ?? null;
      // Z LinkedIna budujemy "bio" z roli zawodowej — to nasz materiał dla LLM.
      const bioParts = [
        profile.headline,
        profile.jobTitle && profile.companyName ? `${profile.jobTitle} at ${profile.companyName}` : profile.jobTitle,
        profile.location ? `Location: ${profile.location}` : '',
        profile.topSkills ? `Skills: ${profile.topSkills}` : '',
        profile.about || profile.raw_data?.meta_description || '',
      ].filter((p): p is string => !!p && p.trim().length > 0);
      ctx.bio = bioParts.join('. ');
    }
  } catch (e) {
    console.warn('⚠️ [generate-seeds] linkedin-profile failed:', (e as Error).message);
  }
  return ctx;
}

// Bazowy URL do wewnętrznych wywołań (te same maszyny/instancja).
function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  const host = request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  return host ? `${proto}://${host}` : 'http://localhost:3000';
}

// Wewnętrzny fetch z przekazaniem ciasteczka sesji (auth dla endpointów chronionych).
async function internalFetch(baseUrl: string, path: string, body: any, cookie: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Wykrycie języka tekstu (proste, heurystyka po polskich znakach/słowach).
// Używane TYLKO jako sygnał; właściwy język bierzemy z lang (app language) z body.
function looksPolish(text: string): boolean {
  if (!text) return false;
  const plChars = (text.match(/[ąćęłńóśźż]/gi) || []).length;
  const plWords = (text.match(/\b(jak|dla|nie|jest|oraz|twoje|twój|się|że|aby|przez)\b/gi) || []).length;
  return plChars > 3 || plWords > 2;
}

// ── Pozyskanie kontekstu IG (profil + posty) ────────────────────────────────
async function fetchInstagramContext(
  baseUrl: string,
  cookie: string,
  igInput: string,
): Promise<Partial<CreatorContext>> {
  const username = extractIgUsername(igInput);
  if (!username) return { posts: [] };

  const igUrl = `https://www.instagram.com/${username}`;
  const ctx: Partial<CreatorContext> = { handle: username, posts: [] };

  // Profil (bio, followers, fullName) — best-effort.
  try {
    const profile = await internalFetch(baseUrl, '/api/instagram-profile', { url: igUrl }, cookie);
    if (profile?.exist) {
      ctx.fullName = profile.full_name || undefined;
      ctx.bio = profile.bio || undefined;
      ctx.followers = profile.followers_count ?? null;
    }
  } catch (e) {
    console.warn('⚠️ [generate-seeds] instagram-profile failed:', (e as Error).message);
  }

  // Posty (captiony) — best-effort.
  try {
    const analysis = await internalFetch(
      baseUrl,
      '/api/social/instagram/creator-analysis',
      { username, postsLimit: 12 },
      cookie,
    );
    if (Array.isArray(analysis?.posts)) {
      ctx.posts = analysis.posts
        .map((p: any) => (typeof p.caption === 'string' ? p.caption.trim() : ''))
        .filter((c: string) => c.length > 0);
    }
  } catch (e) {
    console.warn('⚠️ [generate-seeds] creator-analysis failed:', (e as Error).message);
  }

  return ctx;
}

// ── Pozyskanie kontekstu ze stron WWW (scrape) ──────────────────────────────
async function fetchWebContext(
  baseUrl: string,
  cookie: string,
  urls: string[],
): Promise<string[]> {
  const valid = urls.map(normalizeUrl).slice(0, 5);
  if (valid.length === 0) return [];
  try {
    const data = await internalFetch(baseUrl, '/api/scrape-urls', { urls: valid }, cookie);
    if (Array.isArray(data?.scrapedContent)) {
      return data.scrapedContent
        .map((s: any) => {
          const title = typeof s.title === 'string' ? s.title : '';
          const content = typeof s.content === 'string' ? s.content : '';
          // Skracamy każdą stronę, by prompt nie spuchł.
          return `${title}\n${content}`.trim().slice(0, 4000);
        })
        .filter((t: string) => t.length > 0);
    }
  } catch (e) {
    console.warn('⚠️ [generate-seeds] scrape-urls failed:', (e as Error).message);
  }
  return [];
}

// ── Budowa promptu LLM ──────────────────────────────────────────────────────
function buildSeedsPrompt(ctx: CreatorContext, pl: boolean): string {
  const langName = pl ? 'POLISH' : 'ENGLISH';

  // Sekcja z danymi twórcy.
  let creator = '';
  if (ctx.handle) creator += `Instagram handle: @${ctx.handle}\n`;
  if (ctx.fullName) creator += `Name: ${ctx.fullName}\n`;
  if (typeof ctx.followers === 'number') creator += `Followers: ${ctx.followers}\n`;
  if (ctx.bio) creator += `Bio: ${ctx.bio}\n`;
  if (ctx.posts.length > 0) {
    creator += `\nRecent post captions (how they actually talk to their audience):\n`;
    ctx.posts.slice(0, 12).forEach((c, i) => {
      creator += `[Post ${i + 1}] ${c.slice(0, 600)}\n`;
    });
  }
  if (ctx.webContent.length > 0) {
    creator += `\nContent from their website / links:\n`;
    ctx.webContent.forEach((c, i) => {
      creator += `[Source ${i + 1}] ${c}\n`;
    });
  }
  // UWAGA: pusty kontekst NIE jest tu dozwolony — sprawdzamy to wcześniej (guard w handlerze)
  // i przerywamy zanim w ogóle wejdziemy w prompt. Generator nigdy nie zmyśla treści bez danych.

  // Prompt: metodyki Suby + Tracy + StoryBrand zsyntetyzowane w reguły.
  return `You are a world-class lead-magnet strategist. You write ebook titles in the combined tradition of Sabri Suby (irresistible offers, curiosity, specificity), Brian Tracy (benefit clarity, result-orientation), and Donald Miller / StoryBrand (customer-as-hero, clarity over cleverness, the grunt test).

Your task: based on the creator profile below, generate EXACTLY 3 distinct lead-magnet ebook ideas. Each idea has a title, a subtitle, and an author-voice style description.

=== CREATOR PROFILE ===
${creator}

=== STEP 1: REASON ABOUT THE CREATOR AND AUDIENCE (think before writing) ===
Before writing anything, work through this reasoning from the profile above:
1. EXPERTISE: From the creator's data, infer what this person is genuinely skilled at and what their product/knowledge actually is. Be grounded in evidence from the profile — do not invent expertise they don't show.
2. AUDIENCE: Determine who the real audience is — the actual people who follow, hire, or buy from this creator. Be specific about who they are.
3. BURNING PROBLEMS: Find the audience's most painful, pressing problems that THIS creator is genuinely able to solve. The sweet spot is the intersection: (audience's real pain) ∩ (creator's real competence). Pick the 3 strongest.
Then build one ebook idea per problem.

=== STEP 2: WRITE THE TITLE + SUBTITLE ===
TWO FORCES, BOTH REQUIRED:
1. CLARITY (StoryBrand): "If you want to be mysterious, you'll also enjoy being broke." The title states PLAINLY what real problem it solves and what the reader gets. NEVER hide the payoff behind mystery, "secrets", "what they won't tell you", or curiosity gaps. If the reader has to guess what's inside, it failed.
2. PUNCH via SABRI SUBY'S TITLE STRUCTURES: clarity is not the same as flat. Suby's power comes from proven SYNTACTIC SKELETONS, not adjectives. Build each of the 3 titles on a DIFFERENT one of these structures (fill the brackets with the real problem/result from Step 1):
   a) "How to [specific concrete result] without [the real pain/sacrifice they dread]" — e.g. "How to Pass Every Fabric Compliance Test Without Re-Ordering"
   b) "[Number] [adjective] Mistakes [specific audience] Make When [action]" — e.g. "7 Costly Mistakes Buyers Make When Sourcing Flame-Retardant Fabric"
   c) "The [specific audience]'s Guide to [concrete result]" — e.g. "The Procurement Manager's Guide to Certified Protective Textiles"
   d) "Stop [a specific, real loss the reader is suffering]" — e.g. "Stop Approving Fabric That Fails in the Field"
   e) "Avoid the [number] [thing] That [concrete bad consequence]" — e.g. "Avoid the 5 Spec Errors That Get Protective Orders Rejected"
Pick the 3 strongest structures for these 3 problems — vary them, do not use the same skeleton twice. These skeletons are DIRECT (no mystery, no hidden payoff) but structured to grab the right reader. Fill them with the visceral language your audience actually uses for their pain — name the specific failure, not a soft abstraction.
The test: a flat statement ("Your fabric won't protect workers") fails — it is not built on a skeleton and has no pull. You want a Suby skeleton + the real problem + true stakes. Every word must still be TRUE and deliverable in a few free chapters — structure never licenses exaggeration.

EVERYTHING MUST BE TRUE AND DELIVERABLE — this is the hard constraint:
- This is a FREE ebook of only a FEW chapters. The title must promise ONLY what a few chapters (or a piece of genuinely unique information/insight) can realistically deliver.
- Do NOT over-promise or promise the impossible. No "double your revenue", no "complete system", no grand transformations a short free ebook cannot honestly fulfill. Right-size the promise to the format.
- The promise must match the creator's real competence (from Step 1). No exaggeration, no stretching.

Each title MUST:
- Address ONE real, specific problem from Step 1 and state its solution/result directly.
- Be concrete and honest — a number or scope is good only if it's realistic for a few chapters.
- Pass the "grunt test": a stranger instantly knows what it is and what they get, with zero guessing.
- Speak to the reader's world and the problem they actually feel — not the creator's brand or features.
- Be precisely matched to THIS creator and THIS audience. A generic title that could belong to anyone is a failure.
A direct, honest objection-remover is allowed when it's TRUE and achievable (e.g. "without [a real, avoidable pain]", "even if [a real starting point]") — but only if a few chapters can actually back it up. It must clarify, never tease.
AVOID: mystery/curiosity/"secrets", over-promising, impossible or oversized promises, jargon, multiple competing promises, brand-led or feature-led titles.
Length — TITLE MUST BE SHORT: aim for 5–8 words, absolute maximum 9. Front-load the result. A title that needs two lines is too long — cut it. Do NOT cram multiple attributes/specs into the title (e.g. listing two fabric types, or appending a standard number) — pick the single sharpest angle and push every secondary detail (specs, standards, audience, timeframe) into the subtitle. Prefer dropping filler like "How to" / "What you must know before" when the title is stronger without it.
Subtitle = ONE line (~8–16 words) that COMPLEMENTS (does not repeat) the title — it states plainly who it's for and the concrete, realistic result, and is where specifics like standards, numbers, or niche details belong. The subtitle ALWAYS carries a clear reader benefit, never a description of the ebook's contents.

=== HOW TO WRITE THE DESCRIPTION (author voice profile — NOT content) ===
The description captures HOW this author communicates, so an AI can later write every chapter in their voice. It MUST describe ONLY style, never the ebook's actual content or chapter topics. Cover, in 2–4 sentences: tone/energy (calm vs high-energy, warm vs blunt), sentence rhythm (short punchy vs flowing), vocabulary register and any signature words/metaphors, level of formality, how they address the audience (second-person "you", commands, questions), and their emotional palette. Base this on the creator's actual captions/bio above. If data is thin, describe a warm, clear, professional coaching voice. Do NOT mention specific topics, facts, or what the ebook will teach — style only.

=== LANGUAGE ===
Write ALL titles, subtitles, and descriptions in ${langName}.

=== OUTPUT FORMAT ===
Return ONLY a JSON array of exactly 3 objects, no extra text, no markdown:
[
  { "title": "...", "subtitle": "...", "description": "..." },
  { "title": "...", "subtitle": "...", "description": "..." },
  { "title": "...", "subtitle": "...", "description": "..." }
]`;
}

// ── Wywołanie Anthropic (wzorzec z generate-toc) ────────────────────────────
async function callAnthropic(prompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      //temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();

  // NIE zakladamy, ze content[0] to tekst. Nowsze modele (Opus 5 i pozniejsze)
  // maja rozszerzone myslenie wlaczone domyslnie i moga zwrocic blok 'thinking'
  // na pierwszej pozycji — wtedy .text jest undefined i cala sciezka sie wywala.
  // Filtrujemy po TYPIE i sklejamy wszystkie bloki tekstowe.
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n')
    .trim();

  if (!text) {
    const types = blocks.map((b: any) => b?.type).join(', ') || 'brak blokow';
    throw new Error(
      `Odpowiedz modelu bez bloku tekstowego (typy: ${types}, stop_reason: ${data?.stop_reason ?? '?'})`,
    );
  }
  return text;
}

// Parsowanie odpowiedzi → dokładnie 3 seedy.
function parseSeeds(raw: string): Seed[] {
  let jsonContent = '';
  const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/```\s*([\s\S]*?)\s*```/);
  if (fenced) {
    jsonContent = fenced[1];
  } else {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    jsonContent = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
  }
  const parsed = JSON.parse(jsonContent.trim());
  if (!Array.isArray(parsed)) throw new Error('Odpowiedź nie jest tablicą');

  const seeds: Seed[] = parsed.slice(0, 3).map((item: any) => ({
    title: typeof item?.title === 'string' ? item.title.trim() : '',
    subtitle: typeof item?.subtitle === 'string' ? item.subtitle.trim() : '',
    description: typeof item?.description === 'string' ? item.description.trim() : '',
  }));
  if (seeds.length !== 3 || seeds.some((s) => !s.title)) {
    throw new Error('Niepełny zestaw seedów (wymagane 3 z tytułami)');
  }
  return seeds;
}

// ── Handler ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((session.user as any).role !== 'GOD') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();
    const { instagram, applicationId, lang } = body ?? {};

    const baseUrl = getBaseUrl(request);
    const cookie = request.headers.get('cookie') || '';

    // Zbuduj kontekst twórcy z odpowiedniego źródła.
    const ctx: CreatorContext = { posts: [], webContent: [] };

    if (applicationId) {
      // Tor APPLICATION: bierzemy wszystkie linki z wniosku.
      const app = await prisma.application.findUnique({ where: { id: applicationId } });
      if (!app) {
        return NextResponse.json({ error: 'Application nie istnieje' }, { status: 404 });
      }
      // IG z wniosku → profil + posty.
      if (app.instagram) {
        const igCtx = await fetchInstagramContext(baseUrl, cookie, app.instagram);
        Object.assign(ctx, igCtx, { webContent: ctx.webContent });
      }
      // Pozostałe linki → scrape.
      const webUrls = [app.website, app.linkedin, app.youtube, app.facebook].filter(
        (u): u is string => !!u && u.trim().length > 0,
      );
      if (webUrls.length > 0) {
        ctx.webContent = await fetchWebContext(baseUrl, cookie, webUrls);
      }
    } else if (instagram) {
      // Tor INVITATION: jedno pole przyjmuje IG, LinkedIn ALBO zwykłą stronę www.
      const raw = instagram.trim();
      console.log('🔎 [generate-seeds] invitation input:', JSON.stringify(raw), {
        isLI: isLinkedInInput(raw),
        isIG: /instagram\.com/i.test(raw) || raw.startsWith('@'),
      });
      if (isLinkedInInput(raw)) {
        // LinkedIn → profil zawodowy
        Object.assign(ctx, await fetchLinkedInContext(baseUrl, cookie, raw));
      } else if (/instagram\.com/i.test(raw) || raw.startsWith('@')) {
        // Instagram (link lub @nick) → profil + posty
        Object.assign(ctx, await fetchInstagramContext(baseUrl, cookie, raw));
      } else if (/^https?:\/\//i.test(raw) || /^[^\s@]+\.[a-z]{2,}/i.test(raw)) {
        // Każdy inny URL/domena (np. ariteks.net) → SCRAPE strony www
        ctx.webContent = await fetchWebContext(baseUrl, cookie, [raw]);
      } else {
        // Nierozpoznane wejście → guard niżej zwróci czytelny błąd (zero zmyślania)
      }
    } else {
      return NextResponse.json(
        { error: 'Podaj instagram (invitation) albo applicationId (application)' },
        { status: 400 },
      );
    }

    // GUARD: bez realnych danych o twórcy NIE generujemy (żadnego zmyślania).
    // Wymagamy choć jednego źródła: bio/headline, posty IG albo treść ze stron.
    const hasRealContext =
      (!!ctx.bio && ctx.bio.trim().length > 0) ||
      ctx.posts.length > 0 ||
      ctx.webContent.length > 0;
    if (!hasRealContext) {
      console.warn('⚠️ [generate-seeds] pusty kontekst — przerywam bez generowania');
      return NextResponse.json(
        {
          error:
            'Nie udało się pobrać danych z podanego źródła (profil prywatny, nieosiągalny albo zły link). Seedy nie zostały wygenerowane.',
        },
        { status: 422 },
      );
    }

    // Ustal język: app language z body ma priorytet; jeśli brak — heurystyka z treści; fallback EN.
    let pl: boolean;
    if (lang === 'pl') pl = true;
    else if (lang === 'en') pl = false;
    else {
      const sample = [ctx.bio || '', ...ctx.posts, ...ctx.webContent].join(' ').slice(0, 2000);
      pl = looksPolish(sample); // brak jawnego langa → zgadnij; jak nie wiadomo → false (EN)
    }

    // Klucz API + model (wzorzec z generate-toc).
    const userId = session.user.id;
    const { apiKey } = await getApiKeyForEndpoint(userId, 'anthropic', 'ANTHROPIC_API_KEY');
    if (!apiKey) {
      return NextResponse.json({ error: 'Brak klucza API Anthropic' }, { status: 500 });
    }
    // Seedy to copywriting najwyższej próby — własny, dedykowany model (ponad premium).
    // Fallback: PREMIUM, a gdyby i jego nie było — Sonnet. Generator NIE używa modelu z ustawień usera.
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-20250514';
    const model = process.env.SEEDS_AI_MODEL || PREMIUM_AI_MODEL;

    const prompt = buildSeedsPrompt(ctx, pl);
    console.log('🌱 [generate-seeds] context:', {
      source: applicationId ? 'application' : 'invitation',
      input: applicationId ? 'application' : (isLinkedInInput(instagram || '') ? 'linkedin' : 'instagram'),
      handle: ctx.handle,
      fullName: ctx.fullName,
      hasBio: !!ctx.bio,
      posts: ctx.posts.length,
      web: ctx.webContent.length,
      lang: pl ? 'pl' : 'en',
      model,
    });

    const rawOutput = await callAnthropic(prompt, apiKey, model);

    // Parsowanie bywa zawodne: model potrafi wstawic niezescape'owany cudzyslow
    // w opisie i JSON.parse sie wywala. Bez surowej odpowiedzi w logu nie da sie
    // ustalic, co dokladnie zepsul — wiec logujemy ja, zanim rzucimy blad dalej.
    // Uwaga: pozycja z komunikatu odnosi sie do WYCIETEGO JSON-a, nie do calego
    // rawOutput, wiec okno ponizej jest orientacyjne (zwykle offset to 0-10 znakow).
    let seeds: Seed[];
    try {
      seeds = parseSeeds(rawOutput);
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : String(parseError);
      const pos = Number(msg.match(/position (\d+)/)?.[1] ?? NaN);
      console.error('❌ [generate-seeds] PARSE FAILED:', msg);
      console.error('📏 [generate-seeds] dlugosc odpowiedzi:', rawOutput.length, 'model:', model);
      if (Number.isFinite(pos)) {
        console.error(
          '🔍 [generate-seeds] okolica bledu:',
          JSON.stringify(rawOutput.slice(Math.max(0, pos - 150), pos + 150)),
        );
      }
      console.error('📄 [generate-seeds] RAW START>>>\n' + rawOutput + '\n<<<RAW END');
      throw parseError;
    }

    return NextResponse.json({ seeds });
  } catch (error) {
    console.error('❌ [generate-seeds] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Use POST' }, { status: 405 });
}