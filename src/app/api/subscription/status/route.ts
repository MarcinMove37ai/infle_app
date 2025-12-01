import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        paymentVerifiedAt: true,
        nextBillingDate: true,
        billingName: true,
        billingAddress: true,
        companyName: true,
        taxId: true,
        taxIdType: true,
        cardLast4: true,
        cardBrand: true,
        billingPreference: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // --- SEKCJA: USTALANIE KWOT (ZMODYFIKOWANA) ---

    // 1. Pobierz parametr locale z URL (frontend musi wysyłać ?locale=pl lub en)
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get('locale') || 'pl';

    // 2. Definicja zmiennych wyjściowych
    let nextBillingAmount = '---';
    let oneTimePriceFormatted = '29,00 zł'; // Domyślna cena BLIK do wyświetlenia w opcjach

    // 3. Pomocnicza funkcja do formatowania waluty
    const formatCurrency = (amount: number, currency: string) => {
      return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    // 4. Pobierz ogólną cenę BLIK (dla przycisku "Kup jednorazowo") - niezależnie od roli
    try {
      if (process.env.STRIPE_ROOKIE_PRICE_ID_BLIK) {
        const blikPriceObj = await stripe.prices.retrieve(process.env.STRIPE_ROOKIE_PRICE_ID_BLIK);
        oneTimePriceFormatted = formatCurrency((blikPriceObj.unit_amount || 0) / 100, blikPriceObj.currency);
      }
    } catch (e) {
      console.error('Error fetching generic BLIK price:', e);
    }

    // 5. Ustal ID ceny dla BIEŻĄCEGO planu użytkownika (do wyświetlenia "Wartość/Cena")
    const role = user.role?.toLowerCase();
    const isOneTime = user.subscriptionStatus === 'one_time_paid';
    let currentPlanPriceId = '';

    // Logika mapowania Rola + Język + Status -> Zmienna środowiskowa
    if (locale === 'pl') {
      if (role === 'rookie' || role === 'free_ver') {
        currentPlanPriceId = isOneTime
          ? process.env.STRIPE_ROOKIE_PRICE_ID_BLIK!
          : process.env.STRIPE_ROOKIE_PRICE_ID_PLN!;
      } else if (role === 'creator') {
        currentPlanPriceId = isOneTime
          ? process.env.STRIPE_CREATOR_PRICE_ID_BLIK!
          : process.env.STRIPE_CREATOR_PRICE_ID_PLN!;
      } else if (role === 'unlimited') {
        currentPlanPriceId = isOneTime
          ? process.env.STRIPE_UNLIMITED_PRICE_ID_BLIK!
          : process.env.STRIPE_UNLIMITED_PRICE_ID_PLN!;
      }
    } else {
      // Logika dla EN / USD (zakładamy brak one-time dla USD)
      if (role === 'rookie') currentPlanPriceId = process.env.STRIPE_ROOKIE_PRICE_ID_USD!;
      else if (role === 'creator') currentPlanPriceId = process.env.STRIPE_CREATOR_PRICE_ID_USD!;
      else if (role === 'unlimited') currentPlanPriceId = process.env.STRIPE_UNLIMITED_PRICE_ID_USD!;
    }

    // 6. Pobierz i sformatuj cenę bieżącego planu
    if (role === 'free' || role === 'demo') {
      nextBillingAmount = locale === 'pl' ? '0,00 zł' : '$0.00';
    } else if (currentPlanPriceId) {
      try {
        const priceObj = await stripe.prices.retrieve(currentPlanPriceId);
        nextBillingAmount = formatCurrency((priceObj.unit_amount || 0) / 100, priceObj.currency);
      } catch (error) {
        console.error(`Error fetching price for role ${role} (ID: ${currentPlanPriceId}):`, error);
        // Fallback w razie awarii Stripe lub błędnego ID w .env
        if (locale === 'pl') {
            if (role === 'creator') nextBillingAmount = '87 zł';
            else if (role === 'unlimited') nextBillingAmount = '299 zł';
            else nextBillingAmount = '29 zł';
        } else {
             nextBillingAmount = '---';
        }
      }
    }

    // --- KONIEC SEKCJI USTALANIA KWOT ---

    // Mapowanie nazw planów
    const planMapping: Record<string, { name: string; description: string }> = {
      free: { name: 'planFree', description: 'planDescriptionFree' },
      free_ver: { name: 'planRookie', description: 'planDescriptionRookieTrial' },
      rookie: { name: 'planRookie', description: 'planDescriptionRookie' },
      creator: { name: 'planCreator', description: 'planDescriptionCreator' },
      unlimited: { name: 'planUnlimited', description: 'planDescriptionUnlimited' },
      demo: { name: 'planFree', description: 'planDescriptionFree' }
    };

    const planInfo = planMapping[user.role] || planMapping.free;

    return NextResponse.json({
      role: user.role,
      plan: planInfo.name,
      planDescription: planInfo.description,

      subscriptionStatus: user.subscriptionStatus,
      isTrialing: user.subscriptionStatus === 'trialing',
      upgradeRequired: user.role === 'free' || user.role === 'demo',

      nextBillingDate: user.nextBillingDate,
      nextBillingAmount: nextBillingAmount, // <--- Teraz pochodzi z logicznego mapowania env
      oneTimePrice: oneTimePriceFormatted,

      paymentVerifiedAt: user.paymentVerifiedAt,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,

      limitation: null,

      billingName: user.billingName,
      billingAddress: user.billingAddress,
      companyName: user.companyName,
      taxId: user.taxId,
      taxIdType: user.taxIdType,
      cardLast4: user.cardLast4,
      cardBrand: user.cardBrand,
      billingPreference: user.billingPreference,
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}