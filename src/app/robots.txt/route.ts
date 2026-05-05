// src/app/robots.txt/route.ts
//
// Dynamiczny robots.txt — różne reguły zależnie od hosta requesta.
//
// Logika:
// • app.inflee.app i origin hosts (connect/fallback.inflee.app) →
//   Disallow: / (panel + infrastruktura nie powinna być indeksowana,
//   żeby nie konkurowała w SERP z custom domenami klientów)
// • każdy inny host (custom domena klienta lub inflee.app marketing
//   landing) → Allow: / + sitemap pointer
//
// UWAGA: wcześniejszy plik public/robots.txt został usunięty —
// Next.js serwuje statyczne pliki PRZED route handlerami, więc
// dopóki istniał, ta logika by się nie wykonała.

import { NextRequest } from 'next/server';

const APP_HOST = (process.env.APP_HOST || 'app.inflee.app').toLowerCase();

// Hosts gdzie indeksacja jest WYŁĄCZONA (panel + CF for SaaS infra)
const DISALLOW_HOSTS = new Set([
  APP_HOST,
  'connect.inflee.app',
  'fallback.inflee.app',
]);

const DISALLOW_BODY = `User-agent: *
Disallow: /
Allow: /llms.txt
Allow: /llms-pl.txt
Allow: /robots.txt
`;

const ALLOW_BODY = (host: string) => `User-agent: *
Allow: /

Sitemap: https://${host}/sitemap.xml
`;

export async function GET(request: NextRequest) {
  // Ten sam priorytet hostów co w middleware:
  // 1. CF-Custom-Hostname (CF for SaaS — oryginalna domena klienta)
  // 2. X-Forwarded-Host (proxy chain)
  // 3. Host (direct)
  const cfHostname = request.headers.get('cf-custom-hostname')?.toLowerCase().split(':')[0];
  const xForwardedHost = request.headers.get('x-forwarded-host')?.toLowerCase().split(':')[0];
  const directHost = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  const host = cfHostname || xForwardedHost || directHost;

  const isDisallowed = DISALLOW_HOSTS.has(host);
  const body = isDisallowed ? DISALLOW_BODY : ALLOW_BODY(host);

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Krótki cache — żeby zmiana statusu domeny / nowych domen szybko się propagowała
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}