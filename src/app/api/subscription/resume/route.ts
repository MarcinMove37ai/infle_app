import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

// 1. Inicjalizacja Stripe lokalnie (tak jak w pliku anulowania)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function POST(req: NextRequest) {
  try {
    // 2. Autoryzacja przez email (zgodnie z Twoim działającym wzorcem)
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Pobranie użytkownika po emailu
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { stripeSubscriptionId: true }
    });

    if (!user?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // 4. Sprawdzenie statusu w Stripe
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    if (subscription.status === 'canceled') {
      return NextResponse.json({
        error: 'Subscription is already fully canceled. Please subscribe again.'
      }, { status: 400 });
    }

    // 5. UPDATE W STRIPE: Anulujemy "cancel_at_period_end"
    const updatedSubscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    // 6. UPDATE W BAZIE DANYCH (To naprawia UI!)
    // Musimy ręcznie przywrócić status "active" w bazie, żeby czerwona etykieta zniknęła natychmiast.
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        subscriptionStatus: 'active', // Przywracamy status aktywny
        // Opcjonalnie: resetujemy nextBillingDate do standardowego cyklu,
        // ale najważniejszy jest status 'active' dla Twojego UI.
      },
    });

    return NextResponse.json({
      status: 'success',
      subscription: updatedSubscription
    });

  } catch (error: any) {
    console.error('Error resuming subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}