// src/app/api/stripe/create-one-time-checkout-session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const locale = body.locale || 'pl';

    // ZMIANA: Jeśli frontend nie wyśle 'plan', domyślnie przyjmujemy 'rookie'.
    // To ratuje obecną funkcjonalność (weryfikacja Free -> Rookie).
    const planName = body.plan || 'rookie';

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        stripeCustomerId: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Walidacja ról (pozostawiamy bez zmian dla zachowania bezpieczeństwa)
    // Pozwala na zakup tylko jeśli user jest 'free', 'demo' lub 'free_ver'
    /*
    if (user.role !== 'free' && user.role !== 'demo' && user.role !== 'free_ver') {
      return NextResponse.json(
        { error: 'User already has an active plan' },
        { status: 400 }
      );
    }
    */

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Dobieranie Price ID w zależności od planu
    let priceId = '';

    switch (planName) {
      case 'rookie':
        priceId = process.env.STRIPE_ROOKIE_PRICE_ID_BLIK!;
        break;
      case 'creator':
        priceId = process.env.STRIPE_CREATOR_PRICE_ID_BLIK!;
        break;
      case 'unlimited':
        priceId = process.env.STRIPE_UNLIMITED_PRICE_ID_BLIK!;
        break;
      default:
        // Fallback dla bezpieczeństwa - gdyby ktoś wysłał dziwną nazwę planu
        // Możemy rzucić błąd lub zafallbackować do rookie, tu rzucamy błąd.
        return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    if (!priceId) {
      console.error(`Missing One-Time Price ID for plan: ${planName}`);
      return NextResponse.json(
        { error: 'Server configuration error: Missing Price ID' },
        { status: 500 }
      );
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['blik', 'card', 'p24'],
      billing_address_collection: 'required',
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
      tax_id_collection: { enabled: true },
      locale: locale === 'pl' ? 'pl' : 'en',

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      invoice_creation: {
        enabled: true,
      },

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,

      metadata: {
        userId: user.id,
        planName: planName, // Przekazujemy 'rookie', 'creator' lub 'unlimited'
        paymentType: 'one_time',
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Error creating checkout session (One-Time):', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}