// src/app/api/stripe/create-checkout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

// MAPA CEN - Ceny Subskrypcyjne (Bez Triala - Płatność Natychmiastowa)
const PRICE_MAP: Record<string, Record<string, string | undefined>> = {
  rookie: {
    en: process.env.STRIPE_ROOKIE_PRICE_ID_USD,
    pl: process.env.STRIPE_ROOKIE_PRICE_ID_PLN,
  },
  creator: {
    en: process.env.STRIPE_CREATOR_PRICE_ID_USD,
    pl: process.env.STRIPE_CREATOR_PRICE_ID_PLN,
  },
  unlimited: {
    en: process.env.STRIPE_UNLIMITED_PRICE_ID_USD,
    pl: process.env.STRIPE_UNLIMITED_PRICE_ID_PLN,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // plan: 'rookie' | 'creator' | 'unlimited'
    // locale: 'en' | 'pl'
    const { plan, locale = 'en' } = body;

    if (!plan) {
      return NextResponse.json({ error: 'Missing plan parameter' }, { status: 400 });
    }

    // 1. Auth
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. User DB
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Customer Stripe
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // 4. Pobranie Price ID
    const targetLocale = locale === 'pl' ? 'pl' : 'en';
    const priceId = PRICE_MAP[plan]?.[targetLocale];

    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not found for plan: ${plan} in locale: ${targetLocale}` },
        { status: 500 }
      );
    }

    // 5. Konfiguracja sesji (CZYSTA SUBSKRYPCJA, PŁATNOŚĆ NATYCHMIASTOWA)
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',

      // 'always' wymusza pobranie danych karty i obciążenie natychmiastowe (brak triala)
      payment_method_collection: 'always',

      // POPRAWKA: Usunięto 'p24' i 'blik' z trybu subskrypcji.
      // Subskrypcje wymagają metod płatności obsługujących automatyczne obciążenia (karty).
      payment_method_types: ['card'],

      billing_address_collection: 'required',
      customer_update: { name: 'auto', address: 'auto' },
      tax_id_collection: { enabled: true },

      locale: targetLocale === 'pl' ? 'pl' : 'en',

      line_items: [{ price: priceId, quantity: 1 }],

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,

      subscription_data: {
        metadata: {
          userId: user.id,
          planName: plan,
        },
      },
      metadata: {
        userId: user.id,
        planName: plan,
      },
    };

    // 6. Utworzenie sesji
    const checkoutSession = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: checkoutSession.url });

  } catch (error) {
    console.error('Error creating checkout session (No-Trial):', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}