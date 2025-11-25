// app/api/subscription/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Mapowanie planów na ceny
    const planPrices: Record<string, string> = {
      rookie: '29 zł',
      creator: '99 zł',
      unlimited: '299 zł',
    };

    // FREE
    if (user.role === 'free') {
      return NextResponse.json({
        role: 'free',
        plan: 'planFree',
        planDescription: 'planDescriptionFree',
        features: [
          'featureFree1', // Zmienione na unikalne klucze
          'featureFree2',
          'featureFree3',
        ],
        limitation: 'limitationPublish', // Klucz tłumaczenia
        upgradeRequired: true,
        subscriptionStatus: null,
        nextBillingDate: null,
      });
    }

    // FREE_VER (trial)
    if (user.role === 'free_ver') {
      return NextResponse.json({
        role: 'free_ver',
        plan: 'planRookieTrial', // Klucz
        planDescription: 'planDescriptionRookieTrial', // Klucz
        isTrialing: true,
        nextBillingDate: user.nextBillingDate,
        nextBillingAmount: planPrices.rookie,
        paymentVerifiedAt: user.paymentVerifiedAt,
        features: [
          'featureRookie1', // 3 funkcje Rookie
          'featureRookie2',
          'featureRookie3',
        ],
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
      });
    }

    // Definicje planów i funkcji
    const planDetails: Record<string, { planKey: string, descriptionKey: string, features: string[] }> = {
      rookie: {
        planKey: 'planRookie',
        descriptionKey: 'planDescriptionRookie',
        features: ['featureRookie1', 'featureRookie2', 'featureRookie3'],
      },
      creator: {
        planKey: 'planCreator',
        descriptionKey: 'planDescriptionCreator',
        features: ['featureCreator1', 'featureCreator2', 'featureCreator3'],
      },
      unlimited: {
        planKey: 'planUnlimited',
        descriptionKey: 'planDescriptionUnlimited',
        features: ['featureUnlimited1', 'featureUnlimited2', 'featureUnlimited3'],
      },
    };

    // ROOKIE, CREATOR, UNLIMITED
    const userPlanKey = user.role.toLowerCase();
    const activePlans = ['rookie', 'creator', 'unlimited'];

    if (activePlans.includes(userPlanKey)) {
      const details = planDetails[userPlanKey];

      return NextResponse.json({
        role: user.role,
        plan: details.planKey,
        planDescription: details.descriptionKey,
        features: details.features,
        isTrialing: false,
        subscriptionStatus: user.subscriptionStatus,
        nextBillingDate: user.nextBillingDate,
        nextBillingAmount: planPrices[userPlanKey],
        paymentVerifiedAt: user.paymentVerifiedAt,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
      });
    }

    // Fallback
    return NextResponse.json({
      role: user.role,
      plan: user.role,
      planDescription: 'Plan specjalny',
      subscriptionStatus: user.subscriptionStatus,
      nextBillingDate: user.nextBillingDate,
    });

  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}