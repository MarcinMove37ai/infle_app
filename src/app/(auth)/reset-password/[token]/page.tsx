// src/app/(auth)/reset-password/[token]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ResetPasswordPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [token, setToken] = useState<string>('');
  const router = useRouter();

  // Pobierz token z params asynchronicznie
  useEffect(() => {
    const getToken = async () => {
      const resolvedParams = await params;
      setToken(resolvedParams.token);
    };
    getToken();
  }, [params]);

  // Sprawdź token przy załadowaniu strony
  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      try {
        const response = await fetch('/api/auth/verify-reset-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        if (response.ok) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
        }
      } catch (error) {
        setTokenValid(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Walidacja
    if (password.length < 6) {
      setError('Hasło musi mieć minimum 6 znaków');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Przekierowanie na login po 3 sekundach
        setTimeout(() => {
          router.push('/login?message=Hasło zostało zmienione. Możesz się zalogować.');
        }, 3000);
      } else {
        setError(data.error || 'Wystąpił błąd podczas resetowania hasła');
      }
    } catch (error) {
      setError('Wystąpił błąd podczas resetowania hasła');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-purple-200 border-t-purple-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Sprawdzanie linku...</p>
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

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 ease-out p-6 md:p-8">
          {!tokenValid ? (
            // Invalid token
            <>
              {/* Form Header */}
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-gray-700">
                  Nieprawidłowy link
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Link wygasł lub jest nieprawidłowy
                </p>
                <hr className="mt-4 border-gray-200" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Link wygasł lub jest nieprawidłowy
                </h3>

                <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-red-800 font-medium mb-2">Problem z linkiem</p>
                      <p className="text-red-700 text-sm">
                        Link do resetowania hasła jest nieprawidłowy, wygasł lub został już użyty.
                        Linki są ważne tylko przez 1 godzinę od momentu wygenerowania.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/forgot-password"
                    className="w-full inline-block py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] text-center"
                  >
                    Wyślij nowy link
                  </Link>

                  <Link
                    href="/login"
                    className="w-full inline-block py-3 px-4 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200 hover:shadow-sm text-center"
                  >
                    Powrót do logowania
                  </Link>
                </div>
              </div>
            </>
          ) : success ? (
            // Success state
            <>
              {/* Form Header */}
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-gray-700">
                  Hasło zostało zmienione!
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Za chwilę zostaniesz przekierowany
                </p>
                <hr className="mt-4 border-gray-200" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Hasło zostało pomyślnie zmienione! ✅
                </h3>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-green-800 font-medium mb-2">Sukces!</p>
                      <p className="text-green-700 text-sm">
                        Twoje hasło zostało zaktualizowane. Możesz teraz zalogować się używając nowego hasła.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-center space-x-3 text-sm text-blue-700">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <span>Przekierowywanie na stronę logowania...</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Reset form
            <>
              {/* Form Header */}
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-gray-700">
                  Reset hasła
                </h2>
                <hr className="mt-4 border-gray-200" />
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  {/* Password Field with Floating Label */}
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="peer w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-transparent hover:border-gray-300"
                      placeholder="Nowe hasło"
                    />
                    <label
                      htmlFor="password"
                      className="absolute left-4 top-2 text-xs font-medium text-gray-500 transition-all duration-200 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-4 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-focus:font-medium"
                    >
                      Nowe hasło *
                    </label>
                  </div>

                  {/* Confirm Password Field with Floating Label */}
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="peer w-full px-4 pt-6 pb-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-transparent hover:border-gray-300"
                      placeholder="Potwierdź nowe hasło"
                    />
                    <label
                      htmlFor="confirmPassword"
                      className="absolute left-4 top-2 text-xs font-medium text-gray-500 transition-all duration-200 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-4 peer-focus:top-2 peer-focus:text-xs peer-focus:text-blue-600 peer-focus:font-medium"
                    >
                      Potwierdź nowe hasło *
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
                        Zmienianie hasła...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                        </svg>
                        Ustaw nowe hasło
                      </div>
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
                    Pamiętasz hasło?{' '}
                    <Link
                      href="/login"
                      className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200 hover:underline"
                    >
                      Zaloguj się
                    </Link>
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}