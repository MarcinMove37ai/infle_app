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
      // Instagram domains
      'cdninstagram.com',
      'fbcdn.net',
      'instagram.com',
      'scontent-',

      // LinkedIn domains
      'media.licdn.com',
      'licdn.com',
    ];

    const isAllowedDomain = allowedDomains.some(domain =>
      imageUrl.includes(domain)
    );

    if (!isAllowedDomain) {
      console.log('❌ Image URL not from allowed domain:', imageUrl);
      return NextResponse.json({ error: 'Image URL not from allowed domain' }, { status: 403 });
    }

    console.log('🔍 Fetching image from:', imageUrl.substring(0, 80) + '...');

    // Determine platform for appropriate headers
    const isInstagram = allowedDomains.slice(0, 4).some(domain => imageUrl.includes(domain));
    const isLinkedIn = imageUrl.includes('licdn.com');

    // Prepare headers based on platform
    let fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };

    // Add platform-specific headers
    if (isLinkedIn) {
      // LinkedIn specific headers
      fetchHeaders = {
        ...fetchHeaders,
        'Referer': 'https://www.linkedin.com/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-site',
      };
      console.log('🔗 Using LinkedIn-specific headers');
    } else if (isInstagram) {
      // Instagram specific headers
      fetchHeaders = {
        ...fetchHeaders,
        'Referer': 'https://www.instagram.com/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      };
      console.log('📷 Using Instagram-specific headers');
    }

    // Pobierz obraz z CDN
    const imageResponse = await fetch(imageUrl, {
      headers: fetchHeaders,
      signal: AbortSignal.timeout(15000) // 15 sekund timeout dla LinkedIn (może być wolniejsze)
    });

    console.log(`📊 Image response status: ${imageResponse.status} ${imageResponse.statusText}`);

    if (!imageResponse.ok) {
      console.log('❌ Failed to fetch image:', imageResponse.status);

      // Dla LinkedIn spróbuj bez dodatkowych headers jeśli pierwsze żądanie się nie powiodło
      if (isLinkedIn && imageResponse.status === 403) {
        console.log('🔄 Retrying LinkedIn image with basic headers...');
        const retryResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*',
          },
          signal: AbortSignal.timeout(10000)
        });

        if (retryResponse.ok) {
          const retryArrayBuffer = await retryResponse.arrayBuffer();
          const retryBuffer = Buffer.from(retryArrayBuffer);

          console.log(`✅ LinkedIn image fetched on retry, size: ${retryBuffer.length.toLocaleString()} bytes`);

          let contentType = retryResponse.headers.get('content-type') || 'image/jpeg';
          if (!contentType.startsWith('image/')) {
            contentType = determineContentTypeFromUrl(imageUrl);
          }

          return createImageResponse(retryBuffer, contentType);
        }
      }

      return NextResponse.json({
        error: 'Failed to fetch image',
        status: imageResponse.status,
        platform: isLinkedIn ? 'LinkedIn' : isInstagram ? 'Instagram' : 'Unknown'
      }, { status: 502 });
    }

    // Pobierz dane obrazu
    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);

    console.log(`✅ Image fetched successfully, size: ${imageBuffer.length.toLocaleString()} bytes`);

    // Określ content type na podstawie response headers lub URL
    let contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    if (!contentType.startsWith('image/')) {
      contentType = determineContentTypeFromUrl(imageUrl);
    }

    console.log(`📄 Content type: ${contentType}`);

    return createImageResponse(imageBuffer, contentType);

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

// Helper function to determine content type from URL
function determineContentTypeFromUrl(url: string): string {
  if (url.includes('.png')) {
    return 'image/png';
  } else if (url.includes('.gif')) {
    return 'image/gif';
  } else if (url.includes('.webp')) {
    return 'image/webp';
  } else if (url.includes('.svg')) {
    return 'image/svg+xml';
  } else {
    return 'image/jpeg';
  }
}

// Helper function to create consistent image response
function createImageResponse(imageBuffer: Buffer, contentType: string): NextResponse {
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
      // Dodaj headers dla lepszej kompatybilności
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
    },
  });
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
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}