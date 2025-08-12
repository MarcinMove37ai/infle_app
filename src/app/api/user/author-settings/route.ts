// src/app/api/user/author-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

/**
 * Pobieranie ustawień autora (GET)
 */
export async function GET() {
  try {
    // Autoryzacja przez session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    console.log(`📖 Pobieranie ustawień autora dla userId=${session.user.id}`);

    // Pobranie ustawień autora z bazy danych
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        authorDisplayName: true,
        authorLogoUrl: true,
        // ✅ NOWE: Dodaj pola AI
        textAiProvider: true,
        textAiModel: true,
        imageAiProvider: true,
        imageAiModel: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Użytkownik nie został znaleziony' }, { status: 404 });
    }

    // Zwróć aktualne ustawienia autora z polami AI
    return NextResponse.json({
      success: true,
      authorSettings: {
        authorDisplayName: user.authorDisplayName,
        authorLogoUrl: user.authorLogoUrl,
        fallbackName: `${user.firstName} ${user.lastName}`.trim(),
        // ✅ NOWE: Dodaj ustawienia AI do odpowiedzi
        textAiProvider: user.textAiProvider,
        textAiModel: user.textAiModel,
        imageAiProvider: user.imageAiProvider,
        imageAiModel: user.imageAiModel
      }
    });

  } catch (error) {
    console.error('❌ Błąd podczas pobierania ustawień autora:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas pobierania ustawień autora',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

/**
 * Aktualizacja ustawień autora (PUT) - nazwa, avatar i/lub ustawienia AI
 */
export async function PUT(request: NextRequest) {
  try {
    // Autoryzacja przez session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`✏️ Aktualizacja ustawień autora dla userId=${userId}`);

    // Sprawdzenie typu zawartości
    const contentType = request.headers.get('content-type') || '';
    console.log('Content-Type ustawień autora:', contentType);

    let authorDisplayName: string | undefined;
    let imageFile: File | null = null;
    // ✅ NOWE: Pola AI
    let textAiProvider: string | undefined;
    let textAiModel: string | undefined;
    let imageAiProvider: string | undefined;
    let imageAiModel: string | undefined;

    // Obsługa różnych typów zawartości
    if (contentType.includes('multipart/form-data')) {
      // FormData - może zawierać nazwę i/lub avatar
      try {
        const formData = await request.formData();

        // Pobierz nazwę autora jeśli jest w formData
        const nameFromForm = formData.get('authorDisplayName');
        if (nameFromForm && typeof nameFromForm === 'string') {
          authorDisplayName = nameFromForm.trim();
        }

        // Pobierz plik avatara jeśli jest w formData
        imageFile = formData.get('avatar') as File | null;

        // ✅ NOWE: Pobierz ustawienia AI z formData (opcjonalne)
        const textProviderFromForm = formData.get('textAiProvider');
        if (textProviderFromForm && typeof textProviderFromForm === 'string') {
          textAiProvider = textProviderFromForm.trim();
        }

        const textModelFromForm = formData.get('textAiModel');
        if (textModelFromForm && typeof textModelFromForm === 'string') {
          textAiModel = textModelFromForm.trim();
        }

        const imageProviderFromForm = formData.get('imageAiProvider');
        if (imageProviderFromForm && typeof imageProviderFromForm === 'string') {
          imageAiProvider = imageProviderFromForm.trim();
        }

        const imageModelFromForm = formData.get('imageAiModel');
        if (imageModelFromForm && typeof imageModelFromForm === 'string') {
          imageAiModel = imageModelFromForm.trim();
        }

        console.log('📝 Z formData - nazwa:', authorDisplayName, 'avatar:', !!imageFile, 'AI settings:', {
          textAiProvider, textAiModel, imageAiProvider, imageAiModel
        });
      } catch (formError) {
        console.error('Błąd podczas parsowania formData:', formError);
        return NextResponse.json({
          error: 'Nie można przetworzyć formularza',
          details: 'Upewnij się, że żądanie jest wysyłane jako multipart/form-data'
        }, { status: 400 });
      }
    } else if (contentType.includes('application/json')) {
      // JSON - nazwa autora i/lub ustawienia AI
      try {
        const body = await request.json();

        if (body.authorDisplayName && typeof body.authorDisplayName === 'string') {
          authorDisplayName = body.authorDisplayName.trim();
        }

        // ✅ NOWE: Obsługa pól AI z JSON
        if (body.textAiProvider && typeof body.textAiProvider === 'string') {
          textAiProvider = body.textAiProvider.trim();
        }

        if (body.textAiModel && typeof body.textAiModel === 'string') {
          textAiModel = body.textAiModel.trim();
        }

        if (body.imageAiProvider && typeof body.imageAiProvider === 'string') {
          imageAiProvider = body.imageAiProvider.trim();
        }

        if (body.imageAiModel && typeof body.imageAiModel === 'string') {
          imageAiModel = body.imageAiModel.trim();
        }

        console.log('📝 Z JSON - nazwa:', authorDisplayName, 'AI settings:', {
          textAiProvider, textAiModel, imageAiProvider, imageAiModel
        });
      } catch (jsonError) {
        console.error('Błąd podczas parsowania JSON:', jsonError);
        return NextResponse.json({
          error: 'Nieprawidłowy format JSON'
        }, { status: 400 });
      }
    } else {
      return NextResponse.json({
        error: 'Nieobsługiwany typ zawartości',
        supportedTypes: ['multipart/form-data', 'application/json'],
        receivedType: contentType
      }, { status: 400 });
    }

    // ✅ ZAKTUALIZOWANA WALIDACJA: musi być przynajmniej jeden parametr do aktualizacji
    if (!authorDisplayName && !imageFile && !textAiProvider && !textAiModel && !imageAiProvider && !imageAiModel) {
      return NextResponse.json({
        error: 'Brak danych do aktualizacji',
        required: 'Podaj authorDisplayName, prześlij avatar, lub ustaw ustawienia AI'
      }, { status: 400 });
    }

    // Walidacja nazwy autora
    if (authorDisplayName !== undefined) {
      if (authorDisplayName.length === 0) {
        return NextResponse.json({
          error: 'Nazwa autora nie może być pusta'
        }, { status: 400 });
      }

      if (authorDisplayName.length > 100) {
        return NextResponse.json({
          error: 'Nazwa autora nie może być dłuższa niż 100 znaków'
        }, { status: 400 });
      }
    }

    // ✅ NOWA WALIDACJA: Ustawienia AI
    const validProviders = ['anthropic', 'openai', 'gemini'];
    const validTextModels = ['claude-3-haiku', 'claude-3-sonnet', 'gpt-4o', 'gemini-pro'];
    const validImageModels = ['dall-e-3', 'gpt-image-1', 'imagen-2'];

    if (textAiProvider !== undefined && !validProviders.includes(textAiProvider)) {
      return NextResponse.json({
        error: 'Nieprawidłowy provider tekstu',
        validProviders: validProviders
      }, { status: 400 });
    }

    if (imageAiProvider !== undefined && !validProviders.includes(imageAiProvider)) {
      return NextResponse.json({
        error: 'Nieprawidłowy provider obrazów',
        validProviders: validProviders
      }, { status: 400 });
    }

    if (textAiModel !== undefined && !validTextModels.includes(textAiModel)) {
      return NextResponse.json({
        error: 'Nieprawidłowy model tekstu',
        validModels: validTextModels
      }, { status: 400 });
    }

    if (imageAiModel !== undefined && !validImageModels.includes(imageAiModel)) {
      return NextResponse.json({
        error: 'Nieprawidłowy model obrazów',
        validModels: validImageModels
      }, { status: 400 });
    }

    let newAvatarUrl: string | undefined;

    // Przetwarzanie avatara jeśli został przesłany (bez zmian w tej sekcji)
    if (imageFile) {
      console.log(`🖼️ Przetwarzanie avatara - rozmiar: ${imageFile.size} bytes, typ: ${imageFile.type}`);

      // Sprawdzenie typu pliku
      const fileType = imageFile.type;
      if (!fileType.startsWith('image/')) {
        return NextResponse.json({
          error: 'Wybrany plik nie jest obrazem',
          fileType,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
        }, { status: 400 });
      }

      // Sprawdzenie rozmiaru pliku (max 5MB dla avatara)
      const maxSizeBytes = 5 * 1024 * 1024; // 5MB
      if (imageFile.size > maxSizeBytes) {
        return NextResponse.json({
          error: 'Plik jest za duży',
          maxSize: '5MB',
          actualSize: `${Math.round(imageFile.size / 1024 / 1024 * 100) / 100}MB`
        }, { status: 400 });
      }

      // Konwersja pliku do ArrayBuffer
      const buffer = await imageFile.arrayBuffer();

      // Przetwarzanie obrazu avatara za pomocą sharp
      let processedImageBuffer;
      let outputContentType;
      let fileExtension;

      if (fileType.includes('png') || fileType.includes('webp')) {
        // Przetwarzanie jako PNG z zachowaniem przezroczystości (idealne dla avatarów)
        processedImageBuffer = await sharp(Buffer.from(buffer))
          .png({
            quality: 90,           // Wysoka jakość dla avatarów
            compressionLevel: 7,
            effort: 8
          })
          .resize({
            width: 800,            // ✅ TYLKO maksymalna szerokość
            height: 800,           // ✅ TYLKO maksymalna wysokość
            fit: 'inside',         // ✅ Zachowuje proporcje - obraz się zmieści w 800x800 ale może być 800x400 lub 400x800
            withoutEnlargement: true // ✅ Nie powiększa małych obrazów
          })
          .toBuffer();
        outputContentType = 'image/png';
        fileExtension = 'png';
      } else {
        // Przetwarzanie jako JPEG
        processedImageBuffer = await sharp(Buffer.from(buffer))
          .jpeg({
            quality: 85,           // Dobra jakość dla avatarów
            progressive: true
          })
          .resize({
            width: 800,            // ✅ TYLKO maksymalna szerokość
            height: 800,           // ✅ TYLKO maksymalna wysokość
            fit: 'inside',         // ✅ Zachowuje proporcje - obraz się zmieści w 800x800 ale może być 800x400 lub 400x800
            withoutEnlargement: true // ✅ Nie powiększa małych obrazów
          })
          .toBuffer();
        outputContentType = 'image/jpeg';
        fileExtension = 'jpg';
      }

      // Przygotowanie ścieżki zapisu w Railway storage
      const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
      const avatarsDir = path.join(storageBasePath, 'uploads', 'avatars');

      // Upewnij się, że folder istnieje
      await fs.mkdir(avatarsDir, { recursive: true });

      // Generowanie nazwy pliku dla avatara
      const fileName = `USER_${userId}_AVATAR.${fileExtension}`;
      const filePath = path.join(avatarsDir, fileName);

      console.log(`💾 Zapisywanie avatara jako ${fileName} w Railway storage`);

      // Usunięcie starego avatara jeśli istnieje
      try {
        const existingFiles = await fs.readdir(avatarsDir);
        const oldAvatarFiles = existingFiles.filter(file =>
          file.startsWith(`USER_${userId}_AVATAR.`)
        );

        for (const oldFile of oldAvatarFiles) {
          const oldFilePath = path.join(avatarsDir, oldFile);
          await fs.unlink(oldFilePath);
          console.log(`🗑️ Usunięto stary avatar: ${oldFile}`);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Nie udało się usunąć starego avatara:', cleanupError);
        // Nie przerywamy operacji jeśli czyszczenie się nie powiodło
      }

      // Zapisanie nowego pliku avatara
      await fs.writeFile(filePath, processedImageBuffer);

      // Generowanie publicznego URL dla avatara
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      newAvatarUrl = `${baseUrl}/api/assets/uploads/avatars/${fileName}`;

      console.log(`✅ Avatar zapisany: ${newAvatarUrl}`);
    }

    // ✅ ZAKTUALIZOWANE: Przygotowanie danych do aktualizacji z polami AI
    const updateData: {
      authorDisplayName?: string;
      authorLogoUrl?: string;
      textAiProvider?: string;
      textAiModel?: string;
      imageAiProvider?: string;
      imageAiModel?: string;
      updatedAt: Date;
    } = {
      updatedAt: new Date()
    };

    if (authorDisplayName !== undefined) {
      updateData.authorDisplayName = authorDisplayName;
    }

    if (newAvatarUrl) {
      updateData.authorLogoUrl = newAvatarUrl;
    }

    // ✅ NOWE: Dodaj pola AI do aktualizacji
    if (textAiProvider !== undefined) {
      updateData.textAiProvider = textAiProvider;
    }

    if (textAiModel !== undefined) {
      updateData.textAiModel = textAiModel;
    }

    if (imageAiProvider !== undefined) {
      updateData.imageAiProvider = imageAiProvider;
    }

    if (imageAiModel !== undefined) {
      updateData.imageAiModel = imageAiModel;
    }

    // Aktualizacja ustawień autora w bazie danych
    const updatedUser = await prisma.user.update({
      where: {
        id: userId
      },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        authorDisplayName: true,
        authorLogoUrl: true,
        // ✅ NOWE: Pobierz zaktualizowane pola AI
        textAiProvider: true,
        textAiModel: true,
        imageAiProvider: true,
        imageAiModel: true,
        updatedAt: true
      }
    });

    console.log(`✅ Pomyślnie zaktualizowano ustawienia autora dla userId=${userId}`);

    // ✅ ZAKTUALIZOWANE: Zwróć odpowiedź z polami AI
    return NextResponse.json({
      success: true,
      message: 'Ustawienia autora zostały zaktualizowane',
      authorSettings: {
        authorDisplayName: updatedUser.authorDisplayName,
        authorLogoUrl: updatedUser.authorLogoUrl,
        fallbackName: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
        // ✅ NOWE: Dodaj ustawienia AI do odpowiedzi
        textAiProvider: updatedUser.textAiProvider,
        textAiModel: updatedUser.textAiModel,
        imageAiProvider: updatedUser.imageAiProvider,
        imageAiModel: updatedUser.imageAiModel
      },
      updatedFields: {
        name: authorDisplayName !== undefined,
        avatar: !!newAvatarUrl,
        // ✅ NOWE: Informacja o zaktualizowanych polach AI
        textAiProvider: textAiProvider !== undefined,
        textAiModel: textAiModel !== undefined,
        imageAiProvider: imageAiProvider !== undefined,
        imageAiModel: imageAiModel !== undefined
      }
    });

  } catch (error) {
    console.error('❌ Błąd podczas aktualizacji ustawień autora:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas aktualizacji ustawień autora',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}

/**
 * Usunięcie avatara autora (DELETE) - bez zmian
 */
export async function DELETE() {
  try {
    // Autoryzacja przez session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log(`🗑️ Usuwanie avatara autora dla userId=${userId}`);

    // Pobranie aktualnego URL avatara
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { authorLogoUrl: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'Użytkownik nie został znaleziony' }, { status: 404 });
    }

    // Usunięcie pliku avatara z dysku jeśli istnieje
    if (user.authorLogoUrl) {
      try {
        const storageBasePath = process.env.FILE_STORAGE_PATH || '/data';
        const avatarsDir = path.join(storageBasePath, 'uploads', 'avatars');

        const existingFiles = await fs.readdir(avatarsDir);
        const avatarFiles = existingFiles.filter(file =>
          file.startsWith(`USER_${userId}_AVATAR.`)
        );

        for (const avatarFile of avatarFiles) {
          const filePath = path.join(avatarsDir, avatarFile);
          await fs.unlink(filePath);
          console.log(`🗑️ Usunięto plik avatara: ${avatarFile}`);
        }
      } catch (fileError) {
        console.warn('⚠️ Nie udało się usunąć pliku avatara z dysku:', fileError);
        // Kontynuujemy mimo błędu usuwania pliku
      }
    }

    // Usunięcie URL avatara z bazy danych
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        authorLogoUrl: null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        authorDisplayName: true,
        authorLogoUrl: true,
        // ✅ NOWE: Pobierz też ustawienia AI przy usuwaniu avatara
        textAiProvider: true,
        textAiModel: true,
        imageAiProvider: true,
        imageAiModel: true
      }
    });

    console.log(`✅ Pomyślnie usunięto avatar autora dla userId=${userId}`);

    // ✅ ZAKTUALIZOWANE: Zwróć odpowiedź z polami AI
    return NextResponse.json({
      success: true,
      message: 'Avatar autora został usunięty',
      authorSettings: {
        authorDisplayName: updatedUser.authorDisplayName,
        authorLogoUrl: updatedUser.authorLogoUrl,
        fallbackName: `${updatedUser.firstName} ${updatedUser.lastName}`.trim(),
        // ✅ NOWE: Dodaj ustawienia AI do odpowiedzi
        textAiProvider: updatedUser.textAiProvider,
        textAiModel: updatedUser.textAiModel,
        imageAiProvider: updatedUser.imageAiProvider,
        imageAiModel: updatedUser.imageAiModel
      }
    });

  } catch (error) {
    console.error('❌ Błąd podczas usuwania avatara autora:', error);
    return NextResponse.json({
      error: 'Wystąpił błąd podczas usuwania avatara autora',
      details: error instanceof Error ? error.message : 'Nieznany błąd'
    }, { status: 500 });
  }
}