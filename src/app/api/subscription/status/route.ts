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

    // --- SEKCJA: USTALANIE KWOT (WERSJA: WALUTA ZE STRIPE + CENA Z KATALOGU) ---

    // 1. Pobierz parametr locale z URL (służy TYLKO do formatowania zapisu liczby: przecinek vs kropka)
    const { searchParams } = new URL(req.url);
    const browserLocale = searchParams.get('locale') || 'pl';

    // Helper formatowania (używa waluty przekazanej dynamicznie)
    const formatCurrency = (amount: number, currency: string) => {
      return new Intl.NumberFormat(browserLocale === 'pl' ? 'pl-PL' : 'en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      }).format(amount);
    };

    // --- KROK 1: Wykryj rzeczywistą walutę klienta ze Stripe ---
    let detectedCurrency = 'pln'; // Domyślnie, jeśli nie znajdziemy klienta

    if (user.stripeCustomerId) {
      try {
        // A. Sprawdzamy subskrypcje (WSZYSTKIE statusy, by złapać też trial)
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: 'all',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          // Bierzemy walutę z subskrypcji
          detectedCurrency = subscriptions.data[0].items.data[0].price.currency;
        } else {
          // B. Brak subskrypcji? Sprawdzamy historię płatności (One-Time / BLIK)
          const paymentIntents = await stripe.paymentIntents.list({
            customer: user.stripeCustomerId,
            limit: 1,
          });
          if (paymentIntents.data.length > 0) {
            detectedCurrency = paymentIntents.data[0].currency;
          }
        }
      } catch (error) {
        console.error('Błąd pobierania waluty ze Stripe:', error);
      }
    }

    // --- KROK 2: Ustal tryb cennika (PL vs EN) na podstawie wykrytej waluty ---
    // Jeśli waluta to PLN -> traktujemy jak rynek PL. Każda inna (USD, EUR) -> rynek EN.
    const configMode = detectedCurrency.toLowerCase() === 'pln' ? 'pl' : 'en';

    // --- KROK 3: Wybierz ID ceny katalogowej (Oryginalna logika, ale sterowana przez configMode) ---
    const role = user.role?.toLowerCase();
    const isOneTime = user.subscriptionStatus === 'one_time_paid';
    let currentPlanPriceId = '';

    if (configMode === 'pl') {
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
      // Logika dla rynków zagranicznych (USD)
      // POPRAWKA: Dodano obsługę free_ver (trial), który mapuje się na cenę Rookie USD
      if (role === 'rookie' || role === 'free_ver') {
          currentPlanPriceId = process.env.STRIPE_ROOKIE_PRICE_ID_USD!;
      }
      else if (role === 'creator') currentPlanPriceId = process.env.STRIPE_CREATOR_PRICE_ID_USD!;
      else if (role === 'unlimited') currentPlanPriceId = process.env.STRIPE_UNLIMITED_PRICE_ID_USD!;
    }

    // --- KROK 4: Pobierz PEŁNĄ wartość planu ze Stripe na podstawie ID ---
    let nextBillingAmount = '---';

    // Obsługa Free/Demo
    if (role === 'free' || role === 'demo') {
       // Dla darmowych pokazujemy 0 w walucie odpowiedniej dla języka przeglądarki
       nextBillingAmount = browserLocale === 'pl' ? '0,00 zł' : '$0.00';
    }
    else if (currentPlanPriceId) {
      try {
        // Pobieramy cenę STANDARDOWĄ (katalogową) - to rozwiązuje problem proratingu
        const priceObj = await stripe.prices.retrieve(currentPlanPriceId);

        // Formatujemy cenę używając:
        // 1. Kwoty katalogowej (priceObj.unit_amount)
        // 2. Wykrytej waluty klienta (detectedCurrency) - dla pewności zgodności
        nextBillingAmount = formatCurrency((priceObj.unit_amount || 0) / 100, priceObj.currency);
      } catch (error) {
        console.error(`Błąd pobierania ceny katalogowej ID: ${currentPlanPriceId}`, error);
        nextBillingAmount = '---';
      }
    }

    // Dodatek: Cena One-Time (dla modala) - zawsze w PLN
    let oneTimePriceFormatted = '29,00 zł';
    try {
      if (process.env.STRIPE_ROOKIE_PRICE_ID_BLIK) {
        const blikPriceObj = await stripe.prices.retrieve(process.env.STRIPE_ROOKIE_PRICE_ID_BLIK);
        // Tu wymuszamy formatowanie PL, bo to oferta specyficzna dla PL
        oneTimePriceFormatted = new Intl.NumberFormat('pl-PL', {
             style: 'currency', currency: blikPriceObj.currency.toUpperCase()
        }).format((blikPriceObj.unit_amount || 0) / 100);
      }
    } catch (e) {}

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