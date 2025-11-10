// src/app/api/pages/ai-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Interfejs dla odpowiedzi z API Anthropic
interface AnthropicResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  id: string;
  model: string;
  role: string;
  type: string;
}

// Interfejs dla struktury JSON generowanej przez AI
interface PageContentJSON {
  pageContent: {
    hero: {
      headline: string;
      subheadline: string;
      description: string;
    };
    benefits: {
      items: Array<{
        title: string;
        text: string;
      }>;
    };
    testimonials: {
      items: Array<{
        text: string;
        author: string;
        role: string;
      }>;
    };
    content: {
      chapters: Array<{
        title: string;
        description: string;
      }>;
    };
    form: {
      title: string;
    };
    faq: {
      items: Array<{
        question: string;
        answer: string;
      }>;
    };
  };
}

// Funkcja do wywołania API Anthropic
async function callAnthropicAPI(apiKey: string, prompt: string, model: string): Promise<AnthropicResponse> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model, // ✅ ZMIANA: Używaj parametru zamiast hardcoded
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Błąd API Anthropic:', errorData);
    throw new Error(`API Anthropic zwróciło błąd: ${response.status}`);
  }

  return response.json();
}

// Funkcja do parsowania odpowiedzi JSON z różnych formatów
function parseJSONFromResponse(responseText: string): PageContentJSON {
  // Próba bezpośredniego parsowania
  try {
    return JSON.parse(responseText.trim());
  } catch (error) {
    console.log('Bezpośrednie parsowanie JSON nie powiodło się, szukam w bloku markdown');

    // Szukanie JSON w bloku markdown
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (jsonError) {
        console.error('Nie udało się sparsować JSON z bloku kodu:', jsonError);
        throw new Error('Nie udało się sparsować JSON z bloku kodu');
      }
    } else {
      console.error('Nie znaleziono bloku kodu JSON w odpowiedzi');
      throw new Error('Nie udało się wyodrębnić poprawnego JSON z odpowiedzi');
    }
  }
}

// Funkcja do spłaszczenia struktury JSON do formatu bazy danych
function flattenPageContent(jsonContent: PageContentJSON): Record<string, string | null> {
  const flattened: Record<string, string | null> = {};

  // Sekcja Hero
  if (jsonContent.pageContent?.hero) {
    flattened.hero_headline = jsonContent.pageContent.hero.headline || null;
    flattened.hero_subheadline = jsonContent.pageContent.hero.subheadline || null;
    flattened.hero_description = jsonContent.pageContent.hero.description || null;
  }

  // Sekcja Benefits (max 4 elementy)
  if (jsonContent.pageContent?.benefits?.items) {
    const items = jsonContent.pageContent.benefits.items;
    for (let i = 0; i < Math.min(items.length, 4); i++) {
      flattened[`benefits_item_${i}_title`] = items[i].title || null;
      flattened[`benefits_item_${i}_text`] = items[i].text || null;
    }
  }

  // Sekcja Testimonials (max 3 elementy)
  if (jsonContent.pageContent?.testimonials?.items) {
    const items = jsonContent.pageContent.testimonials.items;
    for (let i = 0; i < Math.min(items.length, 3); i++) {
      flattened[`testimonials_item_${i}_text`] = items[i].text || null;
      flattened[`testimonials_item_${i}_author`] = items[i].author || null;
      flattened[`testimonials_item_${i}_role`] = items[i].role || null;
    }
  }

  // Sekcja Content Chapters (max 3 rozdziały)
  if (jsonContent.pageContent?.content?.chapters) {
    const chapters = jsonContent.pageContent.content.chapters;
    for (let i = 0; i < Math.min(chapters.length, 3); i++) {
      flattened[`content_chapter_${i}_title`] = chapters[i].title || null;
      flattened[`content_chapter_${i}_description`] = chapters[i].description || null;
    }
  }

  // Sekcja Form
  if (jsonContent.pageContent?.form) {
    flattened.form_title = jsonContent.pageContent.form.title || null;
  }

  // Sekcja FAQ (max 3 pytania)
  if (jsonContent.pageContent?.faq?.items) {
    const items = jsonContent.pageContent.faq.items;
    for (let i = 0; i < Math.min(items.length, 3); i++) {
      flattened[`faq_item_${i}_question`] = items[i].question || null;
      flattened[`faq_item_${i}_answer`] = items[i].answer || null;
    }
  }

  return flattened;
}

// GŁÓWNY HANDLER POST
export async function POST(request: NextRequest) {
  try {
    // 1. Autoryzacja użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
    }
    const userId = session.user.id;

    // ✅ DEFINICJE MODELI ZE ZMIENNYCH ŚRODOWISKOWYCH
    const BASIC_AI_MODEL = process.env.BASIC_AI_MODEL || 'claude-3-5-haiku-20241022';
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-20250514';

    // Domyślnie używamy basic model (możesz dodać logikę wyboru na podstawie ustawień użytkownika)
    const modelToUse = BASIC_AI_MODEL;

    // 2. Pobranie danych z ciała żądania
    const { pageId, ebookId } = await request.json();

    if (!pageId) {
      return NextResponse.json({ error: 'Nie podano identyfikatora strony (pageId).' }, { status: 400 });
    }

    if (!ebookId) {
      return NextResponse.json({ error: 'Nie podano identyfikatora e-booka (ebookId).' }, { status: 400 });
    }

    // 3. Weryfikacja, czy strona istnieje i należy do użytkownika
    const page = await prisma.pages.findUnique({
      where: { id: pageId },
      include: {
        ebook: true,
        user: true
      }
    });

    if (!page) {
      return NextResponse.json({ error: 'Strona o podanym ID nie została znaleziona.' }, { status: 404 });
    }

    if (page.userId !== userId && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień do modyfikacji tej strony.' }, { status: 403 });
    }

    // 4. Weryfikacja, czy e-book istnieje i należy do użytkownika
    const ebook = await prisma.ebooks.findUnique({
      where: { id: parseInt(ebookId) },
      include: {
        ebook_chapters: {
          orderBy: { position: 'asc' }
        }
      }
    });

    if (!ebook) {
      return NextResponse.json({ error: 'E-book o podanym ID nie został znaleziony.' }, { status: 404 });
    }

    if (ebook.userId !== userId && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień do użycia zawartości tego e-booka.' }, { status: 403 });
    }

    // 5. Sprawdzenie, czy treść dla tej strony już nie istnieje
    const existingContent = await prisma.page_content.findUnique({
      where: { pageId: pageId }
    });

    if (existingContent) {
      return NextResponse.json({
        error: 'Treść dla tej strony już istnieje. Usuń istniejącą treść przed wygenerowaniem nowej.'
      }, { status: 409 });
    }

    // 6. Przygotowanie treści e-booka do przetworzenia
    if (!ebook.ebook_chapters || ebook.ebook_chapters.length === 0) {
      return NextResponse.json({
        error: 'E-book nie zawiera żadnych rozdziałów do przetworzenia.'
      }, { status: 400 });
    }

    // Formatowanie rozdziałów dokładnie jak w Lambda
    let fullTextContent = '';
    ebook.ebook_chapters.forEach((chapter, index) => {
      fullTextContent += `Rozdział nr ${chapter.position} - ${chapter.title}\n`;
      fullTextContent += `Treść rozdziału: ${chapter.content || 'Brak treści'}\n\n`;
    });

    console.log(`Przygotowano ${ebook.ebook_chapters.length} rozdziałów do przetworzenia`);
    console.log(`Całkowita długość tekstu: ${fullTextContent.length} znaków`);

    // 7. Ograniczenie długości tekstu (jak w Lambda)
    const MAX_TEXT_LENGTH = 200000;
    const textContent = fullTextContent.length > MAX_TEXT_LENGTH
      ? fullTextContent.substring(0, MAX_TEXT_LENGTH)
      : fullTextContent;

    if (fullTextContent.length > MAX_TEXT_LENGTH) {
      console.log(`Tekst został przycięty do ${MAX_TEXT_LENGTH} znaków (${Math.round((MAX_TEXT_LENGTH/fullTextContent.length)*100)}% oryginalnej długości)`);
    }

    // 8. Przygotowanie promptu (DOKŁADNIE jak w Lambda)
    const prompt = `
Oto treść e-booka:

${textContent}

Na podstawie tej treści, wygeneruj wartości do poniższej struktury JSON. Każde pole ma szczegółowe instrukcje. Przeczytaj uważnie każdą instrukcję i na jej podstawie wygeneruj odpowiednią wartość.

Zwróć tylko kompletny JSON bez żadnego dodatkowego tekstu, komentarzy czy wyjaśnień.

Oto instrukcje dla każdego pola:

"pageContent.hero.headline": "Stwórz krótki, przyciągający uwagę główny nagłówek (5-7 słów) dla landing page oferującej przewodnik na temat przedstawiony w treści. Nagłówek powinien podkreślać główne korzyści i posiadać lekko emocjonalny wydźwięk. Używaj czasowników w trybie rozkazującym, by zachęcić do działania."

"pageContent.hero.subheadline": "Napisz zwięzły podtytuł (4-6 słów) uzupełniający główny nagłówek. Powinien jasno określać, czym jest oferowany produkt (przewodnik, ebook) i podkreślać jego kompletność/wszechstronność."

"pageContent.hero.description": "Utwórz jedno zdanie (20-30 słów) wyjaśniające korzyści płynące z tematu przewodnika. Wymień 2-3 konkretne zalety, używając czasowników takich jak 'wspierać', 'poprawiać', 'przedłużać'. Pisz bezpośrednio do czytelnika używając drugiej osoby ('Twoje zdrowie')."

"pageContent.benefits.items[0].title": "Napisz krótki tytuł (3-4 słowa) dla pierwszej korzyści z przewodnika, skupiając się na pierwszym głównym aspekcie tematu. Użyj przymiotnika w stopniu najwyższym (np. 'najlepsze') dla zwiększenia wartości."

"pageContent.benefits.items[0].text": "Stwórz jedno konkretne zdanie (10-15 słów) opisujące, co czytelnik zyska z przewodnika w kontekście pierwszego kluczowego aspektu tematu. Zacznij od czasownika w drugiej osobie ('poznasz', 'odkryjesz'). Podkreśl, że informacje są aktualne i praktycznie użyteczne."

"pageContent.benefits.items[1].title": "Utwórz krótki, przyciągający uwagę tytuł (3-5 słów) dla drugiej korzyści z przewodnika, skupiając się na drugim kluczowym aspekcie tematu. Tytuł powinien być rzeczowy i precyzyjny."

"pageContent.benefits.items[1].text": "Napisz jedno przejrzyste zdanie (10-15 słów) wyjaśniające, jak czytelnik skorzysta z drugiego kluczowego aspektu tematu. Użyj czasownika w drugiej osobie ('zrozumiesz') i zastosuj specjalistyczne pojęcie związane z tematem, co dodaje naukowego autorytetu."

"pageContent.benefits.items[2].title": "Stwórz zwięzły tytuł (3-4 słowa) dla trzeciej korzyści z przewodnika, skupiając się na trzecim kluczowym aspekcie tematu. Tytuł powinien sugerować spersonalizowane podejście."

"pageContent.benefits.items[2].text": "Napisz jedno zdanie (10-15 słów) opisujące korzyść dotyczącą trzeciego kluczowego aspektu. Zacznij od czasownika w drugiej osobie ('odkryjesz') i podkreśl, że informacje są dostosowane do różnych potrzeb, co zwiększa użyteczność przewodnika."

"pageContent.benefits.items[3].title": "Stwórz krótki tytuł (2-3 słowa) dla czwartej korzyści, skupiający się na praktycznym aspekcie tematu. Tytuł powinien być rzeczowy i zwięzły, sugerujący praktyczną wiedzę."

"pageContent.benefits.items[3].text": "Napisz jedno zdanie (12-18 słów) wyjaśniające, jak czytelnik nauczy się rozpoznawać jakość lub wartość związaną z tematem. Użyj kontrastujących określeń (np. 'wysokiej jakości' vs 'nieskuteczne zamienniki') dla podkreślenia wartości tej wiedzy. Zacznij od czasownika 'nauczysz się'."

"pageContent.testimonials.items[0].text": "Napisz krótką, wiarygodnie brzmiącą rekomendację (12-15 słów) od zadowolonej czytelniczki e-booka. Użyj mocnego czasownika ('zmienił', 'zrewolucjonizował') odnoszącego się do podejścia do tematu. Zakończ zdecydowaną rekomendacją z wykrzyknikiem."

"pageContent.testimonials.items[0].author": "Wymyśl typowe polskie imię i nazwisko dla kobiety, która mogłaby być autorką pozytywnej opinii o przewodniku."

"pageContent.testimonials.items[0].role": "Podaj jednowyrazową nazwę profesji związanej z tematyką przewodnika, która zwiększyłaby wiarygodność opinii."

"pageContent.testimonials.items[1].text": "Stwórz autentycznie brzmiącą opinię (10-15 słów) od czytelnika, która podkreśla przystępność i jasność przewodnika. Zacznij od wyrażenia ulgi ('Nareszcie', 'Wreszcie') i wspomnij o skomplikowanym temacie, który został wyjaśniony w prosty sposób. Zakończ krótką, entuzjastyczną oceną."

"pageContent.testimonials.items[1].author": "Wymyśl typowe polskie imię i nazwisko dla mężczyzny, który mógłby być autorem pozytywnej opinii o przewodniku."

"pageContent.testimonials.items[1].role": "Podaj dwuwyrazową nazwę profesji związanej z tematyką przewodnika, która zwiększyłaby wiarygodność opinii."

"pageContent.testimonials.items[2].text": "Napisz krótką, wiarygodną opinię (10-12 słów) od czytelniczki podkreślającą praktyczny charakter porad z przewodnika. Użyj sformułowania sugerującego natychmiastowe zastosowanie porad ('od razu wdrożyłam') i zakończ osobistym podziękowaniem."

"pageContent.testimonials.items[2].author": "Wymyśl typowe polskie imię i nazwisko dla kobiety, która mogłaby być autorką pozytywnej opinii o przewodniku."

"pageContent.testimonials.items[2].role": "Utwórz krótki opis (3-4 słowa) statusu rodzinnego osoby, która nie jest ekspertem w dziedzinie, ale jej opinia jako zwykłego użytkownika zwiększa wiarygodność przewodnika dla przeciętnych czytelników."

"pageContent.content.chapters[0].title": "Napisz krótki tytuł (5-7 słów) dla pierwszego rozdziału przewodnika, który wprowadza podstawowe informacje o temacie. Tytuł powinien jasno sugerować, że to początkowy, fundamentalny rozdział zawierający kluczowe informacje."

"pageContent.content.chapters[0].description": "Utwórz jedno zdanie (12-15 słów) opisujące zawartość pierwszego, wprowadzającego rozdziału. Zacznij od czasownika w trybie rozkazującym ('Zrozum', 'Poznaj') i wymień 2 kluczowe aspekty tematu, które zostaną omówione."

"pageContent.content.chapters[1].title": "Stwórz zwięzły tytuł (4-5 słów) dla drugiego rozdziału przewodnika, który będzie porównywał dwa kluczowe aspekty tematu. Użyj konstrukcji kontrastującej z 'vs.' lub 'a', by podkreślić porównawczy charakter rozdziału."

"pageContent.content.chapters[1].description": "Napisz jedno zdanie (10-15 słów) opisujące drugi rozdział przewodnika, skupiający się na porównaniu dwóch kluczowych aspektów tematu. Użyj słowa 'porównanie' i wspomnij konkretnie o praktycznych zastosowaniach."

"pageContent.content.chapters[2].title": "Napisz krótki tytuł (5-6 słów) dla trzeciego rozdziału przewodnika, który omawia temat w kontekście różnorodnych zastosowań lub potrzeb. Tytuł powinien sugerować spersonalizowane podejście."

"pageContent.content.chapters[2].description": "Utwórz jedno konkretne zdanie (10-15 słów) opisujące zawartość trzeciego rozdziału przewodnika, który omawia różne aspekty tematu w kontekście różnorodnych potrzeb. Wymień konkretnie 3-4 przykłady lub grupy odbiorców, by podkreślić wszechstronność treści."

"pageContent.form.title": "Napisz krótki, zachęcający do działania nagłówek (6-8 słów) dla formularza do pobrania darmowego przewodnika. Użyj czasownika w trybie rozkazującym ('Pobierz'), podkreśl, że przewodnik jest bezpłatny i dodaj wyrażenie sugerujące natychmiastowość ('już teraz', 'natychmiast') zakończone wykrzyknikiem."

"pageContent.faq.items[0].question": "Sformułuj proste pytanie (5-7 słów) dotyczące bezpłatności e-booka, które mogłoby się pojawić w sekcji FAQ. Pytanie powinno odzwierciedlać potencjalną wątpliwość (użyj słowa 'naprawdę') czytelnika odnośnie tego, czy oferta jest rzeczywiście darmowa."

"pageContent.faq.items[0].answer": "Napisz jasną, jednoznaczną odpowiedź (15-20 słów) na pytanie o bezpłatność e-booka. Zacznij od zdecydowanego potwierdzenia ('Tak'), podkreśl, że jest 'całkowicie bezpłatny' i dodaj proste instrukcje, co należy zrobić, aby go otrzymać (wypełnić formularz)."

"pageContent.faq.items[1].question": "Sformułuj pytanie (8-10 słów) dotyczące czasu dostarczenia e-booka po wypełnieniu formularza, które mogłoby się pojawić w sekcji FAQ. Pytanie powinno być proste i bezpośrednie, z naciskiem na szybkość dostawy."

"pageContent.faq.items[1].answer": "Napisz precyzyjną odpowiedź (15-20 słów) na pytanie o czas dostarczenia e-booka. Podkreśl natychmiastowość procesu ('natychmiast po wypełnieniu') i wyjaśnij, że będzie to automatyczna wiadomość wysłana na adres e-mail."

"pageContent.faq.items[2].question": "Sformułuj krótkie pytanie (6-8 słów) dotyczące formatu, w jakim dostępny jest e-book, które mogłoby się pojawić w sekcji FAQ. Pytanie powinno być proste i bezpośrednie."

"pageContent.faq.items[2].answer": "Napisz kompletną odpowiedź (15-20 słów) na pytanie o format e-booka. Wymień konkretny format (PDF) i podkreśl jego uniwersalność, wymieniając różne urządzenia, na których można go otworzyć (komputer, tablet, smartfon)."
`;

    // 9. Pobranie klucza API Anthropic
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      console.error('Brak klucza API Anthropic w zmiennych środowiskowych');
      return NextResponse.json({
        error: 'Konfiguracja serwera nieprawidłowa. Skontaktuj się z administratorem.'
      }, { status: 500 });
    }

    // 10. Wywołanie API Anthropic
    console.log('Wysyłanie żądania do API Anthropic...');
    console.log(`🤖 Używam modelu: ${modelToUse}`);
    const apiResponse = await callAnthropicAPI(anthropicApiKey, prompt, modelToUse);
    console.log('Otrzymano odpowiedź z API Anthropic');

    // 11. Parsowanie odpowiedzi JSON
    let jsonContent: PageContentJSON;

    if (apiResponse.content && apiResponse.content.length > 0) {
      const responseText = apiResponse.content[0].text;
      jsonContent = parseJSONFromResponse(responseText);
      console.log('Pomyślnie sparsowano odpowiedź JSON');
    } else {
      console.error('Nieprawidłowy format odpowiedzi z API Anthropic');
      throw new Error('Nieprawidłowy format odpowiedzi z API Anthropic');
    }

    // 12. Spłaszczenie struktury JSON do formatu bazy danych
    const flattenedContent = flattenPageContent(jsonContent);
    console.log(`Przygotowano ${Object.keys(flattenedContent).length} pól do zapisania`);

    // 13. Zapisanie do bazy danych
    const pageContent = await prisma.page_content.create({
      data: {
        pageId: pageId,
        userId: userId,
        ebookId: parseInt(ebookId),
        ...flattenedContent
      }
    });

    console.log(`Pomyślnie utworzono treść strony z ID: ${pageContent.id}`);

    // 14. Opcjonalnie: aktualizacja statusu strony na 'pending' lub 'ready'
    await prisma.pages.update({
      where: { id: pageId },
      data: {
        status: 'pending',
        headline: flattenedContent.hero_headline || page.headline // Aktualizacja headline jeśli został wygenerowany
      }
    });

    // 15. Zwrócenie sukcesu
    return NextResponse.json({
      success: true,
      message: 'Treść strony została pomyślnie wygenerowana',
      pageContentId: pageContent.id,
      fieldsGenerated: Object.keys(flattenedContent).length
    }, { status: 201 });

  } catch (error) {
    console.error('Błąd podczas generowania treści AI:', error);

    // Rozróżnienie typów błędów dla lepszego debugowania
    if (error instanceof Error) {
      if (error.message.includes('API Anthropic')) {
        return NextResponse.json({
          error: 'Błąd komunikacji z usługą AI. Spróbuj ponownie za chwilę.'
        }, { status: 503 });
      }

      if (error.message.includes('JSON')) {
        return NextResponse.json({
          error: 'Błąd przetwarzania odpowiedzi AI. Skontaktuj się z administratorem.'
        }, { status: 500 });
      }

      return NextResponse.json({
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      error: 'Wystąpił nieoczekiwany błąd podczas generowania treści.'
    }, { status: 500 });
  }
}

// Endpoint GET do sprawdzenia, czy treść już istnieje
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const pageId = searchParams.get('pageId');

    if (!pageId) {
      return NextResponse.json({ error: 'Nie podano identyfikatora strony.' }, { status: 400 });
    }

    const pageContent = await prisma.page_content.findUnique({
      where: { pageId: pageId },
      include: {
        page: true,
        ebook: true
      }
    });

    if (!pageContent) {
      return NextResponse.json({ exists: false });
    }

    // Sprawdzenie uprawnień
    if (pageContent.userId !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });
    }

    return NextResponse.json({
      exists: true,
      content: pageContent,
      createdAt: pageContent.createdAt,
      updatedAt: pageContent.updatedAt
    });

  } catch (error) {
    console.error('Błąd podczas sprawdzania treści:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas sprawdzania treści.'
    }, { status: 500 });
  }
}