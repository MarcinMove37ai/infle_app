import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  console.log('🛡️ MIDDLEWARE:', {
    path: request.nextUrl.pathname,
    url: request.url
  });

  // Pobierz token NextAuth
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  });

  console.log('🔐 TOKEN:', {
    exists: !!token,
    email: token?.email,
    emailVerified: token?.emailVerified
  });

  const isAuth = !!token;
  const { pathname } = request.nextUrl;

  // Definiuj które strony to auth pages
  const isAuthPage = pathname.startsWith('/login') ||
                    pathname.startsWith('/register') ||
                    pathname.startsWith('/verify');

  // Definiuj które strony są chronione
  const isProtectedPage = pathname.startsWith('/dashboard') ||
                         pathname.startsWith('/ebooki') ||
                         pathname.startsWith('/statystyki') ||
                         pathname.startsWith('/raport-tworcy') ||
                         pathname.startsWith('/raport-odbiorcow') ||
                         pathname.startsWith('/strony-zapisu') ||
                         pathname.startsWith('/trendy');

  console.log('📍 PAGE TYPE:', {
    isAuthPage,
    isProtectedPage,
    isAuth
  });

  // 1. Jeśli zalogowany user próbuje wejść na strony auth - przekieruj na dashboard
  if (isAuthPage && isAuth) {
    console.log('🔄 Redirect: Zalogowany na auth page -> dashboard');
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 2. Jeśli niezalogowany próbuje wejść na chronione strony - przekieruj na login
  if (isProtectedPage && !isAuth) {
    const from = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    console.log('🔄 Redirect: Niezalogowany na protected page -> login');
    return NextResponse.redirect(new URL(`/login?from=${from}`, request.url));
  }

  // 3. Jeśli zalogowany ale niezweryfikowany email próbuje wejść na chronione strony
  if (isProtectedPage && isAuth && !token.emailVerified) {
    console.log('🔄 Redirect: Niezweryfikowany email -> login');
    return NextResponse.redirect(new URL('/login?error=email-not-verified', request.url));
  }

  console.log('✅ ALLOWED: Przepuszczam request');
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}