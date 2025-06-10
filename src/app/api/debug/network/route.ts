// src/app/api/debug/network/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testUrl = searchParams.get('url') || 'https://httpbin.org/ip';

  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    testUrl,
    tests: {} as any
  };

  try {
    // Test 1: Podstawowy fetch
    console.log('🧪 Testing basic fetch...');
    const startTime = Date.now();

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NextJS-App/1.0)',
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text();

    results.tests.basicFetch = {
      success: true,
      status: response.status,
      statusText: response.statusText,
      duration: `${duration}ms`,
      responseSize: responseText.length,
      headers: Object.fromEntries(response.headers.entries())
    };

    // Test 2: Instagram connectivity
    console.log('🧪 Testing Instagram connectivity...');
    const igStartTime = Date.now();

    try {
      const igResponse = await fetch('https://www.instagram.com/', {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000)
      });

      const igDuration = Date.now() - igStartTime;

      results.tests.instagram = {
        success: true,
        status: igResponse.status,
        duration: `${igDuration}ms`,
        accessible: igResponse.status < 400
      };
    } catch (igError: any) {
      results.tests.instagram = {
        success: false,
        error: igError.message,
        accessible: false
      };
    }

    // Test 3: DNS Resolution
    console.log('🧪 Testing DNS resolution...');
    try {
      const dnsResponse = await fetch('https://1.1.1.1/dns-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/dns-json',
        },
        body: JSON.stringify({
          name: 'instagram.com',
          type: 'A'
        }),
        signal: AbortSignal.timeout(5000)
      });

      const dnsData = await dnsResponse.json();
      results.tests.dns = {
        success: true,
        resolved: dnsData.Answer?.length > 0,
        answers: dnsData.Answer
      };
    } catch (dnsError: any) {
      results.tests.dns = {
        success: false,
        error: dnsError.message
      };
    }

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('❌ Network test failed:', error);

    results.tests.basicFetch = {
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    return NextResponse.json(results, { status: 500 });
  }
}

// Endpoint do testowania konkretnej funkcjonalności
export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();

    if (action === 'test-instagram') {
      const username = data?.username || 'instagram';

      // Testuj rzeczywistą funkcjonalność Instagram
      const response = await fetch(`${request.nextUrl.origin}/api/instagram-profile?username=${username}`);
      const result = await response.json();

      return NextResponse.json({
        success: response.ok,
        status: response.status,
        result,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}