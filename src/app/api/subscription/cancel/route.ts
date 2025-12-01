import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as any,
});

export async function POST(req: NextRequest) {
  try {
    // 1. Autoryzacja
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Pobierz dane użytkownika (potrzebujemy ROLI, aby rozróżnić logikę)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        stripeSubscriptionId: true,
        role: true, // <--- KLUCZOWE: Sprawdzamy, czy to trial
      },
    });

    if (!user || !user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Brak aktywnej subskrypcji.' }, { status: 404 });
    }

    // --- SCENARIUSZ A: TRIAL (free_ver) -> NATYCHMIASTOWA ŚMIERĆ ---
    // Jeśli user jest na trialu, anulujemy od razu i zabieramy dostęp.
    if (user.role === 'free_ver') {

      // A1. Anuluj w Stripe natychmiast (bez czekania na koniec okresu)
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (err) {
        console.error('Błąd anulowania w Stripe (może już anulowana?):', err);
        // Kontynuujemy, żeby posprzątać w bazie
      }

      // A2. Natychmiastowa degradacja w Bazie Danych
      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          role: 'demo', // Koniec zabawy, wracamy do demo
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: null, // Odpinamy subskrypcję, bo została skasowana
          nextBillingDate: null,
          // WAŻNE: Zostawiamy stripeCustomerId, żeby zachować historię klienta!
        },
      });

      return NextResponse.json({
        status: 'cancelled_immediately',
        message: 'Okres próbny został przerwany. Dostęp został cofnięty.',
        newRole: 'demo'
      });
    }

    // --- SCENARIUSZ B: PŁATNY PLAN (rookie/creator) -> GRACEFUL CANCEL ---
    else {

      // B1. Sprawdź status w Stripe
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      if (subscription.cancel_at_period_end) {
        return NextResponse.json({ message: 'Anulowanie zostało już zaplanowane wcześniej.' });
      }

      // B2. Ustaw flagę "Nie odnawiaj" w Stripe
      const updatedSub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // B3. Zaktualizuj status w bazie (ALE ZACHOWAJ ROLĘ!)
      // To pozwoli wyświetlić komunikat: "Twoja subskrypcja wygasa [Data]"
      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          subscriptionStatus: 'canceled', // UI wie, że to koniec odnawiania
          // Aktualizujemy datę na moment faktycznego wygaśnięcia
          nextBillingDate: updatedSub.cancel_at
            ? new Date(updatedSub.cancel_at * 1000)
            : null,
        },
      });

      return NextResponse.json({
        status: 'cancel_scheduled',
        ends_at: updatedSub.cancel_at
          ? new Date(updatedSub.cancel_at * 1000).toISOString()
          : null,
        message: 'Subskrypcja wygaśnie po zakończeniu opłaconego okresu.',
      });
    }

  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}