// src/app/api/linkedin-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Typy dla LinkedIn
interface LinkedInProfileResponse {
  exist: boolean;
  is_public: boolean;
  profilepic_url: string | null;
  username: string;
  followers: number | null;
  connections: number | null;
  full_name: string | null;
  headline: string | null;
  detection_method: string;
  raw_data?: {
    page_title: string;
    meta_description: string;
    json_data_found: boolean;
    html_indicators: string[];
  };
}

interface LinkedInApiRequest {
  url: string;
}

interface LinkedInApiError {
  error: string;
  details?: string;
}

// Typ odpowiedzi z Apify LinkedIn scraper (na podstawie rzeczywistej odpowiedzi)
interface ApifyLinkedInResponse {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  connections: number;
  followers: number;
  email: string | null;
  mobileNumber: string | null;
  jobTitle: string;
  companyName: string | null;
  profilePic: string;
  profilePicHighQuality: string;
  about: string;
  publicIdentifier: string;
  urn: string;
  experiences: any[];
  skills: any[];
  educations: any[];
  updates: any[];
  [key: string]: any;
}

type ApiResponse = LinkedInProfileResponse | LinkedInApiError;

// Główna funkcja POST
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    console.log('=== LINKEDIN API CALL START (APIFY) ===');
    console.log('🌍 Environment:', process.env.NODE_ENV);
    console.log('🏠 Host:', request.headers.get('host'));
    console.log('📍 Client IP:', request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown');
    console.log('🕐 Timestamp:', new Date().toISOString());

    const body: LinkedInApiRequest = await request.json();
    const { url } = body;

    console.log('🔗 Requested URL:', url);

    if (!url) {
      console.log('❌ No URL provided');
      return NextResponse.json({ error: 'LinkedIn URL is required' }, { status: 400 });
    }

    const username = extractLinkedInUsername(url);

    if (!username) {
      console.log('❌ Invalid LinkedIn URL format');
      return NextResponse.json({ error: 'Invalid LinkedIn URL' }, { status: 400 });
    }

    console.log('👤 Extracted username:', username);

    // Sprawdź czy token Apify jest dostępny
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.log('❌ APIFY_API_TOKEN not configured');
      return NextResponse.json({
        error: 'API configuration error',
        details: 'APIFY_API_TOKEN not configured'
      }, { status: 500 });
    }

    const profileData = await checkLinkedInProfileWithApify(url, apifyToken);

    console.log('✅ Profile check completed successfully via Apify');
    console.log('=== LINKEDIN API CALL END ===');

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('❌ CRITICAL ERROR in LinkedIn API:', error);
    console.log('=== LINKEDIN API CALL FAILED ===');
    return NextResponse.json({
      error: 'Failed to check LinkedIn profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Funkcja do wyciągania nazwy użytkownika z LinkedIn URL
function extractLinkedInUsername(url: string): string | null {
  try {
    const patterns: RegExp[] = [
      /linkedin\.com\/in\/([a-zA-Z0-9._-]+)\/?$/,
      /linkedin\.com\/in\/([a-zA-Z0-9._-]+)\/$/,
      /linkedin\.com\/in\/([a-zA-Z0-9._-]+)$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/\/$/, '');
      }
    }

    return null;
  } catch (error) {
    console.error('❌ Error extracting LinkedIn username:', error);
    return null;
  }
}

// Główna funkcja sprawdzająca profil LinkedIn za pomocą Apify
async function checkLinkedInProfileWithApify(
  linkedinUrl: string,
  apifyToken: string
): Promise<LinkedInProfileResponse> {
  try {
    console.log(`🔍 Checking LinkedIn profile via Apify synchronous endpoint: ${linkedinUrl}`);

    // Przygotuj payload dla Apify LinkedIn scraper
    const apifyPayload = {
      profileUrls: [linkedinUrl],
      includeSkills: false,
      includeExperience: false,
      includeEducation: false,
      includeRecommendations: false,
      includeAccomplishments: false,
      includePeopleAlsoViewed: false,
      includeActivityPosts: false
    };

    console.log('📤 Sending synchronous request to Apify LinkedIn scraper...');
    console.log('📦 Payload:', JSON.stringify(apifyPayload, null, 2));

    const requestStart = Date.now();

    // Wywołaj Apify LinkedIn scraper synchronicznie - używamy ID aktora zamiast nazwy
    const response = await fetch(`https://api.apify.com/v2/acts/2SyF0bVxmgGr8IVCZ/run-sync-get-dataset-items?token=${apifyToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apifyPayload),
      signal: AbortSignal.timeout(360000) // 6 minut timeout
    });

    const requestDuration = Date.now() - requestStart;
    console.log(`⏱️ Apify LinkedIn synchronous request completed in: ${requestDuration}ms`);
    console.log(`📊 Apify response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Apify LinkedIn API error response:', errorText);

      if (response.status === 408) {
        throw new Error('Apify LinkedIn request timed out - Actor run took longer than 5 minutes');
      }

      throw new Error(`Apify LinkedIn API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Synchroniczny endpoint zwraca wyniki bezpośrednio
    const results: ApifyLinkedInResponse[] = await response.json();

    console.log(`📦 Received ${results.length} results from Apify LinkedIn synchronous endpoint`);

    if (results.length > 0) {
      console.log(`📦 First LinkedIn result preview:`, JSON.stringify(results[0], null, 2).substring(0, 500));
    }

    if (!results || results.length === 0) {
      console.log('❌ No results from Apify LinkedIn - profile not found');
      return createLinkedInNotFoundResponse(extractLinkedInUsername(linkedinUrl) || 'unknown');
    }

    const apifyData: ApifyLinkedInResponse = results[0];
    console.log('✅ Apify LinkedIn data received:', {
      publicIdentifier: apifyData.publicIdentifier,
      fullName: apifyData.fullName,
      followers: apifyData.followers,
      connections: apifyData.connections,
      headline: apifyData.headline
    });

    // Mapuj dane z Apify na nasz format
    const mappedData = mapApifyLinkedInDataToResponse(apifyData);

    console.log('🎯 Final mapped LinkedIn response:', {
      exist: mappedData.exist,
      is_public: mappedData.is_public,
      username: mappedData.username,
      followers: mappedData.followers,
      connections: mappedData.connections,
      detection_method: mappedData.detection_method
    });

    return mappedData;

  } catch (error) {
    console.error(`❌ Error in Apify LinkedIn synchronous request:`, error);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏰ Apify LinkedIn request timed out after 6 minutes');
    }
    throw new Error(`Failed to fetch LinkedIn profile via Apify: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Funkcja mapująca dane z Apify LinkedIn na nasz format
function mapApifyLinkedInDataToResponse(apifyData: ApifyLinkedInResponse): LinkedInProfileResponse {
  console.log('🔄 Mapping Apify LinkedIn data to response format...');

  const originalProfilePicUrl = apifyData.profilePicHighQuality || apifyData.profilePic || null;

  // Stwórz proxy URL dla obrazu profilowego (jeśli istnieje)
  let proxiedProfilePicUrl = null;
  if (originalProfilePicUrl) {
    // Enkoduj URL obrazu dla bezpieczeństwa
    const encodedImageUrl = encodeURIComponent(originalProfilePicUrl);
    proxiedProfilePicUrl = `/api/proxy-image?url=${encodedImageUrl}`;
    console.log('🔄 Created proxy URL for LinkedIn profile picture');
  }

  const response: LinkedInProfileResponse = {
    exist: true,
    is_public: true, // LinkedIn profile scraper zwykle zwraca tylko publiczne profile
    profilepic_url: proxiedProfilePicUrl,
    username: apifyData.publicIdentifier || apifyData.urn || 'unknown',
    followers: apifyData.followers || null,
    connections: apifyData.connections || null,
    full_name: apifyData.fullName,
    headline: apifyData.headline,
    detection_method: 'APIFY_LINKEDIN_API',
    raw_data: {
      page_title: apifyData.fullName ? `${apifyData.fullName} - LinkedIn` : `LinkedIn Profile`,
      meta_description: apifyData.headline || apifyData.about || '',
      json_data_found: true,
      html_indicators: [
        'apify_linkedin_api_data',
        'public_linkedin_profile',
        ...(apifyData.followers > 0 ? ['has_followers'] : []),
        ...(apifyData.connections > 0 ? ['has_connections'] : []),
        ...(apifyData.companyName ? ['has_company'] : []),
        ...(apifyData.jobTitle ? ['has_job_title'] : []),
      ]
    }
  };

  console.log('✅ LinkedIn mapping completed successfully');
  return response;
}

function createLinkedInNotFoundResponse(username: string): LinkedInProfileResponse {
  console.log(`📝 Creating LinkedIn not found response for ${username}`);
  return {
    exist: false,
    is_public: false,
    profilepic_url: null,
    username: username,
    followers: null,
    connections: null,
    full_name: null,
    headline: null,
    detection_method: 'APIFY_LINKEDIN_API_NOT_FOUND',
  };
}

// Opcjonalne: obsługa innych metod HTTP
export async function GET(): Promise<NextResponse> {
  console.log('❌ GET method called on LinkedIn API - should use POST');
  return NextResponse.json({
    error: 'Method not allowed. Use POST instead.'
  }, { status: 405 });
}