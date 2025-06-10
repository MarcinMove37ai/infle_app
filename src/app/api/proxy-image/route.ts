// src/app/api/proxy-image/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    console.log('📸 Image proxy request for:', imageUrl);

    if (!imageUrl) {
      console.log('❌ No image URL provided');
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Sprawdź czy URL jest z dozwolonych domen (security)
    const allowedDomains = [
      'cdninstagram.com',
      'fbcdn.net',
      'instagram.com',
      'scontent-',
    ];

    const isAllowedDomain = allowedDomains.some(domain =>
      imageUrl.includes(domain)
    );

    if (!isAllowedDomain) {
      console.log('❌ Image URL not from allowed domain:', imageUrl);
      return NextResponse.json({ error: 'Image URL not from allowed domain' }, { status: 403 });
    }

    console.log('🔍 Fetching image from:', imageUrl.substring(0, 80) + '...');

    // Pobierz obraz z Instagram CDN
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      signal: AbortSignal.timeout(10000) // 10 sekund timeout
    });

    console.log(`📊 Image response status: ${imageResponse.status} ${imageResponse.statusText}`);

    if (!imageResponse.ok) {
      console.log('❌ Failed to fetch image:', imageResponse.status);
      return NextResponse.json({
        error: 'Failed to fetch image',
        status: imageResponse.status
      }, { status: 502 });
    }

    // Pobierz dane obrazu
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);

    console.log(`✅ Image fetched successfully, size: ${imageBuffer.length.toLocaleString()} bytes`);

    // Określ content type na podstawie response headers lub URL
    let contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    if (!contentType.startsWith('image/')) {
      // Fallback na podstawie rozszerzenia w URL
      if (imageUrl.includes('.png')) {
        contentType = 'image/png';
      } else if (imageUrl.includes('.gif')) {
        contentType = 'image/gif';
      } else if (imageUrl.includes('.webp')) {
        contentType = 'image/webp';
      } else {
        contentType = 'image/jpeg';
      }
    }

    console.log(`📄 Content type: ${contentType}`);

    // Zwróć obraz z odpowiednimi headerami CORS
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache na 1 godzinę
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Dodatkowe headers dla lepszego cachowania
        'X-Content-Type-Options': 'nosniff',
        'Content-Length': imageBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('❌ Error in image proxy:', error);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏰ Image fetch timed out');
      return NextResponse.json({ error: 'Image fetch timeout' }, { status: 504 });
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Opcjonalna obsługa preflight requests dla CORS
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400', // 24 godziny
    },
  });
}