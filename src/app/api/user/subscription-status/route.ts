// src/app/api/user/subscription-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Pobierz dane użytkownika
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        paymentVerifiedAt: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const isInTrial = user.trialEndsAt && now <= user.trialEndsAt;

    // Określ czy może publikować
    let canPublish = false;
    let reason = '';
    let action: 'VERIFY_PAYMENT' | 'SUBSCRIBE' | null = null;

    if (isInTrial) {
      // W trialu - wymaga weryfikacji płatności
      if (user.paymentVerifiedAt) {
        canPublish = true;
      } else {
        canPublish = false;
        reason = 'Aby opublikować stronę w okresie próbnym, musisz zweryfikować swoją płatność.';
        action = 'VERIFY_PAYMENT';
      }
    } else {
      // Trial wygasł - sprawdź subskrypcję
      if (user.subscriptionStatus === 'free') {
        canPublish = false;
        reason = 'Twój okres próbny wygasł. Wykup subskrypcję aby kontynuować publikowanie stron.';
        action = 'SUBSCRIBE';
      } else {
        // Ma aktywną subskrypcję
        canPublish = true;
      }
    }

    return NextResponse.json({
      canPublish,
      reason,
      action,
      status: user.subscriptionStatus,
      isInTrial,
      trialEndsAt: user.trialEndsAt,
      hasPaymentVerified: !!user.paymentVerifiedAt
    });

  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}