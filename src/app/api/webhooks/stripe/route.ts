// src/app/api/webhooks/stripe/route.ts
// ZAKTUALIZOWANA WERSJA Z PEŁNĄ OBSŁUGĄ UPGRADE'ÓW

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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

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
        console.log(`Unhandled event type: ${event.type}`);
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
  const planName = session.metadata?.planName;
  const isUpgradeFlow = session.metadata?.upgradeType === 'onetime_to_subscription' ||
                        session.metadata?.upgradeType === 'subscription_upgrade';

  console.log('[Webhook] checkout.session.completed:', {
    userId,
    planName,
    upgradeType: session.metadata?.upgradeType,
    mode: session.mode,
  });

  if (!userId) {
    console.error('[Webhook] No userId in session metadata');
    return;
  }

  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!userExists) {
    console.error('[Webhook] User not found in DB');
    return;
  }

  let stripeSubscriptionId: string | null = null;
  let subscriptionStatus = 'active';
  let role = 'rookie';
  const validRoles = ['rookie', 'creator', 'unlimited'];

  if (planName && validRoles.includes(planName)) {
    role = planName;
  }

  let nextBillingDate: Date;
  let paymentMethodId: string | null = null;

  if (session.mode === 'subscription') {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
    stripeSubscriptionId = subscription.id;
    subscriptionStatus = subscription.status;

    // KLUCZOWA LOGIKA DLA UPGRADE'ÓW
    if (isUpgradeFlow) {
      // Upgrade flow - użytkownik płaci dopłatę, więc od razu aktywny
      subscriptionStatus = 'active';
      console.log(`[Webhook] Upgrade flow detected. Status: active, Role: ${role}`);
    } else {
      // Standardowy trial dla nowych użytkowników
      if (subscription.status === 'trialing') {
        role = 'free_ver';
      }
    }

    paymentMethodId = subscription.default_payment_method as string;
    const timestamp = subscription.current_period_end || subscription.trial_end;
    nextBillingDate = timestamp ? new Date(timestamp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  } else if (session.mode === 'payment') {
    // Płatność jednorazowa (One-Time) - BLIK
    stripeSubscriptionId = null;
    subscriptionStatus = 'one_time_paid';

    const now = new Date();
    nextBillingDate = new Date(now.setMonth(now.getMonth() + 1));
    paymentMethodId = null;

    if (session.payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        paymentMethodId = pi.payment_method as string;
      } catch (e) {
        console.error('[Webhook] Error fetching payment intent:', e);
      }
    }
  } else {
    return;
  }

  // Pobierz dane karty i billing
  let cardholderName: string | null = null;
  let cardLast4 = null;
  let cardBrand = null;

  if (paymentMethodId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      cardholderName = pm.billing_details.name;
      cardLast4 = pm.card?.last4;
      cardBrand = pm.card?.brand;
    } catch (e) {
      console.error('[Webhook] Error fetching payment method:', e);
    }
  }

  const billingName = cardholderName || session.customer_details?.name || 'N/A';

  let taxId: string | null = null;
  let taxIdType: string | null = null;
  let companyName: string | null = null;

  const sessionTaxIds = session.customer_details?.tax_ids;

  if (sessionTaxIds && sessionTaxIds.length > 0) {
    taxId = sessionTaxIds[0].value || null;
    taxIdType = sessionTaxIds[0].type || null;
  } else {
    try {
      const taxIdsList = await stripe.customers.listTaxIds(session.customer as string);
      if (taxIdsList.data.length > 0) {
        taxId = taxIdsList.data[0].value;
        taxIdType = taxIdsList.data[0].type;
      }
    } catch (e) {
      console.error('[Webhook] Error fetching tax IDs:', e);
    }
  }

  if (taxId) {
    companyName = session.customer_details?.name || null;
  }

  const billingAddress = session.customer_details?.address;

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: stripeSubscriptionId,
      subscriptionStatus: subscriptionStatus,
      role: role as Role,
      paymentVerifiedAt: new Date(),
      nextBillingDate: nextBillingDate,
      billingName: billingName,
      companyName: companyName,
      billingAddress: billingAddress as any,
      taxId: taxId,
      taxIdType: taxIdType,
      cardLast4: cardLast4,
      cardBrand: cardBrand,
    },
  });

  console.log(`✅ [Webhook][${session.mode}] User ${userId} updated to role: ${role}, Status: ${subscriptionStatus}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('[Webhook] customer.subscription.updated:', {
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  // Pobierz użytkownika z bazy
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, role: true, subscriptionStatus: true }
  });

  if (!user) {
    console.log('[Webhook] No user found for subscription:', subscription.id);
    return;
  }

  // Sprawdź czy to upgrade planu (zmianaPrice ID)
  const subscriptionItems = subscription.items.data;
  let newRole: string | null = null;

  if (subscriptionItems.length > 0) {
    const priceId = subscriptionItems[0].price.id;

    // Mapowanie Price ID na role
    const priceToRoleMap: Record<string, string> = {
      [process.env.STRIPE_ROOKIE_PRICE_ID_PLN || '']: 'rookie',
      [process.env.STRIPE_ROOKIE_PRICE_ID_USD || '']: 'rookie',
      [process.env.STRIPE_CREATOR_PRICE_ID_PLN || '']: 'creator',
      [process.env.STRIPE_CREATOR_PRICE_ID_USD || '']: 'creator',
      [process.env.STRIPE_UNLIMITED_PRICE_ID_PLN || '']: 'unlimited',
      [process.env.STRIPE_UNLIMITED_PRICE_ID_USD || '']: 'unlimited',
    };

    newRole = priceToRoleMap[priceId] || null;

    if (newRole && newRole !== user.role) {
      console.log(`[Webhook] Plan upgrade detected: ${user.role} → ${newRole}`);
    }
  }

  // Określ nowy status i rolę
  let updatedStatus = subscription.status;
  let updatedRole = newRole || user.role;

  // Jeśli status zmienił się z trialing na active
  if (user.subscriptionStatus === 'trialing' && subscription.status === 'active') {
    // Jeśli był free_ver (trial), przejdź na właściwą rolę
    if (user.role === 'free_ver' && newRole) {
      updatedRole = newRole;
    }
    console.log(`[Webhook] Trial ended, activating subscription. Role: ${updatedRole}`);
  }

  // Aktualizuj użytkownika
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: updatedStatus,
      role: updatedRole as Role,
      nextBillingDate: new Date((subscription as any).current_period_end * 1000),
    },
  });

  console.log(`✅ [Webhook] Subscription ${subscription.id} updated. Status: ${updatedStatus}, Role: ${updatedRole}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Webhook] customer.subscription.deleted:', subscription.id);

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      subscriptionStatus: 'canceled',
      role: 'demo', // Zmienione z 'free' na 'demo'
    },
  });

  console.log(`✅ [Webhook] Subscription ${subscription.id} canceled, user moved to demo`);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!(invoice as any).subscription) {
    console.log('[Webhook] invoice.payment_succeeded: No subscription attached');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string) as any;

  console.log('[Webhook] invoice.payment_succeeded:', {
    invoiceId: invoice.id,
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  // Pobierz użytkownika
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, role: true }
  });

  if (!user) {
    console.log('[Webhook] No user found for subscription:', subscription.id);
    return;
  }

  // Sprawdź czy zmienił się plan (Price ID)
  let newRole: string | null = null;
  const subscriptionItems = subscription.items.data;

  if (subscriptionItems.length > 0) {
    const priceId = subscriptionItems[0].price.id;

    const priceToRoleMap: Record<string, string> = {
      [process.env.STRIPE_ROOKIE_PRICE_ID_PLN || '']: 'rookie',
      [process.env.STRIPE_ROOKIE_PRICE_ID_USD || '']: 'rookie',
      [process.env.STRIPE_CREATOR_PRICE_ID_PLN || '']: 'creator',
      [process.env.STRIPE_CREATOR_PRICE_ID_USD || '']: 'creator',
      [process.env.STRIPE_UNLIMITED_PRICE_ID_PLN || '']: 'unlimited',
      [process.env.STRIPE_UNLIMITED_PRICE_ID_USD || '']: 'unlimited',
    };

    newRole = priceToRoleMap[priceId] || null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'active',
      role: (newRole || user.role) as Role,
      nextBillingDate: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`✅ [Webhook] Payment succeeded for subscription ${subscription.id}. Role: ${newRole || user.role}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!(invoice as any).subscription) {
    console.log('[Webhook] invoice.payment_failed: No subscription attached');
    return;
  }

  console.log('[Webhook] invoice.payment_failed:', {
    invoiceId: invoice.id,
    subscriptionId: (invoice as any).subscription,
  });

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: (invoice as any).subscription as string },
    data: { subscriptionStatus: 'past_due' },
  });

  console.log(`⚠️ [Webhook] Payment failed for subscription: ${(invoice as any).subscription}`);
}