// src/app/lib/fbPixel.ts
// Kopia 1:1 z landingu - to ten sam mechanizm

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';

// TypeScript deklaracje
declare global {
  interface Window {
    fbq?: any;
    _fbPixelInitialized?: boolean;
  }
}

const getCookie = (name: string) => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

// --- GŁÓWNA FUNKCJA HYBRYDOWA ---
export const trackHybridEvent = async (eventName: string, params: any = {}) => {
  // Generujemy ID zdarzenia dla deduplikacji
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 1. Browser Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', eventName, params, { eventID: eventId });
    console.log(`📡 [App Hybrid] Browser sent: ${eventName}`, params);
  }

  // 2. Server CAPI
  try {
    const fbp = getCookie('_fbp');
    const fbc = getCookie('_fbc');

    await fetch('/api/fb-conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        eventId,
        customData: params,
        userData: {
          fbp: fbp,
          fbc: fbc,
          client_user_agent: navigator.userAgent,
        }
      })
    });
    console.log(`SERVER [App Hybrid] CAPI sent: ${eventName}`);
  } catch (e) {
    console.error('CAPI Error:', e);
  }
};