import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { encryptData, decryptData } from '@/lib/encryption';

interface LeadStats {
  total: number;
  active: number;
  new: number;
  contacted: number;
  archived: number;
}

interface FormattedLead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  comment: string | null;
  source: string;
  page: string;
  createdAt: string;
  creator: string;
  opiekun: string | null;
  buyNow: boolean;
  status: string;
  creatorId: string;
}

interface LeadsResponse {
  leads: FormattedLead[];
  stats: LeadStats;
}

interface CreateLeadRequest {
  pageId: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  buyNow?: boolean;
  status?: string;
}

/**
 * Pobiera listę leadów z filtrowaniem, wyszukiwaniem i statystykami po stronie serwera.
 */
export async function GET(request: NextRequest): Promise<NextResponse<LeadsResponse | { error: string; details?: string }>> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json(
        { error: 'Brak autoryzacji' },
        { status: 401 }
      );
    }

    const { id: sessionUserId, role: userRole } = session.user;
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('search');
    const statusFilter = searchParams.get('status');

    // Bazowe warunki dla zapytań - admin widzi wszystko, user tylko swoje
    const baseWhereClause = {
      ...(userRole !== 'admin' && { userId: sessionUserId }),
    };

    // --- 1. Pobieranie statystyk ---
    // Pobieramy statystyki ze wszystkich leadów użytkownika, niezależnie od filtra statusu
    const statsData = await prisma.leads.groupBy({
      by: ['status'],
      where: baseWhereClause,
      _count: {
        status: true,
      },
    });

    const stats: LeadStats = { total: 0, active: 0, new: 0, contacted: 0, archived: 0 };

    statsData.forEach(item => {
      const count = item._count.status;
      stats.total += count;

      if (item.status === 'b_contact') {
        stats.new += count;
        stats.active += count;
      } else if (item.status === 'a_contact') {
        stats.contacted += count;
        stats.active += count;
      } else if (item.status === 'archive') {
        stats.archived += count;
      }
    });

    // --- 2. Pobieranie i filtrowanie leadów ---
    const leadsWhereClause: any = { ...baseWhereClause };

    // Dodaj warunek filtrowania po statusie
    if (statusFilter && statusFilter !== 'all') {
      switch (statusFilter) {
        case 'active':
          leadsWhereClause.status = { in: ['b_contact', 'a_contact'] };
          break;
        case 'new':
          leadsWhereClause.status = 'b_contact';
          break;
        case 'contacted':
          leadsWhereClause.status = 'a_contact';
          break;
        case 'archived':
          leadsWhereClause.status = 'archive';
          break;
        default:
          break;
      }
    }

    // Pobieramy leady z uwzględnieniem filtra statusu
    const leads = await prisma.leads.findMany({
      where: leadsWhereClause,
      orderBy: {
        leadTimestamp: 'desc',
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        page: {
          select: {
            title: true
          }
        },
      },
    });

    // Deszyfrujemy dane, aby móc po nich wyszukiwać
    const formattedLeads: FormattedLead[] = leads.map(lead => ({
      id: lead.id.toString(), // Konwertuj number na string
      name: decryptData(lead.leadName),
      email: decryptData(lead.leadEmail),
      phone: lead.leadPhone ? decryptData(lead.leadPhone) : null,
      comment: lead.comment ? decryptData(lead.comment) : null,
      source: lead.leadType || 'unknown', // Dodaj fallback dla null
      page: lead.page?.title || lead.pageName || 'Nieznana strona',
      createdAt: lead.leadTimestamp?.toISOString() || new Date().toISOString(),
      creator: lead.user ? `${lead.user.firstName} ${lead.user.lastName}`.trim() : 'Nieznany',
      opiekun: lead.supervisorCode,
      buyNow: lead.buyNow || false, // Konwertuj null na false
      status: lead.status || 'b_contact',
      creatorId: lead.userId || '', // Dodaj fallback dla null
    }));

    // --- 3. Wyszukiwanie w pamięci po zdeszyfrowaniu danych ---
    const finalLeads = searchTerm
      ? formattedLeads.filter(lead =>
          lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.page.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : formattedLeads;

    return NextResponse.json({ leads: finalLeads, stats });

  } catch (error) {
    console.error('Błąd podczas pobierania leadów:', error);
    return NextResponse.json(
      {
        error: 'Błąd serwera podczas pobierania leadów',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Tworzy nowy lead (z SZYFROWANIEM).
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<{ success: true; leadId: string; message: string } | { error: string; details?: string }>> {
  try {
    const data: CreateLeadRequest = await request.json();

    const requiredFields: (keyof CreateLeadRequest)[] = ['pageId', 'leadName', 'leadEmail'];

    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { error: `Brak wymaganego pola: ${field}` },
          { status: 400 }
        );
      }
    }

    const pageInfo = await prisma.pages.findUnique({
      where: { id: data.pageId },
    });

    if (!pageInfo) {
      return NextResponse.json(
        { error: 'Nie znaleziono strony o podanym ID' },
        { status: 404 }
      );
    }

    const newLead = await prisma.leads.create({
      data: {
        pageId: data.pageId,
        pageName: pageInfo.title,
        leadType: pageInfo.type || 'ebook',
        userId: pageInfo.userId,
        leadName: encryptData(data.leadName),
        leadEmail: encryptData(data.leadEmail),
        leadPhone: data.leadPhone ? encryptData(data.leadPhone) : null,
        buyNow: data.buyNow || false,
        status: data.status || 'b_contact',
      }
    });

    await prisma.pages.update({
      where: { id: data.pageId },
      data: { leadsCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      leadId: newLead.id.toString(), // Konwertuj na string dla spójności
      message: 'Lead pomyślnie zapisany'
    }, { status: 201 });

  } catch (error) {
    console.error('Błąd podczas zapisywania leada:', error);
    return NextResponse.json(
      {
        error: 'Błąd serwera podczas zapisywania leada',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}