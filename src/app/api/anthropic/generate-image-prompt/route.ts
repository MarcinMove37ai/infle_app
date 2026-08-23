// src/app/api/anthropic/generate-image-prompt/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint, getUserAiSettings } from '@/lib/user-api-keys';
import { callAnthropic, premiumModel, AnthropicError } from '@/lib/anthropic';

export const runtime = 'nodejs';

// 🎯 PROMPT CONFIGURATION FOR IMAGEN-3
const PROMPT_CONFIGS = {
  "imagen-3": {
    maxLength: 4000,
    optimalLength: 1200,
    targetLength: 1100,
    style: "photorealistic-standard",
    supportsComplexInstructions: true,
    qualityTarget: "high_realism",
    provider: "google",
    costEstimate: 0.03,
    enhancement_level: "standard_plus"
  }
};

// ✅ Generator elementów fotograficznych dla realizmu
const generatePhotographicElements = () => {
  const cameras = [
    "Canon EOS R5, 85mm f/1.8 lens",
    "Sony A7R IV, 50mm f/1.4 lens",
    "Nikon D850, 70-200mm f/2.8 lens",
    "Canon EOS 5D Mark IV, 85mm f/1.4 lens",
    "Sony A7III, 35mm f/1.8 lens",
    "Canon R6, 24-70mm f/2.8 lens"
  ];

  const lighting = [
    "soft golden hour lighting with warm atmospheric glow",
    "professional studio lighting with softbox setup",
    "natural window lighting with gentle highlights",
    "dramatic chiaroscuro lighting with deep shadows",
    "diffused overcast lighting with even illumination",
    "cinematic three-point lighting with rim effects"
  ];

  const qualityTerms = [
    "photorealistic, hyperrealistic, 8K UHD resolution",
    "professional photography, ultra-sharp focus, HDR",
    "commercial photography quality, detailed textures",
    "magazine-quality photography, crisp details",
    "high-end editorial photography, premium finish",
    "studio photography quality, perfect clarity"
  ];

  const compositions = [
    "rule of thirds composition, shallow depth of field",
    "centered composition with balanced framing",
    "dynamic diagonal composition with leading lines",
    "portrait orientation with professional framing",
    "artistic composition with negative space",
    "symmetrical composition with perfect balance"
  ];

  return {
    camera: cameras[Math.floor(Math.random() * cameras.length)],
    lighting: lighting[Math.floor(Math.random() * lighting.length)],
    quality: qualityTerms[Math.floor(Math.random() * qualityTerms.length)],
    composition: compositions[Math.floor(Math.random() * compositions.length)]
  };
};

export async function POST(request: Request) {
  const isInternalRequest = request.headers.get('x-internal-request') === 'true';

  if (!isInternalRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
  }

  console.log('📸 === MULTI-PROVIDER PHOTOREALISTIC PROMPT GENERATOR ===');

  try {
    const body = await request.json();
    const {
      title,
      subtitle,
      chapterTitle,
      chapterContent,
      allChapters,
      targetModel = "imagen-3",
      forceRegenerate = false,
      enableTransparency = true,
      maximumQuality = true
    } = body;

    // ✅ LOGIKA KLUCZY API
    // Ilustracje rozdziałów to zadanie kreatywne wymagające spójnego art direction
    // w obrębie całej książki — używamy mocniejszego modelu (premium).
    // BASIC_AI_MODEL byl tu zadeklarowany i nigdy nieuzywany — modelToUse
    // od poczatku startuje z premium.
    const PREMIUM_AI_MODEL = premiumModel();

    let anthropicApiKey: string | null = null;
    let keySource: 'user' | 'env' | 'none' = 'none';
    let userAiSettings: any = null;
    let modelToUse: string = PREMIUM_AI_MODEL;

    if (!isInternalRequest) {
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;

      if (userId) {
        const { apiKey, source } = await getApiKeyForEndpoint(
          userId,
          'anthropic',
          'ANTHROPIC_API_KEY'
        );
        anthropicApiKey = apiKey;
        keySource = source;

        userAiSettings = await getUserAiSettings(userId);
      }
    } else {
      anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? null;
      keySource = anthropicApiKey ? 'env' : 'none';
    }

    if (!anthropicApiKey) {
      console.error('❌ Brak dostępnego klucza Anthropic API');
      return NextResponse.json(
        { error: 'Błąd konfiguracji - brak klucza API Anthropic' },
        { status: 500 }
      );
    }

    // 🔥 KONFIGURACJA DLA IMAGEN-3
    const config = PROMPT_CONFIGS[targetModel as keyof typeof PROMPT_CONFIGS];

    if (!config) {
      console.warn(`⚠️ Unknown model: ${targetModel}, using Imagen-3 config`);
    }

    const finalConfig = config || PROMPT_CONFIGS["imagen-3"];

    console.log(`🔥 === PHOTOREALISTIC OPTIMIZATION ANALYSIS ===`);
    console.log(`   - Title: "${title}"`);
    console.log(`   - Chapter: "${chapterTitle}"`);
    console.log(`   - Content length: ${chapterContent?.length || 0} chars`);
    console.log(`   - Target model: ${targetModel} (${finalConfig.provider})`);
    console.log(`   - Force regenerate: ${forceRegenerate}`);
    console.log(`   - Enable transparency: ${enableTransparency}`);
    console.log(`   - Maximum quality: ${maximumQuality}`);
    console.log(`   - Optimal prompt length: ${finalConfig.optimalLength} chars`);
    console.log(`   - Enhancement level: ${finalConfig.enhancement_level}`);
    console.log(`   - Cost estimate: $${finalConfig.costEstimate}`);

    if (!title || !chapterTitle || !chapterContent) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe. Wymagany tytuł e-booka, tytuł rozdziału i treść.' },
        { status: 400 }
      );
    }

    // Generator elementów fotograficznych dla różnorodności
    const photoElements = generatePhotographicElements();
    const timestamp = new Date().toISOString();

    // Przygotowanie kontekstu
    let contextInfo = "";
    if (allChapters && Array.isArray(allChapters) && allChapters.length > 0) {
      const otherChapters = allChapters
        .filter(ch => ch.title !== chapterTitle)
        .map(ch => ch.title)
        .slice(0, 3);

      if (otherChapters.length > 0) {
        contextInfo = `\n\nKONTEKST EBOOKA - inne rozdziały: ${otherChapters.join(', ')}`;
      }
    }

    // 🎨 PROMPT — spektakularny fotorealizm: spójny styl serii + scena z treści rozdziału
    const prompt = `Jesteś dyrektorem artystycznym i fotografem tworzącym SERIĘ spektakularnych, fotorealistycznych ilustracji do książki — po jednej na rozdział. Cała seria ma wyglądać jak dzieło jednego twórcy: ten sam fotograficzny styl, paleta i nastrój w każdym rozdziale. Twoje obrazy są ostre, bogate w detale, przemyślane kompozycyjnie i robią wrażenie — nigdy banalne.

Twoim zadaniem jest napisanie promptu (po angielsku) dla modelu generowania obrazów, który stworzy ilustrację do JEDNEGO rozdziału tej książki.

KSIĄŻKA (wspólny kontekst dla całej serii ilustracji):
- Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}${contextInfo}

ROZDZIAŁ DO ZILUSTROWANIA:
- Tytuł rozdziału: "${chapterTitle}"

TREŚĆ ROZDZIAŁU (źródło konkretnej sceny):
${chapterContent}

---

DWIE WARSTWY, KTÓRE MUSISZ POGODZIĆ:

WARSTWA 1 — STYL CAŁEJ SERII (MUSI być identyczny w każdym rozdziale tej książki):
Medium jest USTALONE: wysokiej klasy FOTOREALIZM — albo realistyczna fotografia, albo hiperrealistyczny render 3D (wybierz to, co lepiej pasuje do tematu książki, i trzymaj się jednego w całej serii). Obraz ma być ostry, pełen detali, z realistycznym światłem, fakturami i głębią — jak profesjonalna fotografia lub kadr z high-endowej reklamy.
Wyprowadź spójny klucz wizualny WYŁĄCZNIE z tytułu i tematu CAŁEJ książki (nie z treści tego konkretnego rozdziału — bo wtedy każdy rozdział wyszedłby inny) i opisuj go zawsze tak samo:
- CHARAKTER ŚWIATŁA: jeden konsekwentny rodzaj (np. ciepłe naturalne światło dzienne, dramatyczne kinowe światło z głębokimi cieniami, czyste studyjne) — buduje nastrój i spójność.
- PALETA KOLORÓW: konkretna, ograniczona paleta (podaj realne kolory), spójna dla całej serii.
- NASTRÓJ: jedna konsekwentna atmosfera (np. warm and aspirational, focused and calm, bold and energetic).
- JAKOŚĆ: realistic, crisp focus, rich fine detail, professional photography quality, striking and memorable composition, depth and atmosphere.
BEZWZGLĘDNIE ZAKAZANE: flat illustration, vector art, cartoon, clip-art, minimalist corporate graphics, anime — wszystko, co płaskie lub uproszczone. To MA wyglądać realistycznie i bogato.

WARSTWA 2 — SYMBOLICZNA SCENA TEGO ROZDZIAŁU (różna w każdym rozdziale; ŚCIŚLE powiązana z jego TYTUŁEM):
Punktem wyjścia jest TYTUŁ tego rozdziału: "${chapterTitle}". To on, a nie ogólny temat książki, wyznacza, co przedstawia ilustracja.

Pomyśl dwustopniowo, zanim opiszesz scenę:
1) Wydobądź z tytułu rozdziału JEDNĄ kluczową ideę lub pojęcie — to, co ten konkretny rozdział komunikuje (treść rozdziału powyżej służy tylko do doprecyzowania detali i kontekstu, nie do rozmycia tematu).
2) Zaprojektuj jeden WYRAŹNY, fotorealistyczny SYMBOL lub wizualną METAFORĘ tej idei — konkretny obraz, który czytelnik natychmiast i jednoznacznie skojarzy z tytułem rozdziału. Powiązanie ma być ścisłe i czytelne, nie luźne.

Scena musi być wyraźnie różna od scen innych rozdziałów — bo każdy tytuł niesie inną ideę. To jedyny element zmienny w serii; fotograficzny styl, paleta i nastrój (Warstwa 1) pozostają wspólne.

UNIKAJ generycznych scen rodzajowych (osoba przy laptopie, biurko, uścisk dłoni, wykres na ekranie), CHYBA że taki obraz jest faktycznym, mocnym symbolem idei z tytułu. Domyślnie szukaj świeższej, bardziej symbolicznej metafory — pomysłowej, ale czytelnej.

WYMAGANIA TECHNICZNE (bezwzględne):
- Format poziomy 16:9, wysoka rozdzielczość, ostrość, mnóstwo detali
- NO promotional or marketing text: no advertising banners, no call-to-action, no slogans, headlines, posters, billboards, big captions, titles overlaid on the image, logos or watermarks. The image must never look like an ad. Natural, incidental environmental text is fine when the scene calls for it (e.g. a handwritten sticky note, a book spine, a faint shop sign in the background) — keep it minimal, secondary and contextual, never the focal point, and never leave artificial blank signs or empty screens where text would naturally be
- DO NOT include children, infants, or minors — adult or symbolic representations only
- No face looking directly at the camera, no direct eye contact with the viewer
- NEVER censor, cover, blur, pixelate, black-bar, smudge or obscure any face. No black bars, no blur over faces, no objects placed to hide a face. Achieve anonymity through framing only (profile, three-quarter, from behind, face turned away or out of frame, focus on hands or silhouette). Any face shown must be natural, sharp and uncensored — simply not looking at the camera
- Kompozycja czysta, z jednym wyraźnym punktem skupienia, ale bogata w realistyczny detal

ZASADA NADRZĘDNA:
Spójność fotorealistycznego stylu (Warstwa 1) jest nienaruszalna — wszystkie ilustracje mają wyglądać jak jedna seria zdjęć/renderów. Różnorodność dotyczy WYŁĄCZNIE sceny (Warstwa 2), a każda scena musi być wyraźnym, symbolicznym odzwierciedleniem TYTUŁU swojego rozdziału — powiązanie ścisłe i natychmiast czytelne, nigdy ozdobnik oderwany od tematu.

WYMAGANIA TECHNICZNE (bezwzględne):
- Format poziomy 16:9, wysoka rozdzielczość, ostrość, mnóstwo detali
- ABSOLUTELY NO TEXT, no letters, no words, no numbers anywhere in the image
- DO NOT include children, infants, or minors — adult or symbolic representations only
- No face looking directly at the camera, no direct eye contact with the viewer
- Kompozycja czysta, z jednym wyraźnym punktem skupienia, ale bogata w realistyczny detal

Napisz prompt po angielsku, długość około ${finalConfig.optimalLength} znaków. Zacznij prompt od precyzyjnego opisu sceny i fotorealistycznego stylu. NIE używaj słów-etykiet ani komentarzy — tylko gotowy prompt obrazu, bez prefiksu "PROMPT:".`;

    console.log(`📸 === SENDING PHOTOREALISTIC REQUEST ===`);
    console.log(`   - Provider: ${finalConfig.provider}`);
    console.log(`   - Model: ${targetModel}`);
    console.log(`   - Target length: ${finalConfig.optimalLength} chars`);
    console.log(`   - Photo elements: ${JSON.stringify(photoElements, null, 2)}`);

    // max_tokens podniesione z 600: prompt do grafiki ma 300-500 slow, ale przy
    // wlaczonym mysleniu jego tokeny tez licza sie do tego samego limitu.
    let imagePrompt: string;
    try {
      const result = await callAnthropic({
        apiKey: anthropicApiKey,
        model: modelToUse,
        prompt,
        maxTokens: 2500,
        maxAttempts: 3,
        label: 'generate-image-prompt',
      });
      imagePrompt = result.text;
    } catch (e) {
      const status = e instanceof AnthropicError ? e.status : 500;
      return NextResponse.json(
        { error: `Błąd podczas generowania promptu: ${status}` },
        { status },
      );
    }

    // Usuń ewentualny prefiks/cudzysłowy okalające
    imagePrompt = imagePrompt.replace(/^#+\s*PROMPT:?\s*/i, '').trim();
    imagePrompt = imagePrompt.replace(/^['"]+|['"]+$/g, '').trim();

    // ✅ WALIDACJA STYLOWO-NEUTRALNA
    // Nie narzucamy żadnej techniki (fotografia/ilustracja/3D — o tym decyduje styl
    // serii dobrany przez model). Pilnujemy WYŁĄCZNIE twardych, uniwersalnych wymogów:
    // brak tekstu, brak wizerunków dzieci, odniesienie do rozdziału.
    const requiredElements = {
      // Pilnujemy braku tekstu PROMOCYJNEGO/reklamowego (banery, CTA, slogany, logo) — naturalny
      // tekst środowiskowy (karteczka, grzbiet książki, szyld w tle) jest dozwolony i NIE jest wymuszany.
      'no_text': /(?:no promotional|no marketing|no advertising|no call-to-action|no slogan|no banner|no logo|never look like an ad|no headline)/i.test(imagePrompt),
      'no_minors': /(?:no children|no minors|no infants|adult|symbolic)/i.test(imagePrompt),
      'chapter_ref': imagePrompt.toLowerCase().includes(
        chapterTitle.toLowerCase().substring(0, 12)
      ),
    };

    const missingRequired = Object.entries(requiredElements)
      .filter(([, present]) => !present)
      .map(([key]) => key);

    if (missingRequired.length > 0) {
      console.warn(`🔧 Uzupełniam brakujące wymogi: ${missingRequired.join(', ')}`);
      let correctedPrompt = imagePrompt;

      if (!requiredElements['no_text']) {
        correctedPrompt += ` No promotional or marketing text, no advertising banners, no call-to-action, no slogans, headlines, posters, logos or watermarks; the image must never look like an ad. Natural incidental environmental text is fine when the scene calls for it, kept minimal and secondary.`;
      }
      if (!requiredElements['no_minors']) {
        correctedPrompt += ` Do not include children, infants, or minors — adult or symbolic representations only.`;
      }
      if (!requiredElements['chapter_ref']) {
        correctedPrompt += ` A fitting illustration for the chapter "${chapterTitle}".`;
      }

      // Przytnij do limitu modelu, gdyby uzupełnienia przekroczyły maxLength
      if (correctedPrompt.length > finalConfig.maxLength) {
        correctedPrompt = correctedPrompt.substring(0, finalConfig.maxLength);
      }

      // Po korekcie zaktualizuj flagi (na potrzeby metryk poniżej)
      requiredElements['no_text'] = true;
      requiredElements['no_minors'] = true;
      requiredElements['chapter_ref'] = true;

      imagePrompt = correctedPrompt;
    }

    // 📊 METRYKI JAKOŚCI (stylowo-neutralne)
    const overallQuality = (
      (requiredElements['no_text'] ? 0.34 : 0) +
      (requiredElements['no_minors'] ? 0.33 : 0) +
      (requiredElements['chapter_ref'] ? 0.33 : 0)
    );
    const isOptimalLength = imagePrompt.length >= (finalConfig.optimalLength - 200) &&
                           imagePrompt.length <= (finalConfig.optimalLength + 400);

    console.log(`📊 === QUALITY METRICS ===`);
    console.log(`   Target Model: ${targetModel} (${finalConfig.provider})`);
    console.log(`   Length: ${imagePrompt.length}/${finalConfig.maxLength} chars`);
    console.log(`   No-text clause: ${requiredElements['no_text'] ? '✅' : '❌'}`);
    console.log(`   No-minors clause: ${requiredElements['no_minors'] ? '✅' : '❌'}`);
    console.log(`   Chapter reference: ${requiredElements['chapter_ref'] ? '✅' : '❌'}`);
    console.log(`   Overall: ${(overallQuality * 100).toFixed(1)}%`);
    console.log(`   Model: ${modelToUse}`);
    console.log(`📝 Preview: ${imagePrompt.substring(0, 150)}...`);

    return NextResponse.json({
      success: true,
      imagePrompt: imagePrompt,
      promptLength: imagePrompt.length,
      targetModel: targetModel,
      overallQuality: overallQuality,
      requiredElements: requiredElements,
      isOptimalLength: isOptimalLength,
      diversityApplied: forceRegenerate,
      modelUsed: modelToUse,
      keySource: keySource,
      modelConfig: {
        provider: finalConfig.provider,
        maxLength: finalConfig.maxLength,
        optimalLength: finalConfig.optimalLength,
        costEstimate: finalConfig.costEstimate,
      },
      qualityValidation: {
        requiredElementsMissing: missingRequired,
        autoCorrectionsApplied: missingRequired.length > 0,
        readyForGeneration: missingRequired.length === 0,
      },
    });

  } catch (error) {
    console.error('❌ Błąd generowania photorealistic promptu:', error);
    return NextResponse.json({
      error: 'Błąd wewnętrzny serwera',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Photorealistic Prompt Generator for Professional Ebook Illustrations - Imagen-3 Optimized',
    version: "8.0-imagen3-only-with-retry",
    supportedModels: ['imagen-3'],
    defaultModel: 'imagen-3',
    provider: 'google',
    costPerGeneration: '$0.03',
    optimalPromptLength: 1200,
    focusAreas: {
      photorealisticElements: [
        'Camera parameters (Canon/Sony/Nikon + lens + aperture) - 20% weight',
        'Photorealistic terminology (photorealistic, hyperrealistic, 8K UHD) - 20% weight',
        'Specific lighting conditions (golden hour, studio, natural) - 15% weight',
        'Depth of field specifications (shallow DOF, bokeh) - 10% weight',
        'Sharp focus requirements (ultra-sharp, crisp) - 10% weight',
        'High resolution specs (8K, UHD, 4K) - 10% weight',
        'Professional photography terms - 5% weight',
        'No text enforcement - 10% weight'
      ],
      technicalRequirements: [
        'Transparent background support (when enabled)',
        'Chapter content relevance',
        'Professional ebook illustration standards'
      ]
    },
    qualityThresholds: {
      excellent: '85%+ (Ready for photorealistic generation)',
      good: '70-84% (Acceptable with minor issues)',
      poor: '<70% (Requires manual review)'
    },
    autoCorrection: {
      criticalElements: ['camera_params', 'photorealistic', 'no_text'],
      optionalThreshold: 2,
      smartTrimming: 'Preserves essential photorealistic elements'
    },
    retryLogic: {
      maxAttempts: 3,
      timeoutPerAttempt: '30s',
      exponentialBackoff: true
    }
  }, { status: 405 });
}