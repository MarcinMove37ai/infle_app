// Plik: src/app/api/assets/[...filePath]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { stat } from 'fs/promises';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filePath: string[] }> } // <-- ZMIANA: params jest teraz Promise
) {
  const params = await context.params; // <-- ZMIANA: await params
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

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': stats.size.toString(),
      },
    });
  } catch (error) {
    console.error(`File not found or error reading: ${safeFilePath}`, error);
    return NextResponse.json({ error: 'File Not Found' }, { status: 404 });
  }
}