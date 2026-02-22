// src/app/api/tts/route.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from 'next/server';
import { getApiKeyForEndpoint } from '@/lib/user-api-keys';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe. Wymagany niepusty tekst.' },
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
        { error: 'Błąd konfiguracji - brak klucza API ElevenLabs' },
        { status: 500 }
      );
    }

    // AUTOMATYCZNY BUFFER 0.5s - używamy natywnego tagu v3
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
      return NextResponse.json(
        { error: `Błąd podczas generowania mowy: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const responseData: ElevenLabsTTSResponse = await response.json();

    const outputDir = join(process.cwd(), 'reels', 'tts');
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    const timestamp = Date.now();
    const audioFileName = `tts_${timestamp}.mp3`;
    const timestampsFileName = `tts_${timestamp}_timestamps.json`;

    const audioFilePath = join(outputDir, audioFileName);
    const timestampsFilePath = join(outputDir, timestampsFileName);

    const audioBuffer = Buffer.from(responseData.audio_base64, 'base64');
    await writeFile(audioFilePath, audioBuffer);

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

    await writeFile(
      timestampsFilePath,
      JSON.stringify(captionData, null, 2),
      'utf-8'
    );

    const result = {
      success: true,
      files: {
        audio: {
          path: audioFilePath,
          relativePath: `reels/tts/${audioFileName}`,
          fileName: audioFileName,
          size: audioBuffer.length,
          format: 'mp3_44100_128'
        },
        timestamps: {
          path: timestampsFilePath,
          relativePath: `reels/tts/${timestampsFileName}`,
          fileName: timestampsFileName,
          size: JSON.stringify(captionData).length
        }
      },
      metadata: {
        textLength: text.length,
        audioDuration: captionData.duration,
        characterCount: captionData.character_count,
        voiceId: 'P9yx385KN0FOmLll8Lkx',
        model: 'eleven_v3',
        keySource: keySource,
        timestamp: timestamp
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Błąd wewnętrzny serwera podczas generowania TTS',
        details: error instanceof Error ? error.message : 'Nieznany błąd'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Ta metoda nie jest obsługiwana. Użyj metody POST.' },
    { status: 405 }
  );
}