// src/app/api/reel/[pageId]/generate/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiKeyForEndpoint } from "@/lib/user-api-keys";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minut na TTS + render wideo

// ─── Typy ────────────────────────────────────────────────────────────────────

interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsTTSResponse {
  audio_base64: string;
  alignment: AlignmentData;
  normalized_alignment: AlignmentData;
}

interface TimestampEntry {
  character: string;
  start_time: number;
  end_time: number;
}

interface CaptionFile {
  text: string;
  timestamps: TimestampEntry[];
  duration: number;
  character_count: number;
}

// ─── Konfiguracja głosów ─────────────────────────────────────────────────────

const VOICE_IDS: Record<string, string> = {
  MALE: "P9yx385KN0FOmLll8Lkx",
  FEMALE: "Qvbf0AoA7UZSgJUp8Ba5",
};

// ─── Helpers: ścieżki plików (Wzorzec A) ────────────────────────────────────

function getStoragePaths(userId: string, pageId: string) {
  const storageBasePath = process.env.FILE_STORAGE_PATH || "/data";
  const uploadsDir = join(storageBasePath, "uploads");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const audioFileName = `${userId}_REEL_${pageId}_audio.mp3`;
  const timestampsFileName = `${userId}_REEL_${pageId}_timestamps.json`;
  const rawTextFileName = `${userId}_REEL_${pageId}_rawtext.txt`;
  const videoFileName = `${userId}_REEL_${pageId}_video.mp4`;
  const configFileName = `${userId}_REEL_${pageId}_config.json`;

  return {
    uploadsDir,
    audio: {
      filePath: join(uploadsDir, audioFileName),
      dbUrl: `${baseUrl}/api/assets/uploads/${audioFileName}`,
      fileName: audioFileName,
    },
    timestamps: {
      filePath: join(uploadsDir, timestampsFileName),
      dbUrl: `${baseUrl}/api/assets/uploads/${timestampsFileName}`,
      fileName: timestampsFileName,
    },
    rawText: {
      filePath: join(uploadsDir, rawTextFileName),
      dbUrl: `${baseUrl}/api/assets/uploads/${rawTextFileName}`,
      fileName: rawTextFileName,
    },
    video: {
      filePath: join(uploadsDir, videoFileName),
      dbUrl: `${baseUrl}/api/assets/uploads/${videoFileName}`,
      fileName: videoFileName,
    },
    config: {
      filePath: join(uploadsDir, configFileName),
      fileName: configFileName,
    },
  };
}

// ─── TTS via ElevenLabs ─────────────────────────────────────────────────────

async function generateTTS(
  text: string,
  voiceId: string,
  elevenlabsApiKey: string
): Promise<{ audioBuffer: Buffer; captionData: CaptionFile }> {
  // Buffer z kropkami (identycznie jak w istniejącym route tts)
  const textWithBuffer = `........................................${text.trim()}........................................`;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": elevenlabsApiKey,
      },
      body: JSON.stringify({
        text: textWithBuffer,
        model_id: "eleven_v3",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          use_speaker_boost: true,
        },
        language_code: null,
        output_format: "mp3_44100_128",
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${errorText}`);
  }

  const data: ElevenLabsTTSResponse = await response.json();

  const audioBuffer = Buffer.from(data.audio_base64, "base64");

  const timestampEntries: TimestampEntry[] = data.alignment.characters.map(
    (char, index) => ({
      character: char,
      start_time: data.alignment.character_start_times_seconds[index],
      end_time: data.alignment.character_end_times_seconds[index],
    })
  );

  const captionData: CaptionFile = {
    text: text.trim(),
    timestamps: timestampEntries,
    duration:
      data.alignment.character_end_times_seconds[
        data.alignment.character_end_times_seconds.length - 1
      ],
    character_count: data.alignment.characters.length,
  };

  return { audioBuffer, captionData };
}

// ─── POST /api/reels/[pageId]/generate ──────────────────────────────────────

type RouteContext = { params: Promise<{ pageId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const { pageId } = await context.params;
  const userId = session.user.id;

  try {
    // ── 0. Odczytaj body (ttsText, selectedCtaKey) ──
    let ttsText = '';
    let selectedCtaKey: string | null = null;
    try {
      const body = await request.json();
      ttsText = (body.ttsText || '').trim();
      selectedCtaKey = body.selectedCtaKey ?? null;
    } catch {
      // Pusty body — dozwolone (backward compat)
    }

    // ── 1. Pobierz reel z bazy ──
    const reel = await prisma.reels.findUnique({ where: { pageId } });

    if (!reel) {
      return NextResponse.json(
        { error: "Reel nie znaleziony. Najpierw zapisz konfigurację." },
        { status: 404 }
      );
    }
    if (reel.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── 2. Tekst TTS: z body (frontend skomponował) lub fallback na reelIntro ──
    if (!ttsText) {
      ttsText = (reel.reelIntro || '').trim();
    }

    if (!ttsText || ttsText.length === 0) {
      return NextResponse.json(
        { error: "Brak tekstu do wygenerowania TTS — uzupełnij reelIntro lub wybierz wariant CTA." },
        { status: 400 }
      );
    }

    console.log(`📝 [reel-generate] TTS text (${ttsText.length} chars):`);
    console.log(`   "${ttsText.substring(0, 150)}${ttsText.length > 150 ? '...' : ''}"`);

    // ── 3. Klucz API ElevenLabs ──
    const { apiKey: elevenlabsApiKey, source: keySource } =
      await getApiKeyForEndpoint(userId, "elevenlabs", "ELEVENLABS_API_KEY");

    if (!elevenlabsApiKey) {
      return NextResponse.json(
        { error: "Brak klucza API ElevenLabs" },
        { status: 500 }
      );
    }

    // ── 4. Wybór głosu ──
    const gender = reel.audioGender === "FEMALE" ? "FEMALE" : "MALE";
    const voiceId = VOICE_IDS[gender];

    console.log(`🎤 [reel-generate] TTS start | page=${pageId} voice=${gender}`);

    // ── 5. Generowanie TTS ──
    const { audioBuffer, captionData } = await generateTTS(
      ttsText,
      voiceId,
      elevenlabsApiKey
    );

    console.log(
      `   ✅ TTS gotowe (${captionData.duration.toFixed(1)}s, ${(audioBuffer.length / 1024).toFixed(0)}KB)`
    );

    // ── 6. Zapis plików na dysk (Wzorzec A) ──
    const paths = getStoragePaths(userId, pageId);

    if (!existsSync(paths.uploadsDir)) {
      await mkdir(paths.uploadsDir, { recursive: true });
    }

    await Promise.all([
      writeFile(paths.audio.filePath, audioBuffer),
      writeFile(
        paths.timestamps.filePath,
        JSON.stringify(captionData, null, 2),
        "utf-8"
      ),
      writeFile(paths.rawText.filePath, ttsText.trim(), "utf-8"),
    ]);

    console.log(`   💾 Pliki zapisane:`);
    console.log(`      audio:      ${paths.audio.fileName}`);
    console.log(`      timestamps:  ${paths.timestamps.fileName}`);
    console.log(`      rawtext:     ${paths.rawText.fileName}`);

    // ── 7. Aktualizacja bazy — audio + timestamps ──
    await prisma.reels.update({
      where: { pageId },
      data: {
        audioURL: paths.audio.dbUrl,
        timestampURL: paths.timestamps.dbUrl,
      },
    });

    console.log(`   ✅ [reel-generate] TTS zapisane do bazy`);

    // ── 8. Przygotuj config override dla reels.js ──
    const coverParams = (reel.coverParams as { scale?: number; positionX?: number; positionY?: number; seed?: number } | null) || {};

    // Tekst CTA: parsuj format "comment;HASŁO"
    let ctaDisplayText = "Pobierz darmowy E-BOOK";
    if (reel.reelCTA) {
      if (reel.reelCTA === "download") {
        ctaDisplayText = "Pobierz darmowy E-BOOK";
      } else if (reel.reelCTA.startsWith("comment;")) {
        const keyword = reel.reelCTA.substring("comment;".length);
        ctaDisplayText = `Skomentuj "${keyword}" aby pobrać`;
      } else if (reel.reelCTA === "comment") {
        ctaDisplayText = "Skomentuj aby pobrać";
      }
    }

    // Ścieżka do cover image
    let coverImagePath: string | null = null;
    if (reel.reelCover) {
      const storageBasePath = process.env.FILE_STORAGE_PATH || "/data";
      const coverFile = reel.reelCover.startsWith("/uploads/")
        ? reel.reelCover.substring("/uploads/".length)
        : reel.reelCover;
      const candidatePath = join(storageBasePath, "uploads", coverFile);
      if (existsSync(candidatePath)) {
        coverImagePath = candidatePath;
      }
    }

    const configOverride = {
      header: { text: reel.reelHeader || "Ebook, którego potrzebujesz" },
      cta: { text: ctaDisplayText },
      marker: {
        enabled: coverParams.markerEnabled ?? true,
        seed: coverParams.seed ?? 42,
        renderScale: coverParams.scale ?? 1.0,
        renderOffsetY: coverParams.positionY ?? 0.0,
      },
      ...(coverImagePath ? { cover: { imagePath: coverImagePath } } : {}),
    };

    await writeFile(paths.config.filePath, JSON.stringify(configOverride, null, 2), "utf-8");
    console.log(`   📋 Config override: ${paths.config.fileName}`);

    // ── 9. Generowanie wideo (reels.js) ──
    const reelsScript = join(process.cwd(), "reels", "reels.js");
    if (!existsSync(reelsScript)) {
      throw new Error(`Brak skryptu reels.js: ${reelsScript}`);
    }

    console.log(`🎬 [reel-generate] Rendering wideo...`);
    const { stdout, stderr } = await execFileAsync(
      "node",
      [reelsScript, paths.audio.filePath, paths.timestamps.filePath, paths.rawText.filePath, paths.config.filePath],
      {
        timeout: 420_000,
        maxBuffer: 10 * 1024 * 1024,
        cwd: join(process.cwd(), "reels"),
      }
    );
    if (stdout) console.log("[reels.js]", stdout);
    if (stderr) console.warn("[reels.js stderr]", stderr);

    // reels.js generuje: {audio_base}_grounded_echo.mp4 obok pliku audio
    const generatedMp4 = paths.audio.filePath.replace(".mp3", "_grounded_echo.mp4");
    if (!existsSync(generatedMp4)) {
      throw new Error(`reels.js nie wygenerował pliku: ${generatedMp4}`);
    }

    // ── 10. Przenieś mp4 do docelowej nazwy ──
    const { renameSync } = require("fs");
    renameSync(generatedMp4, paths.video.filePath);
    console.log(`   💾 Video: ${paths.video.fileName}`);

    // Sprzątanie pliku config
    try { await unlink(paths.config.filePath); } catch {}

    // ── 11. Aktualizacja bazy — reelURL ──
    await prisma.reels.update({
      where: { pageId },
      data: {
        reelURL: paths.video.dbUrl,
      },
    });

    console.log(`   ✅ [reel-generate] Pełny pipeline zakończony`);

    return NextResponse.json({
      success: true,
      audioURL: paths.audio.dbUrl,
      timestampURL: paths.timestamps.dbUrl,
      reelURL: paths.video.dbUrl,
      metadata: {
        duration: captionData.duration,
        audioSize: audioBuffer.length,
        voiceId,
        gender,
        keySource,
        ttsTextLength: ttsText.length,
        selectedCtaKey,
      },
    });
  } catch (error) {
    console.error("❌ [reel-generate] Błąd:", error);
    return NextResponse.json(
      {
        error: "Błąd generowania TTS",
        details: error instanceof Error ? error.message : "Nieznany błąd",
      },
      { status: 500 }
    );
  }
}