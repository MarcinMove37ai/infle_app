// src/app/(auth)/register/[[...plan]]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Sparkles } from 'lucide-react';
import { LazyMotion, domAnimation, m as motion } from "framer-motion";

interface InstagramProfileResponse {
  profilepic_url: string | null;
  username: string;
  followers_count: number | null;
  posts_count: number | null;
  savedProfileId?: string | null;
}

interface LinkedInProfileResponse {
  profilepic_url: string | null;
  username: string;
  followers: number | null;
  connections: number | null;
  full_name: string | null;
  headline: string | null;
  savedProfileId?: string | null;
}

type SocialProfile = InstagramProfileResponse | LinkedInProfileResponse | null;
type PlatformType = 'instagram' | 'linkedin' | null;

export default function RegisterPage({
  params,
}: {
  // ✅ POPRAWKA 1: Używamy KONKRETNEGO typu dla 'params'
  // Nazwa 'plan' pochodzi z nazwy folderu [[...plan]]
  params: Promise<{ plan?: string[] }>;
}) {

  // ✅ POPRAWKA 2: Hooki MUSZĄ być wywołane na samej górze komponentu
  const router = useRouter();
  const searchParams = useSearchParams();

  // Stan dla asynchronicznego params
  const [planSlug, setPlanSlug] = useState<string | null>(null);

  // Odczytanie params asynchronicznie
  useEffect(() => {
    params.then(resolvedParams => {
      const slug = resolvedParams.plan ? resolvedParams.plan[0] : null;
      setPlanSlug(slug);
      console.log('Wybrany plan (ze ścieżki):', slug); // 'free', 'crea', 'inf', 'final' lub null
    });
  }, [params]);

  // Bezpieczne wyciąganie wartości 'lang' z hooka 'useSearchParams'
  const lang = searchParams.get('lang') || null;
  console.log('Wybrany język (z ?lang=):', lang); // 'pl', 'en' lub null

  // ✅ POPRAWKA: Tworzymy dynamiczny link do logowania, który zachowuje parametr 'lang'
  const loginHref = lang ? `/login?lang=${lang}` : '/login';

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

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    socialLink: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    marketingConsent: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const [socialProfile, setSocialProfile] = useState<SocialProfile>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [platformType, setPlatformType] = useState<PlatformType>(null);
  const [showSocialProfile, setShowSocialProfile] = useState(false);

  const [checkedProfileId, setCheckedProfileId] = useState<string | null>(null);

  const formatNumber = (num: number | null): string => {
    if (num === null) return 'N/A';
    if (num < 1000) return num.toString();
    if (num >= 1000000) {
      const millions = num / 1000000;
      return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
    }
    if (num >= 1000) {
      const thousands = num / 1000;
      return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const detectPlatform = (url: string): PlatformType => {
    if (url.includes('instagram.com') && url.includes('/')) {
      return 'instagram';
    }
    if (url.includes('linkedin.com/in/') && url.includes('/')) {
      return 'linkedin';
    }
    return null;
  };

  const simulateProgress = () => {
    setLoadingProgress(0);
    const intervals = [
      { time: 500, progress: 10 }, { time: 1000, progress: 20 },
      { time: 1500, progress: 35 }, { time: 2500, progress: 50 },
      { time: 4000, progress: 65 }, { time: 5500, progress: 80 },
      { time: 7000, progress: 95 }, { time: 8000, progress: 100 }
    ];
    intervals.forEach(({ time, progress }) => {
      setTimeout(() => { setLoadingProgress(progress); }, time);
    });
  };

  const checkInstagramProfile = async (url: string) => {
    try {
      const response = await fetch('/api/instagram-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (response.ok && data.exist && data.profilepic_url && data.followers_count !== null && data.posts_count !== null) {
        setSocialProfile(data);
        if (data.savedProfileId) {
          setCheckedProfileId(data.savedProfileId);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Instagram profile check error:', error);
      return false;
    }
  };

  const checkLinkedInProfile = async (url: string) => {
    try {
      const response = await fetch('/api/linkedin-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (response.ok && data.exist && data.profilepic_url && data.followers !== null && data.connections !== null) {
        setSocialProfile(data);
        if (data.savedProfileId) {
          setCheckedProfileId(data.savedProfileId);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('LinkedIn profile check error:', error);
      return false;
    }
  };

  const showProfileSmooth = () => {
    setTimeout(() => { setShowSocialProfile(true); }, 10);
  };

  const hideProfileSmooth = () => {
    setShowSocialProfile(false);
    setTimeout(() => {
      setSocialProfile(null);
      setPlatformType(null);
    }, 500);
  };

  const checkSocialProfile = async (url: string) => {
    const platform = detectPlatform(url);
    if (!platform) {
      hideProfileSmooth();
      setLoadingProgress(0);
      return;
    }
    setPlatformType(platform);
    setSocialLoading(true);
    setCheckingProfile(true);
    simulateProgress();
    let success = platform === 'instagram' ? await checkInstagramProfile(url) : await checkLinkedInProfile(url);
    if (!success) {
      hideProfileSmooth();
    } else {
      showProfileSmooth();
    }
    setTimeout(() => {
      setSocialLoading(false);
      setCheckingProfile(false);
      setLoadingProgress(0);
    }, 200);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.socialLink) {
        checkSocialProfile(formData.socialLink);
      } else {
        hideProfileSmooth();
        setLoadingProgress(0);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData.socialLink]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (name === 'socialLink') {
      setCheckedProfileId(null);
    }
  };

  const handleGoogleSignUp = () => {
    alert(lang === 'en' ? 'Sign up with Google - feature in preparation' : 'Rejestracja przez Google - funkcja w przygotowaniu');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setError(lang === 'en' ? 'First Name, Last Name, and Email fields are required.' : 'Pola Imię, Nazwisko i Adres email są wymagane.');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(lang === 'en' ? 'Passwords do not match' : 'Hasła nie są identyczne');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError(lang === 'en' ? 'Password must be at least 6 characters long' : 'Hasło musi mieć minimum 6 znaków');
      setLoading(false);
      return;
    }

    if (!formData.termsAccepted) {
      setError(lang === 'en' ? 'You must accept the Terms of Service and Privacy Policy' : 'Musisz zaakceptować regulamin i politykę prywatności');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || null,
          socialLink: formData.socialLink || null,
          profilePicture: socialProfile?.profilepic_url || null,
          password: formData.password,
          checkedProfileId: checkedProfileId,
          termsAccepted: formData.termsAccepted,
          marketingConsent: formData.marketingConsent,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setRegistrationSuccess(true);
        window.location.hash = 'sukces';
      } else {
        setError(data.error || (lang === 'en' ? 'An error occurred during registration' : 'Wystąpił błąd podczas rejestracji'));
      }
    } catch (error) {
      setError(lang === 'en' ? 'An error occurred during registration' : 'Wystąpił błąd podczas rejestracji');
    } finally {
      setLoading(false);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.removeAttribute('readonly');
  };

  const isInstagramProfile = (profile: SocialProfile): profile is InstagramProfileResponse => profile !== null && 'followers_count' in profile;
  const isLinkedInProfile = (profile: SocialProfile): profile is LinkedInProfileResponse => profile !== null && 'followers' in profile;

  return (
    <LazyMotion features={domAnimation}>
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

        <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10 h-20">
          <div className="container mx-auto px-6 h-full flex justify-between items-center">
            <Link href="/" className="group flex items-center cursor-pointer">
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

            {/* ✅ POPRAWKA: Używamy dynamicznego linku loginHref */}
            <Link href={loginHref} className="px-4 py-1.5 bg-white/10 border border-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition">
              {lang === 'en' ? 'Log in' : 'Zaloguj'}
            </Link>
          </div>
        </header>

        <main className="pt-16 h-screen">
          <section className="h-full relative">
            <div className="absolute top-0 left-0 w-full h-full z-0 lg:flex lg:justify-start">
              <Image
                src={registrationSuccess ? "/heroS.webp" : "/heroR.webp"}
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

            <div className="container mx-auto px-6 relative z-20 grid grid-cols-1 lg:grid-cols-12 h-full gap-0 lg:gap-0">

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
                        {registrationSuccess ? (lang === 'en' ? 'Success!' : 'Sukces!') : (lang === 'en' ? 'Join Inflee.app' : 'Dołącz do Inflee.app')}
                      </span>
                    </h1>
                  </motion.div>

                  <motion.div variants={heroItemVariants}>
                    <div className="w-40 sm:w-48 lg:w-full lg:max-w-md h-px bg-gradient-to-r from-purple-500 to-pink-500 mt-2.5 mb-1.5 lg:mt-6 lg:mb-2"></div>
                  </motion.div>

                  {!registrationSuccess && (
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
                          {lang === 'en' ? 'to start creating' : 'aby zacząć tworzyć'}
                        </span>
                      </h1>
                    </motion.div>
                  )}
                </motion.div>
              </div>

              <div className="lg:col-span-5 lg:h-full flex items-start lg:items-center justify-center lg:justify-end mt-1 lg:mt-0">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="w-full max-w-md py-0 lg:p-0"
                >
                  {registrationSuccess ? (
                  <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-8 w-full">
                    <div className="text-center space-y-6">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                      >
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/20">
                          <Check className="w-10 h-10 text-white" />
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="space-y-3"
                      >
                        <h2 className="text-3xl font-bold text-white">
                          {lang === 'en' ? 'Registration complete' : 'Rejestracja ukończona'}
                        </h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                          {lang === 'en' ? "We've sent a verification link to:" : 'Wysłaliśmy link weryfikacyjny na adres:'}
                        </p>
                        <div className="bg-white/5 ring-1 ring-white/10 rounded-lg px-4 py-3">
                          <span className="font-mono text-white text-sm break-all">
                            {formData.email}
                          </span>
                        </div>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="space-y-4"
                      >
                        <p className="text-slate-400 text-xs">
                          {lang === 'en' ? 'The link is valid for 24 hours. Please also check your spam folder.' : 'Link jest ważny przez 24 godziny. Sprawdź również folder spam.'}
                        </p>

                        {/* ✅ POPRAWKA: Używamy dynamicznego linku loginHref */}
                        <Link
                          href={loginHref}
                          className="inline-block w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-90 transition-all shadow-lg"
                        >
                          {lang === 'en' ? 'Proceed to login' : 'Przejdź do logowania'}
                        </Link>
                      </motion.div>
                    </div>
                  </div>
                ) : (
                    <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 w-full max-h-full">
                      <div className="mb-4 hidden lg:block">
                        <h2 className="text-xl font-bold text-white">{lang === 'en' ? 'Create your inflee.app account' : 'Utwórz konto w inflee.app'}</h2>
                      </div>

                      <div className="form-scroll-container p-1">
                        <button
                          onClick={handleGoogleSignUp}
                          type="button"
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all duration-200 shadow-md hover:shadow-lg mb-4"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          <span className="text-sm">{lang === 'en' ? 'Sign up with Google' : 'Utwórz konto z Google'}</span>
                        </button>

                        <div className="flex items-center my-4">
                          <div className="flex-grow border-t border-white/10"></div>
                          <span className="flex-shrink-0 mx-3 text-xs text-slate-400">{lang === 'en' ? 'or use your email' : 'lub użyj email'}</span>
                          <div className="flex-grow border-t border-white/10"></div>
                        </div>

                        <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="relative">
                              <input
                                id="firstName"
                                name="firstName"
                                type="text"
                                required
                                value={formData.firstName}
                                onChange={handleChange}
                                className="w-full px-3 pt-5 pb-2 bg-slate-900/95 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 text-white peer text-sm"
                                placeholder=" "
                                readOnly
                                onFocus={handleFocus}
                                autoComplete="given-name"
                              />
                              <label htmlFor="firstName" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">
                                {lang === 'en' ? 'First name *' : 'Imię *'}
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                id="lastName"
                                name="lastName"
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={handleChange}
                                className="w-full px-3 pt-5 pb-2 bg-slate-900/95 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 text-white peer text-sm"
                                placeholder=" "
                                readOnly
                                onFocus={handleFocus}
                                autoComplete="family-name"
                              />
                              <label htmlFor="lastName" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">
                                {lang === 'en' ? 'Last name *' : 'Nazwisko *'}
                              </label>
                            </div>
                          </div>

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
                              id="phone"
                              name="phone"
                              type="tel"
                              value={formData.phone}
                              onChange={handleChange}
                              className="w-full px-3 pt-5 pb-2 bg-slate-900/95 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 text-white peer text-sm"
                              placeholder=" "
                              readOnly
                              onFocus={handleFocus}
                              autoComplete="tel"
                            />
                            <label htmlFor="phone" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">
                              {lang === 'en' ? 'Phone' : 'Telefon'}
                            </label>
                          </div>

                          <input id="socialLink" name="socialLink" type="url" value={formData.socialLink} onChange={handleChange} style={{ display: 'none' }}/>

                          {socialProfile && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: showSocialProfile ? 'auto' : 0, opacity: showSocialProfile ? 1 : 0 }}
                              transition={{ duration: 0.5 }}
                              style={{ overflow: 'hidden' }}
                            >
                              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                {isInstagramProfile(socialProfile) && (
                                  <>
                                    <div className="grid grid-cols-3 gap-3 items-center mb-2">
                                      <div className="text-center">
                                        <div className="w-14 h-14 rounded-full mx-auto p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                                          <img src={socialProfile.profilepic_url!} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-slate-900" onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; }}/>
                                        </div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xl font-bold text-white mb-0.5">{formatNumber(socialProfile.posts_count)}</div>
                                        <div className="text-xs text-slate-400 font-medium">Posts</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xl font-bold text-white mb-0.5">{formatNumber(socialProfile.followers_count)}</div>
                                        <div className="text-xs text-slate-400 font-medium">Followers</div>
                                      </div>
                                    </div>
                                    <div className="border-t border-white/10 pt-2">
                                      <p className="text-xs font-semibold text-white text-center truncate">@{socialProfile.username}</p>
                                    </div>
                                  </>
                                )}
                                {isLinkedInProfile(socialProfile) && (
                                  <>
                                    <div className="grid grid-cols-3 gap-3 items-center mb-2">
                                      <div className="text-center">
                                        <div className="w-14 h-14 rounded-full mx-auto p-0.5 bg-gradient-to-tr from-blue-500 to-cyan-500">
                                          <img src={socialProfile.profilepic_url!} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-slate-900" onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; }}/>
                                        </div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xl font-bold text-white mb-0.5">{formatNumber(socialProfile.followers)}</div>
                                        <div className="text-xs text-slate-400 font-medium">Followers</div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xl font-bold text-white mb-0.5">{formatNumber(socialProfile.connections)}</div>
                                        <div className="text-xs text-slate-400 font-medium">Connections</div>
                                      </div>
                                    </div>
                                    <div className="border-t border-white/10 pt-2">
                                      <p className="text-xs font-semibold text-white text-center truncate">{socialProfile.full_name || `@${socialProfile.username}`}</p>
                                      {socialProfile.headline && (<p className="text-xs text-slate-400 mt-0.5 text-center truncate">{socialProfile.headline}</p>)}
                                    </div>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                autoComplete="new-password"
                              />
                              <label htmlFor="password" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">
                                {lang === 'en' ? 'Password *' : 'Hasło *'}
                              </label>
                            </div>
                            <div className="relative">
                              <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="w-full px-3 pt-5 pb-2 bg-slate-900/95 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-200 text-white peer text-sm"
                                placeholder=" "
                                readOnly
                                onFocus={handleFocus}
                                autoComplete="new-password"
                              />
                              <label htmlFor="confirmPassword" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">
                                {lang === 'en' ? 'Confirm password *' : 'Potwierdź hasło *'}
                              </label>
                            </div>
                          </div>

                          <div className="space-y-2 pt-1">
                            <div className="flex items-start">
                              <div className="flex items-center h-4">
                                <input
                                  id="termsAccepted"
                                  name="termsAccepted"
                                  type="checkbox"
                                  required
                                  checked={formData.termsAccepted}
                                  onChange={handleChange}
                                  className="focus:ring-indigo-500 h-3.5 w-3.5 text-indigo-600 bg-slate-900 border-slate-600 rounded cursor-pointer"
                                />
                              </div>
                              <div className="ml-2 text-xs">
                                <label htmlFor="termsAccepted" className="text-slate-400">
                                  {lang === 'en' ? 'I have read and agree to the ' : 'Zapoznałem się z '}
                                  <a href="/terms" target="_blank" className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
                                    {lang === 'en' ? 'Terms of Service' : 'regulaminem'}
                                  </a>
                                  {lang === 'en' ? ' and ' : ' i '}
                                  <a href="/privacy" target="_blank" className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline">
                                    {lang === 'en' ? 'Privacy Policy' : 'polityką prywatności'}
                                  </a>.
                                </label>
                              </div>
                            </div>
                            <div className="flex items-start">
                              <div className="flex items-center h-4">
                                <input
                                  id="marketingConsent"
                                  name="marketingConsent"
                                  type="checkbox"
                                  checked={formData.marketingConsent}
                                  onChange={handleChange}
                                  className="focus:ring-indigo-500 h-3.5 w-3.5 text-indigo-600 bg-slate-900 border-slate-600 rounded cursor-pointer"
                                />
                              </div>
                              <div className="ml-2 text-xs">
                                <label htmlFor="marketingConsent" className="text-slate-400">
                                  {lang === 'en' ? 'I agree to receive marketing communications no more than once a month.' : 'Wyrażam zgodę na kontakt w celach marketingowych nie częściej niż raz w miesiącu.'}
                                </label>
                              </div>
                            </div>
                          </div>

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

                          <div>
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg cursor-pointer"
                            >
                              {loading ? (
                                <div className="flex items-center">
                                  <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                  <span className="text-sm">{lang === 'en' ? 'Creating account...' : 'Tworzenie konta...'}</span>
                                </div>
                              ) : (
                                lang === 'en' ? 'Register' : 'Zarejestruj się'
                              )}
                            </button>
                          </div>

                          <div className="text-center pt-2">
                            <p className="text-xs text-slate-400">
                              {lang === 'en' ? 'Already have an account? ' : 'Masz już konto? '}
                              {/* ✅ POPRAWKA: Używamy dynamicznego linku loginHref */}
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