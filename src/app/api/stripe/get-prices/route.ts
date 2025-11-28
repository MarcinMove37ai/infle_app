// src/app/api/stripe/get-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// WAŻNE: Wymuszamy dynamiczne renderowanie, aby ceny nie były cache'owane
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get('locale') || 'pl';

    // 1. Wybierz odpowiednie Price ID w zależności od języka
    // Używamy tych samych zmiennych co w create-checkout
    const priceIds = {
      rookie: locale === 'pl'
        ? process.env.STRIPE_ROOKIE_PRICE_ID_PLN
        : process.env.STRIPE_ROOKIE_PRICE_ID_USD,
      creator: locale === 'pl'
        ? process.env.STRIPE_CREATOR_PRICE_ID_PLN
        : process.env.STRIPE_CREATOR_PRICE_ID_USD,
      unlimited: locale === 'pl'
        ? process.env.STRIPE_UNLIMITED_PRICE_ID_PLN
        : process.env.STRIPE_UNLIMITED_PRICE_ID_USD,
    };

    const results: Record<string, string> = {};

    // 2. Pobierz dane dla każdego planu ze Stripe
    for (const [planName, priceId] of Object.entries(priceIds)) {
      if (!priceId) {
        console.warn(`⚠️ Missing env variable for ${planName} (${locale})`);
        continue;
      }

      try {
        const price = await stripe.prices.retrieve(priceId);

        // Formatowanie waluty (np. 900 -> 9.00 lub 9)
        const amount = (price.unit_amount || 0) / 100;

        // Formater walutowy (Intl)
        const formatter = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
          style: 'currency',
          currency: price.currency,
          // Jeśli kwota jest pełna (np. 29.00), nie pokazuj groszy (29 zł).
          // Jeśli ma grosze (np. 29.99), pokazuj (29,99 zł).
          minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        });

        results[planName] = formatter.format(amount);
      } catch (err) {
        console.error(`❌ Failed to fetch price for ${planName} (ID: ${priceId}):`, err);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}