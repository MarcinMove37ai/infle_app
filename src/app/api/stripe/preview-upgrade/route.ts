// src/app/api/stripe/preview-upgrade/route.ts

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetPlan = searchParams.get('targetPlan');
    const locale = searchParams.get('locale') || 'en';

    console.log('[Preview Upgrade] Request:', { targetPlan, locale });

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
        stripeSubscriptionId: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Preview Upgrade] User:', {
      userId: user.id,
      role: user.role,
      subscriptionId: user.stripeSubscriptionId
    });

    // Określ locale wcześnie - potrzebne zarówno dla subskrypcji jak i one-time
    const targetLocale = locale === 'pl' ? 'pl' : 'en';

    if (!user.stripeSubscriptionId) {
      console.log('[Preview Upgrade] User has no subscription - checking for one-time payment');

      // Sprawdź czy user ma płatność jednorazową
      const userDetails = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          subscriptionStatus: true,
          paymentVerifiedAt: true,
          nextBillingDate: true,
        },
      });

      if (userDetails?.subscriptionStatus !== 'one_time_paid') {
        return NextResponse.json(
          { error: 'No active subscription found' },
          { status: 400 }
        );
      }

      console.log('[Preview Upgrade] One-time payment user:', {
        paymentVerifiedAt: userDetails.paymentVerifiedAt,
        nextBillingDate: userDetails.nextBillingDate,
      });

      // OBLICZ PROPORCJONALNĄ DOPŁATĘ MANUALNIE
      if (!userDetails.paymentVerifiedAt || !userDetails.nextBillingDate) {
        return NextResponse.json(
          { error: 'Missing payment dates for one-time user' },
          { status: 400 }
        );
      }

      const periodStart = new Date(userDetails.paymentVerifiedAt).getTime() / 1000;
      const periodEnd = new Date(userDetails.nextBillingDate).getTime() / 1000;
      const now = Math.floor(Date.now() / 1000);

      const totalDaysInPeriod = Math.ceil((periodEnd - periodStart) / (60 * 60 * 24));
      const daysRemaining = Math.ceil((periodEnd - now) / (60 * 60 * 24));
      const secondsRemaining = periodEnd - now;
      const totalSeconds = periodEnd - periodStart;

      console.log('[Preview Upgrade] One-time payment calculation:', {
        periodStart: new Date(periodStart * 1000).toISOString(),
        periodEnd: new Date(periodEnd * 1000).toISOString(),
        totalDaysInPeriod,
        daysRemaining,
        secondsRemaining,
      });

      // Pobierz ceny planów
      const currentPriceId = PRICE_MAP[user.role]?.[targetLocale];
      const newPriceId = PRICE_MAP[targetPlan]?.[targetLocale];

      if (!currentPriceId || !newPriceId) {
        return NextResponse.json(
          { error: 'Price IDs not found' },
          { status: 500 }
        );
      }

      const currentPrice = await stripe.prices.retrieve(currentPriceId);
      const newPrice = await stripe.prices.retrieve(newPriceId);

      const currentMonthlyPrice = (currentPrice.unit_amount || 0) / 100;
      const newMonthlyPrice = (newPrice.unit_amount || 0) / 100;

      // Oblicz proporcjonalnie
      const currentPricePerSecond = currentMonthlyPrice / totalSeconds;
      const newPricePerSecond = newMonthlyPrice / totalSeconds;

      const creditFromCurrent = currentPricePerSecond * secondsRemaining;
      const costOfNew = newPricePerSecond * secondsRemaining;
      const immediateCharge = costOfNew - creditFromCurrent;

      // Formatowanie
      const currency = currentPrice.currency.toUpperCase();
      const locale_format = locale === 'pl' ? 'pl-PL' : 'en-US';
      const formatter = new Intl.NumberFormat(locale_format, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
      });

      console.log('[Preview Upgrade] One-time upgrade calculation:', {
        currentMonthlyPrice,
        newMonthlyPrice,
        creditFromCurrent,
        costOfNew,
        immediateCharge,
      });

      return NextResponse.json({
        targetPlan,
        currentPlan: user.role,
        isOneTimeUser: true,

        immediateCharge: formatter.format(immediateCharge),
        immediateChargeAmount: immediateCharge,

        fullMonthlyPrice: formatter.format(newMonthlyPrice),
        fullMonthlyPriceAmount: newMonthlyPrice,

        currentMonthlyPrice: formatter.format(currentMonthlyPrice),
        currentMonthlyPriceAmount: currentMonthlyPrice,

        proration: {
          creditFromCurrentPlan: formatter.format(creditFromCurrent),
          creditFromCurrentPlanAmount: creditFromCurrent,
          newPlanProrated: formatter.format(costOfNew),
          newPlanProratedAmount: costOfNew,
          daysRemaining,
          totalDaysInPeriod,
        },

        periodEnd: new Date(periodEnd * 1000).toISOString(),
        periodStart: new Date(periodStart * 1000).toISOString(),

        currency,
        billingCycleAnchor: new Date(periodEnd * 1000).toISOString(),

        subscriptionStatus: 'one_time_paid',

        upgradeOptions: {
          subscription: {
            available: true,
            description: locale === 'pl'
              ? 'Przejdź na subskrypcję z kartą (automatyczne odnowienie)'
              : 'Switch to card subscription (automatic renewal)',
          },
          oneTime: {
            available: true,
            description: locale === 'pl'
              ? 'Dopłać jednorazowo (BLIK/P24, bez automatycznego odnowienia)'
              : 'Pay one-time (BLIK/P24, no automatic renewal)',
          },
        },
      });
    }

    // 3. Pobierz nowy Price ID
    const newPriceId = PRICE_MAP[targetPlan]?.[targetLocale];

    if (!newPriceId) {
      console.error('[Preview Upgrade] Price ID not found:', { targetPlan, targetLocale });
      return NextResponse.json(
        { error: `Price ID not found for plan: ${targetPlan}` },
        { status: 500 }
      );
    }

    console.log('[Preview Upgrade] Target price ID:', newPriceId);

    // 4. Pobierz obecną subskrypcję
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    console.log('[Preview Upgrade] Full subscription object keys:', Object.keys(subscription));
    console.log('[Preview Upgrade] Subscription details:', {
      id: subscription.id,
      status: subscription.status,
      // ZMIANA TUTAJ: Dodaj rzutowanie (subscription as any), aby naprawić build
      current_period_end: (subscription as any).current_period_end,
      current_period_start: (subscription as any).current_period_start,
      // Check if it's nested somewhere
      billing_cycle_anchor: (subscription as any).billing_cycle_anchor,
    });

    if (!subscription.items.data.length) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 500 });
    }

    const currentItem = subscription.items.data[0];

    // WAŻNE: current_period_* jest teraz w items, nie w subscription!
    const currentPeriodEnd = (currentItem as any).current_period_end;
    const currentPeriodStart = (currentItem as any).current_period_start;

    console.log('[Preview Upgrade] Current subscription item:', {
      itemId: currentItem.id,
      priceId: currentItem.price.id,
      status: subscription.status,
      currentPeriodEnd,
      currentPeriodStart,
    });

    // 5. PODGLĄD FAKTURY - Stripe automatycznie oblicza proration
    console.log('[Preview Upgrade] Fetching upcoming invoice...');

    const upcomingInvoice = await stripe.invoices.createPreview({
      customer: subscription.customer as string,
      subscription: user.stripeSubscriptionId,
      subscription_details: {
        items: [
          {
            id: currentItem.id,
            price: newPriceId,
          },
        ],
        proration_date: Math.floor(Date.now() / 1000),
      },
    });

    console.log('[Preview Upgrade] Invoice retrieved:', {
      amountDue: upcomingInvoice.amount_due,
      currency: upcomingInvoice.currency,
      linesCount: upcomingInvoice.lines.data.length
    });

    // CRITICAL: Log all invoice lines to see what Stripe is charging
    console.log('[Preview Upgrade] Invoice lines breakdown:');
    upcomingInvoice.lines.data.forEach((line, index) => {
      console.log(`  Line ${index + 1}:`, {
        description: line.description,
        amount: line.amount / 100,
        // ZMIANA TUTAJ: Dodaj rzutowanie (line as any)
        proration: (line as any).proration,
        period: line.period ? {
          start: new Date(line.period.start * 1000).toISOString(),
          end: new Date(line.period.end * 1000).toISOString(),
        } : null,
      });
    });

    // 6. Pobierz szczegóły ceny nowego planu
    const newPrice = await stripe.prices.retrieve(newPriceId);
    const fullMonthlyPrice = (newPrice.unit_amount || 0) / 100;

    // 7. Pobierz obecną cenę
    const currentPrice = await stripe.prices.retrieve(currentItem.price.id);
    const currentMonthlyPrice = (currentPrice.unit_amount || 0) / 100;

    // 8. Oblicz ile dni pozostało
    const now = Math.floor(Date.now() / 1000);

    console.log('[Preview Upgrade] Period calculation:', {
      currentPeriodEnd,
      currentPeriodStart,
      now,
    });

    const daysRemaining = Math.ceil(
      (currentPeriodEnd - now) / (60 * 60 * 24)
    );
    const totalDaysInPeriod = Math.ceil(
      (currentPeriodEnd - currentPeriodStart) / (60 * 60 * 24)
    );

    // 9. Formatowanie
    const currency = upcomingInvoice.currency.toUpperCase();
    const locale_format = locale === 'pl' ? 'pl-PL' : 'en-US';

    const formatter = new Intl.NumberFormat(locale_format, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    });

    // KRYTYCZNE: Filtruj tylko linie z obecnego okresu (proration)
    // Ignoruj linie z następnego cyklu rozliczeniowego
    const proratedLines = upcomingInvoice.lines.data.filter(line => {
      if (!line.period) return false;
      // Tylko linie które kończą się w obecnym okresie (lub wcześniej)
      return line.period.end <= currentPeriodEnd;
    });

    console.log('[Preview Upgrade] Filtered proration lines:', {
      totalLines: upcomingInvoice.lines.data.length,
      proratedLines: proratedLines.length,
      proratedTotal: proratedLines.reduce((sum, line) => sum + (line.amount || 0), 0) / 100,
    });

    // Kwota do zapłaty TERAZ (tylko proration, bez następnego miesiąca)
    const immediateCharge = proratedLines.reduce((sum, line) => sum + (line.amount || 0), 0) / 100;

    // Analiza proration lines
    const creditLine = proratedLines.find(line => (line.amount || 0) < 0);
    const newPlanLine = proratedLines.find(line => (line.amount || 0) > 0);

    const actualCreditAmount = Math.abs((creditLine?.amount || 0) / 100);
    const actualNewPlanCost = (newPlanLine?.amount || 0) / 100;

    // 10. Oblicz szczegóły proration dla użytkownika
    // Używamy rzeczywistych wartości ze Stripe zamiast kalkulacji
    const creditFromCurrent = actualCreditAmount;
    const costOfNew = actualNewPlanCost;

    // Helper function to safely convert timestamp to ISO string
    const toISOString = (timestamp: number) => {
      // Check if timestamp is in seconds or milliseconds
      const msTimestamp = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
      return new Date(msTimestamp).toISOString();
    };

    const result = {
      targetPlan,
      currentPlan: user.role,

      immediateCharge: formatter.format(immediateCharge),
      immediateChargeAmount: immediateCharge,

      fullMonthlyPrice: formatter.format(fullMonthlyPrice),
      fullMonthlyPriceAmount: fullMonthlyPrice,

      currentMonthlyPrice: formatter.format(currentMonthlyPrice),
      currentMonthlyPriceAmount: currentMonthlyPrice,

      proration: {
        creditFromCurrentPlan: formatter.format(creditFromCurrent),
        creditFromCurrentPlanAmount: creditFromCurrent,
        newPlanProrated: formatter.format(costOfNew),
        newPlanProratedAmount: costOfNew,
        daysRemaining,
        totalDaysInPeriod,
      },

      periodEnd: toISOString(currentPeriodEnd),
      periodStart: toISOString(currentPeriodStart),

      currency,
      billingCycleAnchor: toISOString(currentPeriodEnd),

      subscriptionStatus: subscription.status,
    };

    console.log('[Preview Upgrade] Success:', result);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[Preview Upgrade] Error:', error);
    console.error('[Preview Upgrade] Error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode
    });

    return NextResponse.json(
      {
        error: 'Failed to preview upgrade',
        details: error.message
      },
      { status: 500 }
    );
  }
}