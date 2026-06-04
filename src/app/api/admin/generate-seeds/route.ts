// src/app/api/admin/generate-seeds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getApiKeyForEndpoint, getUserAiSettings } from '@/lib/user-api-keys';

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
  if (!creator.trim()) {
    creator = '(Very little data available about this creator. Infer a plausible niche from the handle and produce strong, general-purpose lead-magnet titles for a coach/freelancer/small business.)';
  }

  // Prompt: metodyki Suby + Tracy + StoryBrand zsyntetyzowane w reguły.
  return `You are a world-class lead-magnet strategist. You write ebook titles in the combined tradition of Sabri Suby (irresistible offers, curiosity, specificity), Brian Tracy (benefit clarity, result-orientation), and Donald Miller / StoryBrand (customer-as-hero, clarity over cleverness, the grunt test).

Your task: based on the creator profile below, generate EXACTLY 3 distinct lead-magnet ebook ideas. Each idea has a title, a subtitle, and an author-voice style description.

=== CREATOR PROFILE ===
${creator}

=== HOW TO WRITE THE TITLE + SUBTITLE (the lead magnet hook) ===
Each title MUST:
- Name ONE specific burning problem or one desired result (never many).
- Promise a concrete outcome, ideally with a number and/or timeframe.
- Pass the "grunt test": a stranger instantly understands what it is and what they get.
- Speak to the reader's world and identity, not the creator's brand or features.
- Use at most ONE honest curiosity/objection hook where it genuinely fits (e.g. "without [pain]", "even if [obstacle]"). Choose the strongest hook per title; do NOT force the same template on all three. Vary the three titles.
- Be download-worthy: so compelling that the right person feels they must grab it.
AVOID: vague cleverness that sacrifices clarity, jargon, multiple competing promises, over-promising, brand-led or feature-led titles.
Length: title ≈ 6–12 words (front-load the result). Subtitle = ONE line (~8–16 words) that COMPLEMENTS (does not repeat) the title — it adds the clarity layer: who it's for, number of steps, timeframe, or the objection removed.

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
      temperature: 0.8,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errorText.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.content[0].text;
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
      // Tor INVITATION: jedno pole przyjmuje IG albo LinkedIn — rozpoznajemy po linku.
      const inputCtx = isLinkedInInput(instagram)
        ? await fetchLinkedInContext(baseUrl, cookie, instagram)
        : await fetchInstagramContext(baseUrl, cookie, instagram);
      Object.assign(ctx, inputCtx);
      ctx.webContent = ctx.webContent || [];
    } else {
      return NextResponse.json(
        { error: 'Podaj instagram (invitation) albo applicationId (application)' },
        { status: 400 },
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
    const BASIC_AI_MODEL = process.env.BASIC_AI_MODEL || 'claude-3-5-haiku-20241022';
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-20250514';
    const userAiSettings = await getUserAiSettings(userId);
    // Seedy to copywriting wyższej próby — preferujemy mocniejszy model, jeśli dostępny.
    const model =
      userAiSettings.textAiModel === 'claude-3-sonnet' ? PREMIUM_AI_MODEL : PREMIUM_AI_MODEL;

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
    const seeds = parseSeeds(rawOutput);

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