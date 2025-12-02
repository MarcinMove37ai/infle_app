// src/app/api/stripe/upgrade-onetime-to-subscription/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

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

const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetPlan, locale = 'en' } = body;

    console.log('[Upgrade One-Time → Subscription V3 UX] Request:', { targetPlan, locale });

    if (!targetPlan) {
      return NextResponse.json({ error: 'Missing targetPlan parameter' }, { status: 400 });
    }

    // 1. Autoryzacja
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Pobierz użytkownika
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        stripeCustomerId: true,
        subscriptionStatus: true,
        paymentVerifiedAt: true,
        nextBillingDate: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Upgrade One-Time → Subscription V3 UX] User:', {
      userId: user.id,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
    });

    // 3. Walidacja - musi mieć one_time_paid, active LUB canceled (w okresie wypowiedzenia)
    const allowedStatuses = ['one_time_paid', 'active', 'canceled'];

    if (!user.subscriptionStatus || !allowedStatuses.includes(user.subscriptionStatus)) {
      return NextResponse.json(
        { error: 'User must have one-time payment or active/canceled subscription' },
        { status: 400 }
      );
    }

    if (!user.paymentVerifiedAt || !user.nextBillingDate) {
      return NextResponse.json(
        { error: 'Missing payment dates' },
        { status: 400 }
      );
    }

    // 4. Pobierz lub utwórz Stripe Customer
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
      console.log('[Upgrade One-Time → Subscription V3 UX] Created customer:', customerId);
    }

    // 5. Oblicz dopłatę proporcjonalną
    const targetLocale = locale === 'pl' ? 'pl' : 'en';
    const periodStart = new Date(user.paymentVerifiedAt).getTime() / 1000;
    const periodEnd = new Date(user.nextBillingDate).getTime() / 1000;
    const now = Math.floor(Date.now() / 1000);
    const secondsRemaining = periodEnd - now;
    const totalSeconds = periodEnd - periodStart;

    // Pobierz cenę dla obecnego planu
    let currentPriceId: string | undefined;

    if (user.subscriptionStatus === 'one_time_paid') {
      // Dla one-time użyj cen BLIK (lub fallback)
      currentPriceId = user.role === 'rookie'
        ? process.env.STRIPE_ROOKIE_PRICE_ID_BLIK
        : user.role === 'creator'
        ? process.env.STRIPE_CREATOR_PRICE_ID_BLIK
        : user.role === 'unlimited'
        ? process.env.STRIPE_UNLIMITED_PRICE_ID_BLIK
        : PRICE_MAP[user.role]?.[targetLocale];
    } else {
      // Dla active użyj standardowych cen subskrypcji
      currentPriceId = PRICE_MAP[user.role]?.[targetLocale];
    }

    if (!currentPriceId) {
      return NextResponse.json({ error: 'Current plan price not found' }, { status: 500 });
    }

    const targetPriceId = PRICE_MAP[targetPlan]?.[targetLocale];
    if (!targetPriceId) {
      return NextResponse.json({ error: `Target plan price not found: ${targetPlan}` }, { status: 500 });
    }

    const currentPrice = await stripe.prices.retrieve(currentPriceId);
    const targetPrice = await stripe.prices.retrieve(targetPriceId);

    const currentMonthlyPrice = (currentPrice.unit_amount || 0) / 100;
    const targetMonthlyPrice = (targetPrice.unit_amount || 0) / 100;

    const currentPricePerSecond = currentMonthlyPrice / totalSeconds;
    const targetPricePerSecond = targetMonthlyPrice / totalSeconds;

    const creditFromCurrent = currentPricePerSecond * secondsRemaining;
    const costOfTarget = targetPricePerSecond * secondsRemaining;
    const proratedCharge = costOfTarget - creditFromCurrent;

    console.log('[Upgrade One-Time → Subscription V3 UX] Proration calculation:', {
      currentMonthlyPrice,
      targetMonthlyPrice,
      secondsRemaining,
      proratedCharge,
    });

    // 6. Utwórz produkt i cenę JEDNORAZOWĄ (One-Time) dla dopłaty
    const planFrom = capitalize(user.role || '');
    const planTo = capitalize(targetPlan);

    const formattedDateEnd = new Date(user.nextBillingDate).toLocaleDateString(
      targetLocale === 'pl' ? 'pl-PL' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );

    const descriptionPL = `Dopłata za podwyższenie planu z ${planFrom} na ${planTo}. Okres rozliczeniowy pozostaje bez zmian i kończy się ${formattedDateEnd}. Subskrypcja poniżej aktywuje płatności dopiero po tej dacie.`;

    const descriptionEN = `Upgrade fee from ${planFrom} to ${planTo}. Billing period remains unchanged, ending on ${formattedDateEnd}. The subscription below activates payments only after this date.`;

    const upgradeProduct = await stripe.products.create({
      name: locale === 'pl'
        ? `Upgrade do planu ${planTo}`
        : `Upgrade to ${planTo} Plan`,
      description: locale === 'pl' ? descriptionPL : descriptionEN,
      metadata: {
        type: 'upgrade_proration_fee',
        userId: user.id,
        fromPlan: user.role,
        toPlan: targetPlan,
      },
    });

    const upgradePrice = await stripe.prices.create({
      product: upgradeProduct.id,
      unit_amount: Math.round(proratedCharge * 100),
      currency: targetPrice.currency,
      metadata: {
        type: 'upgrade_proration_fee',
        targetPriceId: targetPriceId,
      },
    });

    // 7. Utwórz Checkout Session z DWOMA produktami
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer_update: { name: 'auto', address: 'auto' },
      tax_id_collection: { enabled: true },
      locale: targetLocale === 'pl' ? 'pl' : 'en',

      line_items: [
        {
          price: upgradePrice.id,
          quantity: 1,
        },
        {
          price: targetPriceId,
          quantity: 1,
        },
      ],

      subscription_data: {
        trial_end: Math.floor(periodEnd),
        metadata: {
          userId: user.id,
          planName: targetPlan,
          upgradedFrom: user.role,
          upgradeType: user.subscriptionStatus === 'one_time_paid'
            ? 'onetime_to_subscription'
            : 'subscription_upgrade',
          targetPriceId: targetPriceId,
        },
      },

      custom_text: {
        submit: {
          message: locale === 'pl'
            ? `Zatwierdź i zapłać`
            : `Confirm and Pay`,
        },
      },

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true&upgraded=subscription`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,

      metadata: {
        userId: user.id,
        planName: targetPlan,
        upgradeType: user.subscriptionStatus === 'one_time_paid'
          ? 'onetime_to_subscription'
          : 'subscription_upgrade',
        targetPriceId: targetPriceId,
      },
    });

    console.log('[Upgrade One-Time → Subscription V3 UX] Checkout created:', {
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });

  } catch (error: any) {
    console.error('[Upgrade One-Time → Subscription V3 UX] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create upgrade checkout',
        details: error.message,
      },
      { status: 500 }
    );
  }
}