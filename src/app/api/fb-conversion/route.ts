// src/app/api/fb-conversion/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { FB_PIXEL_ID } from '@/lib/fbPixel';

const hashData = (data: string | undefined | null) => {
  if (!data) return undefined;
  return crypto.createHash('sha256').update(data).digest('hex');
};

export async function POST(request: NextRequest) {
  try {
    const { eventName, userData, customData, eventId } = await request.json();

    // Normalizacja i haszowanie danych (wymogi FB)
    const hashedUserData = {
      em: userData.email ? [hashData(userData.email.toLowerCase().trim())] : undefined,
      ph: userData.phone ? [hashData(userData.phone.replace(/\D/g, ''))] : undefined,
      fn: userData.firstName ? [hashData(userData.firstName.toLowerCase().trim())] : undefined,
      ln: userData.lastName ? [hashData(userData.lastName.toLowerCase().trim())] : undefined,
      ct: userData.city ? [hashData(userData.city.toLowerCase().trim())] : undefined,
      country: userData.country ? [hashData(userData.country.toLowerCase().trim())] : undefined,
      // 🟢 POPRAWKA TUTAJ: Dodano (request as any).ip aby naprawić błąd TypeScript
      client_ip_address: (request as any).ip || request.headers.get('x-forwarded-for'),
      client_user_agent: request.headers.get('user-agent'),
      fbp: userData.fbp,
      fbc: userData.fbc,
    };

    const eventData = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: eventId,
        user_data: hashedUserData,
        custom_data: customData,
      }],
      // Token pobieramy bezpiecznie z .env
      access_token: process.env.FB_ACCESS_TOKEN,
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('FB API Error:', result);
      return NextResponse.json({ success: false, error: result }, { status: response.status });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Conversions API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send event' }, { status: 500 });
  }
}