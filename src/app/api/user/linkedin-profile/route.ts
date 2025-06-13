// src/app/api/user/linkedin-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { linkUserToLinkedInProfile, verifyLinkedInProfileExists } from '@/lib/profileStorage';

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

    console.log('🔗 Fetching LinkedIn profile for user:', session.user.id);

    // Pobierz dane użytkownika z linkedinProfileId
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        linkedinProfileId: true,
        socialProfileType: true,
      }
    });

    if (!user?.linkedinProfileId) {
      return NextResponse.json(
        { error: 'No LinkedIn profile linked' },
        { status: 404 }
      );
    }

    // Pobierz pełne dane profilu LinkedIn
    const linkedinProfile = await prisma.linkedInProfileCheck.findUnique({
      where: { id: user.linkedinProfileId },
      select: {
        id: true,
        linkedinUrl: true,
        firstName: true,
        lastName: true,
        fullName: true,
        headline: true,
        aboutExcerpt: true,
        connectionsCount: true,
        followersCount: true,
        profilePicUrl: true,
        jobTitle: true,
        companyName: true,
        companyIndustry: true,
        location: true,
        topSkills: true,
        checkedAt: true,
      }
    });

    if (!linkedinProfile) {
      return NextResponse.json(
        { error: 'LinkedIn profile not found' },
        { status: 404 }
      );
    }

    console.log('✅ LinkedIn profile found:', {
      fullName: linkedinProfile.fullName,
      followers: linkedinProfile.followersCount,
      connections: linkedinProfile.connectionsCount
    });

    return NextResponse.json({
      success: true,
      profile: linkedinProfile
    });

  } catch (error) {
    console.error('❌ Error fetching LinkedIn profile:', error);
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
    console.log('=== LINK LINKEDIN PROFILE START ===');
    console.log('🕐 Timestamp:', new Date().toISOString());

    // Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      console.log('❌ No valid session found');
      return NextResponse.json({
        error: 'Unauthorized',
        details: 'You must be logged in to link a LinkedIn profile'
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

    // Sprawdź czy profil LinkedIn istnieje w bazie danych
    console.log('🔍 Verifying LinkedIn profile exists...');
    const profileExists = await verifyLinkedInProfileExists(profileId);

    if (!profileExists) {
      console.log('❌ LinkedIn profile not found in database');
      return NextResponse.json({
        error: 'LinkedIn profile not found',
        details: 'The specified profile ID does not exist in the database'
      }, { status: 404 });
    }

    console.log('✅ LinkedIn profile verified');

    // Powiąż użytkownika z profilem LinkedIn
    console.log('🔗 Linking user to LinkedIn profile...');
    const linkSuccess = await linkUserToLinkedInProfile(session.user.id, profileId);

    if (!linkSuccess) {
      console.log('❌ Failed to link user to LinkedIn profile');
      return NextResponse.json({
        error: 'Failed to link profile',
        details: 'Database operation failed while linking the profile to your account'
      }, { status: 500 });
    }

    console.log('✅ Successfully linked user to LinkedIn profile');
    console.log('=== LINK LINKEDIN PROFILE END ===');

    return NextResponse.json({
      success: true,
      message: 'LinkedIn profile successfully linked to your account'
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in link LinkedIn profile API:', error);
    console.log('=== LINK LINKEDIN PROFILE FAILED ===');

    return NextResponse.json({
      error: 'Failed to link LinkedIn profile',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}