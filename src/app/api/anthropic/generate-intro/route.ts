// src/app/api/anthropic/generate-intro/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint } from '@/lib/user-api-keys';
import { callAnthropic, premiumModel, AnthropicError } from '@/lib/anthropic';
import { hasIntroAccess, PLAN_NAMES } from '@/lib/planLimits';
import { prisma } from '@/lib/prisma'; // Zakładam że masz prisma client

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

// Interfejs sparsowanego intro (XML)
interface ParsedIntro {
  p1: string;
  p2: string;
  p3: string;
  cta_1: string;
  cta_2: string;
  cta_3: string;
  cta_4: string;
  cta_5: string;
}

// Funkcja POST do generowania wstępu
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { ebookId, debug, lang } = body;
    const isDebugMode = debug === true;
    const pl = lang === 'pl'; // język aplikacji; brak → EN

    // Konwertuj ebookId na number jeśli przyszedł jako string
    const ebookIdNumber = typeof ebookId === 'string' ? parseInt(ebookId, 10) : ebookId;

    if (!ebookIdNumber || isNaN(ebookIdNumber)) {
      return NextResponse.json(
        { error: 'Nieprawidłowe ID ebooka' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Wstep jest funkcja planu Business i wyzej. Sprawdzamy TUTAJ, nie tylko na
    // froncie — front to przegladarka uzytkownika i nie jest zabezpieczeniem.
    // Stoi przed odczytem ebooka z bazy, zeby nie robic zbednej pracy.
    if (!hasIntroAccess((session.user as any).role)) {
      console.log(`⛔ [generate-intro] brak dostepu w planie uzytkownika ${userId}`);
      return NextResponse.json(
        {
          error: 'INTRO_REQUIRES_UPGRADE',
          requiredPlan: PLAN_NAMES.business,
        },
        { status: 403 },
      );
    }

    // ✅ KROK 1: Pobierz dane ebooka z bazy
    const ebook = await prisma.ebooks.findUnique({
      where: { id: ebookIdNumber },
      select: {
        id: true,
        title: true,
        subtitle: true,
        intro: true,
        userId: true
      }
    });

    if (!ebook) {
      return NextResponse.json(
        { error: 'Nie znaleziono ebooka' },
        { status: 404 }
      );
    }

    // Sprawdź czy ebook należy do zalogowanego użytkownika
    if (ebook.userId !== userId) {
      return NextResponse.json(
        { error: 'Brak uprawnień do tego ebooka' },
        { status: 403 }
      );
    }

    if (!ebook.title || ebook.title.trim() === '') {
      return NextResponse.json(
        { error: 'Ebook nie ma tytułu' },
        { status: 400 }
      );
    }

    // ✅ KROK 2: Pobierz spis treści (rozdziały)
    const chapters = await prisma.ebook_chapters.findMany({
      where: { ebook_id: ebookIdNumber },
      select: {
        title: true,
        position: true
      },
      orderBy: { position: 'asc' }
    });

    if (!chapters || chapters.length === 0) {
      return NextResponse.json(
        { error: 'Ebook nie ma rozdziałów. Wygeneruj najpierw spis treści.' },
        { status: 400 }
      );
    }

    // ✅ KROK 3: Pobierz profile użytkownika (autor i odbiorca)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        user_exp_profile: true,
        client_needs_profile: true
      }
    });

    const authorProfile = user?.user_exp_profile && user.user_exp_profile.trim() !== ''
      ? user.user_exp_profile
      : null;

    const audienceProfile = user?.client_needs_profile && user.client_needs_profile.trim() !== ''
      ? user.client_needs_profile
      : null;

    // ✅ KROK 4: Pobierz klucz API Anthropic
    const { apiKey: anthropicApiKey, source: keySource } = await getApiKeyForEndpoint(
      userId,
      'anthropic',
      'ANTHROPIC_API_KEY'
    );

    if (!anthropicApiKey) {
      console.error('❌ Brak dostępnego klucza Anthropic API');
      return NextResponse.json(
        { error: 'Błąd konfiguracji - brak klucza API Anthropic' },
        { status: 500 }
      );
    }

    // ✅ KROK 5: ZAWSZE używaj premium model
    const PREMIUM_AI_MODEL = premiumModel();

    console.log(`🤖 Używam modelu: ${PREMIUM_AI_MODEL} (premium - zawsze dla intro)`);
    console.log(`🔑 Źródło klucza API: ${keySource}`);

    // ✅ KROK 6: Zbuduj prompt do generowania wstępu
    const prompt = buildIntroPrompt({
      title: ebook.title,
      subtitle: ebook.subtitle || undefined,
      chapters: chapters.map(ch => ch.title),
      authorProfile: authorProfile || undefined,
      audienceProfile: audienceProfile || undefined,
      pl
    });

    // max_tokens podniesione z 2000: przy wlaczonym mysleniu jego tokeny
    // tez licza sie do limitu, a wstep to 3 sekcje plus CTA.
    const MAX_TOKENS = 4000;

    console.log('Wysyłanie zapytania do Anthropic API...');
    console.log('Kontekst:', {
      ebookId: ebookIdNumber,
      title: ebook.title,
      subtitle: ebook.subtitle || 'brak',
      chaptersCount: chapters.length,
      hasAuthorProfile: !!authorProfile,
      hasAudienceProfile: !!audienceProfile,
      model: PREMIUM_AI_MODEL,
      keySource: keySource,
      debugMode: isDebugMode
    });

    if (isDebugMode) {
      console.log('\n' + '='.repeat(80));
      console.log('DEBUG MODE: Pełny prompt wysłany do API');
      console.log('='.repeat(80));
      console.log(prompt);
      console.log('='.repeat(80));
    }

    // ✅ KROK 7: Wykonaj zapytanie do API Anthropic
    let introContent: string;
    try {
      const result = await callAnthropic({
        apiKey: anthropicApiKey,
        model: PREMIUM_AI_MODEL,
        prompt,
        maxTokens: MAX_TOKENS,
        label: 'generate-intro',
      });
      introContent = result.text;
    } catch (e) {
      const status = e instanceof AnthropicError ? e.status : 500;
      return NextResponse.json(
        { error: 'Błąd podczas generowania wstępu' },
        { status },
      );
    }

    console.log('Otrzymano odpowiedź z Anthropic API, długość:', introContent.length);

    if (isDebugMode) {
      console.log('\n' + '='.repeat(80));
      console.log('DEBUG MODE: Surowa odpowiedź z API');
      console.log('='.repeat(80));
      console.log(introContent);
      console.log('='.repeat(80));
    }

    // ✅ KROK 8: Parsowanie strukturalnej odpowiedzi XML
    const parsed = parseIntroResponse(introContent);

    if (!parsed) {
      console.error('❌ Nie udało się sparsować odpowiedzi XML z API');
      console.error('Surowa odpowiedź:', introContent.substring(0, 500));
      return NextResponse.json(
        { error: 'Błąd parsowania odpowiedzi AI - nieprawidłowy format' },
        { status: 500 }
      );
    }

    // Walidacja — każde pole musi mieć sensowną długość
    const fieldMinLengths: Record<keyof ParsedIntro, number> = {
      p1: 100,
      p2: 80,
      p3: 100,
      cta_1: 10,
      cta_2: 10,
      cta_3: 10,
      cta_4: 10,
      cta_5: 10
    };

    const missingFields = (Object.keys(fieldMinLengths) as (keyof ParsedIntro)[]).filter(
      f => !parsed[f] || parsed[f].length < fieldMinLengths[f]
    );

    if (missingFields.length > 0) {
      console.error('❌ Brakujące lub zbyt krótkie pola:', missingFields.map(f => ({
        field: f,
        length: parsed[f]?.length || 0,
        minRequired: fieldMinLengths[f]
      })));
      return NextResponse.json(
        { error: `Niekompletna odpowiedź AI - brakujące pola: ${missingFields.join(', ')}` },
        { status: 500 }
      );
    }

    console.log('✅ Sparsowano 8 pól:', {
      p1: parsed.p1.length,
      p2: parsed.p2.length,
      p3: parsed.p3.length,
      cta_1: parsed.cta_1.length,
      cta_2: parsed.cta_2.length,
      cta_3: parsed.cta_3.length,
      cta_4: parsed.cta_4.length,
      cta_5: parsed.cta_5.length
    });

    // ✅ KROK 8b: Złóż outputy

    // Wersja ebook (klasyczne 3 akapity — jak dotychczas)
    const cleanedIntro = `${parsed.p1}\n\n${parsed.p2}\n\n${parsed.p3}`;

    // Surowe dane do kolumny raw_intro (8 pól jako JSON)
    const rawIntro = JSON.stringify({
      p1: parsed.p1,
      p2: parsed.p2,
      p3: parsed.p3,
      cta_1: parsed.cta_1,
      cta_2: parsed.cta_2,
      cta_3: parsed.cta_3,
      cta_4: parsed.cta_4,
      cta_5: parsed.cta_5
    });

    console.log(`Wygenerowano intro: ${cleanedIntro.length} znaków, raw_intro: ${rawIntro.length} znaków`);

    // ✅ KROK 9: Zapisz wstęp do bazy danych
    await prisma.ebooks.update({
      where: { id: ebookIdNumber },
      data: {
        intro: cleanedIntro,
        raw_intro: rawIntro
      }
    });

    console.log(`✅ Pomyślnie wygenerowano i zapisano wstęp do ebooka ${ebookIdNumber} (${keySource})`);

    // ✅ KROK 10: Zwróć sukces
    const responsePayload: any = {
      success: true,
      intro: cleanedIntro,
      raw_intro: rawIntro,
      metadata: {
        ebookId: ebookIdNumber,
        title: ebook.title,
        chaptersUsed: chapters.length,
        hasAuthorProfile: !!authorProfile,
        hasAudienceProfile: !!audienceProfile,
        modelUsed: PREMIUM_AI_MODEL,
        keySource: keySource,
        introLength: cleanedIntro.length
      }
    };

    // W trybie debug dodaj surowe dane
    if (isDebugMode) {
      responsePayload.raw_prompt = prompt;
      responsePayload.raw_answer = introContent;

      responsePayload.debug = {
        promptLength: prompt.length,
        rawAnswerLength: introContent.length,
        cleanedIntroLength: cleanedIntro.length,
        parsedFieldLengths: {
          p1: parsed.p1.length,
          p2: parsed.p2.length,
          p3: parsed.p3.length,
          cta_1: parsed.cta_1.length,
          cta_2: parsed.cta_2.length,
          cta_3: parsed.cta_3.length,
          cta_4: parsed.cta_4.length,
          cta_5: parsed.cta_5.length
        }
      };
    }

    return NextResponse.json(responsePayload);

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

// ✅ Parser odpowiedzi XML z modelu
function parseIntroResponse(raw: string): ParsedIntro | null {
  try {
    const extract = (tag: string): string | null => {
      const match = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      return match ? match[1].trim() : null;
    };

    const p1 = extract('p1');
    const p2 = extract('p2');
    const p3 = extract('p3');
    const cta_1 = extract('cta_1');
    const cta_2 = extract('cta_2');
    const cta_3 = extract('cta_3');
    const cta_4 = extract('cta_4');
    const cta_5 = extract('cta_5');

    if (!p1 || !p2 || !p3 || !cta_1 || !cta_2 || !cta_3 || !cta_4 || !cta_5) {
      console.error('❌ Brakujące tagi XML w odpowiedzi:', {
        hasP1: !!p1,
        hasP2: !!p2,
        hasP3: !!p3,
        hasCta1: !!cta_1,
        hasCta2: !!cta_2,
        hasCta3: !!cta_3,
        hasCta4: !!cta_4,
        hasCta5: !!cta_5
      });
      return null;
    }

    return { p1, p2, p3, cta_1, cta_2, cta_3, cta_4, cta_5 };
  } catch (error) {
    console.error('❌ Błąd parsowania XML:', error);
    return null;
  }
}

// Funkcja budująca prompt do generowania wstępu
function buildIntroPrompt(params: {
  title: string;
  subtitle?: string;
  chapters: string[];
  authorProfile?: string;
  audienceProfile?: string;
  pl?: boolean;
}): string {
  const { title, subtitle, chapters, authorProfile, audienceProfile, pl } = params;

  let prompt = `# PROMPT DO GENEROWANIA WSTĘPU EBOOKA (+ CTA DO ROLKI)

${pl ? '' : `## ⚠️ OUTPUT LANGUAGE: ENGLISH
Write ALL output content (every XML tag: p1, p2, p3, cta_1..cta_5) in ENGLISH. The instructions below are written in Polish, but your generated text MUST be in English. Keep the XML tag names exactly as specified; translate only the content inside them. All the rules below (structure, "you/your" capitalization becomes natural English second person, no repetition, drill-vs-hole, etc.) apply equally in English.

`}Jesteś ekspertem copywritingu i StoryBrand Framework. Twoim zadaniem jest napisanie emocjonalnego, 3-sekcyjnego wstępu do ebooka oraz dwóch CTA do rolki w social media.

## DANE WEJŚCIOWE:

<tytuł_ebooka>
${title}
</tytuł_ebooka>

`;

  if (subtitle) {
    prompt += `<podtytuł_ebooka>
${subtitle}
</podtytuł_ebooka>

`;
  }

  prompt += `<spis_treści>
${chapters.map((ch, idx) => `${idx + 1}. ${ch}`).join('\n')}
</spis_treści>

`;

  if (authorProfile) {
    prompt += `<profil_autora>
${authorProfile}
</profil_autora>

`;
  }

  if (audienceProfile) {
    prompt += `<profil_odbiorcy>
${audienceProfile}
</profil_odbiorcy>

`;
  }

  prompt += `---

## TWOJE ZADANIE:

Na podstawie powyższych danych wypełnij poniższą strukturę 3-sekcyjną, trafiając w KONKRETNE bóle i pragnienia odbiorcy oraz ekspertyzę autora. Dodatkowo wygeneruj dwa CTA do rolki.

---

## STRUKTURA DO WYPEŁNIENIA:

### SEKCJA 1: PROBLEM (4 zdania) → tag <p1>

**Szablon:**
\`\`\`
Jesteś <KIM_JEST_ODBIORCA>, który ma <CO_MA_DOBRE>.
Wiesz co to <STARA_METODA_KTÓRĄ_NIENAWIDZI>, ale <DLACZEGO_TO_ODPYCHAJĄCE>.
Codziennie słyszysz buzzwordy jak: <3-5_TERMINÓW_BRANŻOWYCH> – wszyscy mówią Ci, że <CO_OBIECUJĄ_GURU>.
Próbują Ci sprzedać <NIEUDANE_PRÓBY_ROZWIĄZANIA>, choć <DLACZEGO_TO_NIE_DZIAŁA>.
\`\`\`

**UWAGA:** W drugim zdaniu odbiorca WIE że metoda istnieje, ale NIE UŻYWA jej - ma reakcję na sam pomysł/myśl o niej.

**Instrukcje wypełniania:**
- \`KIM_JEST_ODBIORCA\` - konkretna rola z profilu odbiorcy (np. "przedsiębiorcą", "trenerem fitness", "konsultantem HR")
- \`CO_MA_DOBRE\` - pozytywny aspekt ich sytuacji związany z tematem (np. "świetny produkt rozwiązujący X", "sprawdzoną metodę Y", "unikalną wiedzę o Z")
- \`STARA_METODA_KTÓRĄ_NIENAWIDZI\` - KONKRETNA AKCJA którą NIE chcą robić (NIE ogólne pojęcie!)
  - ✅ DOBRZE: "coldcall i coldemail", "zimne DM-y na Instagramie", "spam w komentarzach", "zimne pitchowanie"
  - ❌ ŹLE: "sprzedaż bezpośrednia", "marketing", "promocja", "reklama" (za ogólne!)
  - Odbiorca musi ZOBACZYĆ tę akcję w głowie
- \`DLACZEGO_TO_ODPYCHAJĄCE\` - FIZYCZNA lub EMOCJONALNA reakcja NA SAM POMYSŁ/MYŚL o tej metodzie (NIE na działanie!)
  - **KRYTYCZNE:** Odbiorca WIE że metoda istnieje, ale NIE UŻYWA jej - ma reakcję na sam pomysł
  - ✅ DOBRZE (reakcja na pomysł): "na samą myśl dostajesz gęsiej skórki", "nawet pomysł robienia tego przyprawia Cię o mdłości", "myśl o tym wywołuje dyskomfort"
  - ❌ ŹLE (zakłada że robi): "czujesz się jak natręt za każdym razem", "wstyd Cię ogarnia po tym", "po każdym takim działaniu czujesz się źle"
  - Format: "na samą myśl..." / "nawet pomysł..." / "sama myśl o..."
- \`3-5_TERMINÓW_BRANŻOWYCH\` - buzzwordy z branży odbiorcy oddzielone przecinkami, które słyszy ale nie rozumie (np. "lead magnet, funnel, CRM, retargeting")
- \`CO_OBIECUJĄ_GURU\` - ogólnikowa obietnica która wszędzie się powtarza (np. "tego potrzebujesz aby zarabiać więcej", "to jedyna droga do sukcesu")
- \`NIEUDANE_PRÓBY_ROZWIĄZANIA\` - co już kupili/próbowali bez efektu (np. "kolejny kurs", "drogie narzędzie", "konsultację z ekspertem")
- \`DLACZEGO_TO_NIE_DZIAŁA\` - paradoksalny efekt (np. "każdy następny tylko bardziej zaciemnia obraz", "masz więcej pytań niż odpowiedzi")

**KRYTYCZNE:** Terminologia i buzzwordy MUSZĄ być autentyczne dla branży odbiorcy!

---

### SEKCJA 2: PRAGNIENIE (3 zdania) → tag <p2>

**Szablon:**
\`\`\`
Tak naprawdę chcesz tylko <MIERZALNY_CEL_KOŃCOWY>.
Nie chcesz uczyć się <LISTA_NIECHCIANYCH_AKTYWNOŚCI>.
Chcesz <CO_CHCĄ_NAPRAWDĘ_ROBIĆ>, chcesz <KONKRETNY_REZULTAT_W_RĘKACH>.
\`\`\`

**Instrukcje wypełniania:**
- \`MIERZALNY_CEL_KOŃCOWY\` - konkretny, ROSNĄCY asset który odbiorca chce mieć (np. "rosnącej codziennie listy kontaktów do klientów z problemem X", "pełnego kalendarza konsultacji", "100 nowych zapytań miesięcznie")
- \`LISTA_NIECHCIANYCH_AKTYWNOŚCI\` - 3-4 rzeczy oddzielone przecinkami, które są ŚRODKIEM a nie CELEM (np. "marketingu, tworzenia stron, integracji narzędzi" / "nagrywania video, montażu, uczenia się algorytmów")
- \`CO_CHCĄ_NAPRAWDĘ_ROBIĆ\` - ich prawdziwa rola/pasja/misja (np. "robić swoją robotę", "pomagać klientom", "leczyć pacjentów", "trenować sportowców")
- \`KONKRETNY_REZULTAT_W_RĘKACH\` - namacalny outcome który widzą/trzymają (np. "telefonów i maili osób gotowych do rozmowy", "podpisanych umów", "zapłaconych rezerwacji")

**KRYTYCZNE:** Cel końcowy musi być związany z TEMATEM ebooka i ekspertyzą autora!

⚠️ **ZAPAMIĘTAJ PRAGNIENIE Z TEJ SEKCJI** — użyjesz go w CTA (krok poniżej).

---

### SEKCJA 3: ROZWIĄZANIE (4 zdania) → tag <p3>

**Szablon:**
\`\`\`
Ten ebook pokaże Ci dokładnie, jak w <CZAS_REALIZACJI> <GŁÓWNA_AKCJA_DO_WYKONANIA>.
Nie będziesz <LISTA_BARIER_DO_USUNIĘCIA>.
Po prostu <PROSTY_PROCES_3_KROKI> i zaczniesz zbierać <CO_KONKRETNIE_DOSTAJĄ>.
To nie <NIECHCIANA_KATEGORIA> – to konkretne kroki, które za <CZAS_INACZEJ> dadzą Ci <PRAGNIENIE_Z_SEKCJI_2>.
\`\`\`

**Instrukcje wypełniania:**
- \`CZAS_REALIZACJI\` - REALISTYCZNY czas bazując na spisie treści (np. "trzydzieści minut", "jeden wieczór", "weekend", "tydzień")
- \`GŁÓWNA_AKCJA_DO_WYKONANIA\` - cel sformułowany w infinitive, bazujący na TYTULE i SPISIE TREŚCI
  - **KRYTYCZNE - TYLKO AKCJE, NIE TEORIA:**
  - ❌ NIGDY nie używaj: "zrozumieć", "poznać", "nauczyć się", "dowiedzieć się"
  - ✅ ZAWSZE używaj AKCJI: "stworzyć", "uruchomić", "wdrożyć", "opublikować", "zbudować"
  - ❌ ŹLE: "zrozumieć 10 strategii email marketingu" (teoria, lista do nauki)
  - ✅ DOBRZE: "stworzyć pierwszą kampanię email, która sprzedaje" (akcja, gotowy system)
  - Odbiorca musi mieć coś GOTOWEGO po czasie realizacji, nie tylko "wiedzę"
- \`LISTA_BARIER_DO_USUNIĘCIA\` - 3-4 rzeczy oddzielone "ani", które NIE są potrzebne (np. "kupować domeny, hostingu ani uczyć się skomplikowanych narzędzi" / "zatrudniać agencji, grafika ani programisty")
- \`PROSTY_PROCES_3_KROKI\` - uproszczony flow z RZECZYWISTYCH kroków w ebooku (np. "stworzysz materiał, opublikujesz i zaczniesz zbierać kontakty" / "wybierzesz szablon, wypełnisz i uruchomisz")
- \`CO_KONKRETNIE_DOSTAJĄ\` - dane/zasoby/rezultaty które zbierają (np. "nazwiska, maile oraz telefony osób z problemem X" / "listę zainteresowanych z ich głównym wyzwaniem")
- \`NIECHCIANA_KATEGORIA\` - przeciwieństwo tego co oferujesz (np. "teoria o X" / "kolejny kurs do obejrzenia" / "akademicka wiedza bez praktyki")
- \`CZAS_INACZEJ\` - ten sam czas wyrażony INNYM słowem (np. "pół godziny" zamiast "30 minut", "wieczór" zamiast "3 godziny")
- \`PRAGNIENIE_Z_SEKCJI_2\` - DOKŁADNE powtórzenie zmiennej \`MIERZALNY_CEL_KOŃCOWY\` lub \`KONKRETNY_REZULTAT_W_RĘKACH\` z sekcji 2

**KRYTYCZNE:** Proces i czas MUSZĄ być realistyczne względem spisu treści!

---

### SEKCJA 4: CTA DO ROLKI → tagi <cta_1> do <cta_5>

Wygeneruj 5 propozycji CTA. Każda to TYLKO fraza zaczynająca się od "aby", odwołująca się do PRAGNIENIA odbiorcy (outcome z sekcji 2), a NIE do narzędzia, metody ani ebooka.

**ZASADA WIERTŁO vs OTWÓR:**
- Odbiorca NIE chce wiertła (ebook, terminal AI, system, narzędzie, kurs, metoda)
- Odbiorca CHCE otworów (zadowoleni klienci, więcej zleceń, spokój, wyniki, czas)
- CTA ZAWSZE mówi o otworach, NIGDY o wiertle

**Format każdego CTA:**
\`\`\`
aby <PRAGNIENIE_KRÓTKO — max 8 słów, outcome z sekcji 2>
\`\`\`

**Każde z 5 CTA mówi o tym samym pragnieniu, ale INNYMI SŁOWAMI.**

**Przykłady DOBRYCH CTA (otwory = pragnienie):**
- ✅ aby Twoi klienci dostawali odpowiedzi w sekundy.
- ✅ aby skrócić kolejki i zwiększyć zadowolenie klientów.
- ✅ aby mieć pełny kalendarz konsultacji.
- ✅ aby klienci sami do Ciebie trafiali.
- ✅ aby obsługa działała sprawnie bez Twojego nadzoru.

**Przykłady ZŁYCH CTA (wiertła = narzędzie/metoda):**
- ❌ aby wdrożyć terminal AI. (wiertło!)
- ❌ aby pobrać ebooka o chatbotach. (wiertło!)
- ❌ aby poznać system automatyzacji. (wiertło!)

---

## ZASADY OBOWIĄZKOWE:

### 1. REALNOŚĆ I KONKRETNOŚĆ
- Wszystkie buzzwordy MUSZĄ być autentyczne dla branży odbiorcy
- Czas realizacji MUSI być realistyczny względem spisu treści
- Niechciane metody MUSZĄ być rzeczywiste dla tej branży
- Pragnienie MUSI być powiązane z ekspertyzą autora

### 2. JĘZYK I STYL
- Używaj liczebników słownie (np. "trzydzieści minut", "pięćdziesięciu klientów")
- Pisz "Ty/Twój/Ci" wielką literą (zwracasz się do odbiorcy)
- Unikaj patosu i przesady
- Bądź konkretny, nie abstrakcyjny

**KRYTYCZNE - UNIKAJ POWTÓRZEŃ:**
- NIE używaj tego samego istotnego słowa w sąsiednich zdaniach
- Stosuj synonimy dopasowane do kontekstu
- Przykład ŹLE: "musisz budować zasięgi, żeby móc sprzedać. Próbują Ci sprzedać kolejne szkolenie" (słowo "sprzedać" 2x)
- Przykład DOBRZE: "musisz budować zasięgi, żeby móc zarabiać. Próbują Ci wcisną́ kolejne szkolenie"
- Szczególnie uważaj na powtórzenia między Sekcją 1 a Sekcją 2
- Czytaj tekst na głos - powtórzenia rażą w uchu

### 3. EMOCJE
- Sekcja Problem = frustracja, przytłoczenie, bezradność
- Sekcja Pragnienie = ulga, prostota, powrót do misji
- Sekcja Rozwiązanie = nadzieja, konkret, realizm

### 4. SPÓJNOŚĆ
- Buzzwordy w sekcji 1 ≠ terminologia w sekcji 3 (nie mieszaj)
- Pragnienie w sekcji 2 = rezultat w sekcji 3 (powtórz!)
- Niechciane aktywności w sekcji 2 = bariery w sekcji 3 (upraszczaj!)
- CTA = skrócone pragnienie z sekcji 2 (otwory, nie wiertło!) × 5 wariantów

### 5. PRZYKŁADY DOBRYCH I ZŁYCH PRAKTYK

**PRZYKŁAD 1 - POWTÓRZENIA (ŹLE vs DOBRZE):**

❌ ŹLE:
"wszyscy mówią Ci, że musisz budować zasięgi, żeby móc sprzedać. Próbują Ci sprzedać kolejne szkolenie..."
(słowo "sprzedać" użyte 2x w sąsiednich zdaniach)

✅ DOBRZE:
"wszyscy mówią Ci, że musisz budować zasięgi, żeby móc zarabiać. Próbują Ci wcisnąć kolejne szkolenie..."
(synonimy: "zarabiać" zamiast "sprzedać", "wcisnąć" zamiast "sprzedać")

**PRZYKŁAD 2 - KONKRETNOŚĆ METODY (ŹLE vs DOBRZE):**

❌ ŹLE:
"Wiesz co to sprzedaż bezpośrednia"
(za ogólne, abstrakcyjne)

✅ DOBRZE:
"Wiesz co to zimne DM-y na Instagramie i pitchowanie w komentarzach"
(konkretne akcje, które czytelnik widzi)

**PRZYKŁAD 2B - REAKCJA NA POMYSŁ vs DZIAŁANIE (KRYTYCZNE!):**

❌ ŹLE (zakłada że odbiorca TO ROBI):
"Wiesz co to spam w DM-ach, ale czujesz się jak natręt za każdym razem"
(implikuje: robisz to regularnie → odbiorca: "ale ja tego nie robię!" → brak identyfikacji)

✅ DOBRZE (odbiorca WIE że istnieje, ma reakcję na POMYSŁ):
"Wiesz co to spam w DM-ach, ale na samą myśl dostajesz gęsiej skórki"
(odbiorca wie że metoda istnieje, ale NIE używa jej - ma fizyczną reakcję na sam pomysł → pełna identyfikacja)

**Dlaczego to ważne:**
- Wersja ZŁA → 30% identyfikacji (tylko ci co faktycznie spamują)
- Wersja DOBRA → 90% identyfikacji (wszyscy co słyszeli o spammie i go nienawidzą)

**PRZYKŁAD 3 - AKCJA vs TEORIA (ŹLE vs DOBRZE):**

❌ ŹLE:
"Ten ebook pokaże Ci, jak w tydzień zrozumieć dziesięć sprawdzonych strategii content marketingu"
(teoria, lista do nauki, pasywne)

✅ DOBRZE:
"Ten ebook pokaże Ci, jak w tydzień stworzyć i uruchomić swój pierwszy content plan, który przyciąga klientów"
(akcja, gotowy system, aktywne)

**PRZYKŁAD 4 - SYNONIMY ZAMIAST POWTÓRZEŃ:**

❌ ŹLE:
"Próbują Ci sprzedać kolejny kurs z marketingu. Każdy kolejny kurs tylko bardziej Cię gubi."
(słowo "kurs" użyte 3x!)

✅ DOBRZE:
"Próbują Ci wcisnąć kolejny kurs z marketingu. Każde następne szkolenie tylko bardziej Cię gubi."
(synonimy: "wcisnąć" zamiast "sprzedać", "szkolenie" zamiast "kurs")

**PRZYKŁAD 5 - POWTÓRZENIA MIĘDZY SEKCJAMI:**

❌ ŹLE:
Sekcja 1: "...musisz mieć więcej klientów."
Sekcja 2: "Tak naprawdę chcesz tylko więcej klientów każdego miesiąca."
(fraza "więcej klientów" 2x w krótkim odstępie)

✅ DOBRZE:
Sekcja 1: "...musisz mieć więcej klientów."
Sekcja 2: "Tak naprawdę chcesz tylko rosnącej listy zleceń każdego miesiąca."
(synonimy: "rosnącej listy zleceń" zamiast "więcej klientów")

---

## CHECKLIST PRZED ODDANIEM:

Sprawdź każdy punkt przed wygenerowaniem finalnej wersji:

**SEKCJA 1 - PROBLEM:**
- [ ] Rola odbiorcy jest konkretna i pochodzi z profilu odbiorcy?
- [ ] Nienawidzona metoda jest KONKRETNA AKCJA (nie ogólne pojęcie)?
- [ ] Widzę tę metodę w głowie? (test: "zimne DM-y" ✅ vs "marketing" ❌)
- [ ] Reakcja emocjonalna to odpowiedź NA SAM POMYSŁ/MYŚL? (nie na działanie!)
- [ ] NIE zakładam że odbiorca używa tej metody? (wie że istnieje ≠ robi to)
- [ ] Używam frazy "na samą myśl..." lub "nawet pomysł..."?
- [ ] Buzzwordy są AUTENTYCZNE dla tej branży (nie wymyślone)?
- [ ] Nieudane próby rozwiązania pasują do profilu odbiorcy?
- [ ] BRAK powtórzeń istotnych słów między zdaniami?

**SEKCJA 2 - PRAGNIENIE:**
- [ ] Cel końcowy jest MIERZALNY i związany z tematem ebooka?
- [ ] Niechciane aktywności to ŚRODKI (nie cele)?
- [ ] "Co chcą naprawdę robić" to ich prawdziwa rola/pasja?
- [ ] Konkretny rezultat to coś NAMACALNEGO (nie abstrakcja)?
- [ ] BRAK powtórzeń kluczowych słów z sekcji 1?

**SEKCJA 3 - ROZWIĄZANIE:**
- [ ] Czas realizacji jest REALISTYCZNY względem spisu treści?
- [ ] Główna akcja używa CZASOWNIKÓW AKCJI (stworzyć, uruchomić, wdrożyć)?
- [ ] NIE używam słów: "zrozumieć", "poznać", "nauczyć się"?
- [ ] Prosty proces odzwierciedla RZECZYWISTĄ zawartość ebooka?
- [ ] Po czasie realizacji odbiorca ma coś GOTOWEGO (nie tylko wiedzę)?
- [ ] Niechciana kategoria to przeciwieństwo tego co oferujesz?
- [ ] Pragnienie na końcu = DOKŁADNE powtórzenie z sekcji 2?
- [ ] BRAK powtórzeń kluczowych słów z sekcji 1 i 2?

**CTA:**
- [ ] Wszystkie 5 CTA mówią o PRAGNIENIU (otworach), nie o narzędziu (wiertle)?
- [ ] Każde CTA zaczyna się od "aby"?
- [ ] Każde max 8 słów po "aby"?
- [ ] Wszystkie 5 mówią o tym samym pragnieniu innymi słowami?
- [ ] Żadne CTA nie wspomina o ebooku, narzędziu ani metodzie?

**OGÓLNE:**
- [ ] Wszystkie liczby są słownie?
- [ ] Wszystkie "Ty/Twój/Ci" wielką literą?
- [ ] Tekst brzmi naturalnie (nie jak AI)?
- [ ] Zero patosu i przesady?
- [ ] Brak sprzeczności między sekcjami?
- [ ] **BRAK POWTÓRZEŃ istotnych słów w sąsiednich zdaniach?**
- [ ] Używam synonimów tam gdzie to konieczne?
- [ ] Przeczytałem na głos i brzmi płynnie?

---

## SYNONIMY DO UŻYCIA (unikaj powtórzeń):

**Zamiast powtarzania "sprzedać/sprzedaż":**
- wciskać, wcisnąć
- oferować
- proponować
- przekonywać do zakupu
- zarabiać (kontekst: zamiast "sprzedawać produkty" → "zarabiać")

**Zamiast powtarzania "kurs/szkolenie":**
- program
- warsztat
- materiały edukacyjne
- lekcje
- webinar

**Zamiast powtarzania "klienci":**
- odbiorcy
- osoby zainteresowane
- potencjalni nabywcy
- Twoja społeczność
- ludzie z problemem X

**Zamiast powtarzania "stworzyć/utworzyć":**
- zbudować
- uruchomić
- wdrożyć
- opracować
- przygotować

**Zamiast powtarzania "problem":**
- wyzwanie
- trudność
- bolączka
- kłopot
- konkretna potrzeba

---

## FORMAT ODPOWIEDZI:

Zwróć wypełniony tekst wstępu oraz CTA w tagach XML.

PRZYKŁAD (dla kontekstu - NIE KOPIUJ):

<p1>Jesteś przedsiębiorcą, który ma świetny produkt lub usługę rozwiązującą konkretny problem. Wiesz co to coldcall i coldemail, ale na samą myśl dostajesz gęsiej skórki. Codziennie słyszysz buzzwordy jak: "lead magnet", "landing page", "CTA", "CRM" – wszyscy mówią Ci, że tego właśnie potrzebujesz, aby zarabiać więcej. Próbują Ci wcisnąć kolejny kurs, choć każdy następny tylko bardziej zaciemnia obraz zamiast go rozjaśnić.</p1>
<p2>Tak naprawdę chcesz tylko rosnącej codziennie listy kontaktów do ludzi, którzy mają problem, który Ty potrafisz rozwiązać. Nie chcesz uczyć się marketingu, tworzenia stron, formularzy czy jak to wszystko ze sobą integrować. Chcesz robić swoją robotę, chcesz telefonów i maili osób gotowych do rozmowy o Twoim rozwiązaniu.</p2>
<p3>Ten ebook pokaże Ci dokładnie, jak w trzydzieści minut stworzyć materiał, który przyciągnie właściwych ludzi – tych z konkretnym problemem, który Ty potrafisz rozwiązać. Nie będziesz kupować domeny, hostingu ani uczyć się kolejnego skomplikowanego narzędzia. Po prostu stworzysz coś wartościowego dla swoich klientów, opublikujesz i zaczniesz zbierać kontakty – nazwiska, maile oraz telefony do osób, którym potrafisz pomóc. To nie teoria o "lead magnetach" – to konkretne kroki, które za pół godziny dadzą Ci pierwszych potencjalnych klientów gotowych do rozmowy.</p3>
<cta_1>aby mieć stały dopływ klientów gotowych do rozmowy.</cta_1>
<cta_2>aby Twoja lista kontaktów rosła każdego dnia.</cta_2>
<cta_3>aby właściwi ludzie sami się do Ciebie zgłaszali.</cta_3>
<cta_4>aby kolejni klienci czekali w kolejce po Twoje rozwiązanie.</cta_4>
<cta_5>aby telefon dzwonił od osób z konkretnym problemem.</cta_5>

**Zwróć uwagę na dobre praktyki w tym przykładzie:**
- ✅ "zarabiać więcej" → "wcisnąć kolejny kurs" (brak powtórzenia słowa "sprzedać")
- ✅ "coldcall i coldemail" (konkretne akcje, nie "sprzedaż bezpośrednia")
- ✅ "na samą myśl dostajesz gęsiej skórki" (reakcja na POMYSŁ, nie na działanie - odbiorca NIE robi coldcalli, tylko WIE że istnieje)
- ✅ "stworzyć materiał" (akcja, nie "zrozumieć strategię")
- ✅ "trzydzieści minut" → "pół godziny" (ten sam czas, inne słowa)
- ✅ Płynność i naturalność czytania na głos
- ✅ Wszystkie 5 CTA mówią o "klientach/kontaktach" (otwór/pragnienie), NIE o "lead magnecie" (wiertło/narzędzie)
- ✅ Każde CTA to ta sama idea wyrażona inaczej

---

## PRZED WYGENEROWANIEM FINALNEJ WERSJI:

1. Napisz pierwszy draft całego wstępu
2. Przeczytaj na głos (w myślach)
3. Zaznacz wszystkie powtórzenia istotnych słów między zdaniami
4. Zamień powtórzone słowa na synonimy z listy powyżej
5. **KRYTYCZNE:** Sprawdź zdanie 2 w Sekcji 1 - czy reakcja jest NA POMYSŁ (nie na działanie)?
6. Sprawdź czy wszystkie 5 CTA mówią o PRAGNIENIU (otworach), nie o narzędziu (wiertle)
7. Sprawdź czy wszystkie punkty checklisty są ✅
8. Dopiero wtedy zwróć finalną wersję

**PAMIĘTAJ:**
- Powtórzenia to najczęstszy błąd AI
- Zakładanie że odbiorca używa nienawidzonej metody to drugi najczęstszy błąd
- Odbiorca WIE że metoda istnieje, ale NIE ROBI tego - ma reakcję na sam pomysł
- CTA o narzędziu zamiast o pragnieniu to trzeci najczęstszy błąd

**KRYTYCZNE:** Wszystkie powyższe kroki (1-8) wykonaj W MYŚLACH. NIE pisz ich w odpowiedzi. Użytkownik widzi tylko to co zwrócisz.

---

## FORMAT ODPOWIEDZI - KULOODPORNA INSTRUKCJA:

⚠️ **ABSOLUTNIE OBOWIĄZKOWE:**

Twoja odpowiedź to TYLKO 8 tagów XML z treścią.
ZERO dodatkowego tekstu. ZERO nagłówków. ZERO komentarzy. ZERO analiz.

❌ **NIE RÓB TEGO (złe przykłady):**

  ANALIZA PRZED GENEROWANIEM
  Pozwól, że najpierw przeanalizuję...

  DRAFT 1
  <p1>Jesteś twórcą treści...</p1>

  SPRAWDZENIE POWTÓRZEŃ
  🔴 ZNALEZIONO...

  FINALNA WERSJA
  <p1>Jesteś twórcą treści...</p1>

❌ **RÓWNIEŻ NIE RÓB TEGO:**

  Oto wygenerowany wstęp:

  <p1>Jesteś twórcą treści...</p1>

❌ **ANI TEGO (tekst między tagami):**

  <p1>Jesteś twórcą treści...</p1>

  Oto CTA:

  <cta_1>...</cta_1>

✅ **TYLKO TAK (dobry przykład):**

<p1>Jesteś twórcą treści, który ma wartościową wiedzę i rosnącą społeczność w social mediach. Wiesz co to agresywne pitchowanie w komentarzach i spam w wiadomościach prywatnych, ale na samą myśl o robieniu tego samego czujesz skręt w żołądku. Codziennie słyszysz buzzwordy jak: "engagement", "zasięgi organiczne", "algorytm", "konwersja", "funnel" – wszyscy mówią Ci, że musisz budować większą społeczność, żeby w ogóle myśleć o zarobku...</p1>
<p2>Tak naprawdę chcesz tylko...</p2>
<p3>Ten ebook pokaże Ci dokładnie...</p3>
<cta_1>aby pragnienie krótko wariant 1.</cta_1>
<cta_2>aby pragnienie krótko wariant 2.</cta_2>
<cta_3>aby pragnienie krótko wariant 3.</cta_3>
<cta_4>aby pragnienie krótko wariant 4.</cta_4>
<cta_5>aby pragnienie krótko wariant 5.</cta_5>

---

## PODSUMOWANIE - CO ZWRÓCIĆ:

1. **Zacznij od tagu <p1>** (np. "<p1>Jesteś...")
2. **Skończ na tagu </cta_5>**
3. **ZERO** dodatkowych elementów przed <p1>, po </cta_5>, ani między tagami
4. **Tylko 8 tagów XML** - żadnego markdown, żadnych bloków kodu, żadnych nagłówków

Jeśli widzisz słowa jak: "ANALIZA", "DRAFT", "SPRAWDZENIE", "FINALNA WERSJA", "Oto wygenerowany" lub bloki kodu - **USUŃ JE**.

---

ROZPOCZNIJ GENEROWANIE - ZWRÓĆ TYLKO 8 TAGÓW XML.`;

  return prompt;
}

// Obsługa innych metod HTTP
export async function GET() {
  return NextResponse.json(
    { error: 'Ta metoda nie jest obsługiwana. Użyj metody POST.' },
    { status: 405 }
  );
}