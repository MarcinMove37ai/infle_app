// app/api/stripe/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

// Słownik tłumaczeń
const TRANSLATIONS: Record<string, any> = {
  pl: {
    subscriptionFee: 'Opłata subskrypcyjna',
    oneTimePayment: 'Płatność jednorazowa',
    upgradeDesc: (from: string, to: string) => `Upgrade planu: ${capitalize(from)} -> ${capitalize(to)}`,
    creation: 'Utworzenie subskrypcji',
    update: 'Aktualizacja subskrypcji',
  },
  en: {
    subscriptionFee: 'Subscription fee',
    oneTimePayment: 'One-time payment',
    upgradeDesc: (from: string, to: string) => `Plan upgrade: ${capitalize(from)} -> ${capitalize(to)}`,
    creation: 'Subscription creation',
    update: 'Subscription update',
  }
};

const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// Funkcja ustalająca opis w odpowiednim języku
function resolveDescription(stripeDescription: string | null | undefined, metadata: any, t: any) {
  // 1. Priorytet: Upgrade (z metadanych)
  if (metadata?.type === 'upgrade_onetime' || metadata?.type === 'upgrade_proration_fee') {
    const fromPlan = metadata.fromPlan || metadata.upgradedFrom || '?';
    const toPlan = metadata.toPlan || metadata.planName || '?';
    return t.upgradeDesc(fromPlan, toPlan);
  }

  // 2. Jeśli brak opisu ze Stripe, użyj domyślnego
  if (!stripeDescription) {
    return t.subscriptionFee;
  }

  // 3. Tłumaczenie standardowych tekstów Stripe
  if (stripeDescription === 'Subscription creation') return t.creation;
  if (stripeDescription === 'Subscription update') return t.update;

  // 4. W ostateczności zwróć oryginał
  return stripeDescription;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Pobierz język z URL (przekazany z Frontendu)
    const { searchParams } = new URL(req.url);
    const queryLocale = searchParams.get('locale');

    // Ustal język: jeśli 'en' to 'en', w przeciwnym razie 'pl'
    const locale = queryLocale === 'en' ? 'en' : 'pl';
    const t = TRANSLATIONS[locale];

    // 2. Autoryzacja
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Pobierz użytkownika
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        stripeCustomerId: true,
      },
    });

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ invoices: [] });
    }

    // 4. Pobierz dane ze Stripe (Faktury + Sesje)
    const invoicesPromise = stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 100,
      status: 'paid',
    });

    const sessionsPromise = stripe.checkout.sessions.list({
      customer: user.stripeCustomerId,
      limit: 100,
      status: 'complete',
      expand: ['data.payment_intent', 'data.line_items'],
    });

    const [invoicesData, sessionsData] = await Promise.all([invoicesPromise, sessionsPromise]);

    // 5. Przetwórz Faktury
    const formattedInvoices = invoicesData.data.map(invoice => {
      const meta = invoice.metadata || {};

      return {
        id: invoice.id,
        number: invoice.number,
        date: invoice.created * 1000,
        amount: invoice.total,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        pdfUrl: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url,

        // Tłumaczenie opisu
        description: resolveDescription(invoice.description, meta, t),

        lines: invoice.lines.data.map(line => ({
          description: line.description,
          amount: line.amount,
        })),
        sourceType: 'invoice'
      };
    });

    // 6. Przetwórz Sesje (tylko te bez faktur)
    const formattedSessions = sessionsData.data
      .filter(session => !session.invoice)
      .map(session => {
        const firstLineItem = session.line_items?.data[0];
        const rawDescription = firstLineItem?.description;
        const meta = session.metadata || {};

        let finalDescription = resolveDescription(rawDescription, meta, t);

        if (!rawDescription && finalDescription === rawDescription) {
             finalDescription = t.oneTimePayment;
        }

        return {
          id: session.id,
          number: null,
          date: session.created * 1000,
          amount: session.amount_total || 0,
          currency: (session.currency || 'pln').toUpperCase(),
          status: session.payment_status,
          pdfUrl: null,
          hostedUrl: session.url,

          description: finalDescription,

          lines: session.line_items?.data.map(line => ({
            description: line.description,
            amount: line.amount_total,
          })) || [],
          sourceType: 'session'
        };
      });

    // 7. Sortuj i zwróć
    const history = [...formattedInvoices, ...formattedSessions].sort((a, b) => b.date - a.date);

    return NextResponse.json({
      invoices: history,
    });

  } catch (error: any) {
    console.error('[Billing History] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch billing history',
        details: error.message
      },
      { status: 500 }
    );
  }
}