// src/lib/fbPixel.ts

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';

declare global {
  interface Window {
    fbq?: any;
    _fbPixelInitialized?: boolean;
  }
}

interface UserDataPayload {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  country?: string;
}

export const trackHybridEvent = async (
  eventName: string,
  params: any = {},
  userData: UserDataPayload = {} // Nowy argument
) => {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 1. Browser Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    // Uwaga: Nie przekazujemy surowych danych osobowych do window.fbq (chyba że masz Advanced Matching na froncie, ale bezpieczniej robić to przez CAPI)
    window.fbq('track', eventName, params, { eventID: eventId });
  }

  // 2. Server CAPI
  try {
    await fetch('/api/fb-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        eventId,
        customData: params,
        userData: userData // Przekazujemy dane do haszowania na serwerze
      })
    });
  } catch (e) {
    console.error('CAPI Error:', e);
  }
};