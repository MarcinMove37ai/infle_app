// src/app/api/user/instagram-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { linkUserToInstagramProfile, verifyInstagramProfileExists } from '@/lib/profileStorage';

// === METODA GET - POBIERANIE PROFILU (bez zmian) ===
export async function GET(request: NextRequest) {
  try {
    // Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('📱 Fetching Instagram profile for user:', session.user.id);

    // Pobierz dane użytkownika z instagramProfileId
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        instagramProfileId: true,
        socialProfileType: true,
      }
    });

    if (!user?.instagramProfileId) {
      return NextResponse.json(
        { error: 'No Instagram profile linked' },
        { status: 404 }
      );
    }

    // Pobierz pełne dane profilu Instagram
    const instagramProfile = await prisma.instagramProfileCheck.findUnique({
      where: { id: user.instagramProfileId },
      select: {
        id: true,
        instagramUrl: true,
        username: true,
        fullName: true,
        biography: true,
        followersCount: true,
        followsCount: true,
        postsCount: true,
        highlightReelCount: true,  // NOWE POLE - liczba highlight reels
        profilePicUrl: true,
        profilePicUrlHD: true,
        isBusinessAccount: true,
        isPrivate: true,
        isVerified: true,
        businessCategory: true,
        checkedAt: true,
      }
    });

    if (!instagramProfile) {
      return NextResponse.json(
        { error: 'Instagram profile not found' },
        { status: 404 }
      );
    }

    console.log('✅ Instagram profile found:', {
      username: instagramProfile.username,
      followers: instagramProfile.followersCount
    });

    return NextResponse.json({
      success: true,
      profile: instagramProfile
    });

  } catch (error) {
    console.error('❌ Error fetching Instagram profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// === NOWA METODA POST - LINKOWANIE PROFILU ===
interface LinkProfileRequest {
  profileId: string;
}

interface LinkProfileResponse {
  success: boolean;
  message: string;
}

interface LinkProfileError {
  error: string;
  details?: string;
}

type LinkApiResponse = LinkProfileResponse | LinkProfileError;

export async function POST(request: NextRequest): Promise<NextResponse<LinkApiResponse>> {
  try {
    console.log('=== LINK INSTAGRAM PROFILE START ===');
    console.log('🕐 Timestamp:', new Date().toISOString());

    // Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      console.log('❌ No valid session found');
      return NextResponse.json({
        error: 'Unauthorized',
        details: 'You must be logged in to link an Instagram profile'
      }, { status: 401 });
    }

    console.log('👤 User ID:', session.user.id);

    // Pobierz dane z request body
    const body: LinkProfileRequest = await request.json();
    const { profileId } = body;

    console.log('🔗 Profile ID to link:', profileId);

    if (!profileId) {
      console.log('❌ No profile ID provided');
      return NextResponse.json({
        error: 'Profile ID is required'
      }, { status: 400 });
    }

    // Sprawdź czy profil Instagram istnieje w bazie danych
    console.log('🔍 Verifying Instagram profile exists...');
    const profileExists = await verifyInstagramProfileExists(profileId);

    if (!profileExists) {
      console.log('❌ Instagram profile not found in database');
      return NextResponse.json({
        error: 'Instagram profile not found',
        details: 'The specified profile ID does not exist in the database'
      }, { status: 404 });
    }

    console.log('✅ Instagram profile verified');

    // Powiąż użytkownika z profilem Instagram
    console.log('🔗 Linking user to Instagram profile...');
    const linkSuccess = await linkUserToInstagramProfile(session.user.id, profileId);

    if (!linkSuccess) {
      console.log('❌ Failed to link user to Instagram profile');
      return NextResponse.json({
        error: 'Failed to link profile',
        details: 'Database operation failed while linking the profile to your account'
      }, { status: 500 });
    }

    console.log('✅ Successfully linked user to Instagram profile');
    console.log('=== LINK INSTAGRAM PROFILE END ===');

    return NextResponse.json({
      success: true,
      message: 'Instagram profile successfully linked to your account'
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in link Instagram profile API:', error);
    console.log('=== LINK INSTAGRAM PROFILE FAILED ===');

    return NextResponse.json({
      error: 'Failed to link Instagram profile',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}