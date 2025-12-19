import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Usunięcie output: 'standalone' - powoduje problemy z env vars

  // Zaktualizowana opcja zgodnie z nową wersją Next.js
  serverExternalPackages: ['@prisma/client', 'prisma', 'pdf-parse'],

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