// src/app/api/subscription/details/route.ts

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

export async function GET(request: NextRequest) {
  try {
    // ✅ DODAJ NA POCZĄTKU
    const stripe = getStripe();

    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Pobierz dane użytkownika z bazy
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        paymentMethod: true,
        paymentVerifiedAt: true,
        subscriptionEndsAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripePaymentMethodId: true,
        trialEndsAt: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Podstawowe dane
    const subscriptionData: any = {
      status: user.subscriptionStatus,
      paymentMethod: user.paymentMethod,
      paymentVerifiedAt: user.paymentVerifiedAt,
      subscriptionEndsAt: user.subscriptionEndsAt,
      trialEndsAt: user.trialEndsAt,
      isActive: user.subscriptionStatus !== 'free',
    };

    // Jeśli ma Stripe subscription, pobierz szczegóły
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        subscriptionData.stripe = {
          status: subscription.status,
          // @ts-ignore - The type definitions for this API version are missing this property, but it exists at runtime.
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        };
      } catch (error) {
        console.error('Error fetching Stripe subscription:', error);
      }
    }

    // Pobierz payment method details jeśli istnieje
    if (user.stripePaymentMethodId) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(user.stripePaymentMethodId);

        subscriptionData.paymentMethodDetails = {
          type: paymentMethod.type,
          card: paymentMethod.card ? {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            expMonth: paymentMethod.card.exp_month,
            expYear: paymentMethod.card.exp_year,
          } : null,
        };
      } catch (error) {
        console.error('Error fetching payment method:', error);
      }
    }

    // Pobierz historię faktur
    if (user.stripeCustomerId) {
      try {
        const invoices = await stripe.invoices.list({
          customer: user.stripeCustomerId,
          limit: 10,
        });

        subscriptionData.invoices = invoices.data.map(invoice => ({
          id: invoice.id,
          amount: invoice.amount_paid / 100, // Convert from cents
          currency: invoice.currency.toUpperCase(),
          status: invoice.status,
          // ---> POCZĄTEK ZMIANY <---
          // Zamiast nieistniejącej właściwości 'paid', sprawdzamy status faktury.
          paid: invoice.status === 'paid',
          // ---> KONIEC ZMIANY <---
          created: new Date(invoice.created * 1000),
          invoicePdf: invoice.invoice_pdf,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
        }));
      } catch (error) {
        console.error('Error fetching invoices:', error);
        subscriptionData.invoices = [];
      }
    } else {
      subscriptionData.invoices = [];
    }

    return NextResponse.json(subscriptionData);

  } catch (error) {
    console.error('Error fetching subscription details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}