// src/app/(auth)/verify/[token]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

interface VerifyPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { token } = await params;

  if (!token) {
    return notFound();
  }

  let verificationResult: 'success' | 'invalid' | 'error' = 'error';
  let userEmail = '';

  try {
    // Znajdź usera z tym tokenem
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        emailVerified: null // Tylko niezweryfikowani
      }
    });

    if (!user) {
      verificationResult = 'invalid';
    } else {
      // Zweryfikuj email
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          verificationToken: null
        }
      });
      verificationResult = 'success';
      userEmail = user.email;
    }
  } catch (error) {
    console.error('Verification error:', error);
    verificationResult = 'error';
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

        {/* Verification Result */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 ease-out p-6 md:p-8">
          {verificationResult === 'success' && (
            <>
              {/* Form Header */}
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-gray-700">
                  Email zweryfikowany!
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Twoje konto zostało aktywowane
                </p>
                <hr className="mt-4 border-gray-200" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Email został pomyślnie zweryfikowany! ✅
                </h3>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-green-800 font-medium mb-2">
                        🎉 Gratulacje!
                      </p>
                      <p className="text-green-700 text-sm">
                        Twój email został pomyślnie zweryfikowany. <br />
                        Możesz się teraz zalogować do swojego konta i rozpocząć korzystanie z platformy.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-blue-800 text-sm font-medium mb-1">Co dalej?</p>
                      <p className="text-blue-700 text-sm">
                        Kliknij przycisk poniżej, aby przejść do strony logowania i zalogować się po raz pierwszy.
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/login"
                  className="w-full inline-block py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] text-center"
                >
                  <div className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                    </svg>
                    Przejdź do logowania
                  </div>
                </Link>
              </div>
            </>
          )}

          {verificationResult === 'invalid' && (
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
                  Link weryfikacyjny nieprawidłowy
                </h3>

                <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-red-800 font-medium mb-2">
                        ⚠️ Problem z weryfikacją
                      </p>
                      <p className="text-red-700 text-sm">
                        Link weryfikacyjny jest nieprawidłowy, wygasł lub został już użyty.
                        Linki weryfikacyjne są ważne przez 24 godziny od momentu rejestracji.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-blue-800 text-sm font-medium mb-1">Co mogę zrobić?</p>
                      <p className="text-blue-700 text-sm">
                        Spróbuj zarejestrować się ponownie lub skontaktuj się z obsługą, jeśli problem się powtarza.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Link
                    href="/register"
                    className="w-full inline-block py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] text-center"
                  >
                    Zarejestruj się ponownie
                  </Link>

                  <Link
                    href="/login"
                    className="w-full inline-block py-3 px-4 border border-gray-300 text-sm font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200 hover:shadow-sm text-center"
                  >
                    Przejdź do logowania
                  </Link>
                </div>
              </div>
            </>
          )}

          {verificationResult === 'error' && (
            <>
              {/* Form Header */}
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-gray-700">
                  Błąd weryfikacji
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Wystąpił problem techniczny
                </p>
                <hr className="mt-4 border-gray-200" />
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Wystąpił błąd serwera
                </h3>

                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-6 h-6 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-yellow-800 font-medium mb-2">
                        🔧 Wystąpił problem techniczny
                      </p>
                      <p className="text-yellow-700 text-sm">
                        Przepraszamy za problem. Spróbuj ponownie za kilka minut lub skontaktuj się z obsługą techniczną.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div className="text-left">
                      <p className="text-gray-700 text-sm">
                        Jeśli problem się powtarza, prosimy o kontakt z obsługą techniczną, podając link tej strony.
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/login"
                  className="w-full inline-block py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98] text-center"
                >
                  Przejdź do logowania
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}