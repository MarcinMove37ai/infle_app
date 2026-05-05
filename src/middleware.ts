// src/middleware.ts

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Hosts that are allowed to access the admin panel and authenticated routes.
// Everything else is treated as a customer's custom domain or our public landing host.
const APP_HOST = process.env.APP_HOST || 'app.inflee.app'

// Reserved paths that belong to the admin panel — these MUST NEVER be served
// from a custom domain or landing host. Listed first because they share the
// same shape as landing page slugs (one path segment).
const RESERVED_APP_PATHS = new Set([
  'login',
  'register',
  'verify',
  'verify-payment',
  'forgot-password',
  'reset-password',
  'dashboard',
  'ebooks',
  'statystyki',
  'raport-tworcy',
  'raport-odbiorcow',
  'landings',
  'trendy',
  'ustawienia',
  'preview',
  'admin',
  'demo',
  'api',
])

// Whitelist of public paths that ARE allowed on custom/landing hosts.
// The function checks RESERVED_APP_PATHS as a second layer to block panel
// routes whose shape (one segment) matches the slug pattern below.
const PUBLIC_PATH_PATTERNS: RegExp[] = [
  /^\/[a-z0-9][a-z0-9-]*\/?$/,          // /<slug> — landing page (one segment)
  /^\/api\/leads\/?$/,                  // POST from lead-capture form
  /^\/api\/pages\/visits\/?$/,          // visit counter from landing page
  /^\/api\/download-ebook\/?$/,         // ebook download after form submit
  /^\/api\/assets\/.+$/,                // public assets (images, files)
  /^\/_next\/static\/.+$/,              // bundled JS/CSS
  /^\/_next\/image$/,                   // image optimization
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
]

function isPublicLandingPath(pathname: string): boolean {
  // First: check whitelist. If pathname matches an explicitly allowed pattern,
  // it's public regardless of first-segment (e.g. /api/leads is allowed even
  // though 'api' is reserved for everything else under /api/).
  const matchesWhitelist = PUBLIC_PATH_PATTERNS.some(re => re.test(pathname))
  if (!matchesWhitelist) {
    return false
  }

  // Second: even when whitelist matches, block reserved app paths.
  // This catches routes like /login, /dashboard whose shape (one segment)
  // matches the slug pattern but must never be served from a custom domain.
  const firstSegment = pathname.split('/')[1]?.toLowerCase() ?? ''
  if (RESERVED_APP_PATHS.has(firstSegment)) {
    // Exception: /api/* paths are blocked by default (RESERVED has 'api'),
    // but specific /api/* whitelist entries (e.g. /api/leads, /api/assets/*)
    // are public. They already passed the whitelist check above, so allow.
    if (firstSegment === 'api') {
      return true
    }
    return false
  }

  return true
}

export async function middleware(request: NextRequest) {

  // ────────────────────────────────────────────────────────────────────
  // Hostname detection.
  //
  // Cloudflare for SaaS forwarduje request do Railway z nadpisanym Host
  // headerem (= connect.inflee.app — Railway akceptuje), ale dodaje
  // "CF-Custom-Hostname" z oryginalną domeną klienta (np. "lp.legalgpt.pl").
  //
  // Priorytet:
  //  1. CF-Custom-Hostname (production behind Cloudflare for SaaS) — oryginalna domena
  //  2. X-Forwarded-Host (proxy/load balancer chain) — fallback dla setupów bez CF
  //  3. Host header (lokalny dev, direct access) — domyślny
  //
  // W lokalnym dev pierwszy header jest pusty, więc używamy Host (np. localhost:3000).
  // W produkcji za CF for SaaS pierwszy header zawiera prawdziwą domenę klienta.
  // ────────────────────────────────────────────────────────────────────
  const cfHostname = request.headers.get('cf-custom-hostname')?.toLowerCase().split(':')[0]
  const xForwardedHost = request.headers.get('x-forwarded-host')?.toLowerCase().split(':')[0]
  const directHost = (request.headers.get('host') || '').toLowerCase().split(':')[0]
  const host = cfHostname || xForwardedHost || directHost

  // DEBUG — pełny dump relevant CF/proxy headers żeby zdiagnozować routing.
  // Ten log wskaże czy CF for SaaS faktycznie dodaje cf-custom-hostname,
  // jaki Host forwarduje do origin, oraz inne CF-specific headery.


  const { pathname } = request.nextUrl

  const isAppHost = host === APP_HOST
  const isLocalDev = host === 'localhost' || host === '127.0.0.1'

  // ==================================================
  // ⭐ Custom domain / landing host routing (Plan B — lookup by slug)
  //
  // CF for SaaS na planie non-Enterprise nie przekazuje oryginalnej domeny
  // klienta (atlas.legalgpt.pl) do origin. Z custom_origin_server ustawionym
  // na connect.inflee.app, Host w request headerze JEST connect.inflee.app
  // (Railway tego wymaga). Nie ma czystego sposobu odzyskania oryginalnej
  // domeny po stronie Node.
  //
  // Strategia: zaufać unikalności sluga (random suffix typu -abc123) i znaleźć
  // stronę po slug + customDomainId not null + status published. Gdy ktoś
  // trafi na /<slug> NIE z custom domeny (np. bezpośrednio connect.inflee.app)
  // ale strona ma przypisaną customDomainId, też pokazujemy — to OK, bo
  // connect.inflee.app jest fallback originem dla CF for SaaS i nie powinien
  // być używany bezpośrednio przez ludzi.
  // ==================================================
  if (!isAppHost && !isLocalDev) {
    if (!isPublicLandingPath(pathname)) {
      return new NextResponse('Not found', { status: 404 })
    }

    // UWAGA: NIE ustawiamy X-Robots-Tag dla origin hosts (connect/fallback.inflee.app).
    //
    // W trybie CF for SaaS non-Enterprise (SNI), Cloudflare nadpisuje Host
    // header na connect.inflee.app dla WSZYSTKICH custom domain requests
    // klientów. Z perspektywy origin nie można odróżnić "direct hit na
    // connect.inflee.app" od "klient request lp.panwalczak.pl przez CF SaaS".
    // X-Robots-Tag tu blokował indeksację landingów klientów.
    //
    // Ostatnia linia obrony przed indeksacją infrastruktury jest w
    // src/app/ebookpage/[...slug]/page.tsx → generateMetadata, gdzie
    // searchParams.__landing flag pozwala precyzyjnie rozpoznać landing
    // flow vs direct origin hit i ustawić robots noindex tylko w drugim
    // przypadku.

    // Rewrite landing slug into /ebookpage/[slug]?__landing=1
    // — flaga __landing sygnalizuje page.tsx żeby użyć lookupu po slug
    // (a nie po host header, który jest bezużyteczny dla CF for SaaS non-Enterprise).
    const slugMatch = pathname.match(/^\/([a-z0-9][a-z0-9-]*)\/?$/)
    if (slugMatch) {
      const slug = slugMatch[1]
      const url = request.nextUrl.clone()
      url.pathname = `/ebookpage/${slug}`
      url.searchParams.set('__landing', '1')
      return NextResponse.rewrite(url)
    }

    // Robots.txt na custom hostach — propaguj header `x-landing-host` żeby
    // route handler wygenerował minimal body, zamiast DISALLOW na podstawie
    // directHost = connect.inflee.app (UŻYWAMY HEADER, NIE SEARCHPARAMS).
    if (pathname === '/robots.txt') {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-landing-host', '1')
      return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // Passthrough for /api/leads, /api/assets/*, /_next/*, /favicon.ico
    return NextResponse.next()
  }

  // ==================================================
  // Existing logic for app.inflee.app and localhost — UNCHANGED below
  // ==================================================



  // Pobierz token NextAuth
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });


  const isAuth = !!token;

  // ==================================================
  // ⭐ KOREKTA: Dodajemy wyjątek dla strony weryfikacji
  // ==================================================
  if (pathname.startsWith('/verify-payment')) {
    // Jeśli to strona weryfikacji płatności, przepuść request.
    // Musi być dostępna dla zalogowanego użytkownika.
    return NextResponse.next();
  }
  // ==================================================

  // Definiuj które strony to auth pages
  const isAuthPage = pathname.startsWith('/login') ||
                    pathname.startsWith('/register') ||
                    pathname.startsWith('/verify');

  // Definiuj które strony są chronione
  const isProtectedPage = pathname.startsWith('/dashboard') ||
                         pathname.startsWith('/ebooks') ||
                         pathname.startsWith('/statystyki') ||
                         pathname.startsWith('/raport-tworcy') ||
                         pathname.startsWith('/raport-odbiorcow') ||
                         pathname.startsWith('/landings') ||
                         pathname.startsWith('/trendy');


  // 1. Jeśli zalogowany user próbuje wejść na strony auth - przekieruj na ebooks
  if (isAuthPage && isAuth) {
    return NextResponse.redirect(new URL('/ebooks', request.url));
  }

  // 2. Jeśli niezalogowany próbuje wejść na chronione strony - przekieruj na login
  if (isProtectedPage && !isAuth) {
    const from = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?from=${from}`, request.url));
  }

  // 3. Jeśli zalogowany ale niezweryfikowany email próbuje wejść na chronione strony
  if (isProtectedPage && isAuth && !token.emailVerified) {
    return NextResponse.redirect(new URL('/login?error=email-not-verified', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (build assets)
     * - _next/image (image optimization)
     * - favicon.ico
     * - static image files
     *
     * NOTE: API routes are INCLUDED so middleware can block internal endpoints
     * (e.g. /api/user/*, /api/domains/*) when accessed under a custom domain.
     * Only /api/leads and /api/assets/* are whitelisted in PUBLIC_PATH_PATTERNS.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}