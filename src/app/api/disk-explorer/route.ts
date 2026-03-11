// src/app/api/disk-explorer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

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

    const isGod = userRecord?.role === 'GOD';
    const filteredInfos = isGod
      ? fileInfos
      : fileInfos.filter(f =>
          f.type === 'directory' ||
          f.path.includes(session.user.id)
        );

    return NextResponse.json({
      success: true,
      currentPath: requestedPath,
      basePath: baseDir,
      items: filteredInfos,
      totalItems: filteredInfos.length,
      directories: filteredInfos.filter(f => f.type === 'directory').length,
      files: filteredInfos.filter(f => f.type === 'file').length
    });

  } catch (error) {
    console.error('❌ Błąd eksploracji dysku:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas eksploracji dysku',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

// 🗑️ DELETE method - usuwanie plików (tylko GOD_MODE)
export async function DELETE(request: NextRequest) {
  try {
    // Sprawdź autoryzację
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    // 🔥 Sprawdź czy użytkownik ma rolę GOD
    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    });

    if (userRecord?.role !== 'GOD') {
      console.warn(`🚫 Próba usunięcia pliku przez nieuprawnionego użytkownika: ${session.user.id}, rola: ${userRecord?.role}`);
      return NextResponse.json({
        error: 'Brak uprawnień do usuwania plików',
        details: 'Tylko GOD może usuwać pliki'
      }, { status: 403 });
    }

    // Odczytaj dane z body requestu
    const body = await request.json();
    const { path: filePath, action } = body;

    if (action !== 'delete') {
      return NextResponse.json({ error: 'Nieprawidłowa akcja' }, { status: 400 });
    }

    if (!filePath) {
      return NextResponse.json({ error: 'Brak ścieżki pliku' }, { status: 400 });
    }

    console.log(`🗑️ GOD_MODE: Próba usunięcia pliku: "${filePath}" przez użytkownika: ${session.user.id}`);

    // Bazowy katalog
    const baseDir = path.resolve(process.env.FILE_STORAGE_PATH || '/data');
    const targetPath = path.join(baseDir, filePath);
    const safePath = path.normalize(targetPath);

    // Sprawdź czy ścieżka nie wychodzi poza bazowy katalog
    if (!safePath.startsWith(baseDir)) {
      console.warn(`⚠️ Próba usunięcia pliku poza bazowym katalogiem: ${safePath}`);
      return NextResponse.json({ error: 'Dostęp zabroniony' }, { status: 403 });
    }

    // Sprawdź czy plik istnieje
    try {
      const stats = await stat(safePath);

      if (stats.isDirectory()) {
        console.warn(`🚫 Próba usunięcia katalogu zamiast pliku: ${safePath}`);
        return NextResponse.json({
          error: 'Nie można usunąć katalogu',
          details: 'Funkcja obsługuje tylko usuwanie plików'
        }, { status: 400 });
      }

      // Log przed usunięciem
      console.log(`📋 Szczegóły pliku do usunięcia:`, {
        path: safePath,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        name: path.basename(safePath)
      });

    } catch (error) {
      console.error(`❌ Plik nie istnieje: ${safePath}`, error);
      return NextResponse.json({
        error: 'Plik nie istnieje',
        details: 'Nie można usunąć nieistniejącego pliku'
      }, { status: 404 });
    }

    // Usuń plik
    try {
      await fs.unlink(safePath);

      console.log(`✅ GOD_MODE: Pomyślnie usunięto plik: ${safePath}`);

      return NextResponse.json({
        success: true,
        message: 'Plik został pomyślnie usunięty',
        deletedFile: {
          path: filePath,
          name: path.basename(safePath),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error(`❌ Błąd podczas usuwania pliku: ${safePath}`, error);
      return NextResponse.json({
        error: 'Nie można usunąć pliku',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Błąd podczas przetwarzania żądania DELETE:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas usuwania pliku',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}