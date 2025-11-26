// app/api/subscription/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Weryfikacja sesji
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Pobierz ID subskrypcji użytkownika
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Anuluj subskrypcję w Stripe NATYCHMIAST (jeśli istnieje)
    if (user.stripeSubscriptionId) {
      try {
        // Używamy .cancel() zamiast .update(), aby zamknąć ją od razu
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (stripeError) {
        console.error('Error cancelling in Stripe (might be already cancelled):', stripeError);
        // Kontynuujemy, aby wyczyścić bazę nawet jeśli Stripe zwróci błąd
      }
    }

    // 4. Wyczyść dane w bazie danych i zmień rolę
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        // Zmiana roli (Upewnij się, że 'demo' jest w enum Role w schema.prisma, inaczej użyj 'free')
        role: 'demo',

        // Czyszczenie identyfikatorów Stripe
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: null,

        // Czyszczenie dat i weryfikacji
        paymentVerifiedAt: null,
        nextBillingDate: null,

        // Czyszczenie danych bilingowych i karty
        billingName: null,
        billingAddress: Prisma.DbNull,
        companyName: null,
        taxId: null,
        taxIdType: null,
        cardBrand: null,
        cardLast4: null,
        billingPreference: null,
      },
    });

    return NextResponse.json({
      status: 'cancelled_immediately',
      message: 'Subskrypcja anulowana, dane wyczyszczone.',
    });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}