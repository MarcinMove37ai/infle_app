// src/app/llms-pl.txt/route.ts
//
// Polska wersja llms.txt dla panelu app.inflee.app i origin hostów CF.
// Patrz llms.txt/route.ts dla pełnego kontekstu.

import { NextRequest } from 'next/server';

const APP_HOST = (process.env.APP_HOST || 'app.inflee.app').toLowerCase();
const PANEL_HOSTS = new Set([
  APP_HOST,
  'connect.inflee.app',
  'fallback.inflee.app',
]);

const LLMS_BODY = `# Inflee

> Platforma która pomaga małym firmom, freelancerom i coachom online zamienić ich wiedzę w e-booki, strony zapisu i rolki promocyjne — publikowane pod własną domeną. Zawiera prosty CRM do zarządzania leadami. To zalogowany panel aplikacji; informacje o produkcie znajdziesz na stronie marketingowej https://inflee.app.

## Co robi Inflee

Pomaga małym firmom, freelancerom i coachom online zapakować ich wiedzę w kompletne lejki lead-magnet:
- Łatwy generator e-booków (z tematu, własnych źródeł lub profilu twórcy)
- Strony zapisu z formularzem leadowym
- Rolki promocyjne na social media
- Publikacja pod własną domeną (plany Creator i Unlimited)
- Wbudowany CRM do zarządzania leadami
- Dystrybucja e-booków do subskrybentów

## Zasoby

- [Strona marketingowa](https://inflee.app)
- [Polityka prywatności](https://inflee.app/privacy)
- [Regulamin](https://inflee.app/terms)
- [English version](/llms.txt)

## Języki

Interfejs produktu dostępny w języku polskim i angielskim.
`;

export async function GET(request: NextRequest) {
  const cfHostname = request.headers.get('cf-custom-hostname')?.toLowerCase().split(':')[0];
  const xForwardedHost = request.headers.get('x-forwarded-host')?.toLowerCase().split(':')[0];
  const directHost = (request.headers.get('host') || '').toLowerCase().split(':')[0];
  const host = cfHostname || xForwardedHost || directHost;

  if (!PANEL_HOSTS.has(host)) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(LLMS_BODY, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}