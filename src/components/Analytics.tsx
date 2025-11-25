// src/components/Analytics.tsx
"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { FB_PIXEL_ID } from "@/lib/fbPixel"; // Import ID z lib

export default function Analytics() {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;

    // Inicjalizacja Pixela, gdy skrypt się załaduje
    if (typeof window !== 'undefined' && (window as any).fbq) {

        // Wyłączamy automatyczne śledzenie (żeby mieć pełną kontrolę)
        (window as any).fbq.disablePushState = true;
        (window as any).fbq.allowDuplicatePageViews = false;

        // INIT
        (window as any).fbq('init', FB_PIXEL_ID, {}, {
            autoConfig: false,
            disablePushState: true
        });

        console.log("🔒 [App Analytics] Pixel Initialized");

        // UWAGA: Nie wysyłamy tu automatycznego PageView,
        // ponieważ Twoja strona 'RegisterPage' robi to sama ze szczegółami (plan, source, lang).
        // Dzięki temu unikamy duplikatów.

        isInitialized.current = true;
    }
  }, []);

  return (
    <Script
      id="fb-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
        `,
      }}
    />
  );
}