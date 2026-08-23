import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Usunięcie output: 'standalone' - powoduje problemy z env vars

  // Zaktualizowana opcja zgodnie z nową wersją Next.js
  serverExternalPackages: ['@prisma/client', 'prisma', 'pdf-parse'],

  // Image optimization — pozwól Next Image przetwarzać assety z naszego
  // /api/assets/* endpointu (profile pictures, ebook covers, mockup uploads).
  // Bez tego komponent <Image> trzeba było używać z `unoptimized` co skutkowało
  // brakiem WebP conversion + resize + lazy loading.
  //
  // remotePatterns akceptuje wszystkie hosts dla custom domain klientów —
  // Next Image i tak konwertuje przez /_next/image proxy więc URL źródłowy
  // jest inputem, nie zagrożeniem (browser nie ładuje go bezpośrednio).
  images: {
    // localPatterns — wymagane, żeby <Image> przyjął lokalne ścieżki z query stringiem.
    // Bez tego Next.js odrzuca nasz cache-bust (?t=...) przy budowaniu src/srcset,
    // obraz dostaje URL bez bustu i po podmianie pliku zostaje w cache optymalizatora.
    // Pominięty `search` = dowolny query string dozwolony. Podanie search: '**'
    // NIE jest poprawną składnią — Next traktuje to jako dosłowną wartość i nie dopasuje ?t=...
    localPatterns: [
      { pathname: '/api/assets/**' },
      { pathname: '/**' },
    ],
    remotePatterns: [
      // Self-hosted assets — uploads serwowane przez nasz /api/assets/* endpoint
      // (profile pictures, ebook covers, mockup uploads, brand logos).
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/api/assets/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/api/assets/**',
      },
      // Google profile pictures — userzy logujący się przez OAuth Google
      // dostają avatar z lh3.googleusercontent.com (subdomeny lh3-7).
      // Wszystkie to ten sam domain pattern *.googleusercontent.com.
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh4.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh5.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'lh6.googleusercontent.com',
      },
    ],
  },

  // ❌ USUNIĘTE: eslint (przestarzałe w Next.js 16)
  // Aby ignorować błędy ESLint podczas buildu, użyj:
  // npm run build -- --no-lint

  typescript: {
    ignoreBuildErrors: true, // opcjonalnie, jeśli chcesz ignorować błędy TS
  },

  // Zapewnienie dostępu do zmiennych środowiskowych
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  }
};

export default nextConfig;