// src/app/api/anthropic/generate-single-chapter/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint, getUserAiSettings } from '@/lib/user-api-keys';

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

interface Chapter {
  id: string;
  title: string;
  content?: string;
  position?: number;
}

interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  source?: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  console.log('Otrzymano zadanie POST do /api/anthropic/generate-single-chapter');

  try {
    const body = await request.json();
    const { title, subtitle, chapter, allChapters, description, scrapedContent, lang } = body;
    const pl = lang === 'pl'; // język aplikacji; brak → EN

    // Walidacja podstawowych danych
    if (!title || !chapter || !chapter.title) {
      return NextResponse.json(
        { error: 'Nieprawidlowe dane wejsciowe. Wymagany tytul e-booka i informacje o rozdziale.' },
        { status: 400 }
      );
    }

    // NOWA LOGIKA: Pobierz klucz API uzytkownika z fallback na env var
    const userId = session.user.id;
    const { apiKey: anthropicApiKey, source: keySource } = await getApiKeyForEndpoint(
      userId,
      'anthropic',
      'ANTHROPIC_API_KEY'
    );

    if (!anthropicApiKey) {
      console.error('Brak dostepnego klucza Anthropic API (ani uzytkownika, ani env var)');
      return NextResponse.json(
        { error: 'Blad konfiguracji - brak klucza API Anthropic' },
        { status: 500 }
      );
    }

    // NOWA LOGIKA: Pobierz ustawienia AI uzytkownika
    const BASIC_AI_MODEL = process.env.BASIC_AI_MODEL || 'claude-3-5-haiku-20241022';
    const PREMIUM_AI_MODEL = process.env.PREMIUM_AI_MODEL || 'claude-sonnet-4-20250514';

    const userAiSettings = await getUserAiSettings(userId);
    const modelToUse = userAiSettings.textAiModel === 'claude-3-sonnet'
      ? PREMIUM_AI_MODEL
      : BASIC_AI_MODEL;

    console.log(`Uzywam modelu: ${modelToUse} (provider: ${userAiSettings.textAiProvider})`);
    console.log(`Zrodlo klucza API: ${keySource} ${keySource === 'user' ? '(klucz uzytkownika)' : '(klucz systemowy)'}`);

    // Funkcja do budowania kontekstu spisu tresci
    const buildTableOfContentsContext = (chapters: Chapter[]): string => {
      if (!chapters || chapters.length === 0) {
        return '';
      }

      let context = '\n\n=== PELNY SPIS TRESCI E-BOOKA ===\n';
      context += 'Kontekst calego e-booka dla zachowania spojnosci:\n\n';

      chapters.forEach((ch, index) => {
        const isCurrentChapter = ch.id === chapter.id || ch.title === chapter.title;
        context += `${index + 1}. ${ch.title}${isCurrentChapter ? ' <- AKTUALNIE GENEROWANY ROZDZIAL' : ''}\n`;
      });

      context += '\n=== INSTRUKCJE SPOJNOSCI ===\n';
      context += '• Wygenerowana tresc musi byc spojna z pozostalymi rozdzialami\n';
      context += '• Odwoluj sie do poprzednich rozdzialow gdy to ma sens (np. "jak wspomnieliśmy wczesniej")\n';
      context += '• Przygotowuj grunt pod nastepne rozdzialy gdy to naturalne\n';
      context += '• Zachowaj jednolity ton i styl pisania w calym e-booku\n';
      context += '• Unikaj powtarzania tresci z innych rozdzialow\n\n';

      return context;
    };

    // Funkcja do budowania kontekstu ze zrodel naukowych
    const buildSourcesContext = (sources: ScrapedContent[]): string => {
      if (!sources || sources.length === 0) {
        return '';
      }

      let context = '\n\n=== ZRODLA NAUKOWE DO WYKORZYSTANIA ===\n';
      context += 'Ponizsze zrodla moga byc wykorzystane w tresci rozdzialu:\n\n';

      sources.forEach((source, index) => {
        context += `ZRODLO ${index + 1}:\n`;
        context += `• Tytul: ${source.title}\n`;
        context += `• URL: ${source.url}\n`;
        if (source.source) {
          context += `• Pochodzenie: ${source.source}\n`;
        }
        context += `• Tresc/Abstract: ${source.content}\n\n`;
      });

      context += '=== INSTRUKCJE DLA ZRODEL ===\n';
      context += '• Wykorzystaj informacje ze zrodel gdy sa relevatne dla tego rozdzialu\n';
      context += '• Nie kopiuj doslownie - przeformulowuj i adaptuj tresc\n';
      context += '• Jesli uzywasz danych z badan, wspomnij ze sa to wyniki badan naukowych\n';
      context += '• Zachowaj merytorycznosc i rzetelnosc naukowa\n';
      context += '• Mozesz dodac ogolne referencje typu "badania wskazuja" bez podawania konkretnych cytowan\n\n';

      return context;
    };

    // Funkcja do budowania kontekstu uzytkownika
    const buildUserContext = (userDescription: string): string => {
      if (!userDescription || userDescription.trim() === '') {
        return '';
      }

      return `\n\n=== PREFERENCJE STYLU I TRESCI ===\n${userDescription.trim()}\n\n=== INSTRUKCJE STYLISTYCZNE ===\n• Dostosuj poziom jezyka i szczegolowosci do grupy docelowej\n• Zachowaj styl pisania preferowany przez uzytkownika\n• Uwzglednij wskazane priorytety tematyczne\n• Dopasuj ton do oczekiwan czytelnikow\n\n`;
    };

    // Funkcja do okreslenia pozycji rozdzialu w spisie
    const getChapterPosition = (chapters: Chapter[], currentChapter: Chapter): { position: number; total: number; isFirst: boolean; isLast: boolean } => {
      const position = chapters.findIndex(ch => ch.id === currentChapter.id || ch.title === currentChapter.title) + 1;
      const total = chapters.length;
      return {
        position: position || 1,
        total,
        isFirst: position === 1,
        isLast: position === total
      };
    };

    console.log(`Generowanie tresci dla rozdzialu: "${chapter.title}"`);

    // Zbuduj rozszerzony prompt
    let prompt = `Napisz tresc rozdzialu "${chapter.title}" dla e-booka zatytulowanego "${title}"`;

    if (subtitle) {
      prompt += `, z podtytulem "${subtitle}"`;
    }

    prompt += '.\n\n';

    // Dodaj kontekst uzytkownika
    if (description && description.trim()) {
      prompt += buildUserContext(description);
    }

    // Dodaj kontekst spisu tresci
    if (allChapters && Array.isArray(allChapters) && allChapters.length > 0) {
      prompt += buildTableOfContentsContext(allChapters);

      const chapterPos = getChapterPosition(allChapters, chapter);
      prompt += `=== POZYCJA W STRUKTURZE ===\n`;
      prompt += `To jest rozdzial ${chapterPos.position} z ${chapterPos.total} w e-booku.\n`;

      if (chapterPos.isFirst) {
        prompt += `Jest to rozdzial wprowadzajacy - ustaw odpowiedni ton dla calego e-booka.\n`;
      } else if (chapterPos.isLast) {
        prompt += `Jest to ostatni rozdzial - podsumuj kluczowe watki i daj praktyczne wnioski.\n`;
      } else {
        prompt += `Nawiazuj do wczesniejszych rozdzialow i przygotowuj grunt pod kolejne.\n`;
      }
      prompt += '\n';
    }

    // Dodaj kontekst ze zrodel naukowych
    if (scrapedContent && Array.isArray(scrapedContent) && scrapedContent.length > 0) {
      prompt += buildSourcesContext(scrapedContent);
    }

    // Glowne wymagania dla tresci
    prompt += `=== WYMAGANIA DLA TRESCI ROZDZIALU ===\n`;
    prompt += `• KRYTYCZNE: Rozdzial MUSI zawierac minimum 3500 znakow (nie mniej!)\n`;
    prompt += `• DOCELOWO: 4000-4500 znakow (1.5-2.5 strony A4)\n`;
    prompt += `• STRUKTURA: Minimum 4-5 pelnych akapitow po 700-900 znakow kazdy\n`;
    prompt += `• KAZDY AKAPIT: 6-8 pelnych zdan z rozwinieciem i przykladami\n`;
    prompt += `• JESLI tresc wydaje sie za krotka - rozwin kazdy punkt o dodatkowe szczegoly\n`;
    prompt += `• LEPIEJ za duzo niz za malo - czytelnik moze pominac, ale nie moze przeczytac tego czego nie ma\n`;
    prompt += `• NIE rozpoczynaj tresci od nazwy rozdzialu - idz od razu do merytoryki\n`;
    prompt += `• Struktura: wprowadzenie -> rozwiniecie -> praktyczne wnioski/podsumowanie\n`;
    prompt += `• Jezyk profesjonalny ale przystepny, dostosowany do grupy docelowej\n`;
    prompt += `• Unikaj podtytulow, numeracji i formatowania markdown\n`;
    prompt += `• Dodaj wartosc praktyczna - czytelnicy powinni cos konkretnego wyniesc\n`;

    if (subtitle) {
      prompt += `• Uwzglednij kontekst z podtytulu: "${subtitle}"\n`;
    }

    if (scrapedContent && Array.isArray(scrapedContent) && scrapedContent.length > 0) {
      prompt += `• Wykorzystaj dostarczone zrodla naukowe tam gdzie to celowe\n`;
      prompt += `• Zachowaj rzetelnosc merytoryczna oparta na badaniach\n`;
    }

    if (description && description.trim()) {
      prompt += `• Zastosuj preferencje stylistyczne podane przez uzytkownika\n`;
    }

    prompt += `\n=== KONTROLA DLUGOSCI ===\n`;
    prompt += `PAMIETAJ: Sprawdz czy Twoja odpowiedz zawiera co najmniej 3500 znakow.\n`;
    prompt += `Jesli nie - dodaj wiecej szczegolów, przykladow i rozwiniec do kazdego akapitu.\n`;
    prompt += `To nie jest sugestia - to jest wymaganie.\n\n`;

    prompt += `=== JEZYK / LANGUAGE ===\n`;
    prompt += pl
      ? `Napisz CALA tresc rozdzialu w jezyku POLSKIM.\n\n`
      : `Write the ENTIRE chapter content in ENGLISH.\n\n`;

    prompt += `=== FORMAT ODPOWIEDZI ===\n`;
    prompt += `Zwroc tylko czysta tresc rozdzialu bez dodatkowych komentarzy, tytulow czy formatowania.`;

    // Przygotuj zadanie do Anthropic API
    const requestBody: AnthropicRequest = {
      model: modelToUse,
      max_tokens: 4500, // ZWIEKSZONE z 4000 do 4500 dla dluzszej tresci
      temperature: 0.8, // ZWIEKSZONE z 0.7 do 0.8 dla bardziej rozwiniętych odpowiedzi
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    console.log('Wysylanie zapytania do Anthropic API...');
    console.log('Kontekst rozdzialu:', {
      chapterTitle: chapter.title,
      ebookTitle: title,
      hasSubtitle: !!subtitle,
      hasDescription: !!description,
      sourcesCount: scrapedContent?.length || 0,
      totalChapters: allChapters?.length || 0,
      promptLength: prompt.length,
      model: modelToUse,
      keySource: keySource,
      maxTokens: requestBody.max_tokens,
      temperature: requestBody.temperature
    });

    // ROZBUDOWANE LOGOWANIE PROMPTU (bez polskich znakow w logach)
    console.log('\n' + '='.repeat(80));
    console.log('PELNY PROMPT WYSYLANY DO MODELU');
    console.log('='.repeat(80));
    console.log('STATYSTYKI PROMPTU:');
    console.log(`   Dlugosc: ${prompt.length} znakow`);
    console.log(`   Model: ${modelToUse}`);
    console.log(`   Max tokens: ${requestBody.max_tokens}`);
    console.log(`   Temperature: ${requestBody.temperature}`);
    console.log(`   Rozdzial: "${chapter.title}"`);
    console.log(`   E-book: "${title}"`);
    console.log(`   Zrodla: ${scrapedContent?.length || 0}`);
    console.log(`   Spis tresci: ${allChapters?.length || 0} rozdzialow`);

    // DIAGNOSTYKA: Sprawdź czy prompt zawiera polskie znaki (powinien!)
    const polishCharsInPrompt = /[ąćęłńóśżź]/gi.test(prompt);
    const emojiInPrompt = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu.test(prompt);

    console.log(`   Polskie znaki w prompcie: ${polishCharsInPrompt ? 'TAK (prawidlowo)' : 'NIE'}`);
    console.log(`   Emoji w prompcie: ${emojiInPrompt ? 'TAK' : 'NIE'}`);

    // Test kodowania - policz znaki z polskimi literami
    const testString = "ąćęłńóśżź ĄĆĘŁŃÓŚŻŹ";
    console.log(`   Test kodowania: "${testString}" ma ${testString.length} znakow`);

    console.log('='.repeat(80));
    console.log('TRESC PROMPTU:');
    console.log('-'.repeat(50));
    console.log(prompt);
    console.log('-'.repeat(50));
    console.log('KONIEC PROMPTU');
    console.log('='.repeat(80) + '\n');

    // Wykonaj zapytanie do API Anthropic z kluczem uzytkownika lub systemowym
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Blad API Anthropic dla rozdzialu "${chapter.title}":`, errorText);
      console.error(`Status: ${response.status}, klucz z: ${keySource}`);
      return NextResponse.json(
        { error: `Blad podczas generowania tresci rozdzialu: ${response.status}` },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    const chapterContent = responseData.content[0].text;
    const contentLength = chapterContent.length;

    // ROZBUDOWANE LOGOWANIE ODPOWIEDZI (bez polskich znakow w logach)
    console.log('\nODPOWIEDZ Z API ANTHROPIC');
    console.log(`Dlugosc wygenerowanej tresci: ${contentLength} znakow`);
    console.log(`Uzycie tokenow:`, {
      inputTokens: responseData.usage?.input_tokens || 'brak danych',
      outputTokens: responseData.usage?.output_tokens || 'brak danych',
      totalTokens: (responseData.usage?.input_tokens || 0) + (responseData.usage?.output_tokens || 0)
    });
    console.log(`Stosunek dlugosci: ${(contentLength / prompt.length * 100).toFixed(1)}% dlugosci promptu`);
    console.log(`Efektywnosc: ${(contentLength / (responseData.usage?.output_tokens || 1)).toFixed(2)} znakow/token`);

    // WALIDACJA DLUGOSCI (bez emoji w logach)
    const expectedMinLength = 3500;
    const expectedMaxLength = 4500;

    if (contentLength < expectedMinLength) {
      console.warn(`\nOSTRZEZENIE: Tresc za krotka!`);
      console.warn(`   Otrzymano: ${contentLength} znakow`);
      console.warn(`   Oczekiwano: min ${expectedMinLength} znakow`);
      console.warn(`   Brakuje: ${expectedMinLength - contentLength} znakow`);
      console.warn(`   Model: ${modelToUse}`);
      console.warn(`   Max tokens: ${requestBody.max_tokens}`);
      console.warn(`   Uzyte tokeny: ${responseData.usage?.output_tokens || 'nieznane'}`);
      console.warn(`   Procent wykorzystania tokenow: ${((responseData.usage?.output_tokens || 0) / requestBody.max_tokens * 100).toFixed(1)}%`);
    } else if (contentLength > expectedMaxLength) {
      console.log(`\nINFO: Tresc dluzsza niz oczekiwano (${contentLength} > ${expectedMaxLength})`);
    } else {
      console.log(`\nOK: Dlugosc tresci w zakresie (${contentLength} znakow)`);
    }

    // Test kodowania w odpowiedzi
    const polishCharsInResponse = /[ąćęłńóśżź]/gi.test(chapterContent);
    console.log(`Polskie znaki w odpowiedzi: ${polishCharsInResponse ? 'TAK (prawidlowo)' : 'NIE'}`);

    console.log('\nPoczatek tresci:');
    console.log('"' + chapterContent.substring(0, 150) + '..."');
    console.log('\nKoniec tresci:');
    console.log('"...' + chapterContent.substring(contentLength - 150) + '"');

    // DODATKOWA DIAGNOSTYKA: Sprawdź czy odpowiedź została obcięta
    const seemsTruncated = chapterContent.endsWith('...') ||
                           chapterContent.endsWith('.') === false ||
                           chapterContent.trim().length < chapterContent.length - 10;

    if (seemsTruncated) {
      console.warn('UWAGA: Odpowiedz moze byc obcieta!');
    }

    console.log('KONIEC ODPOWIEDZI\n');

    // DODAJ DODATKOWY LOG o kontekście problemu
    console.log('ANALIZA PROBLEMU:');
    console.log(`   Prompt: ${prompt.length} znakow`);
    console.log(`   Odpowiedz: ${contentLength} znakow`);
    console.log(`   Ratio: ${(contentLength / prompt.length).toFixed(2)}`);
    console.log(`   Model: ${modelToUse}`);
    console.log(`   Wykorzystane tokeny: ${responseData.usage?.output_tokens || 0}/${requestBody.max_tokens}`);
    console.log(`   Wykorzystanie: ${((responseData.usage?.output_tokens || 0) / requestBody.max_tokens * 100).toFixed(1)}%`);

    if ((responseData.usage?.output_tokens || 0) < requestBody.max_tokens * 0.5) {
      console.log('   WNIOSEK: Model nie wykorzystuje dostepnych tokenow - mozliwa przyczyna:');
      console.log('     1. Model Haiku naturalnie pisze krotko');
      console.log('     2. Model ignoruje instrukcje o dlugosci');
      console.log('     3. Prompt nie jest wystarczajaco jasny');
      console.log('   REKOMENDACJA: Rozważ uzycie modelu Sonnet dla dluzszych tekstow');
    }

    console.log(`Pomyslnie wygenerowano tresc rozdzialu "${chapter.title}" (${contentLength} znakow, ${keySource})`);

    // Zwroc wygenerowana tresc rozdzialu z dodatkowymi metadanymi
    return NextResponse.json({
      chapter: {
        id: chapter.id,
        title: chapter.title,
        content: chapterContent.trim()
      },
      contextUsed: {
        hasDescription: !!description,
        sourcesCount: scrapedContent?.length || 0,
        totalChapters: allChapters?.length || 0,
        hasSubtitle: !!subtitle,
        modelUsed: modelToUse,
        keySource: keySource
      },
      // NOWE: Informacje o dlugosci i diagnostyce
      lengthInfo: {
        contentLength: contentLength,
        expectedRange: `${expectedMinLength}-${expectedMaxLength}`,
        isWithinRange: contentLength >= expectedMinLength && contentLength <= expectedMaxLength,
        promptLength: prompt.length,
        tokensUsed: responseData.usage || null,
        efficiency: contentLength / (responseData.usage?.output_tokens || 1),
        contentLengthRatio: (contentLength / prompt.length * 100)
      }
    });

  } catch (error) {
    console.error('Blad wewnetrzny serwera:', error);
    return NextResponse.json(
      {
        error: 'Blad wewnetrzny serwera podczas generowania tresci rozdzialu',
        details: error instanceof Error ? error.message : 'Nieznany blad'
      },
      { status: 500 }
    );
  }
}

// Obsluga innych metod HTTP
export async function GET() {
  return NextResponse.json(
    { error: 'Ta metoda nie jest obslugiwana. Uzyj metody POST.' },
    { status: 405 }
  );
}