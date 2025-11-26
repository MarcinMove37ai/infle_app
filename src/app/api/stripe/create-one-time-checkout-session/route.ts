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
    // 1. Pobierz dane z body (locale i opcjonalnie paymentMethod, choć tutaj wymuszamy flow)
    const body = await req.json();
    const locale = body.locale || 'pl'; // Domyślnie polski dla tego endpointu (BLIK jest PL)

    // 2. Pobierz użytkownika z sesji
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Pobierz użytkownika z bazy
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

    // 4. Sprawdź czy user nie ma już aktywnej subskrypcji/planu
    // (Możesz tu dodać logikę, czy pozwalamy przedłużyć, ale dla 'free' jest ok)
    if (user.role !== 'free' && user.role !== 'demo') {
      return NextResponse.json(
        { error: 'User already has an active plan' },
        { status: 400 }
      );
    }

    // 5. Utwórz lub pobierz Customer w Stripe
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

    // 6. Pobierz Price ID dla płatności jednorazowej (BLIK/Przelew)
    // Zakładamy, że ta zmienna jest ustawiona w .env
    const priceId = process.env.STRIPE_ROOKIE_PRICE_ID_BLIK!;

    if (!priceId) {
      throw new Error('Missing STRIPE_ROOKIE_PRICE_ID_BLIK env variable');
    }

    // 7. Utwórz Checkout Session (Tryb PAYMENT)
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      // 🔥 KLUCZOWA ZMIANA 1: Tryb płatności jednorazowej
      mode: 'payment',

      // 🔥 KLUCZOWA ZMIANA 2: Metody płatności
      // 'blik' działa tylko dla waluty PLN. 'card' dodajemy jako fallback.
      // Jeśli w Dashboardzie masz włączone "Automatic Payment Methods", możesz to pominąć,
      // ale ręczne wskazanie 'blik' upewnia nas, że się pojawi.
      payment_method_types: ['blik', 'card', 'p24'],

      billing_address_collection: 'required',
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
      tax_id_collection: { enabled: true },
      locale: 'pl', // Wymuszamy PL, bo BLIK jest polski

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // 🔥 KLUCZOWA ZMIANA 3: Generowanie faktury dla płatności jednorazowej
      invoice_creation: {
        enabled: true,
      },

      // Brak subscription_data (bo to nie subskrypcja)

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,

      metadata: {
        userId: user.id,
        planName: 'rookie',
        paymentType: 'one_time', // Znacznik dla webhooka
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