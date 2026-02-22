// src/app/api/reel/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint } from '@/lib/user-api-keys';
import { writeFile, mkdir, readFile, unlink, rename } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minut na generowanie

// ─── Typy ────────────────────────────────────────────────────────────────────

interface VoiceSettings {
  stability: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface ElevenLabsTTSRequest {
  text: string;
  model_id: string;
  voice_settings?: VoiceSettings;
  language_code?: string | null;
  output_format?: string;
}

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

// ─── Krok 1: Generowanie TTS ────────────────────────────────────────────────

async function generateTTS(text: string, elevenlabsApiKey: string, outputDir: string, timestamp: number) {
  // Buffer z kropkami (identycznie jak w route tts)
  const textWithBuffer = `........................................${text.trim()}........................................`;

  const requestBody: ElevenLabsTTSRequest = {
    text: textWithBuffer,
    model_id: 'eleven_v3',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
      use_speaker_boost: true
    },
    language_code: null,
    output_format: 'mp3_44100_128'
  };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/P9yx385KN0FOmLll8Lkx/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenlabsApiKey,
      },
      body: JSON.stringify(requestBody)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${errorText}`);
  }

  const responseData: ElevenLabsTTSResponse = await response.json();

  // Zapisz audio
  const audioFileName = `tts_${timestamp}.mp3`;
  const audioFilePath = join(outputDir, audioFileName);
  const audioBuffer = Buffer.from(responseData.audio_base64, 'base64');
  await writeFile(audioFilePath, audioBuffer);

  // Zapisz timestamps
  const timestampsFileName = `tts_${timestamp}_timestamps.json`;
  const timestampsFilePath = join(outputDir, timestampsFileName);

  const timestampEntries: TimestampEntry[] = responseData.alignment.characters.map(
    (char, index) => ({
      character: char,
      start_time: responseData.alignment.character_start_times_seconds[index],
      end_time: responseData.alignment.character_end_times_seconds[index]
    })
  );

  const captionData: CaptionFile = {
    text: text,
    timestamps: timestampEntries,
    duration: responseData.alignment.character_end_times_seconds[
      responseData.alignment.character_end_times_seconds.length - 1
    ],
    character_count: responseData.alignment.characters.length
  };

  await writeFile(timestampsFilePath, JSON.stringify(captionData, null, 2), 'utf-8');

  // Zapisz rawtext
  const rawTextFileName = `tts_${timestamp}_rawtext.txt`;
  const rawTextFilePath = join(outputDir, rawTextFileName);
  await writeFile(rawTextFilePath, text.trim(), 'utf-8');

  return {
    audioPath: audioFilePath,
    timestampsPath: timestampsFilePath,
    rawTextPath: rawTextFilePath,
    duration: captionData.duration,
    audioSize: audioBuffer.length,
  };
}

// ─── Krok 2: Generowanie rolki (reels.js) ──────────────────────────────────

async function generateReel(
  audioPath: string,
  timestampsPath: string,
  rawTextPath: string
): Promise<string> {
  const reelsScript = join(process.cwd(), 'reels', 'reels.js');

  if (!existsSync(reelsScript)) {
    throw new Error(`Brak skryptu reels.js: ${reelsScript}`);
  }

  // reels.js generuje output obok pliku audio: {base}_grounded_echo.mp4
  const { stdout, stderr } = await execFileAsync(
    'node',
    [reelsScript, audioPath, timestampsPath, rawTextPath],
    {
      timeout: 240_000, // 4 minuty max
      maxBuffer: 10 * 1024 * 1024,
      cwd: join(process.cwd(), 'reels'),
    }
  );

  if (stdout) console.log('[reels.js]', stdout);
  if (stderr) console.warn('[reels.js stderr]', stderr);

  // Znajdź wygenerowany plik MP4 (obok audio)
  const dir = join(audioPath, '..');
  const base = audioPath.replace(/\.mp3$/, '');
  const generatedMp4 = `${base}_grounded_echo.mp4`;

  if (!existsSync(generatedMp4)) {
    throw new Error(`reels.js nie wygenerował pliku: ${generatedMp4}`);
  }

  return generatedMp4;
}

// ─── Endpoint ────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  const t0 = Date.now();

  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Wymagany niepusty tekst w polu "text".' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const { apiKey: elevenlabsApiKey, source: keySource } = await getApiKeyForEndpoint(
      userId,
      'elevenlabs',
      'ELEVENLABS_API_KEY'
    );

    if (!elevenlabsApiKey) {
      return NextResponse.json(
        { error: 'Brak klucza API ElevenLabs' },
        { status: 500 }
      );
    }

    const timestamp = Date.now();

    // ── Katalogi ──
    const ttsDir = join(process.cwd(), 'reels', 'tts');
    const finalDir = join(process.cwd(), 'reels', 'final_reel');

    if (!existsSync(ttsDir)) await mkdir(ttsDir, { recursive: true });
    if (!existsSync(finalDir)) await mkdir(finalDir, { recursive: true });

    // ── Krok 1: TTS ──
    console.log(`🎤 [reel] Generowanie TTS...`);
    const tts = await generateTTS(text.trim(), elevenlabsApiKey, ttsDir, timestamp);
    console.log(`   ✅ TTS gotowe (${tts.duration.toFixed(1)}s audio)`);

    // ── Krok 2: Rolka ──
    console.log(`🎬 [reel] Generowanie wideo...`);
    const generatedMp4 = await generateReel(tts.audioPath, tts.timestampsPath, tts.rawTextPath);
    console.log(`   ✅ Wideo gotowe`);

    // ── Krok 3: Przenieś do final_reel ──
    const finalFileName = `reel_${timestamp}.mp4`;
    const finalPath = join(finalDir, finalFileName);
    await rename(generatedMp4, finalPath);

    // ── Krok 4: Sprzątanie plików tymczasowych ──
    const tempFiles = [tts.audioPath, tts.timestampsPath, tts.rawTextPath];
    // Plik padded (tmp_pad) - reels.js powinien go usunąć, ale na wszelki wypadek
    const paddedPath = tts.audioPath.replace('.mp3', '_tmp_pad.mp3');
    if (existsSync(paddedPath)) tempFiles.push(paddedPath);

    for (const f of tempFiles) {
      try { await unlink(f); } catch { /* ignore */ }
    }

    const totalTime = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✅ [reel] Gotowe w ${totalTime}s → ${finalPath}`);

    return NextResponse.json({
      success: true,
      file: {
        path: finalPath,
        relativePath: `reels/final_reel/${finalFileName}`,
        fileName: finalFileName,
      },
      metadata: {
        text: text.trim(),
        textLength: text.trim().length,
        audioDuration: tts.duration,
        audioSize: tts.audioSize,
        processingTime: `${totalTime}s`,
        voiceId: 'P9yx385KN0FOmLll8Lkx',
        model: 'eleven_v3',
        keySource,
        timestamp,
      }
    });

  } catch (error) {
    console.error('❌ [reel] Błąd:', error);
    return NextResponse.json(
      {
        error: 'Błąd generowania rolki',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Użyj POST z { "text": "Twój tekst..." }' },
    { status: 405 }
  );
}