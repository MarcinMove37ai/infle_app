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
      // Cache 30 dni dla static uploads — wystarczająco długo żeby Lighthouse
      // i browsery efektywnie cache'owały, krótko enough żeby reupload tej
      // samej nazwy pliku (np. profile picture overwrite) propagował się
      // w sensownym czasie. NIE używamy `immutable` bo URL może być
      // reused przy update'cie usera.
      'Cache-Control': 'public, max-age=2592000',
    };

    // Attachment tylko dla nieobrazkowych plików (np. PDF download).
    // Dla obrazków attachment forcuje download zamiast inline display
    // w niektórych konfiguracjach browser+OS.
    if (!isInlineRenderable) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    console.error(`File not found or error reading: ${safeFilePath}`, error);
    return NextResponse.json({ error: 'File Not Found' }, { status: 404 });
  }
}