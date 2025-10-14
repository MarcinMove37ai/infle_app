// src/app/subscribe/success/SuccessContent.tsx

"use client" // Dyrektywa na samym początku pliku

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

// Ten komponent zawiera całą logikę kliencką
export default function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Symulacja sprawdzenia sesji
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  }, [sessionId]);

  if (loading) {
    return (
      <div className="text-center">
        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-green-500 border-r-transparent mb-4"></div>
        <p className="text-gray-600">Potwierdzanie płatności...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Płatność zakończona!
        </h1>
        <p className="text-gray-600 mb-8">
          Twoja subskrypcja została aktywowana. Możesz teraz tworzyć i publikować nieograniczoną liczbę stron.
        </p>
        {sessionId && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">ID Sesji:</p>
            <p className="text-xs text-gray-700 font-mono break-all">{sessionId}</p>
          </div>
        )}
        <div className="space-y-3">
          <Link
            href="/strony-zapisu"
            className="flex items-center justify-center w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-all"
          >
            Przejdź do moich stron
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
          <Link
            href="/dashboard"
            className="block w-full text-gray-600 hover:text-gray-900 py-3 px-4 rounded-lg font-medium transition-all"
          >
            Wróć do dashboardu
          </Link>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Masz pytania?{' '}
            <a href="mailto:support@inflee.app" className="text-blue-600 hover:text-blue-700">
              Skontaktuj się z nami
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}