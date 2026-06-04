// src/app/(auth)/verify/[token]/VerifyClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LazyMotion, domAnimation, m as motion } from "framer-motion";

type VerifyResult = 'success' | 'invalid' | 'error';

export default function VerifyClient({ result, email }: { result: VerifyResult; email: string }) {

  // --- Hooki ---
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- Obsługa języka (spójnie z login/forgot/reset) ---
  const lang = searchParams.get('lang') || null;
  const loginHref = lang ? `/login?lang=${lang}` : '/login';
  const registerHref = lang ? `/register?lang=${lang}` : '/register';
  const logoHref = lang === 'en' ? 'https://inflee.app/en' : (lang === 'pl' ? 'https://inflee.app/pl' : 'https://inflee.app');

  // --- Ustalenie języka przy wejściu bez parametru. ---
  // Hierarchia: ?lang= → appLanguage (localStorage) → przeglądarka → 'en'. appLanguage ma
  // pierwszeństwo przed przeglądarką — bez tego brak ?lang= pokazywałby polski (wyciek PL).
  useEffect(() => {
    if (!lang && typeof window !== 'undefined') {
      let resolved: 'en' | 'pl' = 'en';
      try {
        const saved = localStorage.getItem('appLanguage');
        if (saved === 'en' || saved === 'pl') {
          resolved = saved;
        } else {
          resolved = navigator.language.split('-')[0] === 'pl' ? 'pl' : 'en';
        }
      } catch {
        resolved = navigator.language.split('-')[0] === 'pl' ? 'pl' : 'en';
      }
      const sp = new URLSearchParams(Array.from(searchParams.entries()));
      sp.set('lang', resolved);
      router.replace(`${window.location.pathname}?${sp.toString()}`);
    }
  }, [lang, searchParams, router]);

  // --- Warianty animacji (zapożyczone ze strony logowania) ---
  const heroContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: [0.43, 0.13, 0.23, 0.96] as const,
      },
    },
  };

  // Lewa kolumna (hero) — tekst zależny od wyniku.
  const heroTop = result === 'success'
    ? (lang === 'en' ? 'Email' : 'Email')
    : result === 'invalid'
      ? (lang === 'en' ? 'Invalid' : 'Nieprawidłowy')
      : (lang === 'en' ? 'Something' : 'Coś');
  const heroBottom = result === 'success'
    ? (lang === 'en' ? 'verified' : 'zweryfikowany')
    : result === 'invalid'
      ? (lang === 'en' ? 'link' : 'link')
      : (lang === 'en' ? 'went wrong' : 'poszło nie tak');

  return (
    <LazyMotion features={domAnimation}>
      {/* --- Wrapper i style globalne (identyczne jak w logowaniu/forgot/reset) --- */}
      <div
        className="register-page-wrapper"
        style={{ fontFamily: '"Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, sans-serif' }}
        suppressHydrationWarning
      >
        <style jsx global>{`
          .register-page-wrapper {
            height: 100vh;
            background: #0A0A0A;
            color: white;
            overflow: hidden !important;
            position: fixed;
            width: 100%;
            top: 0;
            left: 0;
          }
          .gradient-text {
            background: linear-gradient(135deg, #A855F7, #6366F1);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          html, body {
            overflow: hidden !important;
            height: 100vh;
          }
          .register-page-wrapper * {
            will-change: auto;
          }
          .register-page-wrapper h1 {
            backface-visibility: hidden;
            -webkit-font-smoothing: antialiased;
          }
          .form-scroll-container {
            overflow-y: auto !important;
            overflow-x: hidden !important;
            max-height: calc(100vh - 5rem);
            scrollbar-width: thin;
            scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
          }
          .form-scroll-container::-webkit-scrollbar {
            width: 6px;
          }
          .form-scroll-container::-webkit-scrollbar-track {
            background: transparent;
          }
          .form-scroll-container::-webkit-scrollbar-thumb {
            background-color: rgba(139, 92, 246, 0.3);
            border-radius: 3px;
          }
        `}</style>

        {/* --- Header (identyczny, link na 'loginHref') --- */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10 h-20">
          <div className="container mx-auto px-6 h-full flex justify-between items-center">
            <Link href={logoHref} className="group flex items-center cursor-pointer">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-800/70 backdrop-blur-sm rounded-lg ring-1 ring-white/20 flex items-center justify-center p-1 sm:p-1.5 group-hover:ring-white/30 transition-all duration-300 mr-2 sm:mr-3">
                <Image src="/logoW.png" alt="inflee.app logo" width={48} height={48} className="w-full h-full object-contain" priority />
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
                    {lang === 'en' ? 'Educate | Grow | Earn' : 'Edukuj | Rośnij | Zarabiaj'}
                  </p>
              </div>
            </Link>

            <Link href={loginHref} className="px-4 py-1.5 bg-white/10 border border-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition">
              {lang === 'en' ? 'Log in' : 'Zaloguj się'}
            </Link>
          </div>
        </header>

        {/* --- Main (identyczna struktura) --- */}
        <main className="h-screen">
          <section className="h-full relative">
            <div className="absolute top-0 left-0 w-full h-full z-0 lg:flex lg:justify-start">
              <Image
                src={"/heroL.webp"}
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

            {/* --- Overlay (identyczny) --- */}
            <div className="absolute top-0 left-0 w-full h-full z-10 bg-[#010101]/80 lg:bg-none lg:bg-gradient-to-r lg:from-transparent lg:via-[#010101]/90 lg:to-[#010101]/90" />

            {/* --- Grid (identyczny) --- */}
            <div className="container mx-auto px-6 relative z-20 grid grid-cols-1 lg:grid-cols-12 h-full gap-0 lg:gap-0 pt-20">

              {/* --- Lewa strona (hero zależne od wyniku) --- */}
              <div className="lg:col-span-7 flex flex-col justify-center items-start text-left pr-0 lg:pr-10 pb-0 lg:pb-0 pt-4 lg:pt-0">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={heroContainerVariants}
                  className="w-full lg:px-0"
                >
                  <motion.div variants={heroItemVariants}>
                    <h1 className="font-extrabold text-white leading-tight font-sans">
                      <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl whitespace-nowrap">
                        {heroTop}
                      </span>
                    </h1>
                  </motion.div>

                  <motion.div variants={heroItemVariants}>
                    <div className="w-40 sm:w-48 lg:w-full lg:max-w-md h-px bg-gradient-to-r from-purple-500 to-pink-500 mt-2.5 mb-1.5 lg:mt-6 lg:mb-2"></div>
                  </motion.div>

                  <motion.div variants={heroItemVariants}>
                    <h1 className="font-extrabold text-white pb-0 leading-snug font-sans">
                      <span
                        className="block text-xl sm:text-2xl md:text-3xl lg:text-5xl xl:text-6xl pb-3"
                        style={{
                          background: 'linear-gradient(135deg, #A855F7, #6366F1)',
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {heroBottom}
                      </span>
                    </h1>
                  </motion.div>
                </motion.div>
              </div>

              {/* --- Prawa strona (karta wyniku) --- */}
              <div className="lg:col-span-5 lg:h-full flex items-start lg:items-center justify-center lg:justify-end mt-1 lg:mt-0">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="w-full max-w-md py-0 lg:p-0"
                >
                  {result === 'success' ? (
                    // --- WYNIK: sukces ---
                    <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 w-full max-h-full">
                      <div className="mb-4">
                        <h2 className="text-xl font-bold text-white text-center">{lang === 'en' ? 'Email verified!' : 'Email zweryfikowany!'}</h2>
                      </div>
                      <div className="form-scroll-container p-1">
                        <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-white/10 rounded-xl p-4 mb-6">
                          <div className="text-center">
                            <div className="flex justify-center mb-2">
                              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/20">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                              </div>
                            </div>
                            <p className="text-blue-300 font-medium mb-2 text-lg">{lang === 'en' ? 'Your account is active' : 'Twoje konto jest aktywne'}</p>
                            <p className="text-blue-400 text-sm">
                              {lang === 'en'
                                ? 'Your email has been verified. You can now log in and start using the platform.'
                                : 'Twój email został zweryfikowany. Możesz się teraz zalogować i zacząć korzystać z platformy.'}
                            </p>
                            {email && (
                              <div className="bg-slate-900 border border-white/20 rounded-lg px-4 py-2.5 mt-3">
                                <span className="font-mono text-white text-sm break-all">{email}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <Link
                          href={loginHref}
                          className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all duration-200 shadow-lg cursor-pointer text-center"
                        >
                          {lang === 'en' ? 'Go to log in' : 'Przejdź do logowania'}
                        </Link>
                      </div>
                    </div>
                  ) : result === 'invalid' ? (
                    // --- WYNIK: nieprawidłowy / wygasły link ---
                    <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 w-full max-h-full">
                      <div className="mb-4">
                        <h2 className="text-xl font-bold text-white text-center">{lang === 'en' ? 'Invalid link' : 'Nieprawidłowy link'}</h2>
                      </div>
                      <div className="form-scroll-container p-1">
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                          <div className="flex items-start space-x-3">
                            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                            <div className="text-left">
                              <p className="text-red-300 font-medium mb-1 text-sm">{lang === 'en' ? 'Verification problem' : 'Problem z weryfikacją'}</p>
                              <p className="text-red-400 text-sm">
                                {lang === 'en'
                                  ? 'This verification link is invalid, has expired, or has already been used. Verification links are valid for 24 hours after registration.'
                                  : 'Link weryfikacyjny jest nieprawidłowy, wygasł lub został już użyty. Linki weryfikacyjne są ważne przez 24 godziny od momentu rejestracji.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Link
                            href={registerHref}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all duration-200 shadow-lg cursor-pointer text-center"
                          >
                            {lang === 'en' ? 'Register again' : 'Zarejestruj się ponownie'}
                          </Link>
                          <Link
                            href={loginHref}
                            className="w-full py-2.5 px-4 bg-white/10 border border-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition text-center block"
                          >
                            {lang === 'en' ? 'Go to log in' : 'Przejdź do logowania'}
                          </Link>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // --- WYNIK: błąd serwera ---
                    <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 w-full max-h-full">
                      <div className="mb-4">
                        <h2 className="text-xl font-bold text-white text-center">{lang === 'en' ? 'Verification error' : 'Błąd weryfikacji'}</h2>
                      </div>
                      <div className="form-scroll-container p-1">
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                          <div className="flex items-start space-x-3">
                            <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                            <div className="text-left">
                              <p className="text-amber-300 font-medium mb-1 text-sm">{lang === 'en' ? 'A technical problem occurred' : 'Wystąpił problem techniczny'}</p>
                              <p className="text-amber-400 text-sm">
                                {lang === 'en'
                                  ? 'Sorry for the trouble. Please try again in a few minutes, or contact support if the problem persists.'
                                  : 'Przepraszamy za problem. Spróbuj ponownie za kilka minut lub skontaktuj się z obsługą, jeśli problem się powtarza.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <Link
                          href={loginHref}
                          className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all duration-200 shadow-lg cursor-pointer text-center"
                        >
                          {lang === 'en' ? 'Go to log in' : 'Przejdź do logowania'}
                        </Link>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </LazyMotion>
  );
}