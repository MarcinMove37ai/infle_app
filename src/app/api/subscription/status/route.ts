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

    // --- 1. POBIERANIE CENY JEDNORAZOWEJ (BLIK) ZE STRIPE ---
    let oneTimePriceFormatted = '29,00 zł'; // Wartość domyślna (fallback)
    try {
      if (process.env.STRIPE_ROOKIE_PRICE_ID_BLIK) {
        const price = await stripe.prices.retrieve(process.env.STRIPE_ROOKIE_PRICE_ID_BLIK);
        const amount = (price.unit_amount || 0) / 100;
        oneTimePriceFormatted = new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: price.currency.toUpperCase()
        }).format(amount);
      }
    } catch (e) {
      console.error('Error fetching BLIK price from Stripe:', e);
    }

    // --- 2. USTALANIE KWOTY NASTĘPNEJ PŁATNOŚCI (POPRAWIONE) ---
    // Zamiast zgadywać z faktur pro-forma, pobieramy cenę przypisaną do subskrypcji.

    let nextBillingAmount = '';

    // A. Subskrypcje (Aktywne lub Trial)
    if (user.stripeSubscriptionId && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing')) {
       try {
          // Pobieramy obiekt subskrypcji, aby dostać się do items -> price
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

          if (subscription.items && subscription.items.data.length > 0) {
             // To jest obiekt ceny, który jest faktycznie podpięty pod subskrypcję
             const priceObject = subscription.items.data[0].price;

             // Kwota w bazie Stripe jest w groszach (np. 2900), dzielimy przez 100
             const amount = (priceObject.unit_amount || 0) / 100;
             const currency = priceObject.currency.toUpperCase();

             nextBillingAmount = new Intl.NumberFormat('pl-PL', {
                style: 'currency',
                currency: currency
             }).format(amount);
          } else {
             // Fallback, jeśli struktura subskrypcji jest nietypowa
             nextBillingAmount = '---';
          }

       } catch (error) {
          console.error('Error fetching subscription price:', error);

          // Ostateczny fallback na podstawie roli (Hardcoded values), gdyby API Stripe padło
          if (user.role === 'creator') nextBillingAmount = '87,00 zł';
          else if (user.role === 'unlimited') nextBillingAmount = '299,00 zł';
          else nextBillingAmount = '29,00 zł'; // Domyślnie dla Rookie
       }
    }
    // B. Płatność jednorazowa (BLIK) - tutaj cena jest stała
    else if (user.subscriptionStatus === 'one_time_paid') {
      nextBillingAmount = oneTimePriceFormatted;
    }
    // C. Brak płatnego planu (Free, Demo, brak subskrypcji)
    else {
      nextBillingAmount = '0,00 zł';
    }


    // Mapowanie nazw planów
    const planMapping: Record<string, { name: string; description: string }> = {
      free: { name: 'planFree', description: 'planDescriptionFree' },
      free_ver: { name: 'planRookie', description: 'planDescriptionRookieTrial' },
      rookie: { name: 'planRookie', description: 'planDescriptionRookie' },
      creator: { name: 'planCreator', description: 'planDescriptionCreator' },
      unlimited: { name: 'planUnlimited', description: 'planDescriptionUnlimited' },
      demo: { name: 'planFree', description: 'planDescriptionFree' } // POPRAWIONE: Używa nazw planu Free
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
      nextBillingAmount: nextBillingAmount,
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