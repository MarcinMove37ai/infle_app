// src/app/api/auth/verify-reset-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token jest wymagany' }, { status: 400 });
    }

    // Sprawdź czy token istnieje i nie wygasł
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date() // Token nie wygasł
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Token jest nieprawidłowy lub wygasł' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Token jest prawidłowy' });

  } catch (error) {
    console.error('Verify reset token error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}