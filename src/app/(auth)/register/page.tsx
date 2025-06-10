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

  // Instagram profile state
  const [instagramProfile, setInstagramProfile] = useState<InstagramProfileResponse | null>(null);
  const [instagramLoading, setInstagramLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);

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

  const isInstagramUrl = (url: string): boolean => {
    return url.includes('instagram.com') && url.includes('/');
  };

  const checkInstagramProfile = async (url: string) => {
    if (!isInstagramUrl(url)) {
      setInstagramProfile(null);
      return;
    }

    setInstagramLoading(true);
    setCheckingProfile(true);

    try {
      const response = await fetch('/api/instagram-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (response.ok) {
        // Sprawdź czy wszystkie wymagane dane są dostępne
        if (data.profilepic_url && data.followers_count !== null && data.posts_count !== null) {
          setInstagramProfile(data);
        } else {
          setInstagramProfile(null);
        }
      } else {
        setInstagramProfile(null);
      }
    } catch (error) {
      setInstagramProfile(null);
    } finally {
      setInstagramLoading(false);
      setCheckingProfile(false);
    }
  };

  // Debounced Instagram check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.socialLink) {
        checkInstagramProfile(formData.socialLink);
      } else {
        setInstagramProfile(null);
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
          profilePicture: instagramProfile?.profilepic_url || null,  // ← DODAJ TĘ LINIĘ
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

  // Komunikat sukcesu po rejestracji (bez zmian)
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6">
          {/* Logo Section */}
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center p-2 hover:shadow-xl transition-shadow duration-300">
                <img
                  src="/logo.png"
                  alt="inflee.app logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
              inflee.app
            </h1>
            <p className="text-sm text-gray-500 font-medium tracking-wide uppercase leading-tight">
              Edukuj | Rośnij | Zarabiaj
            </p>
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
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
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center p-2 hover:shadow-xl transition-shadow duration-300 cursor-pointer">
              <img
                src="/logo.png"
                alt="inflee.app logo"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            inflee.app
          </h1>
          <p className="text-sm text-gray-500 font-medium tracking-wide uppercase leading-tight">
            Edukuj | Rośnij | Zarabiaj
          </p>
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
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                  Imię *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                  placeholder="Jan"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                  Nazwisko *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                  placeholder="Kowalski"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Adres email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                placeholder="jan.kowalski@example.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                  placeholder="+48 123 456 789"
                />
              </div>
              <div>
                <label htmlFor="socialLink" className="block text-sm font-medium text-gray-700 mb-2">
                  Link Instagram
                  {checkingProfile && (
                    <span className="ml-2 text-xs text-blue-600">Sprawdzanie...</span>
                  )}
                </label>
                <input
                  id="socialLink"
                  name="socialLink"
                  type="url"
                  value={formData.socialLink}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                  placeholder="instagram.com/username"
                />
              </div>
            </div>

            {/* Instagram Profile Display */}
            {instagramProfile && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 transition-all duration-300 ease-in-out">
                {/* Top row: Photo | Posts | Followers */}
                <div className="grid grid-cols-3 gap-4 items-center mb-3">
                  {/* Profile Picture */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full mx-auto p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                      <img
                        src={instagramProfile.profilepic_url!}
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
                      {formatNumber(instagramProfile.posts_count)}
                    </div>
                    <div className="text-xs text-gray-600 font-medium">Posts</div>
                  </div>

                  {/* Followers */}
                  <div className="text-center">
                    <div className="text-2xl font-bold text-pink-600 mb-1">
                      {formatNumber(instagramProfile.followers_count)}
                    </div>
                    <div className="text-xs text-gray-600 font-medium">Followers</div>
                  </div>
                </div>

                {/* Horizontal Divider */}
                <div className="border-t border-green-200 mb-3"></div>

                {/* Username centered at bottom */}
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900 break-all">@{instagramProfile.username}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Hasło *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                  placeholder="Min. 6 znaków"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Potwierdź hasło *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                  placeholder="Powtórz hasło"
                />
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