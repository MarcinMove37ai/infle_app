// src/app/(auth)/register/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface InstagramProfileResponse {
  profilepic_url: string | null;
  username: string;
  followers_count: number | null;
  posts_count: number | null;
}

interface LinkedInProfileResponse {
  profilepic_url: string | null;
  username: string;
  followers: number | null;
  connections: number | null;
  full_name: string | null;
  headline: string | null;
}

type SocialProfile = InstagramProfileResponse | LinkedInProfileResponse | null;
type PlatformType = 'instagram' | 'linkedin' | null;

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    socialLink: '',
    password: '',
    confirmPassword: ''
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
      { time: 500, progress: 10 },
      { time: 1000, progress: 20 },
      { time: 1500, progress: 35 },
      { time: 2500, progress: 50 },
      { time: 4000, progress: 65 },
      { time: 5500, progress: 80 },
      { time: 7000, progress: 95 },
      { time: 8000, progress: 100 }
    ];

    intervals.forEach(({ time, progress }) => {
      setTimeout(() => {
        setLoadingProgress(progress);
      }, time);
    });
  };

  const checkInstagramProfile = async (url: string) => {
    try {
      const response = await fetch('/api/instagram-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (response.ok && data.exist) {
        // Sprawdź czy wszystkie wymagane dane są dostępne
        if (data.profilepic_url && data.followers_count !== null && data.posts_count !== null) {
          setSocialProfile(data);
          return true;
        }
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (response.ok && data.exist) {
        // Sprawdź czy wszystkie wymagane dane są dostępne
        if (data.profilepic_url && data.followers !== null && data.connections !== null) {
          setSocialProfile(data);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('LinkedIn profile check error:', error);
      return false;
    }
  };

  const checkSocialProfile = async (url: string) => {
    const platform = detectPlatform(url);

    if (!platform) {
      setSocialProfile(null);
      setPlatformType(null);
      setLoadingProgress(0);
      return;
    }

    setPlatformType(platform);
    setSocialLoading(true);
    setCheckingProfile(true);
    simulateProgress();

    let success = false;

    if (platform === 'instagram') {
      success = await checkInstagramProfile(url);
    } else if (platform === 'linkedin') {
      success = await checkLinkedInProfile(url);
    }

    if (!success) {
      setSocialProfile(null);
    }

    // Krótkie opóźnienie aby pokazać 100%
    setTimeout(() => {
      setSocialLoading(false);
      setCheckingProfile(false);
      setLoadingProgress(0);
    }, 200);
  };

  // Debounced social check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.socialLink) {
        checkSocialProfile(formData.socialLink);
      } else {
        setSocialProfile(null);
        setPlatformType(null);
        setLoadingProgress(0);
      }
    }, 1000); // 1 sekunda opóźnienia

    return () => clearTimeout(timer);
  }, [formData.socialLink]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Podstawowa walidacja
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

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          socialLink: formData.socialLink,
          profilePicture: socialProfile?.profilepic_url || null,
          password: formData.password,
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

  // Helper functions for profile display
  const isInstagramProfile = (profile: SocialProfile): profile is InstagramProfileResponse => {
    return profile !== null && 'followers_count' in profile;
  };

  const isLinkedInProfile = (profile: SocialProfile): profile is LinkedInProfileResponse => {
    return profile !== null && 'followers' in profile;
  };

  // Komunikat sukcesu po rejestracji (bez zmian)
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6">
          {/* Logo Section */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="w-20 h-20 bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center p-2 hover:shadow-xl transition-shadow duration-300 mr-3">
                <img
                  src="/logo.png"
                  alt="inflee.app logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  inflee.app
                </h1>
                <p className="text-xs text-gray-500 font-medium tracking-wide uppercase leading-tight">
                  Edukuj | Rośnij | Zarabiaj
                </p>
              </div>
            </div>
          </div>

          {/* Success Message */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 ease-out p-6 md:p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Konto zostało utworzone! 🎉
              </h2>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 mb-6">
                <div className="text-center">
                  <div className="flex justify-center mb-0.5">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v10a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                  <p className="text-blue-800 font-medium mb-2 text-lg">
                    Sprawdź swoją skrzynkę pocztową
                  </p>
                  <div className="bg-white border border-blue-300 rounded-lg px-4 py-3 shadow-sm">
                    <span className="font-mono text-blue-900 font-semibold text-base break-all">{formData.email}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="9 5l7 7-7 7"></path>
                  </svg>
                  Następne kroki:
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full mr-3 mt-0.5 flex-shrink-0">1</span>
                    <span className="text-sm text-gray-600">Sprawdź swoją skrzynkę pocztową</span>
                  </div>
                  <div className="flex items-start">
                    <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full mr-3 mt-0.5 flex-shrink-0">2</span>
                    <span className="text-sm text-gray-600">Kliknij link weryfikacyjny w emailu</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                ⏰ Link weryfikacyjny jest ważny przez 24 godziny
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Logo Section */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="w-20 h-20 bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center p-2 hover:shadow-xl transition-shadow duration-300 cursor-pointer mr-3">
              <img
                src="/logo.png"
                alt="inflee.app logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                inflee.app
              </h1>
              <p className="text-xs text-gray-500 font-medium tracking-wide uppercase leading-tight">
                Edukuj | Rośnij | Zarabiaj
              </p>
            </div>
          </div>
        </div>

        {/* Register Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 ease-out p-6 md:p-8">
          {/* Form Header */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-gray-700">
              Utwórz nowe konto
            </h2>
            <hr className="mt-4 border-gray-200" />
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 hover:border-gray-300 peer"
                  placeholder=" "
                />
                <label htmlFor="firstName" className="absolute left-4 top-4 text-gray-500 text-sm transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-600">
                  Imię *
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
                  className="w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 hover:border-gray-300 peer"
                  placeholder=" "
                />
                <label htmlFor="lastName" className="absolute left-4 top-4 text-gray-500 text-sm transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-600">
                  Nazwisko *
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
                className="w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 hover:border-gray-300 peer"
                placeholder=" "
              />
              <label htmlFor="email" className="absolute left-4 top-4 text-gray-500 text-sm transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-600">
                Adres email *
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 hover:border-gray-300 peer"
                  placeholder=" "
                />
                <label htmlFor="phone" className="absolute left-4 top-4 text-gray-500 text-sm transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-600">
                  Telefon
                </label>
              </div>
              <div className="relative">
                <input
                  id="socialLink"
                  name="socialLink"
                  type="url"
                  value={formData.socialLink}
                  onChange={handleChange}
                  className={`w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 ${
                    checkingProfile ? 'text-gray-400' : 'text-gray-900'
                  } hover:border-gray-300 relative z-0 bg-white peer`}
                  placeholder=" "
                />
                <label htmlFor="socialLink" className="absolute left-4 top-4 text-gray-500 text-sm transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-600 z-20">
                  Instagram/LinkedIn
                </label>
                {checkingProfile && (
                  <>
                    <div
                      className={`absolute inset-0 ${
                        platformType === 'instagram'
                          ? 'border-green-300'
                          : 'border-blue-300'
                      } border rounded-xl transition-all duration-300 ease-out z-30 pointer-events-none`}
                      style={{
                        clipPath: `inset(0 ${100 - loadingProgress}% 0 0)`,
                        background: platformType === 'instagram'
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'rgba(59, 130, 246, 0.15)'
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
                      <div className={`px-2 py-0.5 rounded-md text-xs font-medium backdrop-blur-sm border ${
                        platformType === 'instagram'
                          ? 'bg-green-50/90 text-green-700 border-green-200/50'
                          : 'bg-blue-50/90 text-blue-700 border-blue-200/50'
                      } shadow-sm`}>
                        {loadingProgress}%
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Social Profile Display */}
            {socialProfile && (
              <div className={`${
                platformType === 'instagram'
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                  : 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
              } border rounded-xl p-4 transition-all duration-300 ease-in-out`}>

                {/* Instagram Profile */}
                {isInstagramProfile(socialProfile) && (
                  <>
                    {/* Top row: Photo | Posts | Followers */}
                    <div className="grid grid-cols-3 gap-4 items-center mb-3">
                      {/* Profile Picture */}
                      <div className="text-center">
                        <div className="w-20 h-20 rounded-full mx-auto p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                          <img
                            src={socialProfile.profilepic_url!}
                            alt="Profile"
                            className="w-full h-full rounded-full object-cover border-2 border-white"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>

                      {/* Posts */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600 mb-1">
                          {formatNumber(socialProfile.posts_count)}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Posts</div>
                      </div>

                      {/* Followers */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-pink-600 mb-1">
                          {formatNumber(socialProfile.followers_count)}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Followers</div>
                      </div>
                    </div>

                    {/* Horizontal Divider */}
                    <div className="border-t border-green-200 mb-3"></div>

                    {/* Username centered at bottom */}
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900 truncate">@{socialProfile.username}</p>
                    </div>
                  </>
                )}

                {/* LinkedIn Profile */}
                {isLinkedInProfile(socialProfile) && (
                  <>
                    {/* Top row: Photo | Followers | Connections */}
                    <div className="grid grid-cols-3 gap-4 items-center mb-3">
                      {/* Profile Picture */}
                      <div className="text-center">
                        <div className="w-20 h-20 rounded-full mx-auto p-0.5 bg-gradient-to-tr from-blue-500 to-cyan-500">
                          <img
                            src={socialProfile.profilepic_url!}
                            alt="Profile"
                            className="w-full h-full rounded-full object-cover border-2 border-white"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </div>
                      </div>

                      {/* Followers */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600 mb-1">
                          {formatNumber(socialProfile.followers)}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Followers</div>
                      </div>

                      {/* Connections */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-cyan-600 mb-1">
                          {formatNumber(socialProfile.connections)}
                        </div>
                        <div className="text-xs text-gray-600 font-medium">Connections</div>
                      </div>
                    </div>

                    {/* Horizontal Divider */}
                    <div className="border-t border-blue-200 mb-3"></div>

                    {/* Name and headline */}
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {socialProfile.full_name || `@${socialProfile.username}`}
                      </p>
                      {socialProfile.headline && (
                        <p className="text-xs text-gray-600 mt-1 truncate">{socialProfile.headline}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 hover:border-gray-300 peer"
                  placeholder=" "
                />
                <label htmlFor="password" className="absolute left-4 top-4 text-gray-500 text-sm transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-600">
                  Hasło *
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
                  className="w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 hover:border-gray-300 peer"
                  placeholder=" "
                />
                <label htmlFor="confirmPassword" className="absolute left-4 top-4 text-gray-500 text-sm transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-gray-600">
                  Potwierdź hasło *
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div className="text-red-700 text-sm font-medium">{error}</div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Tworzenie konta...
                  </div>
                ) : (
                  'Utwórz konto'
                )}
              </button>
            </div>

            <div className="text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">lub</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Masz już konto?{' '}
                <Link
                  href="/login"
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200 hover:underline"
                >
                  Zaloguj się
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}