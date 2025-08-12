// src/app/api/debug/env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // UWAGA: Usuń ten endpoint po debugowaniu!
  const envDebug = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL ? '✅ USTAWIONE' : '❌ BRAK',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? '✅ USTAWIONE' : '❌ BRAK',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ? '✅ USTAWIONE' : '❌ BRAK',
    ENCRYPTION_KEY_LENGTH: process.env.ENCRYPTION_KEY?.length || 0,
    // Pokazuj tylko pierwsze/ostatnie znaki dla bezpieczeństwa
    ENCRYPTION_KEY_PREVIEW: process.env.ENCRYPTION_KEY ?
      `${process.env.ENCRYPTION_KEY.substring(0, 4)}...${process.env.ENCRYPTION_KEY.substring(-4)}` :
      'BRAK'
  };

  return NextResponse.json(envDebug);
}

// Po sprawdzeniu usuń ten plik!