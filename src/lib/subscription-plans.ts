export type PlanId = 'rookie' | 'creator' | 'unlimited';

export interface PlanConfig {
  id: PlanId;
  name: string;
  role: 'rookie' | 'creator' | 'unlimited';
  priceCard: {
    amount: number;
    currency: string;
    interval: 'month';
    stripePriceId: string;
  };
  priceBlik: {
    amount: number;
    currency: string;
    stripePriceId: string;
  };
  trialDays?: number;
  requiresCardVerification: boolean;
  features: {
    maxEbooks: number;
    maxSources: number;
    maxChapters: number;
    maxLandingPages: number;
    maxContacts: number;
    hasBranding: boolean;
    supportTime: string;
    hasCollabOffer?: boolean;
  };
}

export const SUBSCRIPTION_PLANS: Record<PlanId, PlanConfig> = {
  rookie: {
    id: 'rookie',
    name: 'Rookie',
    role: 'rookie',
    priceCard: {
      amount: 37,
      currency: 'PLN',
      interval: 'month',
      stripePriceId: process.env.STRIPE_ROOKIE_CARD_PRICE_ID!,
    },
    priceBlik: {
      amount: 87,
      currency: 'PLN',
      stripePriceId: process.env.STRIPE_ROOKIE_BLIK_PRICE_ID!,
    },
    trialDays: 21,
    requiresCardVerification: true,
    features: {
      maxEbooks: 1,
      maxSources: 1,
      maxChapters: 6,
      maxLandingPages: 1,
      maxContacts: 100,
      hasBranding: true,
      supportTime: '72h',
    },
  },
  // Będziemy dodawać creator i unlimited później
  creator: {
    id: 'creator',
    name: 'Creator',
    role: 'creator',
    priceCard: {
      amount: 87,
      currency: 'PLN',
      interval: 'month',
      stripePriceId: '', // TODO
    },
    priceBlik: {
      amount: 0, // TODO
      currency: 'PLN',
      stripePriceId: '', // TODO
    },
    trialDays: 0,
    requiresCardVerification: false,
    features: {
      maxEbooks: 5,
      maxSources: 5,
      maxChapters: 12,
      maxLandingPages: 5,
      maxContacts: 1000,
      hasBranding: true,
      supportTime: '24h',
      hasCollabOffer: true,
    },
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    role: 'unlimited',
    priceCard: {
      amount: 297,
      currency: 'PLN',
      interval: 'month',
      stripePriceId: '', // TODO
    },
    priceBlik: {
      amount: 0, // TODO
      currency: 'PLN',
      stripePriceId: '', // TODO
    },
    trialDays: 0,
    requiresCardVerification: false,
    features: {
      maxEbooks: -1, // unlimited
      maxSources: -1,
      maxChapters: -1,
      maxLandingPages: -1,
      maxContacts: -1,
      hasBranding: false,
      supportTime: '3h',
    },
  },
};