// src/app/(auth)/forgot-password/ForgotPasswordClient.tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LazyMotion, domAnimation, m as motion } from "framer-motion";


// Zmieniona nazwa funkcji
export default function ForgotPasswordClient() {

  // --- Hooki ---
  const searchParams = useSearchParams();

  // --- Obsługa języka (zapożyczone ze strony logowania) ---
  const lang = searchParams.get('lang') || null;
  const registerHref = lang ? `/register?lang=${lang}` : '/register';
  const loginHref = lang ? `/login?lang=${lang}` : '/login';

  const logoHref = lang === 'en' ? 'https://inflee.app/en' : (lang === 'pl' ? 'https://inflee.app/pl' : 'https://inflee.app');

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

  // --- Stan specyficzny dla odzyskiwania hasła (z oryginalnego pliku) ---
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // --- Logika wysyłania linku (z oryginalnego pliku, z dodaną obsługą `lang`) ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (!email) {
      setError(lang === 'en' ? 'Email address is required.' : 'Adres email jest wymagany.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailSent(true);
        setMessage(lang === 'en' ? 'A password reset link has been sent to your email!' : 'Link do resetowania hasła został wysłany na Twój email!');
      } else {
        setError(data.error || (lang === 'en' ? 'An error occurred while sending the email.' : 'Wystąpił błąd podczas wysyłania emaila.'));
      }
    } catch (error) {
      setError(lang === 'en' ? 'An error occurred while sending the email.' : 'Wystąpił błąd podczas wysyłania emaila.');
    } finally {
      setLoading(false);
    }
  };

  // --- Handler dla autofill (zapożyczony ze strony logowania) ---
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.removeAttribute('readonly');
  };

  return (
    <LazyMotion features={domAnimation}>
      {/* --- Wrapper i style globalne (identyczne jak w logowaniu) --- */}
      <div
        className="register-page-wrapper" // Używamy tej samej klasy CSS
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

        {/* --- Header (identyczny, zmieniony link na 'loginHref') --- */}
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
              {/* Ta sama grafika tła co na logowaniu */}
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

              {/* --- Lewa strona (zmienione teksty na reset hasła) --- */}
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
                        {lang === 'en' ? 'Forgot' : 'Nie pamiętasz'}
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
                        {lang === 'en' ? 'your password?' : 'hasła?'}
                      </span>
                    </h1>
                  </motion.div>
                </motion.div>
              </div>

              {/* --- Prawa strona (Formularz resetowania lub ekran sukcesu) --- */}
              <div className="lg:col-span-5 lg:h-full flex items-start lg:items-center justify-center lg:justify-end mt-1 lg:mt-0">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="w-full max-w-md py-0 lg:p-0"
                >
                  {/* Używamy logiki `emailSent` z oryginalnego pliku */}
                  {emailSent ? (
                    // --- WIDOK SUKCESU (przystosowany do ciemnego motywu) ---
                    <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 w-full max-h-full">
                      <div className="mb-4">
                        <h2 className="text-xl font-bold text-white">{lang === 'en' ? 'Link sent!' : 'Link wysłany!'}</h2>
                      </div>
                      <div className="form-scroll-container p-1">

                        {/* Box informacyjny - dostosowany do ciemnego motywu */}
                        <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-white/10 rounded-xl p-4 mb-6">
                          <div className="text-center">
                            <div className="flex justify-center mb-1">
                              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                              </svg>
                            </div>
                            <p className="text-blue-300 font-medium mb-2 text-lg">
                              {lang === 'en' ? 'Check your inbox' : 'Sprawdź swoją skrzynkę pocztową'}
                            </p>
                            <p className="text-blue-400 text-sm mb-4">
                              {lang === 'en' ? 'We sent a password reset link to:' : 'Wysłaliśmy link do resetowania hasła na adres:'}
                            </p>
                            <div className="bg-slate-900 border border-white/20 rounded-lg px-4 py-3 shadow-sm">
                              <span className="font-mono text-white font-semibold text-base break-all">{email}</span>
                            </div>
                          </div>
                        </div>

                        {/* Box SPAM - dostosowany do ciemnego motywu */}
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                          <div className="flex items-start space-x-3">
                            <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                            <div className="text-left">
                              <p className="text-yellow-300 text-sm font-medium mb-1">{lang === 'en' ? "Don't see the email?" : 'Nie widzisz emaila?'}</p>
                              <p className="text-yellow-400 text-sm">
                                {lang === 'en' ? 'Check your spam folder or try again in a few minutes.' : 'Sprawdź folder spam lub spróbuj ponownie za kilka minut.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Przyciski akcji */}
                        <div className="space-y-3">
                          <Link
                            href={loginHref}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-all duration-200 shadow-lg cursor-pointer text-center"
                          >
                            {lang === 'en' ? 'Back to log in' : 'Powrót do logowania'}
                          </Link>

                          <button
                            onClick={() => {
                              setEmailSent(false);
                              // Nie czyścimy emaila, aby ułatwić ponowne wysłanie
                              setError('');
                              setMessage('');
                            }}
                            className="w-full py-2.5 px-4 bg-white/10 border border-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition text-center"
                          >
                            {lang === 'en' ? 'Send again' : 'Wyślij ponownie'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // --- WIDOK FORMULARZA (uproszczony formularz logowania) ---
                    <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 w-full max-h-full">
                      <div className="mb-4">
                        <h2 className="text-xl text-slate-300 text-center">{lang === 'en' ? 'Reset password' : 'Reset hasła'}</h2>
                      </div>

                      <div className="form-scroll-container p-1">

                        {/* Usunięty przycisk Google i separator "lub" */}

                        <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">

                          {/* Tylko pole Email */}
                          <div className="relative">
                            <input
                              id="email"
                              name="email"
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="w-full px-3 pt-5 pb-2 bg-slate-900/95 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 text-white peer text-sm"
                              placeholder=" "
                              readOnly
                              onFocus={handleFocus}
                              autoComplete="email"
                            />
                            <label htmlFor="email" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">
                              {lang === 'en' ? 'Email address *' : 'Adres email *'}
                            </label>
                          </div>

                          {/* Usunięte pole Hasło */}
                          {/* Usunięty link "Nie pamiętasz hasła?" */}

                          {/* Wyświetlanie błędu (identyczne) */}
                          {error && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-red-500/10 ring-1 ring-red-500/20 rounded-xl p-3"
                            >
                              <div className="flex items-center">
                                <svg className="w-4 h-4 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <div className="text-red-400 text-xs font-medium">{error}</div>
                              </div>
                            </motion.div>
                          )}

                          {/* Komunikat sukcesu jest teraz obsługiwany przez `emailSent` */}

                          {/* Przycisk Submit (zmieniony tekst) */}
                          <div>
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg cursor-pointer"
                            >
                              {loading ? (
                                <div className="flex items-center">
                                  <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                  <span className="text-sm">{lang === 'en' ? 'Sending...' : 'Wysyłanie...'}</span>
                                </div>
                              ) : (
                                lang === 'en' ? 'Send reset link' : 'Wyślij link resetujący'
                              )}
                            </button>
                          </div>

                          {/* Link do logowania na dole (zmieniony tekst i link) */}
                          <div className="text-center pt-2">
                            <p className="text-xs text-slate-400">
                              {lang === 'en' ? 'Remember your password? ' : 'Pamiętasz hasło? '}
                              <Link href={loginHref} className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors duration-200 hover:underline">
                                {lang === 'en' ? 'Log in' : 'Zaloguj się'}
                              </Link>
                            </p>
                          </div>
                        </form>
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