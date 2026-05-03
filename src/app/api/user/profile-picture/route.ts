// src/app/api/user/profile-picture/route.ts
//
// Endpoint do zarządzania zdjęciem profilowym usera w headerze landing page'a.
//
// Pola w User:
//   - profilePicture        — Google original (read-only)
//   - customProfilePicture  — wgrane przez usera (storage path)
//   - headerStyle           — 'profile' | 'logo' | 'none'
//   - activeProfileSource   — 'custom' | 'google' (które źródło wybrać gdy headerStyle='profile')
//
// Akcje:
//   - GET    → zwraca pełen stan settings
//   - PUT    → upload (FormData) LUB zmiana headerStyle/activeProfileSource (JSON)
//   - DELETE → usuwa customProfilePicture (Google nieruszane)

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

// ─── Stałe ────────────────────────────────────────────────────────────────

const PROFILE_SIZE = 256;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;  // 5MB

const VALID_HEADER_STYLES = ['profile', 'logo', 'none'] as const;
type HeaderStyle = typeof VALID_HEADER_STYLES[number];

const VALID_PROFILE_SOURCES = ['custom', 'google'] as const;
type ProfileSource = typeof VALID_PROFILE_SOURCES[number];

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildPublicUrl(filename: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/api/assets/uploads/profile-pictures/${filename}`;
}

async function removeExistingProfilePictures(userId: string, dir: string): Promise<void> {
  try {
    const existingFiles = await fs.readdir(dir);
    const oldFiles = existingFiles.filter(file =>
      file.startsWith(`USER_${userId}_PROFILE.`)
    );
    for (const oldFile of oldFiles) {
      await fs.unlink(path.join(dir, oldFile));
      console.log(`🗑️ Usunięto stary plik profile-picture: ${oldFile}`);
    }
  } catch (cleanupError) {
    console.warn('⚠️ Nie udało się usunąć starych plików profile-picture:', cleanupError);
  }
}

// Resolver — co pokazujemy w UI:
//   1) headerStyle !== 'profile' → null
//   2) activeProfileSource === 'google' i Google istnieje → Google
//   3) Inaczej (custom lub fallback) → custom > google > null
function resolveProfileUrl(user: {
  profilePicture: string | null;
  customProfilePicture: string | null;
  headerStyle: string;
  activeProfileSource: string;
}): string | null {
  if (user.headerStyle !== 'profile') return null;
  if (user.activeProfileSource === 'google' && user.profilePicture) {
    return user.profilePicture;
  }
  return user.customProfilePicture || user.profilePicture || null;
}

function buildSettingsResponse(user: {
  profilePicture: string | null;
  customProfilePicture: string | null;
  headerStyle: string;
  activeProfileSource: string;
  authProvider: string | null;
}) {
  return {
    profilePicture: user.profilePicture,
    customProfilePicture: user.customProfilePicture,
    headerStyle: user.headerStyle,
    activeProfileSource: user.activeProfileSource,
    resolvedUrl: resolveProfileUrl(user),
    hasGoogleOriginal: !!user.profilePicture,
    hasCustomPicture: !!user.customProfilePicture,
    authProvider: user.authProvider,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        profilePicture: true,
        customProfilePicture: true,
        headerStyle: true,
        activeProfileSource: true,
        authProvider: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Użytkownik nie został znaleziony' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profilePictureSettings: buildSettingsResponse(user),
    });
  } catch (error) {
    console.error('❌ Błąd podczas pobierania profile-picture:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas pobierania ustawień zdjęcia profilowego',
      details: error instanceof Error ? error.message : 'Nieznany błąd',
    }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT
// ═══════════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const userId = session.user.id;
    const contentType = request.headers.get('content-type') || '';

    let imageFile: File | null = null;
    let headerStyle: HeaderStyle | undefined;
    let activeProfileSource: ProfileSource | undefined;

    // ─── Routing po Content-Type ─────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await request.formData();
        imageFile = formData.get('profilePicture') as File | null;
      } catch (formError) {
        console.error('Błąd parsowania formData:', formError);
        return NextResponse.json({
          error: 'Nie można przetworzyć formularza',
        }, { status: 400 });
      }
    } else if (contentType.includes('application/json')) {
      try {
        const body = await request.json();
        if (typeof body.headerStyle === 'string') {
          if (!VALID_HEADER_STYLES.includes(body.headerStyle)) {
            return NextResponse.json({
              error: 'Nieprawidłowa wartość headerStyle',
              validValues: VALID_HEADER_STYLES,
              received: body.headerStyle,
            }, { status: 400 });
          }
          headerStyle = body.headerStyle as HeaderStyle;
        }
        if (typeof body.activeProfileSource === 'string') {
          if (!VALID_PROFILE_SOURCES.includes(body.activeProfileSource)) {
            return NextResponse.json({
              error: 'Nieprawidłowa wartość activeProfileSource',
              validValues: VALID_PROFILE_SOURCES,
              received: body.activeProfileSource,
            }, { status: 400 });
          }
          activeProfileSource = body.activeProfileSource as ProfileSource;
        }
      } catch (jsonError) {
        console.error('Błąd parsowania JSON:', jsonError);
        return NextResponse.json({
          error: 'Nieprawidłowy format JSON',
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: 'Nieobsługiwany typ zawartości',
        supportedTypes: ['multipart/form-data', 'application/json'],
      }, { status: 400 });
    }

    if (!imageFile && headerStyle === undefined && activeProfileSource === undefined) {
      return NextResponse.json({
        error: 'Brak danych do aktualizacji',
        required: 'Prześlij zdjęcie (FormData "profilePicture") lub ustaw headerStyle/activeProfileSource (JSON)',
      }, { status: 400 });
    }

    // ─── ŚCIEŻKA 1: Upload pliku ─────────────────────────────────────────
    let newCustomUrl: string | undefined;

    if (imageFile) {
      console.log(`🖼️ Upload profile-picture - rozmiar: ${imageFile.size} bytes, typ: ${imageFile.type}`);

      const fileType = imageFile.type;
      if (!fileType.startsWith('image/')) {
        return NextResponse.json({
          error: 'Wybrany plik nie jest obrazem',
          fileType,
        }, { status: 400 });
      }

      if (imageFile.size > MAX_UPLOAD_SIZE) {
        return NextResponse.json({
          error: 'Plik jest za duży',
          maxSize: '5MB',
          actualSize: `${Math.round(imageFile.size / 1024 / 1024 * 100) / 100}MB`,
        }, { status: 400 });
      }

      const buffer = await imageFile.arrayBuffer();

      const isPng = fileType.includes('png') || fileType.includes('webp');
      const fileExtension = isPng ? 'png' : 'jpg';
      const outputContentType = isPng ? 'image/png' : 'image/jpeg';

      let processedBuffer: Buffer;
      if (isPng) {
        processedBuffer = await sharp(Buffer.from(buffer))
          .resize({
            width: PROFILE_SIZE,
            height: PROFILE_SIZE,
            fit: 'cover',
            position: 'center',
          })
          .png({ quality: 90, compressionLevel: 7 })
          .toBuffer();
      } else {
        processedBuffer = await sharp(Buffer.from(buffer))
          .resize({
            width: PROFILE_SIZE,
            height: PROFILE_SIZE,
            fit: 'cover',
            position: 'center',
          })
          .jpeg({ quality: 88, progressive: true })
          .toBuffer();
      }

      const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
      const targetDir = path.join(storageBasePath, 'uploads', 'profile-pictures');
      await fs.mkdir(targetDir, { recursive: true });

      const fileName = `USER_${userId}_PROFILE.${fileExtension}`;
      const filePath = path.join(targetDir, fileName);

      await removeExistingProfilePictures(userId, targetDir);
      await fs.writeFile(filePath, processedBuffer);

      newCustomUrl = buildPublicUrl(fileName);
      console.log(`✅ Profile-picture zapisane: ${newCustomUrl} (${outputContentType}, ${PROFILE_SIZE}×${PROFILE_SIZE}px)`);
    }

    // ─── Aktualizacja DB ─────────────────────────────────────────────────
    const updateData: {
      customProfilePicture?: string;
      headerStyle?: HeaderStyle;
      activeProfileSource?: ProfileSource;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (newCustomUrl) {
      updateData.customProfilePicture = newCustomUrl;
      // Po wgraniu nowego — automatycznie aktywujemy 'profile' i activeSource='custom'.
      // Jeśli klient explicitnie podał inne wartości w tym samym requeście, respektujemy.
      updateData.headerStyle = headerStyle ?? 'profile';
      updateData.activeProfileSource = activeProfileSource ?? 'custom';
    } else {
      if (headerStyle !== undefined) updateData.headerStyle = headerStyle;
      if (activeProfileSource !== undefined) updateData.activeProfileSource = activeProfileSource;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        profilePicture: true,
        customProfilePicture: true,
        headerStyle: true,
        activeProfileSource: true,
        authProvider: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: imageFile ? 'Zdjęcie profilowe zaktualizowane' : 'Ustawienie zaktualizowane',
      profilePictureSettings: buildSettingsResponse(updatedUser),
    });
  } catch (error) {
    console.error('❌ Błąd podczas aktualizacji profile-picture:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas aktualizacji zdjęcia profilowego',
      details: error instanceof Error ? error.message : 'Nieznany błąd',
    }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE — usuń customProfilePicture (wraca do Google jeśli istnieje)
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`🗑️ Usuwanie customProfilePicture dla userId=${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { customProfilePicture: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Użytkownik nie został znaleziony' }, { status: 404 });
    }

    if (user.customProfilePicture) {
      const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
      const targetDir = path.join(storageBasePath, 'uploads', 'profile-pictures');
      await removeExistingProfilePictures(userId, targetDir);
    }

    // Wyzeruj customProfilePicture w bazie. Reset activeProfileSource='custom'
    // (gdy w przyszłości znów wgra, aktywuje się; nie wpływa na resolver gdy custom=null).
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        customProfilePicture: null,
        activeProfileSource: 'custom',
        updatedAt: new Date(),
      },
      select: {
        profilePicture: true,
        customProfilePicture: true,
        headerStyle: true,
        activeProfileSource: true,
        authProvider: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Custom zdjęcie profilowe zostało usunięte',
      profilePictureSettings: buildSettingsResponse(updatedUser),
    });
  } catch (error) {
    console.error('❌ Błąd podczas usuwania profile-picture:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas usuwania zdjęcia profilowego',
      details: error instanceof Error ? error.message : 'Nieznany błąd',
    }, { status: 500 });
  }
}