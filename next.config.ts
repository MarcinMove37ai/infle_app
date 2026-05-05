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
    remotePatterns: [
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