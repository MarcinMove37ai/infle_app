// src/app/api/subscription/cancel/route.ts

// ✅ DODAJ NA GÓRZE
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

// ❌ USUŃ (linie 9-11):
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2025-09-30.clover',
// });

// ✅ DODAJ LAZY INITIALIZATION
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not defined');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-09-30.clover',
    });
  }
  return stripeInstance;
}

export async function POST(request: NextRequest) {
  try {
    // ✅ DODAJ NA POCZĄTKU
    const stripe = getStripe();

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Pobierz dane użytkownika
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeSubscriptionId: true,
        paymentMethod: true,
        subscriptionStatus: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Sprawdź czy user ma subskrypcję do anulowania
    if (user.subscriptionStatus === 'free') {
      return NextResponse.json({
        error: 'No active subscription to cancel'
      }, { status: 400 });
    }

    // BLIK - jednorazowa płatność (nie można anulować w Stripe, tylko lokalnie)
    if (user.paymentMethod === 'blik') {
      // Ustaw status na free
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionStatus: 'free',
          subscriptionEndsAt: null,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'BLIK subscription canceled immediately'
      });
    }

    // KARTA - recurring subscription
    if (!user.stripeSubscriptionId) {
      return NextResponse.json({
        error: 'No Stripe subscription found'
      }, { status: 404 });
    }

    // Anuluj subskrypcję w Stripe (na koniec okresu)
    const subscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Zaktualizuj w bazie
    await prisma.user.update({
      where: { id: userId },
      data: {
        // Status pozostaje do końca okresu, webhook zmieni na 'free'
        // ---> GŁÓWNA ZMIANA TUTAJ <---
        subscriptionEndsAt: new Date(subscription.cancel_at! * 1000),
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      // ---> I ZMIANA TUTAJ <---
      endsAt: new Date(subscription.cancel_at! * 1000)
    });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json({
      error: 'Failed to cancel subscription'
    }, { status: 500 });
  }
}