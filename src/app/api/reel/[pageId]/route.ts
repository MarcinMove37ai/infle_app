// src/app/api/reels/[pageId]/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AudioGender } from "@prisma/client";

type RouteContext = { params: Promise<{ pageId: string }> };

// ─── GET /api/reels/[pageId] — pobierz reel dla strony ──────────────────────

export async function GET(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await context.params;

  try {
    const reel = await prisma.reels.findUnique({ where: { pageId } });

    if (!reel) {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    }
    if (reel.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(reel);
  } catch (error) {
    console.error("[GET /api/reels] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/reels/[pageId] — utwórz reel dla strony ─────────────────────

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await context.params;

  try {
    const body = await request.json();

    const page = await prisma.pages.findUnique({
      where: { id: pageId },
      select: { userId: true, ebookId: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    if (page.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.reels.findUnique({ where: { pageId } });
    if (existing) {
      return NextResponse.json(
        { error: "Reel already exists for this page. Use PUT to update." },
        { status: 409 }
      );
    }

    const reel = await prisma.reels.create({
      data: {
        pageId,
        userId: session.user.id,
        ebookId: body.ebookId ?? page.ebookId ?? null,
        reelIntro: body.reelIntro ?? null,
        reelCover: body.reelCover ?? null,
        reelHeader: body.reelHeader ?? null,
        reelCTA: body.reelCTA ?? null,
        CTAtext: body.CTAtext ?? null,
        coverParams: body.coverParams ?? null,
        audioGender: validateAudioGender(body.audioGender),
        audioURL: body.audioURL ?? null,
        timestampURL: body.timestampURL ?? null,
        reelURL: body.reelURL ?? null,
      },
    });

    return NextResponse.json(reel, { status: 201 });
  } catch (error) {
    console.error("[POST /api/reels] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PUT /api/reels/[pageId] — aktualizuj reel ─────────────────────────────

export async function PUT(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await context.params;

  try {
    const body = await request.json();

    const existing = await prisma.reels.findUnique({ where: { pageId } });
    if (!existing) {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.reelIntro !== undefined) updateData.reelIntro = body.reelIntro;
    if (body.reelCover !== undefined) updateData.reelCover = body.reelCover;
    if (body.reelHeader !== undefined) updateData.reelHeader = body.reelHeader;
    if (body.reelCTA !== undefined) updateData.reelCTA = body.reelCTA;
    if (body.CTAtext !== undefined) updateData.CTAtext = body.CTAtext;
    if (body.coverParams !== undefined) updateData.coverParams = body.coverParams;
    if (body.audioGender !== undefined) updateData.audioGender = validateAudioGender(body.audioGender);
    if (body.audioURL !== undefined) updateData.audioURL = body.audioURL;
    if (body.timestampURL !== undefined) updateData.timestampURL = body.timestampURL;
    if (body.reelURL !== undefined) updateData.reelURL = body.reelURL;
    if (body.ebookId !== undefined) updateData.ebookId = body.ebookId;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const reel = await prisma.reels.update({ where: { pageId }, data: updateData });

    return NextResponse.json(reel);
  } catch (error) {
    console.error("[PUT /api/reels] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/reels/[pageId] — usuń reel ────────────────────────────────

export async function DELETE(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pageId } = await context.params;

  try {
    const existing = await prisma.reels.findUnique({ where: { pageId } });
    if (!existing) {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.reels.delete({ where: { pageId } });

    return NextResponse.json({ success: true, deleted: pageId });
  } catch (error) {
    console.error("[DELETE /api/reels] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function validateAudioGender(value: unknown): AudioGender | null {
  if (value === "MALE" || value === "FEMALE") return value;
  return null;
}