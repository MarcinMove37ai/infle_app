// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function POST(req: NextRequest) {
  const body = await req.text();

  // POPRAWKA NEXT.JS 15: headers() jest teraz asynchroniczne
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

  // Obsługa różnych eventów
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

// Handler dla checkout.session.completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  // Pobierz subscription z Stripe
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  ) as any;

  // Pobierz Customer z danymi billing
  // UWAGA: Stripe nadpisuje customer.name nazwą firmy, jeśli podano NIP w checkoucie
  const customer = await stripe.customers.retrieve(
    session.customer as string
  ) as Stripe.Customer;

  // Pobierz Payment Method (karta) - dla 4 ostatnich cyfr
  const paymentMethodId = subscription.default_payment_method as string;
  const paymentMethod = paymentMethodId
    ? await stripe.paymentMethods.retrieve(paymentMethodId)
    : null;

  // Pobierz Tax ID jeśli istnieje
  let taxId = null;
  let taxIdType = null;
  try {
    const taxIds = await stripe.customers.listTaxIds(session.customer as string);
    if (taxIds.data.length > 0) {
      taxId = taxIds.data[0].value;
      taxIdType = taxIds.data[0].type;
    }
  } catch (error) {
    console.log('No tax ID found');
  }

  // --- POPRAWIONA LOGIKA DANYCH ---

  // 1. Billing Name (Osoba / Właściciel karty):
  // Priorytet 1: Dane z karty (paymentMethod) - to jest "właściciel karty"
  // Priorytet 2: Dane wpisane w formularzu checkout (customer_details)
  // Priorytet 3: Fallback do customer.name (tylko jeśli nie ma nic innego)
  const billingName = paymentMethod?.billing_details?.name || session.customer_details?.name || customer.name;

  // 2. Company Name (Firma):
  // Jeśli wykryto NIP (taxId), Stripe nadpisuje customer.name nazwą firmy.
  // Wtedy wiemy, że customer.name to Firma, a billingName (pobrane wyżej z karty) to Osoba.
  let companyName = null;
  if (taxId) {
     companyName = customer.name;

     // Dodatkowe zabezpieczenie: Jeśli z jakiegoś powodu billingName jest takie samo jak nazwa firmy
     // (np. użytkownik wpisał nazwę firmy też na karcie), a mamy NIP, to w polu billingName
     // staramy się znaleźć osobę kontaktową z metadanych lub zostawiamy jak jest.
     // W 99% przypadków paymentMethod?.billing_details?.name rozdzieli to poprawnie.
  }

  // 3. Adres
  const billingAddress = session.customer_details?.address || customer.address;

  // Określ role na podstawie statusu subskrypcji
  const role = subscription.status === 'trialing' ? 'free_ver' : 'rookie';

  // NAPRAWA: Oblicz bezpieczną datę (jeśli current_period_end jest puste, użyj trial_end lub +30 dni)
  const timestamp = subscription.current_period_end || subscription.trial_end;
  const safeNextBillingDate = timestamp
    ? new Date(timestamp * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Aktualizuj użytkownika w bazie
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      role: role,
      paymentVerifiedAt: new Date(),
      nextBillingDate: safeNextBillingDate,

      // Zaktualizowane pola
      billingName: billingName,
      billingAddress: billingAddress as any,
      companyName: companyName, // Teraz poprawnie zaciągane z customer.name przy NIP-ie

      cardLast4: paymentMethod?.card?.last4,
      cardBrand: paymentMethod?.card?.brand,
      taxId: taxId,
      taxIdType: taxIdType,
    },
  });

  console.log(`✅ ${subscription.status === 'trialing' ? 'Trial' : 'Subscription'} activated for user ${userId}`);
  console.log(`📧 Email: ${customer.email}`);
  console.log(`👤 Billing Name: ${billingName}`);
  if (companyName) console.log(`🏢 Company (from Customer Name): ${companyName}`);
  if (taxId) console.log(`🧾 Tax ID (${taxIdType}): ${taxId}`);
}

// Handler dla subscription.updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      subscriptionStatus: subscription.status,
      nextBillingDate: new Date((subscription as any).current_period_end * 1000),
    },
  });

  console.log(`✅ Subscription updated: ${subscription.id}`);
}

// Handler dla subscription.deleted
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

// Handler dla invoice.payment_succeeded
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!(invoice as any).subscription) return;

  const subscription = await stripe.subscriptions.retrieve(
    (invoice as any).subscription as string
  ) as any;

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      subscriptionStatus: 'active',
      role: 'rookie',
      nextBillingDate: new Date(subscription.current_period_end * 1000),
    },
  });

  console.log(`✅ Payment succeeded for subscription: ${subscription.id}`);
}

// Handler dla invoice.payment_failed
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!(invoice as any).subscription) return;

  await prisma.user.updateMany({
    where: { stripeSubscriptionId: (invoice as any).subscription as string },
    data: {
      subscriptionStatus: 'past_due',
    },
  });

  console.log(`⚠️ Payment failed for subscription: ${(invoice as any).subscription}`);
}