// src/app/api/user/subscription-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Pobierz rolę użytkownika
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prosta logika: każdy z rolą inną niż 'free' może publikować
    const canPublish = user.role !== Role.free;
    const reason = canPublish
      ? 'Masz aktywny plan.'
      : 'Aby opublikować stronę, musisz mieć aktywny plan.';

    return NextResponse.json({
      canPublish,
      reason,
      action: canPublish ? null : 'SUBSCRIBE',
      status: user.role,
    });

  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}