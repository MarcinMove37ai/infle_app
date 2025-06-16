// src/app/api/social/linkedin/creator-analysis/ai/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper function to get LinkedIn AI analysis
async function getLinkedInAIAnalysis(userId: string, username: string) {
  try {
    const analysis = await prisma.linkedInCreatorAIAnalysis.findUnique({
      where: {
        userId_username: {
          userId: userId,
          username: username
        }
      }
    });

    if (!analysis) return null;

    return {
      username: analysis.username,
      profileDescription: analysis.profileDescription,
      businessCompetencies: analysis.businessCompetencies,
      expertiseNiche: analysis.expertiseNiche,
      metadata: analysis.metadata,
      postsAnalyzed: analysis.postsAnalyzed,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt
    };

  } catch (error) {
    console.error('❌ Error fetching LinkedIn AI analysis:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking existing LinkedIn AI analysis...');

    // 1. Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'You must be logged in' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Pobierz username z query params lub z sesji (LinkedIn specific)
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') ||
                    (session.user as any)?.linkedinUsername ||
                    session.user.name; // Fallback na name

    if (!username) {
      return NextResponse.json(
        { error: 'Username required', details: 'No username provided or found in session' },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking LinkedIn AI analysis for userId: ${userId}, username: ${username}`);

    // 3. Sprawdź czy istnieje analiza AI w bazie
    const existingAnalysis = await getLinkedInAIAnalysis(userId, username);

    if (existingAnalysis) {
      console.log('✅ Found existing LinkedIn AI analysis');

      // Sprawdź świeżość danych (7 dni)
      const daysSinceUpdate = (Date.now() - existingAnalysis.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      const isFresh = daysSinceUpdate < 7;

      // 🔧 NAPRAWKA: Bezpieczne obsłużenie metadata
      const metadataBase = existingAnalysis.metadata && typeof existingAnalysis.metadata === 'object'
        ? existingAnalysis.metadata as Record<string, any>
        : {};

      return NextResponse.json({
        exists: true,
        username: username,
        analysis: {
          username: existingAnalysis.username,
          profileDescription: existingAnalysis.profileDescription,
          businessCompetencies: existingAnalysis.businessCompetencies,
          expertiseNiche: existingAnalysis.expertiseNiche
        },
        metadata: {
          ...metadataBase,
          postsAnalyzed: existingAnalysis.postsAnalyzed,
          createdAt: existingAnalysis.createdAt.toISOString(),
          updatedAt: existingAnalysis.updatedAt.toISOString(),
          daysSinceUpdate: parseFloat(daysSinceUpdate.toFixed(1)),
          isFresh: isFresh
        },
        message: 'LinkedIn AI analysis found in database'
      });
    } else {
      console.log('📭 No existing LinkedIn AI analysis found');

      return NextResponse.json({
        exists: false,
        username: username,
        message: 'No LinkedIn AI analysis found - can proceed with generation'
      });
    }

  } catch (error) {
    console.error('❌ Error checking existing LinkedIn AI analysis:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}