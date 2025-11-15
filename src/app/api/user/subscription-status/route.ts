// src/app/api/user/subscription-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client'; // Importujemy Enum Role

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. ZMIANA: Pobieramy 'role' zamiast 'subscriptionStatus'
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        trialEndsAt: true,
        subscriptionEndsAt: true, // Pobieramy dla pewności, choć rola jest główna
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    let canPublish = false;
    let reason = '';
    let action: 'VERIFY_PAYMENT' | 'SUBSCRIBE' | null = null;
    let isInTrial = false;

    // 2. ZMIANA: Logika oparta w całości na 'role'
    switch (user.role) {
      case Role.free:
        // Użytkownik 'free' (nowy) -> musi zweryfikować kartę, aby zacząć trial
        canPublish = false;
        reason = 'Aby opublikować stronę, musisz rozpocząć 21-dniowy okres próbny przez weryfikację płatności.';
        action = 'VERIFY_PAYMENT';
        break;

      case Role.free_ver:
        // Użytkownik w trakcie triala ('free_ver')
        isInTrial = user.trialEndsAt ? now <= user.trialEndsAt : false;

        if (isInTrial) {
          canPublish = true;
          reason = 'Możesz publikować, jesteś w okresie próbnym.';
        } else {
          // Trial się skończył, ale rola jeszcze się nie zaktualizowała (np. webhook nie dotarł)
          canPublish = false;
          reason = 'Twój okres próbny wygasł. Wykup subskrypcję, aby kontynuować.';
          action = 'SUBSCRIBE';
        }
        break;

      case Role.rookie:
      case Role.creator:
      case Role.unlimited:
      case Role.GOD:
      case Role.admin:
        // Użytkownicy z aktywnym planem lub admini
        // Zakładamy, że jeśli rola jest płatna, to subskrypcja jest aktywna
        // (Webhooki dbają o degradację roli w razie braku płatności)
        canPublish = true;
        reason = 'Masz aktywny plan lub uprawnienia administratora.';
        break;

      default:
        // Wszelkie inne przestarzałe role (demo, payd, premium itp.)
        canPublish = false;
        reason = 'Nie masz uprawnień do publikowania. Wykup subskrypcję.';
        action = 'SUBSCRIBE';
    }

    return NextResponse.json({
      canPublish,
      reason,
      action,
      status: user.role, // Zwracamy 'role' jako 'status'
      isInTrial,
      trialEndsAt: user.trialEndsAt,
      // 'hasPaymentVerified' jest teraz tożsame z tym, czy rola jest inna niż 'free'
      hasPaymentVerified: user.role !== Role.free
    });

  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}