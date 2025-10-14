// src/app/api/stripe/create-checkout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

// Inicjalizacja Stripe z użyciem klucza sekretnego z .env
// Użycie konkretnej wersji API jest dobrą praktyką
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, paymentMethod } = await request.json();
    const userId = session.user.id;

    // --- Walidacja Danych Wejściowych ---
    if (!planId || !paymentMethod) {
      return NextResponse.json({ error: 'Missing planId or paymentMethod' }, { status: 400 });
    }
    if (!['standard', 'premium'].includes(planId)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!['card', 'blik'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // --- Pobranie Danych Użytkownika ---
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // --- Zarządzanie Klientem w Stripe ---
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const mode = paymentMethod === 'card' ? 'subscription' : 'payment';
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

    // --- Dynamiczne Tworzenie Pozycji Zamówienia ---
    // ✅ GŁÓWNA AKTUALIZACJA: Logika dynamicznego opisu dla płatności jednorazowych
    if (mode === 'subscription') {
      // Dla subskrypcji używamy istniejących cen (Price IDs)
      const priceId =
        planId === 'standard'
          ? process.env.STRIPE_STANDARD_CARD_PRICE_ID!
          : process.env.STRIPE_PREMIUM_CARD_PRICE_ID!;
      lineItems = [{ price: priceId, quantity: 1 }];
    } else {
      // Dla płatności jednorazowych (BLIK) tworzymy pozycję dynamicznie
      const isStandard = planId === 'standard';
      lineItems = [
        {
          price_data: {
            currency: 'pln',
            // Kwota w groszach
            unit_amount: isStandard ? 8700 : 18700,
            product_data: {
              name: `Plan ${isStandard ? 'Standard' : 'Premium'} (Dostęp na 30 dni)`,
              description: 'Jednorazowa opłata za 30-dniowy dostęp do aplikacji. Twoja subskrypcja nie odnowi się automatycznie.',
            },
          },
          quantity: 1,
        },
      ];
    }

    // --- Tworzenie Sesji Płatności Stripe Checkout ---
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: mode,
      // Dla płatności kartą, Stripe sam pokaże portfele (jeśli włączone)
      // Dla BLIKa, dodajemy też opcję karty/portfeli jako alternatywę
      payment_method_types: mode === 'subscription' ? ['card'] : ['blik', 'card'],
      line_items: lineItems,
      // ✅ Wymuszenie pełnego adresu dla celów fakturowania
      billing_address_collection: 'required',
      // Pozwolenie Stripe na aktualizację adresu klienta
      customer_update: {
        address: 'auto',
      },
      // Włączenie automatycznego obliczania podatków
      automatic_tax: {
        enabled: true,
      },
      success_url: `${process.env.NEXTAUTH_URL}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/subscribe?canceled=true`,
      metadata: {
        userId: userId,
        planId: planId,
        paymentMethod: paymentMethod,
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    // W środowisku produkcyjnym warto logować błędy do zewnętrznego serwisu
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}