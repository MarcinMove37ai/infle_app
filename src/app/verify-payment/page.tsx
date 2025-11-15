// src/app/verify-payment/page.tsx
"use client";

import React, { useState, useEffect } from 'react'; // <--- POPRAWIONA LINIA
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import VerifyPaymentForm from './VerifyPaymentForm'; // Importujemy nasz nowy formularz
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Wczytujemy Stripe poza renderowaniem, aby uniknąć re-renderów
// Upewnij się, że masz ten klucz w pliku .env.local
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function VerifyPaymentPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { status: authStatus } = useSession();
  const router = useRouter();

  useEffect(() => {
    // 1. Sprawdzanie sesji
    if (authStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [authStatus, router]);

  useEffect(() => {
    // 2. Pobieranie Client Secret z naszego API
    if (authStatus === 'authenticated') {
      fetch('/api/stripe/create-setup-intent', {
        method: 'POST',
      })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setClientSecret(data.clientSecret);
        }
      })
      .catch(() => {
        setError('Nie udało się połączyć z serwerem płatności.');
      })
      .finally(() => {
        setLoading(false);
      });
    }
  }, [authStatus]); // Uruchamiamy, gdy sesja będzie gotowa

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
          <p className="mt-4 text-lg text-gray-700">Przygotowywanie formularza...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold">Wystąpił błąd</p>
          <p>{error}</p>
        </div>
      );
    }

    if (clientSecret) {
      // Jeśli mamy secret, renderujemy formularz Stripe
      return (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <VerifyPaymentForm />
        </Elements>
      );
    }

    return null; // Domyślny stan
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">
          Weryfikacja płatności
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Rozpocznij 21-dniowy okres próbny. Weryfikujemy Twoją kartę, ale nie pobierzemy żadnych opłat przed końcem okresu próbnego.
        </p>
        {renderContent()}
      </div>
    </div>
  );
}