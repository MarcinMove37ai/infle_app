// src/app/api/social/linkedin/creator-analysis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveLinkedInCreatorAnalysis } from '@/lib/profileStorage';

// LIMITY ZASZYTE W ENDPOINCIE - TESTOWE
const POST_LIMIT = 3;  // Ile postów pobrać
const COMMENT_LIMIT = 3; // Ile komentarzy na post

// Funkcja do czyszczenia tekstu z ozdobników i formatowania (ulepszona wersja)
function cleanText(text: string): string {
  if (!text) return '';

  return text
    // Usuń wszystkie emotikony i symbole - bardziej komprehensywne zakresy
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Symbols & Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
    .replace(/[\u{1F018}-\u{1F270}]/gu, '') // Additional symbols
    .replace(/[\u{238C}-\u{2454}]/gu, '')   // Technical symbols
    .replace(/[\u{20D0}-\u{20FF}]/gu, '')   // Combining marks
    .replace(/[\u{2190}-\u{21FF}]/gu, '')   // Arrows
    .replace(/[\u{2000}-\u{206F}]/gu, '')   // General punctuation
    .replace(/[\u{2070}-\u{209F}]/gu, '')   // Superscripts and subscripts
    .replace(/[\u{20A0}-\u{20CF}]/gu, '')   // Currency symbols
    .replace(/[\u{2100}-\u{214F}]/gu, '')   // Letterlike symbols
    .replace(/[\u{2150}-\u{218F}]/gu, '')   // Number forms
    .replace(/[\u{2460}-\u{24FF}]/gu, '')   // Enclosed alphanumerics
    .replace(/[\u{25A0}-\u{25FF}]/gu, '')   // Geometric shapes
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Miscellaneous symbols (powtórzenie dla pewności)
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats (powtórzenie)
    // Usuń konkretne problematyczne znaki
    .replace(/[⏰☕⚡🧠✅⌛📅🤔❤️🔥🌐🚀💡🔍💬⚙️📊💰⭐]/gu, '') // Często używane emotikony
    // Usuń znaki specjalne i formatowanie
    .replace(/[\u{200D}\u{FE0F}]/gu, '')    // Zero Width Joiner, Variation Selector
    .replace(/[⁣\u{2063}]/gu, '')           // Invisible separator
    .replace(/\n\s*\n/g, ' ')               // Podwójne nowe linie na spację
    .replace(/\n/g, ' ')                    // Nowe linie na spacje
    .replace(/\t/g, ' ')                    // Tabulatory na spacje
    .replace(/\s+/g, ' ')                   // Wielokrotne spacje na jedną
    .replace(/[^\w\s\.,!?;:\-()]/g, '')     // Tylko podstawowe znaki interpunkcyjne (agresywne czyszczenie)
    .replace(/\s+/g, ' ')                   // Ponownie - usuń wielokrotne spacje po czyszczeniu
    .trim();
}

// Funkcja do wyciągania URN posta z komentarza
function extractUrnFromComment(comment: any): string | null {
  // W rzeczywistych danych post_input to już jest URN posta
  if (comment.post_input) {
    // Jeśli to string z liczbami, to już jest URN
    if (typeof comment.post_input === 'string' && /^\d+$/.test(comment.post_input)) {
      return comment.post_input;
    }
    // Fallback: jeśli to URL, wyciągnij URN
    const activityMatch = comment.post_input.match(/activity-(\d+)/);
    return activityMatch ? activityMatch[1] : null;
  }
  return null;
}

// RAW DATA STRUCTURE
interface LinkedInPostRecord {
  userId: string;
  username: string;
  postUrn: string;
  postDate: string;
  postText: string;
  totalReactions: number;
  commentsCount: number;
  commenterHeadlines: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== LINKEDIN CREATOR ANALYSIS START ===');
    console.log('🕐 Timestamp:', new Date().toISOString());
    console.log(`📊 Limits: ${POST_LIMIT} posts, ${COMMENT_LIMIT} comments per post`);

    // Sprawdź sesję użytkownika
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.log('❌ No valid session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    console.log('👤 User ID:', userId);

    // Input: JSON z username
    const body = await request.json();
    const username = body.username;

    console.log('📱 Platform: LinkedIn');
    console.log('🔍 Analysis for username:', username);

    if (!username) {
      console.log('❌ No username provided');
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.log('❌ APIFY_API_TOKEN not configured');
      return NextResponse.json({ error: 'API not configured' }, { status: 500 });
    }

    // Wyciągnij czyste username z URL
    let cleanUsername = username;
    if (username.includes('linkedin.com/in/')) {
      const match = username.match(/linkedin\.com\/in\/([^\/\?]+)/);
      if (match) cleanUsername = match[1];
    }

    console.log('📤 Sending request to LinkedIn Post Scraper...');

    const requestStart = Date.now();

    // ETAP 1: Pobierz posty
    const postsResponse = await fetch(`https://api.apify.com/v2/acts/LQQIXN9Othf8f7R5n/run-sync-get-dataset-items?token=${apifyToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        limit: POST_LIMIT,
        username: username,
        page_number: 1
      }),
      signal: AbortSignal.timeout(360000)
    });

    const requestDuration = Date.now() - requestStart;
    console.log(`⏱️ LinkedIn Post Scraper request completed in: ${requestDuration}ms`);
    console.log(`📊 Response status: ${postsResponse.status} ${postsResponse.statusText}`);

    if (!postsResponse.ok) {
      const error = await postsResponse.text();
      console.error('❌ LinkedIn Post Scraper API error:', error);
      throw new Error(`Posts API error: ${postsResponse.status} - ${error}`);
    }

    const posts = await postsResponse.json();
    console.log(`📦 Received ${posts.length} items from LinkedIn Post Scraper`);

    if (posts.length === 0) {
      console.log('❌ No posts found for user:', username);
      return NextResponse.json({ error: 'No posts found' }, { status: 404 });
    }

    // Stwórz rekordy
    const records: LinkedInPostRecord[] = posts.map((post: any) => ({
      userId,
      username: cleanUsername,
      postUrn: post.urn || '',
      postDate: post.posted_at?.date || '',
      postText: cleanText(post.text || ''),
      totalReactions: post.stats?.total_reactions || 0,
      commentsCount: post.stats?.comments || 0,
      commenterHeadlines: ''
    }));

    console.log('✅ Posts data processing completed');
    console.log('📊 Processed posts count:', records.length);

    // ETAP 2: Pobierz komentarze dla postów które je mają
    const postsWithComments = records.filter(r => r.commentsCount > 0);
    console.log(`📝 Posts with comments: ${postsWithComments.length}/${records.length}`);

    if (postsWithComments.length > 0) {
      console.log('🔍 Fetching commenters data for posts with comments...');

      try {
        const commentsResponse = await fetch(`https://api.apify.com/v2/acts/2XnpwxfhSW1fAWElp/run-sync-get-dataset-items?token=${apifyToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postIds: postsWithComments.map(r => r.postUrn),
            limit: COMMENT_LIMIT,
            page_number: 1,
            sortOrder: "most recent"
          }),
          signal: AbortSignal.timeout(360000)
        });

        if (commentsResponse.ok) {
          const comments = await commentsResponse.json();
          console.log(`📦 Received comments data: ${comments.length} items`);

          const commentersByPost: Record<string, Record<string, string>> = {};

          comments.forEach((item: any, index: number) => {
            const processComment = (comment: any, depth: string = '') => {
              if (comment.author?.name && comment.author?.headline && comment.post_input) {
                const commenterName = comment.author.name;
                const commenterHeadline = cleanText(comment.author.headline); // ✅ Czyść headline

                // Wykluczaj autora postu
                if (commenterName.toLowerCase() === cleanUsername.toLowerCase() ||
                    commenterName.toLowerCase() === 'artur balicki') {
                  console.log(`${depth}⏭️  Skipping post author: ${commenterName}`);
                  return;
                }

                const postUrn = extractUrnFromComment(comment);
                console.log(`${depth}📝 Comment by: ${commenterName} (${commenterHeadline.substring(0, 30)}...) for post: ${postUrn}`);

                if (postUrn) {
                  if (!commentersByPost[postUrn]) {
                    commentersByPost[postUrn] = {};
                  }
                  // Format: {"username": "cleaned_headline"}
                  commentersByPost[postUrn][commenterName] = commenterHeadline;
                }
              }

              if (comment.replies?.length) {
                console.log(`${depth}  📥 Processing ${comment.replies.length} replies`);
                comment.replies.forEach((reply: any) => processComment(reply, depth + '  '));
              }
            };

            console.log(`📋 Processing comment item ${index + 1}/${comments.length}`);
            processComment(item);
          });

          // Pokaż co znaleziono
          console.log('🔍 Commenters found per post (excluding post author):');
          Object.entries(commentersByPost).forEach(([urn, commentersObj]) => {
            console.log(`  Post ${urn}: ${Object.keys(commentersObj).length} unique commenters`);
            Object.entries(commentersObj).slice(0, 2).forEach(([username, headline]) => {
              console.log(`    - ${username}: ${headline.substring(0, 40)}...`);
            });
          });

          // Przypisz jako JSON string
          records.forEach(record => {
            if (commentersByPost[record.postUrn]) {
              record.commenterHeadlines = JSON.stringify(commentersByPost[record.postUrn]);
              console.log(`✅ Post ${record.postUrn}: assigned ${Object.keys(commentersByPost[record.postUrn]).length} commenter entries as JSON`);
            }
          });

          console.log('✅ Comments data processing completed');
        } else {
          const errorText = await commentsResponse.text();
          console.warn('⚠️ Comments API failed:', errorText);
          console.log('📝 Continuing without commenter data...');
        }
      } catch (commentsError) {
        console.warn('⚠️ Comments API error:', commentsError);
        console.log('📝 Continuing without commenter data...');
      }
    } else {
      console.log('📝 No posts with comments found - skipping comments API call');
    }

    // Pokaż przykłady rekordów z oczyszczonym tekstem i danymi komentujących
    records.slice(0, 2).forEach((record, index) => {
      console.log(`📋 Record ${index + 1}:`, {
        postUrn: record.postUrn,
        postDate: record.postDate,
        cleanTextLength: record.postText.length,
        totalReactions: record.totalReactions,
        commentsCount: record.commentsCount,
        commentersCount: record.commenterHeadlines ? Object.keys(JSON.parse(record.commenterHeadlines || '{}')).length : 0,
        textPreview: record.postText.substring(0, 100) + '...'
      });
    });

    // 💾 ZAPISZ DO BAZY DANYCH
    console.log('💾 Saving analysis data to database...');
    const saveResult = await saveLinkedInCreatorAnalysis(records);
    console.log('📊 Database save result:', saveResult);

    console.log('✅ LinkedIn creator analysis completed successfully');
    console.log('=== LINKEDIN CREATOR ANALYSIS END ===');

    // RAW DATA OUTPUT - tylko tablica rekordów
    return NextResponse.json(records);

  } catch (error) {
    console.error('❌ CRITICAL ERROR in LinkedIn Creator Analysis:', error);
    console.log('=== LINKEDIN CREATOR ANALYSIS FAILED ===');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    usage: 'POST with { "username": "LinkedIn profile URL" }',
    example: 'POST { "username": "https://www.linkedin.com/in/username/" }',
    output: 'Array of raw data records saved to database',
    limits: { posts: POST_LIMIT, comments: COMMENT_LIMIT },
    database: {
      table: 'linkedin_creator_analysis',
      upsert: 'Updates existing records or creates new ones',
      unique_key: 'userId + postUrn'
    }
  });
}