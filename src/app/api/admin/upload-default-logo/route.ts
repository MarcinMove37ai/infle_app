import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    // Tymczasowo wyłączona autoryzacja
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('⚠️ Tymczasowy endpoint - bez sprawdzania roli');

    // Pobierz plik z FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Przygotuj ścieżkę zapisu
    const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
    const uploadsDir = path.join(storageBasePath, 'uploads');

    // Upewnij się, że folder istnieje
    await fs.mkdir(uploadsDir, { recursive: true });

    // Zapisz plik jako logo_inflee.webp
    const filePath = path.join(uploadsDir, 'logo_inflee.webp');
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Generuj URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const logoUrl = `${baseUrl}/api/assets/uploads/logo_inflee.webp`;

    console.log('✅ Default logo uploaded:', logoUrl);

    return NextResponse.json({
      success: true,
      message: 'Default logo uploaded successfully',
      logoUrl: logoUrl,
      filePath: filePath
    });

  } catch (error) {
    console.error('❌ Error uploading default logo:', error);
    return NextResponse.json({
      error: 'Failed to upload default logo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}