// app/api/user/billing-preference/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  try {
    // 1. Weryfikacja sesji
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Pobierz dane z żądania
    const body = await req.json();
    const { billingPreference } = body;

    // 3. Walidacja danych
    if (billingPreference !== 'company' && billingPreference !== 'personal') {
      return NextResponse.json({ error: 'Invalid preference value' }, { status: 400 });
    }

    // 4. Zapisz w bazie danych
    // UWAGA: Upewnij się, że wykonałeś 'npx prisma db push' po dodaniu pola do schema.prisma
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        billingPreference: billingPreference,
      },
    });

    return NextResponse.json({
      success: true,
      billingPreference: updatedUser.billingPreference
    });

  } catch (error) {
    console.error('Error saving billing preference:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}