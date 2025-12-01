import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { Role } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headerList = await headers();
  const signature = headerList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// HANDLERY
// -----------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planName = session.metadata?.planName; // np. 'rookie', 'creator', 'unlimited'

  console.log('[Webhook] checkout.session.completed:', { userId, planName, mode: session.mode });

  if (!userId) {
    console.error('[Webhook] No userId in session metadata');
    return;
  }

  // 1. Pobieramy usera z bazy (do sprawdzenia starej subskrypcji)
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      stripeSubscriptionId: true
    }
  });

  if (!existingUser) {
    console.error('[Webhook] User not found in DB:', userId);
    return;
  }

  // Domyślne wartości
  let stripeSubscriptionId: string | null = null;
  let subscriptionStatus = 'active';
  let role = 'rookie'; // Fallback

  // Definicja płatnych ról
  const paidRoles = ['rookie', 'creator', 'unlimited'];
  let isPaidPlan = false;

  // Ustalamy rolę na podstawie metadanych (intencja użytkownika)
  if (planName && paidRoles.includes(planName)) {
    role = planName;
    isPaidPlan = true;
  }

  let nextBillingDate: Date;
  let paymentMethodId: string | null = null;

  // -------------------------------------------------------
  // SCENARIUSZ A: SUBSKRYPCJA
  // -------------------------------------------------------
  if (session.mode === 'subscription') {
    const newSubscriptionId = session.subscription as string;

    // Pobieramy szczegóły nowej subskrypcji
    const subscription = await stripe.subscriptions.retrieve(newSubscriptionId) as any;

    stripeSubscriptionId = newSubscriptionId;
    subscriptionStatus = subscription.status; // Może być 'active' lub 'trialing'
    paymentMethodId = subscription.default_payment_method as string;

    const timestamp = subscription.current_period_end || subscription.trial_end;
    nextBillingDate = timestamp ? new Date(timestamp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // --- LOGIKA CLEANUP (Usuwanie starej subskrypcji) ---
    if (existingUser.stripeSubscriptionId && existingUser.stripeSubscriptionId !== newSubscriptionId) {
      console.log(`[Webhook] Cleanup detected. Old ID: ${existingUser.stripeSubscriptionId}, New ID: ${newSubscriptionId}`);
      try {
        const oldSub = await stripe.subscriptions.retrieve(existingUser.stripeSubscriptionId);
        if (oldSub.status === 'active' || oldSub.status === 'trialing') {
           console.log(`[Webhook] Canceling OLD subscription: ${existingUser.stripeSubscriptionId}`);
           await stripe.subscriptions.cancel(existingUser.stripeSubscriptionId);
        }
      } catch (err) {
        console.warn('[Webhook] Failed to cancel old subscription:', err);
      }
    }

    // --- KLUCZOWA POPRAWKA LOGIKI STATUSÓW ---
    if (isPaidPlan) {
        // Jeśli użytkownik wybrał płatny plan (Rookie/Creator/Unlimited),
        // w bazie danych MUSI mieć status 'active', nawet jeśli Stripe mówi 'trialing'.
        // Nadpisujemy status ze Stripe, aby aplikacja traktowała go jako pełnoprawnego klienta.
        subscriptionStatus = 'active';
        // Rola pozostaje taka, jak ustalono wyżej (np. 'unlimited')
    } else {
        // Jeśli nie jest to płatny plan (czyli np. czysta rejestracja free_ver),
        // wtedy i tylko wtedy akceptujemy logikę triala/free_ver.
        if (subscription.status === 'trialing') {
            role = 'free_ver';
        }
    }

  }
  // -------------------------------------------------------
  // SCENARIUSZ B: PŁATNOŚĆ JEDNORAZOWA
  // -------------------------------------------------------
  else if (session.mode === 'payment') {
    stripeSubscriptionId = null;
    subscriptionStatus = 'one_time_paid';
    const now = new Date();
    nextBillingDate = new Date(now.setMonth(now.getMonth() + 1));

    if (session.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        paymentMethodId = pi.payment_method as string;
    }
  } else {
    return;
  }

  // -------------------------------------------------------
  // POBIERANIE DANYCH PŁATNIKA
  // -------------------------------------------------------
  let cardholderName: string | null = null;
  let cardLast4 = null;
  let cardBrand = null;

  if (paymentMethodId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      cardholderName = pm.billing_details.name;
      cardLast4 = pm.card?.last4;
      cardBrand = pm.card?.brand;
    } catch (e) { console.error(e); }
  }

  const billingName = cardholderName || session.customer_details?.name || 'N/A';

  let taxId: string | null = null;
  let taxIdType: string | null = null;
  let companyName: string | null = null;

  const sessionTaxIds = session.customer_details?.tax_ids;
  if (sessionTaxIds && sessionTaxIds.length > 0) {
    taxId = sessionTaxIds[0].value;
    taxIdType = sessionTaxIds[0].type;
  } else {
    try {
      const taxIdsList = await stripe.customers.listTaxIds(session.customer as string);
      if (taxIdsList.data.length > 0) {
        taxId = taxIdsList.data[0].value;
        taxIdType = taxIdsList.data[0].type;
      }
    } catch (e) {}
  }

  if (taxId) companyName = session.customer_details?.name || null;
  const billingAddress = session.customer_details?.address;

  // -------------------------------------------------------
  // AKTUALIZACJA BAZY DANYCH
  // -------------------------------------------------------
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: stripeSubscriptionId,
      subscriptionStatus: subscriptionStatus, // Tu trafia 'active' dla płatnych planów
      role: role as Role,
      paymentVerifiedAt: new Date(),
      nextBillingDate: nextBillingDate,
      billingName, companyName, billingAddress: billingAddress as any,
      taxId, taxIdType, cardLast4, cardBrand,
    },
  });

  console.log(`✅ [Webhook][${session.mode}] User ${userId} set to: ${role}, Status: ${subscriptionStatus}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[Webhook] customer.subscription.updated:', subscription.id);

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, role: true, subscriptionStatus: true }
  });

  if (!user) return;

  // Rozpoznawanie roli na podstawie ceny
  const subscriptionItems = subscription.items.data;
  let newRole: string | null = null;

  // Mapowanie PriceID -> Role
  const priceToRoleMap: Record<string, string> = {
    [process.env.STRIPE_ROOKIE_PRICE_ID_PLN || '']: 'rookie',
    [process.env.STRIPE_ROOKIE_PRICE_ID_USD || '']: 'rookie',
    [process.env.STRIPE_CREATOR_PRICE_ID_PLN || '']: 'creator',
    [process.env.STRIPE_CREATOR_PRICE_ID_USD || '']: 'creator',
    [process.env.STRIPE_UNLIMITED_PRICE_ID_PLN || '']: 'unlimited',
    [process.env.STRIPE_UNLIMITED_PRICE_ID_USD || '']: 'unlimited',
  };

  if (subscriptionItems.length > 0) {
    const priceId = subscriptionItems[0].price.id;
    newRole = priceToRoleMap[priceId] || null;
  }

  let updatedRole = newRole || user.role;
  let updatedStatus = subscription.status;

  // --- WYMUSZENIE STATUSU ACTIVE DLA PŁATNYCH PLANÓW ---
  const paidRoles = ['rookie', 'creator', 'unlimited'];

  if (paidRoles.includes(updatedRole as string)) {
    // Jeśli rola to płatny plan, ZAWSZE ustawiamy status na active w bazie,
    // ignorując status 'trialing' ze Stripe.
    updatedStatus = 'active';
  } else if (subscription.status === 'trialing' && updatedRole === 'free_ver') {
    // Tylko dla free_ver pozwalamy na status trialing (lub active)
    // Bez zmian, bierzemy status ze Stripe
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: updatedStatus,
      role: updatedRole as Role,
      nextBillingDate: new Date((subscription as any).current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Webhook] customer.subscription.deleted:', subscription.id);

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
        subscriptionStatus: 'canceled',
        role: 'demo'
    },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!(invoice as any).subscription) return;
  const subscriptionId = (invoice as any).subscription as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Sprawdzamy, jaka to rola, żeby wiedzieć czy wymusić 'active'
  // Pobieramy usera
  const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      select: { role: true }
  });

  let statusToSet = 'active';
  // Jeśli z jakiegoś powodu Stripe zwróci coś dziwnego, a to płatny plan, to i tak active.

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      subscriptionStatus: statusToSet,
      nextBillingDate: new Date((subscription as any).current_period_end * 1000),
    },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!(invoice as any).subscription) return;
  const subscriptionId = (invoice as any).subscription as string;

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { subscriptionStatus: 'past_due' },
  });
}