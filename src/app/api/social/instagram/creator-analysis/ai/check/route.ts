// src/app/api/social/instagram/creator-analysis/ai/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAIAnalysis } from '@/lib/profileStorage';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking existing AI analysis...');

    // 1. Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'You must be logged in' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Pobierz username z query params lub z sesji
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') ||
                    session.user.instagramUsername;

    if (!username) {
      return NextResponse.json(
        { error: 'Username required', details: 'No username provided or found in session' },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking AI analysis for userId: ${userId}, username: ${username}`);

    // 3. Sprawdź czy istnieje analiza AI w bazie
    const existingAnalysis = await getAIAnalysis(userId, username);

    if (existingAnalysis) {
      console.log('✅ Found existing AI analysis');

      return NextResponse.json({
        exists: true,
        username: username,
        analysis: existingAnalysis,
        message: 'AI analysis found in database'
      });
    } else {
      console.log('📭 No existing AI analysis found');

      return NextResponse.json({
        exists: false,
        username: username,
        message: 'No AI analysis found - can proceed with generation'
      });
    }

  } catch (error) {
    console.error('❌ Error checking existing AI analysis:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}