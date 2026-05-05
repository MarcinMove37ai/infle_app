// src/app/robots.txt/route.ts
//
// Dynamiczny robots.txt — różne reguły zależnie od kontekstu requesta.
//
// Logika:
// • header `x-landing-host: 1` (ustawiany przez middleware na custom
//   hostach klientów) → minimal body (tylko sitemap pointer).
//   Cloudflare for SaaS prependuje swój CF Managed Content z `User-agent: *
//   Allow: /` + per-bot disallow listę, więc nie chcemy tworzyć duplikatu
//   — dodajemy tylko sitemap.
//
// • app.inflee.app i origin hosts (connect/fallback.inflee.app) →
//   Disallow: / (panel + infrastruktura nie powinna być indeksowana).
//   Plus Allow dla llms.txt / llms-pl.txt / robots.txt — żeby LLM crawlery
//   respektujące robots mogły dotrzeć do opisu produktu.
//
// • inne hosty (np. inflee.app marketing) → Allow + sitemap.

import { NextRequest } from 'next/server';

const APP_HOST = (process.env.APP_HOST || 'app.inflee.app').toLowerCase();

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
  // Header `x-landing-host` ustawiany przez middleware dla custom domain
  // klientów (CF for SaaS non-Enterprise — Host header to connect.inflee.app,
  // potrzebujemy innego sygnału żeby rozpoznać custom flow).
  const isLandingFlow = request.headers.get('x-landing-host') === '1';

  const cfHostname = request.headers.get('cf-custom-hostname')?.toLowerCase().split(':')[0];
  const xForwardedHost = request.headers.get('x-forwarded-host')?.toLowerCase().split(':')[0];
  const directHost = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  const host = cfHostname || xForwardedHost || directHost;

  let body: string;

  if (isLandingFlow) {
    // Custom domain — CF Managed Content już dodaje `User-agent: *` z
    // Allow + per-bot disallow. My dodajemy TYLKO sitemap pointer żeby
    // Google wiedział gdzie szukać. Bez User-agent block — uniknięcie
    // duplikatu który łamie standard robots.txt.
    body = `Sitemap: https://${host}/sitemap.xml\n`;
  } else if (DISALLOW_HOSTS.has(host)) {
    body = DISALLOW_BODY;
  } else {
    body = ALLOW_BODY(host);
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}