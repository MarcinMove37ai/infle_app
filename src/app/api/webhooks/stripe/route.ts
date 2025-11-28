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
  // Pobieramy nazwę planu z metadanych (np. 'rookie', 'creator', 'unlimited')
  const planName = session.metadata?.planName;

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });

  if (!userExists) {
    console.error('User not found in DB');
    return;
  }

  // --- LOGIKA TRYBU ---
  let stripeSubscriptionId: string | null = null;
  let subscriptionStatus = 'active';

  // Domyślna rola to 'rookie', chyba że w metadanych jest inna poprawna rola
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

    // Jeśli status to 'trialing', nadpisujemy rolę na 'free_ver' (Trial),
    // CHYBA ŻE to plan wyższy niż Rookie (Creator/Unlimited nie mają triala w naszej logice, ale na wszelki wypadek)
    // W Twoim przypadku Creator/Unlimited idą bez triala, więc status będzie 'active'.
    if (subscription.status === 'trialing') {
        role = 'free_ver';
    }

    paymentMethodId = subscription.default_payment_method as string;
    const timestamp = subscription.current_period_end || subscription.trial_end;
    nextBillingDate = timestamp ? new Date(timestamp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  } else if (session.mode === 'payment') {
    // Płatność jednorazowa (One-Time)
    stripeSubscriptionId = null;
    subscriptionStatus = 'one_time_paid';

    // Rola zostaje taka, jak ustaliliśmy na podstawie planName (np. 'creator')

    const now = new Date();
    nextBillingDate = new Date(now.setMonth(now.getMonth() + 1)); // Dostęp na 1 miesiąc
    paymentMethodId = null;

    // Dla płatności jednorazowych musimy pobrać PaymentIntent, aby dostać ID metody płatności
    if (session.payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        paymentMethodId = pi.payment_method as string;
      } catch (e) {
        console.error('Error fetching payment intent:', e);
      }
    }
  } else {
    return;
  }

  // --- LOGIKA DANYCH BILLINGOWYCH (ZACHOWANA) ---

  // 1. Pobieramy dane bezpośrednio z obiektu PaymentMethod
  let cardholderName: string | null = null;
  let cardLast4 = null;
  let cardBrand = null;

  if (paymentMethodId) {
      try {
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        cardholderName = pm.billing_details.name; // <-- Prawdziwe imię z karty
        cardLast4 = pm.card?.last4;
        cardBrand = pm.card?.brand;
      } catch (e) {
        console.error('Error fetching payment method:', e);
      }
  }

  // 2. Ustalamy Billing Name (Imie i Nazwisko)
  const billingName = cardholderName || session.customer_details?.name || 'N/A';

  // 3. Dane Firmy (NIP i Nazwa)
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
        console.error('Error fetching tax IDs:', e);
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
      role: role as Role, // <-- TUTAJ WPADA 'creator', 'unlimited' LUB 'rookie'
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

  console.log(`✅ [${session.mode}] User updated to role: ${role}. Billing: "${billingName}", Company: "${companyName}"`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // UWAGA: Przy update subskrypcji (np. zmiana planu w Stripe Portal)
  // warto byłoby też zaktualizować rolę, ale to wymagałoby mapowania Product ID -> Role.
  // Na razie aktualizujemy tylko status i datę.

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      subscriptionStatus: subscription.status,
      nextBillingDate: new Date((subscription as any).current_period_end * 1000),
    },
  });
  console.log(`✅ Subscription updated: ${subscription.id}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      subscriptionStatus: 'canceled',
      role: 'free',
    },
  });
  console.log(`✅ Subscription canceled: ${subscription.id}`);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!(invoice as any).subscription) return;
  const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string) as any;

  // Tutaj również: Jeśli chcesz obsługiwać zmianę planu przez fakturę,
  // musiałbyś pobrać Product ID z subskrypcji i zmapować na rolę.
  // Obecnie zostawiamy rolę bez zmian (lub ustawiamy 'active'),
  // zakładając że rola została ustawiona przy Checkout.

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      subscriptionStatus: 'active',
      // role: 'rookie', // <-- USUNIĘTO sztywne ustawianie roli, aby nie nadpisać Creatora
      nextBillingDate: new Date(subscription.current_period_end * 1000),
    },
  });
  console.log(`✅ Payment succeeded for subscription: ${subscription.id}`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!(invoice as any).subscription) return;
  await prisma.user.updateMany({
    where: { stripeSubscriptionId: (invoice as any).subscription as string },
    data: { subscriptionStatus: 'past_due' },
  });
  console.log(`⚠️ Payment failed for subscription: ${(invoice as any).subscription}`);
}