// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token i hasło są wymagane' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Hasło musi mieć minimum 6 znaków' }, { status: 400 });
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

    // Hashuj nowe hasło
    const hashedPassword = await bcrypt.hash(password, 12);

    // Zaktualizuj hasło i usuń token resetujący
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Hasło zostało pomyślnie zmienione'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}