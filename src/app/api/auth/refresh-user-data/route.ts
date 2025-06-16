import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Refreshing user data for user:', session.user.id);

    // Pobierz najnowsze dane użytkownika z bazy
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        profilePicture: true,
        instagramProfileId: true,
        linkedinProfileId: true,
        socialProfileType: true,
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Pobierz Instagram username jeśli profil istnieje
    let instagramUsername = null;
    if (user.instagramProfileId) {
      const instagramProfile = await prisma.instagramProfileCheck.findUnique({
        where: { id: user.instagramProfileId },
        select: { username: true }
      });
      instagramUsername = instagramProfile?.username || null;
    }

    // Zwróć zaktualizowane dane
    const updatedUserData = {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      emailVerified: user.emailVerified,
      profilePicture: user.profilePicture,
      instagramProfileId: user.instagramProfileId,
      instagramUsername: instagramUsername,
      linkedinProfileId: user.linkedinProfileId,
      socialProfileType: user.socialProfileType,
    };

    console.log('✅ User data refreshed successfully:', {
      userId: user.id,
      instagramProfileId: user.instagramProfileId,
      instagramUsername: instagramUsername
    });

    return NextResponse.json({
      success: true,
      user: updatedUserData
    });

  } catch (error) {
    console.error('❌ Error refreshing user data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}