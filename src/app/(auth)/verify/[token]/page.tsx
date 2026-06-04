// src/app/(auth)/verify/[token]/page.tsx
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import VerifyClient from './VerifyClient';

export const dynamic = 'force-dynamic';

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

  // --- Logika weryfikacji (niezmieniona względem oryginału) ---
  // Weryfikacja dzieje się server-side i atomowo: znajdź niezweryfikowanego usera z tym
  // tokenem, ustaw emailVerified i wyczyść token. Wynik przekazujemy do klienta jako propsy.
  let verificationResult: 'success' | 'invalid' | 'error' = 'error';
  let userEmail = '';

  try {
    const user = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        emailVerified: null, // tylko niezweryfikowani
      },
    });

    if (!user) {
      verificationResult = 'invalid';
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          verificationToken: null,
        },
      });
      verificationResult = 'success';
      userEmail = user.email;
    }
  } catch (error) {
    console.error('Verification error:', error);
    verificationResult = 'error';
  }

  return (
    <Suspense fallback={
      <div className="h-screen w-full bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <VerifyClient result={verificationResult} email={userEmail} />
    </Suspense>
  );
}