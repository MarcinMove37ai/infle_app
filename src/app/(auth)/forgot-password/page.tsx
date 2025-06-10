// src/app/(auth)/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

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
        setMessage('Link do resetowania hasła został wysłany na Twój email!');
      } else {
        setError(data.error || 'Wystąpił błąd podczas wysyłania emaila');
      }
    } catch (error) {
      setError('Wystąpił błąd podczas wysyłania emaila');
    } finally {
      setLoading(false);
    }
  };

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

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 ease-out p-6 md:p-8">
          {emailSent ? (
            <>
              {/* Form Header */}
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-gray-700">
                  Link resetujący został wysłany!
                </h2>
                <hr className="mt-4 border-gray-200" />
              </div>

              <div className="text-center">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="text-center">
                    <div className="flex justify-center mb-1">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <p className="text-blue-800 font-medium mb-2 text-lg">
                      Sprawdź swoją skrzynkę pocztową
                    </p>
                    <p className="text-blue-700 text-sm mb-4">
                      Wysłaliśmy link do resetowania hasła na adres:
                    </p>
                    <div className="bg-white border border-blue-300 rounded-lg px-4 py-3 shadow-sm">
                      <span className="font-mono text-blue-900 font-semibold text-base break-all">{email}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-yellow-800 text-sm font-medium mb-1">Nie widzisz emaila?</p>
                      <p className="text-yellow-700 text-sm">
                        Sprawdź folder spam lub spróbuj ponownie za kilka minut.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/login"
                    className="w-full inline-block py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] text-center"
                  >
                    Powrót do logowania
                  </Link>

                  <button
                    onClick={() => {
                      setEmailSent(false);
                      setEmail('');
                      setError('');
                      setMessage('');
                    }}
                    className="w-full py-3 px-4 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200 hover:shadow-sm"
                  >
                    Wyślij ponownie
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Form Header */}
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-gray-700">
                  Reset hasła
                </h2>
                <hr className="mt-4 border-gray-200" />
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Adres email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 hover:border-gray-300"
                    placeholder="jan.kowalski@example.com"
                  />
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

                {message && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="5 13l4 4L19 7"></path>
                      </svg>
                      <div className="text-green-700 text-sm font-medium">{message}</div>
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
                        Wysyłanie...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                        </svg>
                        Wyślij link resetujący
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