import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Usunięcie output: 'standalone' - powoduje problemy z env vars

  // Zaktualizowana opcja zgodnie z nową wersją Next.js
  serverExternalPackages: ['@prisma/client', 'prisma'],

  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
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