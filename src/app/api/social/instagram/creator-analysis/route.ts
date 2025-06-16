// src/app/api/social/instagram/creator-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveCreatorAnalysis } from '@/lib/profileStorage';

// Funkcja do czyszczenia tekstu z ozdobników i formatowania
function cleanText(text: string): string {
  if (!text) return '';

  return text
    // Usuń emotikony (Unicode blocks)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Symbols & Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    // Usuń znaki specjalne i formatowanie
    .replace(/[\u{200D}\u{FE0F}]/gu, '')    // Zero Width Joiner, Variation Selector
    .replace(/[⁣\u{2063}]/gu, '')           // Invisible separator
    .replace(/\n\s*\n/g, ' ')               // Podwójne nowe linie na spację
    .replace(/\n/g, ' ')                    // Nowe linie na spacje
    .replace(/\s+/g, ' ')                   // Wielokrotne spacje na jedną
    .replace(/[^\w\s\.,!?;:\-()]/g, '')     // Tylko podstawowe znaki interpunkcyjne
    .trim();
}

interface CreatorAnalysisRequest {
  username: string;
  postsLimit?: number;
}

// POPRAWIONY interfejs - dodano pole username
interface PostAnalysisData {
  userId: string;
  username: string; // ← DODANE POLE
  postId: string;
  caption: string; // Czysty tekst bez formatowania
  likesCount: number;
  commentsCount: number;
  videoPlayCount: number | null;
  videoDuration: number | null;
  commenterUsernames: Record<string, number>; // {username: count}
}

interface CreatorAnalysisResponse {
  success: boolean;
  username: string;
  userId: string;
  totalPosts: number;
  posts: PostAnalysisData[];
  requestDurationMs: number;
  // NOWE POLA dla zapisu do bazy
  savedToDatabase: boolean;
  savedCount: number;
  errorCount: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== SIMPLIFIED CREATOR ANALYSIS START ===');
    console.log('🕐 Timestamp:', new Date().toISOString());

    // Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      console.log('❌ No valid session found');
      return NextResponse.json({
        error: 'Unauthorized',
        details: 'You must be logged in to perform creator analysis'
      }, { status: 401 });
    }

    const userId = session.user.id;
    console.log('👤 User ID:', userId);

    // Pobierz dane z request body
    const body: CreatorAnalysisRequest = await request.json();
    const { username, postsLimit = 12 } = body;

    console.log('📱 Platform: Instagram');
    console.log('🔍 Analysis for username:', username);
    console.log('📊 Posts limit:', postsLimit);

    if (!username) {
      console.log('❌ No username provided');
      return NextResponse.json({
        error: 'Username is required'
      }, { status: 400 });
    }

    // Sprawdź czy token Apify jest dostępny
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.log('❌ APIFY_API_TOKEN not configured');
      return NextResponse.json({
        error: 'API configuration error',
        details: 'APIFY_API_TOKEN not configured'
      }, { status: 500 });
    }

    // Przygotuj payload dla Instagram Post Scraper
    const apifyPayload = {
      resultsLimit: postsLimit,
      skipPinnedPosts: false,
      username: [username]
    };

    console.log('📤 Sending request to Instagram Post Scraper...');
    console.log('📦 Payload:', JSON.stringify(apifyPayload, null, 2));

    const requestStart = Date.now();

    // Wywołaj Instagram Post Scraper API synchronicznie
    const response = await fetch(`https://api.apify.com/v2/acts/apify~instagram-post-scraper/run-sync-get-dataset-items?token=${apifyToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apifyPayload),
      signal: AbortSignal.timeout(360000) // 6 minut timeout
    });

    const requestDuration = Date.now() - requestStart;
    console.log(`⏱️ Instagram Post Scraper request completed in: ${requestDuration}ms`);
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Instagram Post Scraper API error:', errorText);

      if (response.status === 408) {
        throw new Error('Instagram Post Scraper request timed out');
      }

      throw new Error(`Instagram Post Scraper API error: ${response.status} - ${errorText}`);
    }

    const results = await response.json();
    console.log(`📦 Received ${results.length} items from Instagram Post Scraper`);

    if (results.length === 0) {
      console.log('❌ No posts found for user:', username);
      return NextResponse.json({
        error: 'No posts found',
        details: `No posts found for username: ${username}`
      }, { status: 404 });
    }

    // POPRAWIONE przetwarzanie danych - dodano username
    const processedPosts: PostAnalysisData[] = results.map((post: any) => {
      // Wyciągnij i zlicz komentujących (deduplikacja z licznikiem)
      const commenterCounts: Record<string, number> = {};
      if (post.latestComments && Array.isArray(post.latestComments)) {
        post.latestComments.forEach((comment: any) => {
          if (comment.ownerUsername) {
            const commenterUsername = comment.ownerUsername;
            commenterCounts[commenterUsername] = (commenterCounts[commenterUsername] || 0) + 1;
          }
        });
      }

      return {
        userId: userId,
        username: username, // ← DODANE POLE - użyj username z request body
        postId: post.id || '',
        caption: cleanText(post.caption || ''),
        likesCount: post.likesCount || 0,
        commentsCount: post.commentsCount || 0,
        videoPlayCount: post.videoPlayCount || null,
        videoDuration: post.videoDuration || null,
        commenterUsernames: commenterCounts
      };
    });

    console.log('✅ Data processing completed');
    console.log('📊 Processed posts count:', processedPosts.length);

    // Pokaż przykłady wszystkich postów
    processedPosts.forEach((post, index) => {
      const uniqueCommenters = Object.keys(post.commenterUsernames).length;
      const totalComments = Object.values(post.commenterUsernames).reduce((sum, count) => sum + count, 0);

      console.log(`📋 Post ${index + 1}:`, {
        postId: post.postId,
        username: post.username, // ← Dodano do logów
        cleanCaptionLength: post.caption?.length,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        uniqueCommenters: uniqueCommenters,
        totalCommentsFromShown: totalComments,
        hasVideo: post.videoPlayCount !== null,
        topCommenters: Object.entries(post.commenterUsernames)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([user, count]) => `${user}(${count})`)
          .join(', ')
      });
    });

    // ZAPISZ DO BAZY DANYCH - teraz z poprawną strukturą danych
    console.log('💾 Saving analysis data to database...');
    const saveResult = await saveCreatorAnalysis(processedPosts);

    console.log('✅ Simplified creator analysis completed successfully');
    console.log('📊 Database save result:', saveResult);
    console.log('=== SIMPLIFIED CREATOR ANALYSIS END ===');

    const analysisResponse: CreatorAnalysisResponse = {
      success: true,
      username,
      userId,
      totalPosts: processedPosts.length,
      posts: processedPosts,
      requestDurationMs: requestDuration,
      // POLA ZAPISU DO BAZY
      savedToDatabase: saveResult.success,
      savedCount: saveResult.saved,
      errorCount: saveResult.errors
    };

    return NextResponse.json(analysisResponse);

  } catch (error) {
    console.error('❌ CRITICAL ERROR in Simplified Creator Analysis:', error);
    console.log('=== SIMPLIFIED CREATOR ANALYSIS FAILED ===');
    return NextResponse.json({
      error: 'Failed to perform creator analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Opcjonalne: obsługa metody GET dla testów
export async function GET() {
  return NextResponse.json({
    service: 'simplified-creator-analysis',
    message: 'Simplified Instagram Creator Analysis API',
    usage: 'Send POST request with { "username": "instagram_username", "postsLimit": 12 }',
    note: 'Returns simplified data structure and saves to database',
    fields: [
      'userId (from session)',
      'username (from request)', // ← Zaktualizowano opis
      'postId',
      'caption (cleaned text)',
      'likesCount',
      'commentsCount',
      'videoPlayCount',
      'videoDuration',
      'commenterUsernames {username: count}'
    ],
    database: {
      saves: 'instagram_creator_analysis table',
      strategy: 'upsert (update if exists, create if new)',
      note: 'Now includes username field for proper database saving'
    }
  });
}