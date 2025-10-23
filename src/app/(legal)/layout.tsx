// src/app/(legal)/layout.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LazyMotion, domAnimation } from 'framer-motion';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || null;
  const logoHref = lang === 'en' ? 'https://inflee.app/en' : (lang === 'pl' ? 'https://inflee.app/pl' : 'https://inflee.app');

  return (
    <LazyMotion features={domAnimation}>
      <div
        className="register-page-wrapper" // Używamy tej samej klasy co w RegisterPage
        style={{
          fontFamily:
            '"Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
        suppressHydrationWarning
      >
        {/* Style globalne skopiowane 1:1 ze strony rejestracji */}
        <style jsx global>{`
          .register-page-wrapper {
            min-height: 100vh;
            background: #0a0a0a;
            color: white;
            width: 100%;
            top: 0;
            left: 0;
          }
          input:-webkit-autofill,
          input:-webkit-autofill:hover,
          input:-webkit-autofill:focus,
          input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px rgb(15 23 42) inset !important;
            -webkit-text-fill-color: #ffffff !important;
            caret-color: #ffffff !important;
            transition: background-color 5000s ease-in-out 0s;
          }
          .gradient-text {
            background: linear-gradient(135deg, #a855f7, #6366f1);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .register-page-wrapper * {
            will-change: auto;
          }
          .register-page-wrapper h1 {
            backface-visibility: hidden;
            -webkit-font-smoothing: antialiased;
          }
          .form-scroll-container {
            overflow-y: visible; /* Zgodnie z Twoją stroną rejestracji */
            overflow-x: hidden !important;
          }
        `}</style>

        {/* Nagłówek (Header) */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10 h-20">
          <div className="container mx-auto px-6 h-full flex justify-between items-center">
            {/* Logo (skopiowane 1:1) */}
            <Link
              href={logoHref}
              className="group flex items-center cursor-pointer"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-800/70 backdrop-blur-sm rounded-lg ring-1 ring-white/20 flex items-center justify-center p-1 sm:p-1.5 group-hover:ring-white/30 transition-all duration-300 mr-2 sm:mr-3">
                <Image
                  src="/logoW.png"
                  alt="inflee.app logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <div>
                <h1
                  className="text-xl sm:text-2xl font-bold leading-tight"
                  style={{
                    background: 'linear-gradient(135deg, #A855F7, #6366F1)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  inflee.app
                </h1>
                <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-400 tracking-wide uppercase leading-tight group-hover:text-slate-300 transition-colors duration-300">
                  {lang === 'en'
                    ? 'Educate | Grow | Earn'
                    : 'Edukuj | Rośnij | Zarabiaj'}
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* Główna treść (Main) - skopiowane 1:1 */}
        <main className="pt-20 min-h-screen relative flex flex-col justify-center">
          {/* Tło i Nakładka */}
          <div className="absolute top-0 left-0 w-full h-full z-0 lg:flex lg:justify-start">
            <Image
              src={'/heroR.webp'} // Używamy tła ze strony rejestracji
              alt=""
              aria-hidden="true"
              width={1920}
              height={1080}
              priority
              quality={85}
              className="w-full h-full object-cover object-center lg:w-auto"
              sizes="100vw"
            />
          </div>
          <div className="absolute top-0 left-0 w-full h-full z-10 bg-[#010101]/80 lg:bg-none lg:bg-gradient-to-r lg:from-transparent lg:via-[#010101]/90 lg:to-[#010101]/90" />

          {/* Sekcja (Section) - skopiowane 1:1 */}
          <section>
            <div className="container mx-auto px-6 relative z-20 grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-0">
              {/* Tutaj zostanie wstrzyknięta treść z `page.tsx` (Regulaminu lub Polityki) */}
              {children}
            </div>
          </section>
        </main>
      </div>
    </LazyMotion>
  );
}