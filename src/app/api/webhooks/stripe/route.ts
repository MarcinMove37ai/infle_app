// src/app/api/webhooks/stripe/route.ts

// ✅ 1. DODAJ TE DWA EXPORTY NA SAMEJ GÓRZE
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

// ✅ 3. DODAJ LAZY INITIALIZATION
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

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // ✅ 4. UŻYJ getStripe() ZAMIAST GLOBALNEGO stripe
    const stripe = getStripe();

    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('❌ No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    // Weryfikuj webhook
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('✅ Received Stripe webhook:', event.type);

    // Obsłuż różne typy eventów
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// Handler dla setup_intent.succeeded (weryfikacja karty Rookie)
async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  console.log('🔐 Processing setup_intent.succeeded');

  const stripe = getStripe();
  const userId = setupIntent.metadata?.userId;
  const planId = setupIntent.metadata?.planId;

  if (!userId || planId !== 'rookie') {
    console.error('❌ Invalid metadata in setup intent');
    return;
  }

  try {
    // Pobierz payment method ID
    const paymentMethodId = setupIntent.payment_method as string;

    // Ustaw datę końca trial (21 dni od teraz)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 21);

    // Zaktualizuj użytkownika - zmień status na free_ver
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: 'free_ver', // Status: zweryfikowany, w trial
        stripePaymentMethodId: paymentMethodId,
        paymentMethod: 'card',
        paymentVerifiedAt: new Date(),
        trialEndsAt: trialEndsAt,
      },
    });

    console.log(`✅ User ${userId} verified card - trial until:`, trialEndsAt);

    // Zaplanuj subskrypcję, która rozpocznie się po 21 dniach
    const subscription = await stripe.subscriptions.create({
      customer: setupIntent.customer as string,
      items: [{
        price: process.env.STRIPE_ROOKIE_CARD_PRICE_ID!,
      }],
      trial_end: Math.floor(trialEndsAt.getTime() / 1000), // Unix timestamp
      default_payment_method: paymentMethodId,
      metadata: {
        userId: userId,
        planId: 'rookie',
      },
    });

    // Zapisz subscription ID
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
      },
    });

    console.log(`✅ Scheduled subscription ${subscription.id} for user ${userId}`);

  } catch (error) {
    console.error('❌ Error handling setup intent:', error);
  }
}

// Handler dla checkout.session.completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('💳 Processing checkout.session.completed');

  // ✅ 5. DODAJ getStripe() W KAŻDYM HANDLERZE
  const stripe = getStripe();

  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;
  const paymentMethod = session.metadata?.paymentMethod;

  if (!userId) {
    console.error('❌ No userId in session metadata');
    return;
  }

  console.log('📊 Session data:', {
    userId,
    planId,
    paymentMethod,
    subscription: session.subscription,
    paymentStatus: session.payment_status,
  });

  // Pobierz payment method ID ze Stripe
  let stripePaymentMethodId: string | null = null;

  if (paymentMethod === 'card' && session.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      stripePaymentMethodId = (subscription as Stripe.Subscription).default_payment_method as string;
      console.log('💳 Payment method ID:', stripePaymentMethodId);
    } catch (error) {
      console.error('❌ Error retrieving subscription:', error);
    }
  }

  // Określ nowy status i datę wygaśnięcia
  let role: string;
  let subscriptionEndsAt: Date | null = null;

  if (paymentMethod === 'blik') {
    // BLIK - jednorazowa płatność na 30 dni
    role = planId === 'rookie' ? 'rookie' : planId === 'creator' ? 'creator' : 'unlimited';
    subscriptionEndsAt = new Date();
    subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 30);
    console.log('📅 BLIK subscription ends at:', subscriptionEndsAt);
  } else {
    // Karta - recurring subscription
    role = planId === 'rookie' ? 'rookie' : planId === 'creator' ? 'creator' : 'unlimited';

    // Dla karty też ustawiamy subscription_ends_at na następny billing cycle
    if (session.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        // @ts-ignore - The type definitions for this API version are missing this property, but it exists at runtime.
        subscriptionEndsAt = new Date(subscription.current_period_end * 1000);

        console.log('📅 Card subscription ends at:', subscriptionEndsAt);
      } catch (error) {
        console.error('❌ Error retrieving subscription period:', error);
      }
    }
  }

  // Zaktualizuj użytkownika
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: role as Role,
        stripeSubscriptionId: session.subscription as string | null,
        stripePaymentMethodId: stripePaymentMethodId,
        paymentMethod: paymentMethod, // 'card' lub 'blik'
        paymentVerifiedAt: new Date(),
        subscriptionEndsAt: subscriptionEndsAt,
      }
    });

    console.log(`✅ User ${userId} updated:`, {
      role: role,
      paymentMethod: paymentMethod,
      paymentMethodId: stripePaymentMethodId,
      endsAt: subscriptionEndsAt
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
  }
}

// Handler dla invoice.payment_succeeded
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Processing invoice.payment_succeeded');

  // ✅ 6. DODAJ getStripe() TUTAJ
  const stripe = getStripe();

  // @ts-ignore
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) return;

  // Znajdź usera po subscription ID
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId }
  });

  if (!user) {
    console.error('❌ User not found for subscription:', subscriptionId);
    return;
  }

  // Pobierz subskrypcję aby zaktualizować datę wygaśnięcia
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // @ts-ignore
    const subscriptionEndsAt = new Date(subscription.current_period_end * 1000);

    // Jeśli user był w trial (free_ver), zmień na rookie po pierwszej płatności
    const newRole = user.role === 'free_ver' ? 'rookie' : user.role;

    // Odśwież datę weryfikacji płatności i datę wygaśnięcia
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: newRole,
        paymentVerifiedAt: new Date(),
        subscriptionEndsAt: subscriptionEndsAt,
        trialEndsAt: null, // Wyczyść trial po pierwszej płatności
      }
    });

    console.log(`✅ Payment verified for user ${user.id}, role: ${newRole}, new period ends:`, subscriptionEndsAt);
  } catch (error) {
    console.error('❌ Error processing invoice payment:', error);
  }
}

// Handler dla customer.subscription.updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Processing customer.subscription.updated');

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!user) return;

  // Zaktualizuj status subskrypcji i datę wygaśnięcia
  let newRole = user.role;
  let subscriptionEndsAt: Date | null = null;

  if (subscription.status === 'active') {
    // Subskrypcja aktywna - pozostaw obecny plan i zaktualizuj datę
    // @ts-ignore
    subscriptionEndsAt = new Date(subscription.current_period_end * 1000);
  } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    newRole = 'free';
    subscriptionEndsAt = null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: newRole,
      subscriptionEndsAt: subscriptionEndsAt,
    }
  });

  console.log(`✅ Subscription updated for user ${user.id}:`, {
    role: newRole,
    endsAt: subscriptionEndsAt
  });
}

// Handler dla customer.subscription.deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('🗑️ Processing customer.subscription.deleted');

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id }
  });

  if (!user) return;

  // Ustaw status na free
  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: 'free',
      stripeSubscriptionId: null,
      stripePaymentMethodId: null,
      subscriptionEndsAt: null,
    }
  });

  console.log(`✅ Subscription deleted for user ${user.id}`);
}