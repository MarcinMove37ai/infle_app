// Plik: src/app/api/assets/[...filePath]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { stat } from 'fs/promises';

// Mapa rozszerzeń → Content-Type. Dla obrazków obowiązkowo żeby browser
// rozpoznał typ (zamiast generic application/octet-stream). Nieznane typy
// fall back-ują do application/octet-stream + Content-Disposition: attachment
// (zachowuje stare zachowanie dla plików których nie chcemy renderować inline).
const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filePath: string[] }> }
) {
  const params = await context.params;
  const { filePath } = params;

  const baseDir = path.resolve(process.env.FILE_STORAGE_PATH || './.uploads');
  const requestedPath = path.join(baseDir, ...filePath);
  const safeFilePath = path.normalize(requestedPath);

  if (!safeFilePath.startsWith(baseDir)) {
    return NextResponse.json({ error: 'Access Denied' }, { status: 403 });
  }

  try {
    const stats = await stat(safeFilePath);
    const fileBuffer = await fs.readFile(safeFilePath);
    const filename = path.basename(safeFilePath);

    // Wykryj content-type z rozszerzenia. Obrazki dostają konkretny mime
    // (image/png itd.) + cache headers dla performance. Nieznane typy
    // pozostają jako application/octet-stream + attachment header.
    const ext = path.extname(safeFilePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    const isInlineRenderable = contentType.startsWith('image/');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': stats.size.toString(),
      // Pliki mają STAŁE nazwy (USER_{id}_AVATAR.png, ..._COVER.webp), więc URL nie
      // zmienia się przy podmianie zawartości. 30-dniowy max-age powodował, że
      // przeglądarka miesiąc trzymała starą grafikę i nie pytała serwera — to była
      // realna przyczyna „starego logo/avatara", nie brak bustu.
      //
      // Rozwiązanie: adresy z ?t= (patrz assetUrl w src/lib/asset-url.ts) są unikalne
      // dla danej wersji pliku → cache'ujemy je agresywnie. Adresy bez ?t= muszą być
      // walidowane przy każdym użyciu; ETag na mtime+size sprawia, że koszt to 304,
      // nie ponowne pobranie całego pliku.
      'Cache-Control': req.nextUrl.searchParams.has('t')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate',
      'ETag': `"${stats.mtimeMs}-${stats.size}"`,
      'Last-Modified': stats.mtime.toUTCString(),
    };

    // Attachment tylko dla nieobrazkowych plików (np. PDF download).
    // Dla obrazków attachment forcuje download zamiast inline display
    // w niektórych konfiguracjach browser+OS.
    if (!isInlineRenderable) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }

    // Warunkowy GET: jeśli klient ma aktualną wersję, oddajemy 304 bez ciała pliku.
    if (req.headers.get('if-none-match') === headers['ETag']) {
      return new NextResponse(null, { status: 304, headers: { ETag: headers['ETag'] } });
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    console.error(`File not found or error reading: ${safeFilePath}`, error);
    return NextResponse.json({ error: 'File Not Found' }, { status: 404 });
  }
}