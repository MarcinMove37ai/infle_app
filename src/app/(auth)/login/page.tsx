'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [showVerificationView, setShowVerificationView] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const router = useRouter();

  // Timer dla przycisku resend
  useEffect(() => {
    if (showVerificationView && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [showVerificationView, countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowResendButton(false);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // 🔥 KLUCZOWA ZMIANA - Sprawdzamy czy błąd dotyczy weryfikacji emaila
        if (result.error === 'Email nie został zweryfikowany') {
          setError('Musisz zweryfikować swój email przed pierwszym logowaniem. Sprawdź swoją skrzynkę pocztową.');
          setShowResendButton(true);
          setShowVerificationView(true);
          setCountdown(60);
        } else {
          setError(result.error);
        }
      } else if (result?.ok) {
        // Email jest już zweryfikowany - możemy przekierować
        router.push('/dashboard');
      }
    } catch (error) {
      setError('Wystąpił błąd podczas logowania');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setError('Email weryfikacyjny został wysłany ponownie. Sprawdź swoją skrzynkę pocztową.');
        setShowResendButton(false);
        setCountdown(60);
      } else {
        setError('Błąd podczas wysyłania emaila weryfikacyjnego');
      }
    } catch (error) {
      setError('Błąd podczas wysyłania emaila weryfikacyjnego');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo Section */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center p-2 hover:shadow-md transition-shadow duration-200">
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
          <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">
            Edukuj | Rośnij | Zarabiaj
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 ease-out p-8">
          {/* Form Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-700 text-center">
              {showVerificationView ? 'Konieczna weryfikacja email' : 'Zaloguj się do swojego konta'}
            </h2>
            <hr className="mt-4 border-gray-200" />
          </div>

          {!showVerificationView ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Adres email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                    placeholder="Wprowadź swój email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Hasło
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                    placeholder="Wprowadź swoje hasło"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-red-700 text-sm font-medium">{error}</div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Logowanie...
                    </div>
                  ) : (
                    'Zaloguj się'
                  )}
                </button>
              </div>

              {/* Links Section */}
              <div className="text-center space-y-3">
                <p className="text-sm text-gray-600">
                  <Link href="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                    Zapomniałeś hasła?
                  </Link>
                </p>
                <p className="text-sm text-gray-600">
                  Nie masz konta?{' '}
                  <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                    Zarejestruj się
                  </Link>
                </p>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-red-700 text-sm font-medium">{error}</div>
                  </div>
                </div>
              )}

              {showResendButton && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-center">
                    <p className="text-blue-800 text-sm mb-3">
                      Nie otrzymałeś emaila weryfikacyjnego?
                    </p>
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={countdown > 0}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium ${
                        countdown > 0
                          ? 'text-gray-400 bg-gray-100 border border-gray-300 cursor-not-allowed'
                          : 'text-blue-600 bg-white border border-blue-300 hover:bg-blue-50'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors`}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                      </svg>
                      {countdown > 0 ? `Wyślij ponownie (${countdown}s)` : 'Wyślij ponownie email weryfikacyjny'}
                    </button>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600 text-center">
                Nie masz konta?{' '}
                <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                  Zarejestruj się
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}