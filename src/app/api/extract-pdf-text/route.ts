// src/app/api/extract-pdf-text/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import pdf from 'pdf-parse';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

interface ExtractedPdfContent {
  url: string;
  title: string;
  content: string;
  source: string;
  metadata?: {
    filename: string;
    pages: number;
    author?: string;
    subject?: string;
    creator?: string;
    fileSize: number;
  };
}

async function extractTextFromPdf(buffer: Buffer, filename: string, fileSize: number): Promise<ExtractedPdfContent> {
  try {
    console.log(`📄 Rozpoczynam ekstrakcję tekstu z PDF: ${filename}`);

    // Ekstrakcja tekstu z PDF
    const data = await pdf(buffer);

    console.log(`📊 Wyniki ekstrakcji:`);
    console.log(`   📄 Liczba stron: ${data.numpages}`);
    console.log(`   📝 Długość tekstu: ${data.text.length} znaków`);

    // Wyczyść i przetwórz tekst
    let cleanedText = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Sprawdź czy udało się wyodrębnić tekst
    if (!cleanedText || cleanedText.length < 20) {
      console.warn('⚠️ Bardzo mało tekstu wyodrębniono z PDF');
      if (cleanedText.length === 0) {
        cleanedText = 'Nie udało się wyodrębnić tekstu z tego PDF. PDF może zawierać tylko obrazy, być zaszyfrowany lub być skanem.';
      }
    }

    // Utwórz tytuł na podstawie nazwy pliku lub metadata
    let title = filename.replace(/\.pdf$/i, '');
    if (data.info?.Title && data.info.Title.trim()) {
      title = data.info.Title.trim();
    }

    const result: ExtractedPdfContent = {
      url: `pdf://${filename}`,
      title,
      content: cleanedText,
      source: 'PDF Document',
      metadata: {
        filename,
        pages: data.numpages,
        author: data.info?.Author?.trim(),
        subject: data.info?.Subject?.trim(),
        creator: data.info?.Creator?.trim(),
        fileSize
      }
    };

    console.log(`✅ Ekstrakcja zakończona pomyślnie:`);
    console.log(`   📄 Tytuł: ${result.title}`);
    console.log(`   📝 Tekst: ${result.content.length} znaków`);
    console.log(`   📖 Stron: ${result.metadata?.pages || 0}`);

    return result;

  } catch (error) {
    console.error('❌ Błąd podczas ekstrakcji tekstu z PDF:', error);
    throw new Error(`Błąd podczas przetwarzania PDF: ${error instanceof Error ? error.message : 'Nieznany błąd'}`);
  }
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    console.log('🚀 Rozpoczynam przetwarzanie uploadowanego PDF...');

    // Sprawdź Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Nieprawidłowy typ zawartości. Wymagany multipart/form-data.' },
        { status: 400 }
      );
    }

    // Pobierz dane z formularza
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nie znaleziono pliku PDF w żądaniu.' },
        { status: 400 }
      );
    }

    // Walidacja pliku
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Przesłany plik nie jest plikiem PDF.' },
        { status: 400 }
      );
    }

    // Sprawdź rozmiar pliku (maksymalnie 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Plik PDF jest za duży. Maksymalny rozmiar to 10MB.' },
        { status: 400 }
      );
    }

    console.log(`📋 Informacje o pliku:`);
    console.log(`   📄 Nazwa: ${file.name}`);
    console.log(`   📊 Rozmiar: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   🏷️ Typ: ${file.type}`);

    // ✅ DOSTOSOWANE DO TWOJEGO SYSTEMU - użyj tej samej logiki co avatary
    const baseDir = process.env.FILE_STORAGE_PATH || './.uploads';
    const tempDir = join(baseDir, 'temp');

    console.log(`📁 Storage path: ${baseDir}`);
    console.log(`📁 Temp directory: ${tempDir}`);

    // Upewnij się że folder temp istnieje
    if (!existsSync(tempDir)) {
      console.log(`📁 Tworzę folder temp: ${tempDir}`);
      await mkdir(tempDir, { recursive: true });
    }

    // Konwertuj plik na buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ NAMING CONVENTION jak w Twoim systemie
    const timestamp = Date.now();
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const tempFileName = `PDF_${timestamp}_${sanitizedFilename}`;
    tempFilePath = join(tempDir, tempFileName);

    console.log(`💾 Zapisywanie tymczasowego PDF: ${tempFileName}`);

    // Zapisz plik tymczasowo (identycznie jak w Twoim systemie)
    await writeFile(tempFilePath, buffer);
    console.log(`✅ PDF tymczasowo zapisany: ${tempFilePath}`);

    // Wyodrębnij tekst z PDF
    const extractedData = await extractTextFromPdf(buffer, file.name, file.size);

    // ✅ AUTOMATYCZNE USUNIĘCIE (kluczowe dla systemu tymczasowych plików)
    try {
      await unlink(tempFilePath);
      console.log(`🗑️ Usunięto tymczasowy plik: ${tempFileName}`);
    } catch (unlinkError) {
      console.warn('⚠️ Nie udało się usunąć tymczasowego pliku:', unlinkError);
    }

    console.log(`✅ Pomyślnie przetworzono PDF: ${file.name}`);
    console.log(`   📝 Długość tekstu: ${extractedData.content.length} znaków`);
    console.log(`   📖 Liczba stron: ${extractedData.metadata?.pages}`);

    // ✅ ZWRÓĆ W FORMACIE ZGODNYM z scrapedContent
    return NextResponse.json({
      success: true,
      scrapedContent: [extractedData],
      totalPages: extractedData.metadata?.pages || 0,
      fileSize: file.size,
      filename: file.name
    });

  } catch (error) {
    console.error('❌ Błąd podczas przetwarzania PDF:', error);

    // Usuń tymczasowy plik w przypadku błędu
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        console.log(`🗑️ Usunięto tymczasowy plik po błędzie: ${tempFilePath}`);
      } catch (unlinkError) {
        console.warn('⚠️ Nie udało się usunąć tymczasowego pliku po błędzie:', unlinkError);
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Wystąpił błąd podczas przetwarzania PDF',
        success: false
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Ta metoda nie jest obsługiwana. Użyj metody POST do przesłania pliku PDF.' },
    { status: 405 }
  );
}