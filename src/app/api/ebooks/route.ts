// src/app/api/ebooks/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserEbookSettings } from '@/lib/ai-settings';

/**
 * Obsługa tworzenia nowego ebooka (POST)
 * Wersja zaadaptowana do infle_app z metadanymi AI i informacjami o autorze.
 */
export async function POST(request: Request) {
  try {
    // Uwierzytelnianie
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    }
    const userId = session.user.id;

    // Pobierz dane z żądania
    const data = await request.json();
    const { title, subtitle, description, authorDisplayName, authorLogoUrl } = data;

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Walidacja podstawowa pól z requestu
    if (authorDisplayName && authorDisplayName.length > 200) {
      return NextResponse.json({ error: 'Author display name cannot exceed 200 characters' }, { status: 400 });
    }

    if (authorLogoUrl && authorLogoUrl.length > 1024) {
      return NextResponse.json({ error: 'Author logo URL cannot exceed 1024 characters' }, { status: 400 });
    }

    console.log(`Creating new ebook: "${title}"${subtitle ? ` with subtitle: "${subtitle}"` : ''} for user ID=${userId}`);

    // Pobierz ustawienia użytkownika (AI + dane autora z profilu)
    const userSettings = await getUserEbookSettings(userId);
    console.log(`📊 User settings:`, userSettings);

    // Określ finalne dane autora (priorytet: request > profil użytkownika > null)
    const finalAuthorName = authorDisplayName?.trim() || userSettings.authorDisplayName;
    const finalAuthorLogo = authorLogoUrl?.trim() || userSettings.authorLogoUrl;

    console.log(`📝 Final author data:`, {
      name: finalAuthorName || 'Not specified',
      logo: finalAuthorLogo ? 'Provided' : 'Not provided',
      nameSource: authorDisplayName ? 'Request' : (userSettings.authorDisplayName ? 'Profile' : 'None'),
      logoSource: authorLogoUrl ? 'Request' : (userSettings.authorLogoUrl ? 'Profile' : 'None')
    });

    // Zapisz ebook do bazy danych
    const newEbook = await prisma.ebooks.create({
      data: {
        title: title.trim(),
        subtitle: subtitle?.trim() || null,
        description: description?.trim() || null,
        userId: userId,

        // Dane autora
        authorDisplayName: finalAuthorName,
        authorLogoUrl: finalAuthorLogo,

        // Metadane AI
        text_ai_provider: userSettings.textAiProvider,
        text_ai_model: userSettings.textAiModel,
        image_ai_provider: userSettings.imageAiProvider,
        image_ai_model: userSettings.imageAiModel,
        ai_generation_timestamp: new Date(),
      },
      select: {
        id: true,
      },
    });

    console.log(`✅ Ebook created successfully with ID=${newEbook.id}`);

    return NextResponse.json({
      success: true,
      ebookId: newEbook.id,
    });
  } catch (error) {
    console.error('❌ Error creating ebook:', error);
    return NextResponse.json(
      {
        error: 'An error occurred while creating the ebook',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}