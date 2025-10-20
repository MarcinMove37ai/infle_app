// src/app/(auth)/register/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function RegisterPage() {
  const heroContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12, // Efekt "przechodzenia" animacji na dzieci
      },
    },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 10 }, // Startuje lekko niżej
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
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

  // Social profile state
  const [socialProfile, setSocialProfile] = useState<SocialProfile>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [platformType, setPlatformType] = useState<PlatformType>(null);
  const [showSocialProfile, setShowSocialProfile] = useState(false);

  const [checkedProfileId, setCheckedProfileId] = useState<string | null>(null);

  const router = useRouter();

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
    // Mockup - tutaj będzie integracja z Google OAuth
    alert('Rejestracja przez Google - funkcja w przygotowaniu');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      setError('Pola Imię, Nazwisko i Adres email są wymagane.');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Hasła nie są identyczne');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Hasło musi mieć minimum 6 znaków');
      setLoading(false);
      return;
    }

    if (!formData.termsAccepted) {
      setError('Musisz zaakceptować regulamin i politykę prywatności');
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
      } else {
        setError(data.error || 'Wystąpił błąd podczas rejestracji');
      }
    } catch (error) {
      setError('Wystąpił błąd podczas rejestracji');
    } finally {
      setLoading(false);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.removeAttribute('readonly');
  };

  const isInstagramProfile = (profile: SocialProfile): profile is InstagramProfileResponse => profile !== null && 'followers_count' in profile;
  const isLinkedInProfile = (profile: SocialProfile): profile is LinkedInProfileResponse => profile !== null && 'followers' in profile;

  if (registrationSuccess) {
    return (
      <div className="register-page-wrapper">
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
        `}</style>

        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10 h-16">
          <div className="container mx-auto px-6 h-full flex items-center">
            <Link href="/" className="group flex items-center cursor-pointer">
              <div className="w-10 h-10 bg-slate-800/70 backdrop-blur-sm rounded-lg ring-1 ring-white/20 flex items-center justify-center p-1.5 group-hover:ring-white/30 transition-all duration-300 mr-2">
                <Image src="/logoW.png" alt="inflee.app logo" width={40} height={40} className="w-full h-full object-contain" priority />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text leading-tight">inflee.app</h1>
                <p className="text-[10px] text-slate-400 tracking-wide uppercase leading-tight group-hover:text-slate-300 transition-colors duration-300">
                  Edukuj | Rośnij | Zarabiaj
                </p>
              </div>
            </Link>
          </div>
        </header>

        {/* Success Content */}
        <main className="pt-16 h-screen flex items-center justify-center px-4">
          <div className="max-w-xl w-full">
            <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8">
              <div className="text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                </div>

                <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                  Konto zostało utworzone! 🎉
                </h2>

                <div className="bg-white/5 ring-1 ring-indigo-400/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <p className="text-indigo-300 font-semibold text-base">Sprawdź swoją skrzynkę pocztową</p>
                  </div>
                  <div className="bg-slate-900/50 ring-1 ring-white/10 rounded-lg px-3 py-2">
                    <span className="font-mono text-white font-semibold text-sm break-all">{formData.email}</span>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <h3 className="text-xs font-semibold text-slate-300 mb-3">Następne kroki:</h3>
                  <div className="space-y-2">
                    <div className="flex items-start text-left">
                      <span className="bg-indigo-500/20 text-indigo-300 text-xs font-medium px-1.5 py-0.5 rounded-full mr-2 mt-0.5 flex-shrink-0">1</span>
                      <span className="text-xs text-slate-400">Sprawdź swoją skrzynkę pocztową</span>
                    </div>
                    <div className="flex items-start text-left">
                      <span className="bg-indigo-500/20 text-indigo-300 text-xs font-medium px-1.5 py-0.5 rounded-full mr-2 mt-0.5 flex-shrink-0">2</span>
                      <span className="text-xs text-slate-400">Kliknij link weryfikacyjny w emailu</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/10 ring-1 ring-amber-500/20 rounded-lg px-3 py-2 mb-4">
                  <p className="text-xs text-amber-300">
                    ⏰ Link weryfikacyjny jest ważny przez 24 godziny
                  </p>
                </div>

                <Link href="/login" className="inline-block px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-lg text-sm">
                  Przejdź do logowania
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="register-page-wrapper">
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

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md border-b border-white/10 h-16">
        <div className="container mx-auto px-6 lg:px-8 lg:pr-16 xl:pr-24 2xl:pr-32 h-full flex justify-between items-center">
          <Link href="/" className="group flex items-center cursor-pointer">
            <div className="w-10 h-10 bg-slate-800/70 backdrop-blur-sm rounded-lg ring-1 ring-white/20 flex items-center justify-center p-1.5 group-hover:ring-white/30 transition-all duration-300 mr-2">
              <Image src="/logoW.png" alt="inflee.app logo" width={40} height={40} className="w-full h-full object-contain" priority />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text leading-tight">inflee.app</h1>
              <p className="text-[10px] text-slate-400 tracking-wide uppercase leading-tight group-hover:text-slate-300 transition-colors duration-300">
                Edukuj | Rośnij | Zarabiaj
              </p>
            </div>
          </Link>

          <Link href="/login" className="px-4 py-1.5 bg-white/10 border border-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-semibold transition">
            Zaloguj
          </Link>
        </div>
      </header>

        {/* Main Content */}
        <main className="pt-16 h-screen">
          <section className="h-full relative">
            {/* Hero Image - responsywny */}
            <div className="absolute top-0 left-0 w-full h-full z-0 lg:flex lg:justify-start">
              <Image
                src="/heroR.webp"
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

            {/* Gradient overlay - widoczny tylko na dużych ekranach */}
            <div className="absolute top-0 left-0 w-full h-full z-10 bg-[#010101]/80 lg:bg-none lg:bg-gradient-to-r lg:from-transparent lg:via-[#010101]/90 lg:to-[#010101]/90" />

            {/* Container z gridem */}
            <div className="container mx-auto px-2 lg:px-8 lg:pr-16 xl:pr-24 2xl:pr-32 relative z-20 grid grid-cols-1 lg:grid-cols-12 h-full">

              {/* Tekst landing page'a - widoczny tylko na dużych ekranach */}
              <div className="hidden lg:col-span-5 lg:flex flex-col justify-center items-start text-left pr-10">
                  <motion.div variants={heroItemVariants}>
                    {/* ZMIENIONY NAGŁÓWEK H1 */}
                    <h1 className="text-2xl md:text-4xl lg:text-7xl font-extrabold text-white leading-[1.1]">
                      <span className="block">Utwórz konto</span>
                      <span className="gradient-text block">Aby Zacząć Tworzyć</span>
                      <span className="gradient-text block"></span>
                    </h1>
                    <div className="w-84 h-px bg-gradient-to-r from-purple-500 to-pink-500 my-4"></div>
                  </motion.div>
              </div>

              {/* Formularz rejestracyjny */}
                <div className="lg:col-span-7 h-full flex items-center justify-center lg:justify-end">
                  <div className="w-full max-w-md p-4 lg:p-0">
                    <div className="bg-black/40 border border-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 w-full max-h-full">
                      <div className="mb-4 lg:hidden">
                        <h2 className="text-2xl font-bold text-white mb-1">Utwórz konto</h2>
                        <p className="text-sm text-slate-400">Aby zacząć tworzyć z Inflee.app </p>
                      </div>

                    <div className="form-scroll-container p-1">
                      {/* Google Sign Up Button */}
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
                        <span className="text-sm">Zarejestruj się przez Google</span>
                      </button>

                      <div className="flex items-center my-4">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink-0 mx-3 text-xs text-slate-400">lub użyj email</span>
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
                            <label htmlFor="firstName" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">Imię *</label>
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
                            <label htmlFor="lastName" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">Nazwisko *</label>
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
                          <label htmlFor="email" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">Adres email *</label>
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
                          <label htmlFor="phone" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">Telefon</label>
                        </div>

                        <input id="socialLink" name="socialLink" type="url" value={formData.socialLink} onChange={handleChange} style={{ display: 'none' }}/>

                        {socialProfile && (
                          <div className={`transition-all duration-500 ease-in-out ${showSocialProfile ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
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
                          </div>
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
                            <label htmlFor="password" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">Hasło *</label>
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
                            <label htmlFor="confirmPassword" className="absolute left-3 top-3 text-slate-400 text-xs transition-all duration-200 peer-placeholder-shown:top-3 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-indigo-400 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-slate-400">Potwierdź hasło *</label>
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
                                className="focus:ring-indigo-500 h-3.5 w-3.5 text-indigo-600 bg-slate-900 border-slate-600 rounded"
                              />
                            </div>
                            <div className="ml-2 text-xs">
                              <label htmlFor="termsAccepted" className="text-slate-400">
                                Zapoznałem się z <a href="/terms" target="_blank" className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline">regulaminem</a> i <a href="/privacy" target="_blank" className="font-medium text-indigo-400 hover:text-indigo-300 hover:underline">polityką prywatności</a>.
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
                                className="focus:ring-indigo-500 h-3.5 w-3.5 text-indigo-600 bg-slate-900 border-slate-600 rounded"
                              />
                            </div>
                            <div className="ml-2 text-xs">
                              <label htmlFor="marketingConsent" className="text-slate-400">
                                Wyrażam zgodę na kontakt w celach marketingowych nie częściej niż raz w miesiącu.
                              </label>
                            </div>
                          </div>
                        </div>

                        {error && (
                          <div className="bg-red-500/10 ring-1 ring-red-500/20 rounded-xl p-3">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 text-red-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                              <div className="text-red-400 text-xs font-medium">{error}</div>
                            </div>
                          </div>
                        )}

                        <div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                          >
                            {loading ? (
                              <div className="flex items-center">
                                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                <span className="text-sm">Tworzenie konta...</span>
                              </div>
                            ) : (
                              'Utwórz konto'
                            )}
                          </button>
                        </div>

                        <div className="text-center pt-2">
                          <p className="text-xs text-slate-400">
                            Masz już konto?{' '}
                            <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300 transition-colors duration-200 hover:underline">
                              Zaloguj się
                            </Link>
                          </p>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
    </div>
  );
}