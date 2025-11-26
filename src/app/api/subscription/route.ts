// app/api/subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Pobierz użytkownika wraz z danymi bilingowymi
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        role: true,
        subscriptionStatus: true,
        nextBillingDate: true,
        paymentVerifiedAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        // Dane autora
        authorDisplayName: true,
        authorLogoUrl: true,
        firstName: true,
        lastName: true,
        // Dane billing
        billingName: true,
        billingAddress: true,
        cardLast4: true,
        cardBrand: true,
        companyName: true,
        taxId: true,
        taxIdType: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Ustal cenę dynamicznie ze Stripe
    let currentPrice = '0 zł';
    let currency = 'PLN';

    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        if (subscription.items.data.length > 0) {
          const priceItem = subscription.items.data[0].price;
          const amount = (priceItem.unit_amount || 0) / 100;
          currency = priceItem.currency.toUpperCase();

          currentPrice = new Intl.NumberFormat('pl-PL', {
            style: 'currency',
            currency: currency
          }).format(amount);
        }
      } catch (error) {
        console.error('Error fetching Stripe subscription:', error);
        // Fallback cenowy (jeśli Stripe zawiedzie)
        if (user.role === 'rookie' || user.role === 'free_ver') currentPrice = '29 zł';
        if (user.role === 'creator') currentPrice = '87 zł';
        if (user.role === 'unlimited') currentPrice = '299 zł';
      }
    } else {
       // Ceny domyślne jeśli brak aktywnej subskrypcji w Stripe, ale rola jest ustawiona
        if (user.role === 'rookie' || user.role === 'free_ver') currentPrice = '29 zł';
        if (user.role === 'creator') currentPrice = '87 zł';
        if (user.role === 'unlimited') currentPrice = '299 zł';
    }

    // 3. Mapowanie nazw i opisów planów (bez cen - one są teraz dynamiczne)
    const planMapping: Record<string, { name: string; description: string }> = {
      free: {
        name: 'planFree',
        description: 'planDescriptionFree',
      },
      free_ver: {
        name: 'planRookie',
        description: 'planDescriptionRookieTrial',
      },
      rookie: {
        name: 'planRookie',
        description: 'planDescriptionRookie',
      },
      creator: {
        name: 'planCreator',
        description: 'planDescriptionCreator',
      },
      unlimited: {
        name: 'planUnlimited',
        description: 'planDescriptionUnlimited',
      }
    };

    const planInfo = planMapping[user.role] || planMapping.free;

    // 4. Zwróć dane
    return NextResponse.json({
      role: user.role,
      plan: planInfo.name,
      planDescription: planInfo.description,
      subscriptionStatus: user.subscriptionStatus,
      nextBillingDate: user.nextBillingDate,
      nextBillingAmount: currentPrice, // <-- Dynamiczna cena
      paymentVerifiedAt: user.paymentVerifiedAt,
      isTrialing: user.subscriptionStatus === 'trialing',
      limitation: (user.role === 'free_ver' && !user.paymentVerifiedAt) ? 'limitationPublish' : null,

      // Dane autora
      authorDisplayName: user.authorDisplayName,
      authorLogoUrl: user.authorLogoUrl,
      firstName: user.firstName,
      lastName: user.lastName,

      // Dane billing
      billingName: user.billingName,
      billingAddress: user.billingAddress,
      cardLast4: user.cardLast4,
      cardBrand: user.cardBrand,
      companyName: user.companyName,
      taxId: user.taxId,
      taxIdType: user.taxIdType,
    });
  } catch (error) {
    console.error('Error fetching subscription data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription data' },
      { status: 500 }
    );
  }
}