// src/app/api/disk-explorer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { stat } from 'fs/promises';

interface FileInfo {
  name: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  path: string;
  extension?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Sprawdź autoryzację
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedPath = searchParams.get('path') || '';

    console.log(`🗂️ Eksploracja dysku - ścieżka: "${requestedPath}"`);

    // Bazowy katalog - używamy tego samego co w assets
    const baseDir = path.resolve(process.env.FILE_STORAGE_PATH || '/data');
    const targetPath = path.join(baseDir, requestedPath);
    const safePath = path.normalize(targetPath);

    // Sprawdź czy ścieżka nie wychodzi poza bazowy katalog
    if (!safePath.startsWith(baseDir)) {
      console.warn(`⚠️ Próba dostępu poza bazowy katalog: ${safePath}`);
      return NextResponse.json({ error: 'Dostęp zabroniony' }, { status: 403 });
    }

    // Sprawdź czy katalog istnieje
    try {
      const stats = await stat(safePath);
      if (!stats.isDirectory()) {
        return NextResponse.json({ error: 'Ścieżka nie jest katalogiem' }, { status: 400 });
      }
    } catch (error) {
      console.error(`❌ Katalog nie istnieje: ${safePath}`, error);
      return NextResponse.json({ error: 'Katalog nie istnieje' }, { status: 404 });
    }

    // Odczytaj zawartość katalogu
    const items = await fs.readdir(safePath);
    const fileInfos: FileInfo[] = [];

    for (const item of items) {
      try {
        const itemPath = path.join(safePath, item);
        const stats = await stat(itemPath);
        const relativePath = path.relative(baseDir, itemPath);

        const fileInfo: FileInfo = {
          name: item,
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
          path: relativePath.replace(/\\/g, '/'), // Normalizuj separatory dla frontendu
          extension: stats.isFile() ? path.extname(item).toLowerCase() : undefined
        };

        fileInfos.push(fileInfo);
      } catch (error) {
        console.warn(`⚠️ Nie można odczytać informacji o: ${item}`, error);
        // Pomiń problematyczne pliki
      }
    }

    // Sortuj: katalogi najpierw, potem pliki alfabetycznie
    fileInfos.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    console.log(`✅ Znaleziono ${fileInfos.length} elementów w: ${safePath}`);

    return NextResponse.json({
      success: true,
      currentPath: requestedPath,
      basePath: baseDir,
      items: fileInfos,
      totalItems: fileInfos.length,
      directories: fileInfos.filter(f => f.type === 'directory').length,
      files: fileInfos.filter(f => f.type === 'file').length
    });

  } catch (error) {
    console.error('❌ Błąd eksploracji dysku:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas eksploracji dysku',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}