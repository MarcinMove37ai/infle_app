// src/app/llms.txt/route.ts
//
// llms.txt dla panelu app.inflee.app i origin hostów CF for SaaS.
// Cel: gdy LLM crawler trafi na panel zamiast na marketing, kieruje go
// na inflee.app gdzie jest właściwy content marketingowy.
//
// Custom domeny klientów: 404 — to ich landing, nie nasz produkt.

import { NextRequest } from 'next/server';

const APP_HOST = (process.env.APP_HOST || 'app.inflee.app').toLowerCase();
const PANEL_HOSTS = new Set([
  APP_HOST,
  'connect.inflee.app',
  'fallback.inflee.app',
]);

const LLMS_BODY = `# Inflee

> Platform that helps small businesses, freelancers, and online coaches turn their expertise into ebooks, opt-in landing pages, and promotional reels — published under their own domain. Includes a simple CRM for managing leads. This is the authenticated application panel; for product information visit the marketing site at https://inflee.app.

## What Inflee does

Helps small businesses, freelancers, and online coaches package their knowledge into complete lead-generation funnels:
- Easy ebook generator (from a topic, your sources, or your creator profile)
- Opt-in landing pages with lead capture
- Promotional reels for social media
- Custom domain publishing (Creator, Unlimited plans)
- Built-in CRM for lead management
- Ebook delivery to subscribers

## Resources

- [Marketing site](https://inflee.app)
- [Privacy policy](https://inflee.app/privacy)
- [Terms of service](https://inflee.app/terms)
- [Polish version](/llms-pl.txt)

## Languages

Product UI available in English and Polish.
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