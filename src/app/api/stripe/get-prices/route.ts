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

    // 1. Definiujemy mapę cen do pobrania
    // Klucze standardowe (np. 'rookie') to subskrypcje
    const priceIds: Record<string, string | undefined> = {
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

    // 2. Jeśli język to PL, dodajemy ceny jednorazowe (BLIK)
    // Klucze z sufiksem '_onetime' (np. 'rookie_onetime')
    if (locale === 'pl') {
      priceIds.rookie_onetime = process.env.STRIPE_ROOKIE_PRICE_ID_BLIK;
      priceIds.creator_onetime = process.env.STRIPE_CREATOR_PRICE_ID_BLIK;
      priceIds.unlimited_onetime = process.env.STRIPE_UNLIMITED_PRICE_ID_BLIK;
    }

    const results: Record<string, string> = {};

    // 3. Pobierz dane dla każdego planu ze Stripe
    // Używamy Promise.all dla przyspieszenia (równoległe pobieranie)
    const fetchPromises = Object.entries(priceIds).map(async ([key, priceId]) => {
      if (!priceId) {
        // Cichy warn, żeby nie zaśmiecać logów jeśli np. nie ma BLIK w USD (co jest poprawne)
        if (locale === 'pl') console.warn(`⚠️ Missing env variable for ${key}`);
        return;
      }

      try {
        const price = await stripe.prices.retrieve(priceId);

        // Obliczenie kwoty (Stripe trzyma kwoty w groszach/centach)
        const amount = (price.unit_amount || 0) / 100;

        // Formater walutowy (Intl) - używamy waluty zwróconej przez Stripe
        const formatter = new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
          style: 'currency',
          currency: price.currency,
          // Jeśli kwota jest pełna (np. 29.00), nie pokazuj groszy.
          // Jeśli ma grosze (np. 29.99), pokazuj.
          minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        });

        results[key] = formatter.format(amount);
      } catch (err) {
        console.error(`❌ Failed to fetch price for ${key} (ID: ${priceId}):`, err);
        // W razie błędu nie dodajemy klucza do results, frontend użyje fallbacka
      }
    });

    await Promise.all(fetchPromises);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}