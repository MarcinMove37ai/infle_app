// src/lib/prompt-generators.ts
import { NextResponse } from 'next/server';

// --- Interfejsy dla danych wejściowych ---
interface ChapterPromptData {
  title: string;
  subtitle?: string;
  chapterTitle: string;
  chapterContent: string;
  allChapters: { title: string }[];
  targetModel?: string;
  forceRegenerate?: boolean;
  enableTransparency?: boolean;
  maximumQuality?: boolean;
}

interface CoverPromptData {
  title: string;
  subtitle?: string;
  chapters: { title: string; content: string }[];
}

// --- Funkcja do generowania promptu dla ROZDZIAŁU ---
// Logika przeniesiona z /api/anthropic/generate-image-prompt/route.ts
export async function generateChapterPrompt(data: ChapterPromptData) {
  console.log('🎨 === Calling generateChapterPrompt function ===');
  const {
    title,
    subtitle,
    chapterTitle,
    chapterContent,
    allChapters,
    targetModel = "gpt-image-1",
    forceRegenerate = false,
    enableTransparency = true,
    maximumQuality = true
  } = data;

  if (!title || !chapterTitle || !chapterContent) {
    throw new Error('Nieprawidłowe dane wejściowe. Wymagany tytuł e-booka, tytuł rozdziału i treść.');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY nie jest zdefiniowany');
    throw new Error('Błąd konfiguracji serwera: brak klucza ANTHROPIC_API_KEY');
  }

  // Tutaj wklejamy CAŁĄ resztę logiki z oryginalnego pliku generate-image-prompt/route.ts
  // od miejsca przygotowania `prompt` aż do `return NextResponse.json`
  // Zastępujemy `return NextResponse.json` zwykłym `return { ... }`

  const contextInfo = allChapters && Array.isArray(allChapters) && allChapters.length > 0
    ? `\n\nKONTEKST CAŁEGO EBOOKA - inne rozdziały: ${allChapters.map(ch => ch.title).slice(0, 10).join(', ')}`
    : '';

  const prompt = `Jesteś ekspertem w tworzeniu ULTRA-SZCZEGÓŁOWYCH promptów dla GPT-Image-1...

  INFORMACJE O EBOOKU:
  - Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}
  - Rozdział: "${chapterTitle}"${contextInfo}

  TREŚĆ ROZDZIAŁU DO WIZUALNEJ INTERPRETACJI:
  ${chapterContent}

  ... // UWAGA: Wklej tutaj CAŁY, bardzo długi szablon promptu, który miałeś w oryginalnym pliku
  `;

  const requestBody = {
    model: 'claude-3-haiku-20240307',
    max_tokens: 1800,
    temperature: forceRegenerate ? 0.4 : 0.3,
    messages: [{ role: 'user', content: prompt }]
  };

  console.log('🔄 Wysyłanie zapytania do Claude o prompt dla rozdziału...');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Błąd API Anthropic (rozdział):`, errorText);
    throw new Error(`Błąd podczas generowania promptu dla rozdziału: ${errorText}`);
  }

  const responseData = await response.json();
  const imagePrompt = responseData.content[0].text.trim();

  // Zwracamy obiekt z danymi zamiast NextResponse
  return {
    success: true,
    imagePrompt: imagePrompt,
    promptLength: imagePrompt.length,
    // ... i wszystkie inne dane, które chcesz zwrócić
  };
}

// --- Funkcja do generowania promptu dla OKŁADKI ---
// Logika przeniesiona z /api/anthropic/generate-cover-prompt/route.ts
export async function generateCoverPrompt(data: CoverPromptData) {
  console.log('🎨 === Calling generateCoverPrompt function ===');
  const { title, subtitle, chapters } = data;

  if (!title || !chapters || !Array.isArray(chapters)) {
    throw new Error('Nieprawidłowe dane wejściowe. Wymagany tytuł ebooka i lista rozdziałów.');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY nie jest zdefiniowany');
    throw new Error('Błąd konfiguracji serwera: brak klucza ANTHROPIC_API_KEY');
  }

  const chaptersContext = chapters.slice(0, 10).map((ch: any, index: number) => `${index + 1}. ${ch.title}`).join('\n');
  const contentSamples = chapters.slice(0, 5).map((ch: any) => ch.content ? ch.content.trim().substring(0, 300) + '...' : '').filter(Boolean).join('\n\n');

  const prompt = `Jesteś ekspertem w tworzeniu ULTRA-SZCZEGÓŁOWYCH promptów okładek książek...

  INFORMACJE O EBOOKU:
  - Tytuł: "${title}"${subtitle ? `\n- Podtytuł: "${subtitle}"` : ''}

  ROZDZIAŁY EBOOKA:
  ${chaptersContext}

  ${contentSamples ? `PRÓBKI TREŚCI Z ROZDZIAŁÓW:\n${contentSamples}` : ''}

  ... // UWAGA: Wklej tutaj CAŁY, bardzo długi szablon promptu dla OKŁADKI, który miałeś w oryginalnym pliku
  `;

  const requestBody = {
    model: 'claude-3-haiku-20240307',
    max_tokens: 1800,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  };

  console.log('🔄 Wysyłanie zapytania do Claude o prompt dla okładki...');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Błąd API Anthropic (okładka):`, errorText);
    throw new Error(`Błąd podczas generowania promptu okładki: ${errorText}`);
  }

  const responseData = await response.json();
  const coverPrompt = responseData.content[0].text.trim();

  // Tutaj dodaj logikę czyszczenia i walidacji promptu okładki (funkcje cleanPromptFromForbiddenSupplements, etc.)
  // Te funkcje pomocnicze też możesz przenieść do tego pliku lib.

  return {
    success: true,
    coverPrompt: coverPrompt,
    // ... i wszystkie inne dane, które chcesz zwrócić
  };
}