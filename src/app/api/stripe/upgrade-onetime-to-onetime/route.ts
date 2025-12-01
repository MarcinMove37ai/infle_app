// src/app/api/stripe/upgrade-onetime-to-onetime/route.ts

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

// Mapa cen JEDNORAZOWYCH (BLIK/Przelewy)
// Upewnij się, że masz te zmienne w .env (ceny produktów typu "One-time")
const PRICE_MAP_ONETIME: Record<string, Record<string, string | undefined>> = {
  rookie: {
    en: process.env.STRIPE_ROOKIE_PRICE_ID_BLIK_USD, // lub inny ID ceny jednorazowej
    pl: process.env.STRIPE_ROOKIE_PRICE_ID_BLIK,     // np. price_...
  },
  creator: {
    en: process.env.STRIPE_CREATOR_PRICE_ID_BLIK_USD,
    pl: process.env.STRIPE_CREATOR_PRICE_ID_BLIK,
  },
  unlimited: {
    en: process.env.STRIPE_UNLIMITED_PRICE_ID_BLIK_USD,
    pl: process.env.STRIPE_UNLIMITED_PRICE_ID_BLIK,
  },
};

// Pomocnicza funkcja do formatowania nazw (np. rookie -> Rookie)
const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

/**
 * Upgrade: One-Time (np. Rookie BLIK) -> One-Time (np. Creator BLIK)
 *
 * LOGIKA:
 * 1. Obliczamy wartość niewykorzystanego czasu na obecnym planie (Remaining Value).
 * 2. Pobieramy pełną cenę nowego planu (Target Price).
 * 3. Finalna cena = Target Price - Remaining Value.
 * 4. Klient otrzymuje NOWY pełny miesiąc dostępu od momentu zakupu.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetPlan, locale = 'en' } = body;

    console.log('[Upgrade One-Time → One-Time] Request:', { targetPlan, locale });

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

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Walidacja: Użytkownik musi mieć aktywny plan One-Time
    if (user.subscriptionStatus !== 'one_time_paid') {
      return NextResponse.json({ error: 'User is not on a one-time plan' }, { status: 400 });
    }
    if (!user.paymentVerifiedAt || !user.nextBillingDate) {
      return NextResponse.json({ error: 'Missing payment dates' }, { status: 400 });
    }

    // 3. Customer ID
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    // 4. MATEMATYKA RABATOWA
    const targetLocale = locale === 'pl' ? 'pl' : 'en';

    // A. Pobierz cenę OBECNEGO planu (żeby wiedzieć ile był wart dzień)
    const currentPriceId = PRICE_MAP_ONETIME[user.role]?.[targetLocale];
    // B. Pobierz cenę DOCELOWEGO planu
    const targetPriceId = PRICE_MAP_ONETIME[targetPlan]?.[targetLocale];

    if (!currentPriceId || !targetPriceId) {
      return NextResponse.json({ error: 'Price definitions not found' }, { status: 500 });
    }

    const currentPriceObj = await stripe.prices.retrieve(currentPriceId);
    const targetPriceObj = await stripe.prices.retrieve(targetPriceId);

    const currentAmount = (currentPriceObj.unit_amount || 0) / 100; // np. 47 zł
    const targetAmount = (targetPriceObj.unit_amount || 0) / 100;   // np. 97 zł

    // Czas trwania
    const now = Date.now();
    const periodStart = new Date(user.paymentVerifiedAt).getTime();
    const periodEnd = new Date(user.nextBillingDate).getTime();

    // Zabezpieczenie: Jeśli data końca już minęła, nie ma rabatu
    const remainingTime = Math.max(0, periodEnd - now);
    const totalTime = periodEnd - periodStart;

    // Oblicz wartość niewykorzystanego czasu (Credit)
    // Jeśli totalTime jest błędny (np. 0), credit = 0
    let creditValue = 0;
    if (totalTime > 0) {
      const remainingRatio = remainingTime / totalTime;
      creditValue = currentAmount * remainingRatio;
    }

    // Finalna cena do zapłaty (Cena Nowego - Rabat)
    let finalAmount = targetAmount - creditValue;

    // Stripe wymaga minimum ~2 PLN. Jeśli rabat jest ogromny i cena spada poniżej minimum,
    // ustawiamy minimalną opłatę (lub 0, ale Stripe Checkout wymaga > 0 dla płatności).
    // Przyjmijmy minimum 2.00 zł
    if (finalAmount < 2) finalAmount = 2;

    console.log('[Upgrade One-Time → One-Time] Math:', {
      currentAmount,
      targetAmount,
      daysRemaining: Math.ceil(remainingTime / (1000 * 60 * 60 * 24)),
      creditValue,
      finalAmount
    });

    // 5. TWORZENIE PRODUKTU "CUSTOM" W STRIPE
    // Musimy utworzyć dynamiczny produkt, bo cena jest unikalna dla tego momentu

    const planFrom = capitalize(user.role);
    const planTo = capitalize(targetPlan);
    const creditFormatted = creditValue.toFixed(2).replace('.', ',');
    const finalFormatted = finalAmount.toFixed(2).replace('.', ',');

    // Obliczamy datę końca NOWEGO planu (30 dni od teraz)
    const newPeriodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000);
    const formattedNewDate = newPeriodEnd.toLocaleDateString(
      targetLocale === 'pl' ? 'pl-PL' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );

    const productName = locale === 'pl'
      ? `Inflee.app: Zmiana planu z ${planFrom} na ${planTo}`
      : `Switch to ${planTo} Plan`;

    // PROSTY, JASNY I PRZYJAZNY OPIS
    const descriptionPL = `Przechodzisz z planu ${planFrom} na ${planTo}. Płatność pomniejszona jest o kwotę ${creditFormatted} zł za niewykorzystany czas planu ${planFrom}, który opłaciłeś/aś wcześniej. Twój nowy plan ${planTo} będzie ważny od dziś do ${formattedNewDate}.`;
    const descriptionEN = `Switching from ${planFrom} to ${planTo}. We deducted ${creditValue.toFixed(2)} ${targetPriceObj.currency.toUpperCase()} for unused time. Your new plan will be valid until ${formattedNewDate}.`;

    const customProduct = await stripe.products.create({
      name: productName,
      description: locale === 'pl' ? descriptionPL : descriptionEN,
      metadata: {
        type: 'onetime_upgrade',
        userId: user.id,
      }
    });

    const customPrice = await stripe.prices.create({
      product: customProduct.id,
      unit_amount: Math.round(finalAmount * 100), // Grosze
      currency: targetPriceObj.currency,
      metadata: {
        type: 'onetime_upgrade_price',
      }
    });

    // 6. CHECKOUT SESSION (Mode: Payment)
const checkoutSession = await stripe.checkout.sessions.create({
  customer: customerId,
  mode: 'payment', // Płatność jednorazowa

  invoice_creation: {
    enabled: true,
    invoice_data: {
      // 👇 ZAKTUALIZOWANY OPIS (Wskazuje skąd -> dokąd)
      description: `Upgrade planu: ${planFrom} do ${planTo} (Płatność jednorazowa)`,
      metadata: {
        type: 'upgrade_onetime',
        fromPlan: user.role,
        toPlan: targetPlan
      }
    }
  },

      payment_method_types: ['card', 'blik', 'p24'], // Metody płatności
      line_items: [
        {
          price: customPrice.id,
          quantity: 1,
        },
      ],

      custom_text: {
        submit: {
          message: locale === 'pl'
            ? `Zapłać ${finalFormatted} zł`
            : `Pay ${finalAmount.toFixed(2)}`,
        },
      },

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true&upgraded=onetime`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,

      // Metadata dla Webhooka
      metadata: {
        userId: user.id,
        planName: targetPlan,
        upgradeType: 'onetime_to_onetime', // <-- Webhook po tym rozpozna co robić
        // Webhook powinien ustawić nextBillingDate = now + 30 dni
        // i zmienić rolę na targetPlan
      },
    });

    return NextResponse.json({ url: checkoutSession.url });

  } catch (error: any) {
    console.error('[Upgrade One-Time → One-Time] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}