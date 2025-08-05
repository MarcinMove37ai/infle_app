// Plik: src/app/api/assets/[...filePath]/route.ts

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { stat } from 'fs/promises';

// Ta funkcja będzie obsługiwać wszystkie żądania GET do /api/assets/*
export async function GET(
  req: Request,
  { params }: { params: { filePath: string[] } }
) {
  const { filePath } = params;

  // 1. Zdefiniuj bazową, bezpieczną ścieżkę do folderu z plikami
  const baseDir = path.resolve(process.env.FILE_STORAGE_PATH || './.uploads');

  // 2. Połącz ścieżkę bazową ze ścieżką z URL i znormalizuj ją
  // To kluczowy krok bezpieczeństwa, aby uniemożliwić ataki "Path Traversal" (np. ../../etc/passwd)
  const requestedPath = path.join(baseDir, ...filePath);
  const safeFilePath = path.normalize(requestedPath);

  if (!safeFilePath.startsWith(baseDir)) {
    // Jeśli po normalizacji ścieżka wychodzi poza bezpieczny folder, odrzuć żądanie
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 });
  }

  try {
    // 3. Sprawdź, czy plik istnieje
    const stats = await stat(safeFilePath);

    // 4. Odczytaj plik i zwróć go w odpowiedzi
    const fileBuffer = await fs.readFile(safeFilePath);
    const filename = path.basename(safeFilePath);

    return new NextResponse(fileBuffer, {
      headers: {
        // Ta linia sprawia, że przeglądarka zaproponuje pobranie pliku
        'Content-Disposition': `attachment; filename="${filename}"`,
        // Można dodać bardziej specyficzne typy MIME, ale to jest bezpieczne domyślne
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size.toString(),
      },
    });
  } catch (error) {
    // Jeśli plik nie istnieje lub wystąpił inny błąd odczytu
    console.error(`File not found or error reading: ${safeFilePath}`, error);
    return NextResponse.json({ error: 'File Not Found' }, { status: 404 });
  }
}