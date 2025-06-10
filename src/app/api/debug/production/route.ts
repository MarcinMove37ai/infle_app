// src/app/api/debug/production/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    platform: 'unknown',
    tests: {} as any
  };

  try {
    // Test 1: Sprawdź nasze własne IP
    console.log('🔍 Checking our IP address...');
    try {
      const ipResponse = await fetch('https://httpbin.org/ip', {
        signal: AbortSignal.timeout(5000)
      });
      const ipData = await ipResponse.json();
      results.tests.ourIP = {
        success: true,
        ip: ipData.origin,
        provider: detectCloudProvider(ipData.origin)
      };
    } catch (ipError: any) {
      results.tests.ourIP = {
        success: false,
        error: ipError.message
      };
    }

    // Test 2: Test Instagram z dokładnym błędem
    console.log('🔍 Testing Instagram access...');
    try {
      const igResponse = await fetch('https://www.instagram.com/', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(15000)
      });

      const igText = await igResponse.text();

      results.tests.instagram = {
        success: true,
        status: igResponse.status,
        statusText: igResponse.statusText,
        headers: Object.fromEntries(igResponse.headers.entries()),
        bodyLength: igText.length,
        containsError: igText.includes('Sorry') || igText.includes('error') || igText.includes('blocked'),
        isLoginPage: igText.includes('loginForm') || igText.includes('Log in'),
        responsePreview: igText.substring(0, 500) // Pierwsze 500 znaków
      };
    } catch (igError: any) {
      results.tests.instagram = {
        success: false,
        error: igError.message,
        errorType: igError.name,
        isTimeout: igError.name === 'AbortError' || igError.message.includes('timeout'),
        isNetworkError: igError.message.includes('fetch') || igError.message.includes('network')
      };
    }

    // Test 3: Test Instagram profile API
    console.log('🔍 Testing Instagram profile API...');
    try {
      const profileResponse = await fetch('https://www.instagram.com/instagram/', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(15000)
      });

      results.tests.instagramProfile = {
        success: true,
        status: profileResponse.status,
        accessible: profileResponse.status < 400,
        headers: Object.fromEntries(profileResponse.headers.entries())
      };
    } catch (profileError: any) {
      results.tests.instagramProfile = {
        success: false,
        error: profileError.message,
        errorType: profileError.name
      };
    }

    // Test 4: Test innych serwisów dla porównania
    console.log('🔍 Testing other services...');
    const testUrls = [
      'https://httpbin.org/get',
      'https://jsonplaceholder.typicode.com/posts/1',
      'https://api.github.com'
    ];

    for (const url of testUrls) {
      try {
        const testResponse = await fetch(url, {
          signal: AbortSignal.timeout(5000)
        });
        results.tests[`external_${url.split('//')[1].split('/')[0]}`] = {
          success: true,
          status: testResponse.status,
          accessible: testResponse.status < 400
        };
      } catch (testError: any) {
        results.tests[`external_${url.split('//')[1].split('/')[0]}`] = {
          success: false,
          error: testError.message
        };
      }
    }

    // Dodaj informacje o środowisku
    results.platform = detectPlatform();

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('❌ Production debug failed:', error);

    return NextResponse.json({
      ...results,
      globalError: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

function detectCloudProvider(ip: string): string {
  // Sprawdź znane zakresy IP
  if (ip.startsWith('3.') || ip.startsWith('52.') || ip.startsWith('54.')) return 'AWS';
  if (ip.startsWith('35.') || ip.startsWith('34.')) return 'Google Cloud';
  if (ip.startsWith('40.') || ip.startsWith('51.')) return 'Azure';
  if (ip.startsWith('167.')) return 'DigitalOcean';
  return 'Unknown/Railway';
}

function detectPlatform(): string {
  if (process.env.RAILWAY_ENVIRONMENT) return 'Railway';
  if (process.env.AWS_REGION) return 'AWS App Runner';
  if (process.env.VERCEL) return 'Vercel';
  if (process.env.RENDER) return 'Render';
  return 'Unknown';
}

// POST endpoint do testowania konkretnego username
export async function POST(request: NextRequest) {
  try {
    const { username = 'instagram' } = await request.json();

    console.log(`🔍 Testing specific Instagram profile: ${username}`);

    const startTime = Date.now();
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal: AbortSignal.timeout(15000)
    });

    const duration = Date.now() - startTime;
    const html = await response.text();

    return NextResponse.json({
      username,
      success: true,
      status: response.status,
      duration: `${duration}ms`,
      headers: Object.fromEntries(response.headers.entries()),
      analysis: {
        isError: html.includes('Sorry') || html.includes('Page Not Found'),
        isPrivate: html.includes('This account is private'),
        isBlocked: html.includes('blocked') || html.includes('restricted'),
        hasContent: html.length > 1000,
        htmlPreview: html.substring(0, 1000)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}