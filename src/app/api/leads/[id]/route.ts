import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { encryptData, decryptData } from '@/lib/encryption';

// Interfejsy dla typowania
interface RouteParams {
  id: string;
}

interface UpdateLeadRequest {
  status?: string;
  buy_now?: boolean;
  comment?: string;
}

interface UpdateLeadData {
  status?: string;
  buyNow?: boolean;
  comment?: string;
}

interface DeleteResponse {
  success: true;
  message: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * Aktualizuje pojedynczy lead (np. jego status lub komentarz).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse<any | ErrorResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Brak autoryzacji' },
        { status: 401 }
      );
    }

    // Await params - to jest kluczowa zmiana dla Next.js 15+
    const params = await context.params;
    const leadId = parseInt(params.id, 10);

    if (isNaN(leadId)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy identyfikator leada' },
        { status: 400 }
      );
    }

    const body: UpdateLeadRequest = await request.json();
    const { status, buy_now, comment } = body;

    const lead = await prisma.leads.findUnique({
      where: { id: leadId }
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Nie znaleziono leada' },
        { status: 404 }
      );
    }

    if (session.user.role !== 'admin' && lead.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Brak uprawnień do edycji tego leada' },
        { status: 403 }
      );
    }

    const updateData: UpdateLeadData = {};

    if (status !== undefined) {
      updateData.status = status;
    }
    if (buy_now !== undefined) {
      updateData.buyNow = buy_now;
    }
    if (comment !== undefined) {
      updateData.comment = encryptData(comment); // Szyfrujemy komentarz
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Brak danych do aktualizacji' },
        { status: 400 }
      );
    }

    const updatedLead = await prisma.leads.update({
      where: { id: leadId },
      data: updateData,
    });

    return NextResponse.json(updatedLead);

  } catch (error) {
    console.error('Błąd podczas aktualizacji leada:', error);
    return NextResponse.json(
      {
        error: 'Błąd serwera podczas aktualizacji leada',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Usuwa pojedynczy lead.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
): Promise<NextResponse<DeleteResponse | ErrorResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Brak autoryzacji' },
        { status: 401 }
      );
    }

    // Await params - to jest kluczowa zmiana dla Next.js 15+
    const params = await context.params;
    const leadId = parseInt(params.id, 10);

    if (isNaN(leadId)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy identyfikator leada' },
        { status: 400 }
      );
    }

    const lead = await prisma.leads.findUnique({
      where: { id: leadId }
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Nie znaleziono leada' },
        { status: 404 }
      );
    }

    if (session.user.role !== 'admin' && lead.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Brak uprawnień do usunięcia tego leada' },
        { status: 403 }
      );
    }

    await prisma.leads.delete({
      where: { id: leadId },
    });

    return NextResponse.json({
      success: true,
      message: 'Lead został pomyślnie usunięty'
    });

  } catch (error) {
    console.error('Błąd podczas usuwania leada:', error);
    return NextResponse.json(
      {
        error: 'Błąd serwera podczas usuwania leada',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}