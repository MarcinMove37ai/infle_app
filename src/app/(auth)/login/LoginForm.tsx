// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LazyMotion, domAnimation, m as motion } from "framer-motion";
import { signIn } from 'next-auth/react';

export const dynamic = 'force-dynamic';

export default function LoginForm() {

  // ✅ Hooki na samej górze
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ Odczytanie języka i stworzenie dynamicznych linków
  const lang = searchParams.get('lang') || null;
  const registerHref = lang ? `/register?lang=${lang}` : '/register';
  const forgotPasswordHref = lang ? `/forgot-password?lang=${lang}` : '/forgot-password';

  // Warianty animacji (skopiowane 1:1 ze strony rejestracji)
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

  // ✅ Stan specyficzny dla logowania
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // ✅ Logika logowania przez Google
  const handleGoogleSignIn = () => {
    alert(lang === 'en' ? 'Sign in with Google - feature in preparation' : 'Logowanie przez Google - funkcja w przygotowaniu');
  };

  // ✅ Logika logowania przez email/hasło
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.email || !formData.password) {
      setError(lang === 'en' ? 'Email and password are required.' : 'Email i hasło są wymagane.');
      setLoading(false);
      return;
    }

    try {
      // Używamy 'redirect: false' aby móc obsłużyć błąd ręcznie
      const result = await signIn('credentials', {
        ...formData,
        redirect: false,
      });

      if (result?.error) {
        // Ustawiamy przetłumaczony komunikat błędu
        setError(lang === 'en' ? 'Invalid email or password.' : 'Nieprawidłowy email lub hasło.');
        setLoading(false);
      } else if (result?.ok) {
        // Sukces - przekierowujemy na dashboard
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(lang === 'en' ? 'An unexpected error occurred.' : 'Wystąpił nieoczekiwany błąd.');
      setLoading(false);
    }
  };

  // Ta sama funkcja co na stronie rejestracji (dla autofill)
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.removeAttribute('readonly');
  };

  return (
    <LazyMotion features={domAnimation}>
      {/* ✅ Wrapper i style globalne (identyczne jak w rejestracji) */}
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

        {/* ✅ Header (identyczny, zmieniony tylko link na 'registerHref') */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10 h-20">
          <div className="container mx-auto px-6 h-full flex justify-between items-center">
            <Link href="https://inflee.app" className="group flex items-center cursor-pointer">
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

            <Link href={registerHref} className="px-4 py-1.5 bg-white/10 border border-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition">
              {lang === 'en' ? 'Register' : 'Zarejestruj'}
            </Link>
          </div>
        </header>

        {/* ✅ Main (identyczna struktura) */}
        <main className="h-screen">
          <section className="h-full relative">
            <div className="absolute top-0 left-0 w-full h-full z-0 lg:flex lg:justify-start">
              {/* ✅ Zmieniona grafika tła */}
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

            {/* ✅ Overlay (identyczny) */}
            <div className="absolute top-0 left-0 w-full h-full z-10 bg-[#010101]/80 lg:bg-none lg:bg-gradient-to-r lg:from-transparent lg:via-[#010101]/90 lg:to-[#010101]/90" />

            {/* ✅ Grid (identyczny) */}
            <div className="container mx-auto px-6 relative z-20 grid grid-cols-1 lg:grid-cols-12 h-full gap-0 lg:gap-0 pt-20">

              {/* ✅ Lewa strona (zmienione teksty na logowanie) */}
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
                        {lang === 'en' ? 'Welcome back' : 'Witaj ponownie'}
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
                        {lang === 'en' ? 'log in' : 'zaloguj się'}
                      </span>
                    </h1>
                  </motion.div>
                </motion.div>
              </div>

              {/* ✅ Prawa strona (Formularz logowania) */}
              <div className="lg:col-span-5 lg:h-full flex items-start lg:items-center justify-center lg:justify-end mt-1 lg:mt-0">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="w-full max-w-md py-0 lg:p-0"
                >
                  {/* ✅ Usunięty ternary 'registrationSuccess' - tu jest tylko formularz */}
                  <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 w-full max-h-full">
                    <div className="mb-4 hidden lg:block">
                      <h2 className="text-xl text-slate-300 text-center">{lang === 'en' ? 'Log in to inflee.app' : 'Zaloguj się do inflee.app'}</h2>
                    </div>

                    <div className="form-scroll-container p-1">
                      {/* ✅ Przycisk Google (identyczny styl) */}
                      <button
                        onClick={handleGoogleSignIn}
                        type="button"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all duration-200 shadow-md hover:shadow-lg mb-4 disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        <span className="text-sm">{lang === 'en' ? 'Continue with Google' : 'Kontynuuj z Google'}</span>
                      </button>

                      {/* ✅ Separator (identyczny styl) */}
                      <div className="flex items-center my-4">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink-0 mx-3 text-xs text-slate-400">{lang === 'en' ? 'or use your email' : 'lub użyj email'}</span>
                        <div className="flex-grow border-t border-white/10"></div>
                      </div>

                      {/* ✅ Formularz (uproszczony do emaila i hasła) */}
                      <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">

                        <div className="relative">
                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
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

                        <div className="relative">
                          <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full px-3 pt-5 pb-2 bg-slate-900/95 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 text-white peer text-sm"
                            placeholder=" "
                            readOnly
                            onFocus={handleFocus}
                            autoComplete="current-password"
                          />
                          <label htmlFor="password" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">
                            {lang === 'en' ? 'Password *' : 'Hasło *'}
                          </label>
                        </div>

                        {/* ✅ Link "Nie pamiętasz hasła?" */}
                        <div className="text-right">
                          <Link href={forgotPasswordHref} className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors duration-200 hover:underline">
                            {lang === 'en' ? 'Forgot password?' : 'Nie pamiętasz hasła?'}
                          </Link>
                        </div>

                        {/* ✅ Wyświetlanie błędu (identyczne) */}
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

                        {/* ✅ Przycisk Submit (identyczny styl) */}
                        <div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg cursor-pointer"
                          >
                            {loading ? (
                              <div className="flex items-center">
                                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                <span className="text-sm">{lang === 'en' ? 'Logging in...' : 'Logowanie...'}</span>

                              </div>
                            ) : (
                              lang === 'en' ? 'Log in' : 'Zaloguj się'
                            )}
                          </button>
                        </div>

                        {/* ✅ Link do rejestracji na dole (identyczny styl) */}
                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400">
                            {lang === 'en' ? "Don't have an account? " : 'Nie masz jeszcze konta? '}
                            <Link href={registerHref} className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors duration-200 hover:underline">
                              {lang === 'en' ? 'Register' : 'Zarejestruj się'}
                            </Link>
                          </p>
                        </div>
                      </form>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </LazyMotion>
  );
}