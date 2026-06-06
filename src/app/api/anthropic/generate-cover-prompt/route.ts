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
    const { title, subtitle, intro, chapters } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Wymagany tytuł ebooka.' },
        { status: 400 }
      );
    }

    // Okładka opiera się na realnej treści książki: w pierwszej kolejności na
    // strukturze rozdziałów, a gdy ich brak — na wstępie. Wymagamy przynajmniej
    // jednego z tych źródeł.
    const chapterList: Array<{ position?: number; title?: string; content?: string }> =
      Array.isArray(chapters) ? chapters : [];
    const hasChapters = chapterList.length > 0;
    const hasIntro = typeof intro === 'string' && intro.trim().length > 0;

    if (!hasChapters && !hasIntro) {
      return NextResponse.json(
        { error: 'Brak treści książki (rozdziały i wstęp są puste).' },
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

    // Okładka to zadanie kreatywne — używamy mocniejszego modelu (premium),
    // który potrafi przeanalizować treść i zaprojektować dopasowany kierunek
    // artystyczny, zamiast produkować bezpieczną sztampę.
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-6';

    // Zbuduj zwięzłą STRUKTURĘ TREŚCI książki na podstawie rozdziałów:
    // każdy rozdział = jego tytuł + krótki wycinek treści (pierwsze zdania).
    // To realna zawartość książki — okładka ma ją odzwierciedlać, nie zgadywać.
    // Limitujemy liczbę rozdziałów i długość wycinka, by prompt był zwarty.
    const sortedChapters = [...chapterList].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    );

    const chaptersStructure = sortedChapters
      .slice(0, 12)
      .map((ch, idx) => {
        const chTitle = (ch.title ?? '').trim();
        const snippet = (ch.content ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 220);
        const num = ch.position ?? idx + 1;
        if (chTitle && snippet) return `${num}. ${chTitle} — ${snippet}`;
        if (chTitle) return `${num}. ${chTitle}`;
        return snippet ? `${num}. ${snippet}` : '';
      })
      .filter(Boolean)
      .join('\n');

    // Fallback: gdy z jakiegoś powodu nie ma użytecznej struktury rozdziałów,
    // użyj wstępu (przyciętego), żeby brief nie został bez treści.
    const introExcerpt = (intro ?? '').trim().substring(0, 1500);
    const contentForBrief = chaptersStructure.trim().length > 0
      ? chaptersStructure
      : introExcerpt;

    const prompt = `Jesteś dyrektorem artystycznym projektującym okładki książek dla najlepszych wydawnictw. Twoje okładki wygrywają nagrody za to, że są odważne, zapadają w pamięć i idealnie oddają ducha treści. Brzydzisz się generyczną, korporacyjną sztampą — żadnych nudnych gradientów, oklepanych ikon żarówki, banalnych zdjęć stockowych.

Twoim zadaniem jest napisanie szczegółowego promptu (po angielsku) dla modelu Gemini 3 Pro Image, który wygeneruje KOMPLETNĄ, gotową do druku okładkę ebooka — z tytułem i podtytułem wkomponowanymi w grafikę.

DANE EBOOKA:
- Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}

STRUKTURA TREŚCI KSIĄŻKI (tytuły rozdziałów i wycinki — to jest REALNA zawartość, którą okładka musi oddać):
${contentForBrief}

---

ETAP 1 — ANALIZA I KIERUNEK ARTYSTYCZNY (przemyśl, zanim napiszesz prompt):
Przeanalizuj POWYŻSZĄ STRUKTURĘ ROZDZIAŁÓW — to jest faktyczna treść książki. Ustal: o czym KONKRETNIE jest ta książka, jaki problem rozwiązuje i jaki jest jej główny, namacalny temat przewodni wynikający z rozdziałów? Jaka jest jej emocja i obietnica? Kto ją czyta?

Następnie dobierz JEDEN kierunek wizualny, który (a) wyróżni się na tle setek nudnych okładek poradników ORAZ (b) WIERNIE reprezentuje konkretną treść z rozdziałów. Styl może być dowolny (fotograficzny, ilustracyjny, typograficzny, konceptualny, surrealistyczny, abstrakcyjny, malarski) — ale koncept wizualny MUSI bezpośrednio wynikać z tego, o czym jest książka.

ZASADA NADRZĘDNA — SPÓJNOŚĆ TREŚCI Z GRAFIKĄ:
Główny motyw okładki musi reprezentować RZECZYWISTY temat książki widoczny w rozdziałach. Czytelnik, patrząc na okładkę, ma od razu wyczuć, o czym jest środek. ABSOLUTNIE ZAKAZANE są ozdobne, "efektowne" metafory oderwane od treści (np. płonąca zapałka, filiżanka kawy, przypadkowe abstrakcje), jeśli nie reprezentują wprost zawartości książki. Lepszy jest trafny, mocno zaprojektowany motyw niż ładny obrazek bez związku z tematem. Jeśli kusi Cię metafora — sprawdź, czy wprost odsyła do treści rozdziałów; jeśli nie, odrzuć ją.

ETAP 2 — NAPISZ PROMPT w tym kierunku. Prompt MUSI precyzyjnie określać:
- GŁÓWNY KONCEPT WIZUALNY: jeden mocny, konkretny obraz lub motyw, ZAKORZENIONY w temacie książki (nie zlepek ogólników, nie metafora bez związku z treścią)
- KIEROWANIE ŚWIATŁEM: dramatyczne, nastrojowe, kontrastowe — światło buduje emocję
- KOMPOZYCJĘ: odważną, z wyraźnym punktem skupienia i hierarchią; coś, co zatrzymuje wzrok
- PALETĘ KOLORÓW: konkretną i celową, budującą nastrój (podaj realne kolory, nie "ładne barwy")
- TECHNIKĘ I FAKTURĘ: styl renderowania spójny z kierunkiem (np. cinematic photography, bold flat illustration, oil-painted texture, high-contrast graphic design)
- NASTRÓJ: jedno-dwa słowa-klucze emocji, które okładka ma wywołać

WYMAGANIA DOTYCZĄCE TEKSTU NA OKŁADCE (bezwzględne):
- Na okładce mają być WYŁĄCZNIE dwa napisy, oba dokładnie jak podano — słowo w słowo, bez zmian, bez tłumaczenia, bez dopisków.
- Główny napis (tytuł), wyraźny i czytelny, w górnej lub centralnej części, brzmi dokładnie: ${title}
${subtitle ? `- Drugi, mniejszy napis (podtytuł), w DOLNEJ części, mniejszą czcionką, z wyraźnym odstępem od tytułu (nie tuż pod nim), brzmi dokładnie: ${subtitle}` : '- NIE umieszczaj żadnego podtytułu ani drugiego napisu — tylko sam tytuł.'}
- KRYTYCZNE: w prompcie dla modelu graficznego NIGDZIE nie używaj słów-etykiet typu "TITLE", "SUBTITLE", "TYTUŁ", "PODTYTUŁ", "MAIN TITLE", "HEADING", ani dwukropków przed napisami. Model rysuje tekst dosłownie. Opisuj napisy zdaniem (np. 'the cover displays the following title text, rendered exactly as written: ...') i NIGDY nie poprzedzaj cytowanego tekstu etykietą z dwukropkiem.
- Typografia ma być częścią projektu, nie naklejką: dobierz krój i kolor fontu tak, by wspierał kierunek artystyczny i mocno kontrastował z tłem. Tekst ma współgrać z kompozycją.
- Okładka musi zawierać TYLKO ten tekst (tytuł${subtitle ? ' i podtytuł' : ''}) — żadnych dodatkowych słów, etykiet, placeholderów ("subtitle", "your text here") ani powtórzeń.

WYMAGANIA TECHNICZNE FORMATU:
- Format 3:4 (pionowy), rozdzielczość 2K, finalna okładka gotowa do druku (nie szkic, nie makieta)
- Grafika wypełnia CAŁĄ powierzchnię do absolutnej krawędzi — ZERO marginesów, ZERO ramek, ZERO paddingu, żadnych ciemnych obwódek
- NIE pokazuj okładki jako obiektu 3D ani z cieniem sugerującym brzeg książki — to ma być sama płaska grafika wypełniająca kadr

Długość promptu: około 350-550 słów, bogaty i konkretny, po angielsku.

Napisz TYLKO gotowy prompt (bez komentarzy, bez nagłówków, bez opisu swojej analizy). Zacznij od słowa "Create" — bez prefiksu "PROMPT:".`;

    const requestBody: AnthropicRequest = {
      model: PREMIUM_AI_MODEL,
      max_tokens: 1200,
      temperature: 0.65,
      messages: [{ role: 'user', content: prompt }]
    };

    console.log(`📤 Wysyłanie do Claude (${PREMIUM_AI_MODEL})...`);
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
      sourceField: chaptersStructure.trim().length > 0 ? 'chapters' : 'intro',
    });

  } catch (error) {
    console.error('❌ Błąd generowania promptu okładki:', error);
    return NextResponse.json({
      error: 'Błąd wewnętrzny serwera',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}