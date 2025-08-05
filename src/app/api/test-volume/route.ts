// Plik: src/app/api/test-volume/route.ts

import { NextResponse } from 'next/server';
import fs from 'fs/promises'; // Używamy wbudowanego modułu Node.js do operacji na plikach
import path from 'path';

export async function GET() {
  // Odczytujemy ścieżkę z naszej zmiennej środowiskowej
  const storagePath = process.env.FILE_STORAGE_PATH;

  if (!storagePath) {
    return NextResponse.json(
      { error: 'Zmienna FILE_STORAGE_PATH nie jest ustawiona!' },
      { status: 500 }
    );
  }

  try {
    // Upewniamy się, że folder docelowy istnieje (tworzymy go, jeśli nie)
    await fs.mkdir(storagePath, { recursive: true });

    // Tworzymy pełną ścieżkę do naszego pliku testowego
    const testFilePath = path.join(storagePath, 'test.txt');
    const fileContent = `Test zapisu do pliku o godzinie: ${new Date().toLocaleTimeString()}`;

    // Zapisujemy plik
    await fs.writeFile(testFilePath, fileContent);

    // Jeśli wszystko się udało, zwracamy sukces
    return NextResponse.json({
      success: true,
      message: `Plik testowy został pomyślnie zapisany w: ${testFilePath}`,
    });
  } catch (error) {
    console.error('Błąd podczas zapisu pliku:', error);
    return NextResponse.json(
      { error: 'Nie udało się zapisać pliku na dysku.', details: (error as Error).message },
      { status: 500 }
    );
  }
}