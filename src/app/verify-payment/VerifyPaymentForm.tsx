// src/app/verify-payment/VerifyPaymentForm.tsx
"use client";

import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function VerifyPaymentForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ================================================================
  // ⭐ POPRAWIONY OBIEKT OPCJI
  // Usunęliśmy obiekt 'fields'. Sam 'layout' wystarczy,
  // aby Stripe pokazał pełny formularz adresu rozliczeniowego.
  // ================================================================
  const paymentElementOptions = {
    layout: {
      type: 'tabs',
      defaultOpen: {
        billingDetails: true, // To wystarczy, aby wymusić pokazanie pól
      },
    },
  };
  // ================================================================

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    if (!stripe || !elements) {
      setIsLoading(false);
      return;
    }

    // Wymagane do zebrania danych z pól formularza
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setErrorMessage(submitError.message || 'Błąd walidacji danych.');
      setIsLoading(false);
      return;
    }

    // Potwierdzamy SetupIntent (weryfikację karty)
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/subscribe/success?setup_intent=true`,
      },
    });

    if (error) {
      setErrorMessage(error.message || 'Wystąpił nieoczekiwany błąd.');
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">

        {/* Przekazujemy poprawione opcje */}
        <PaymentElement options={paymentElementOptions as any} />

      </div>

      {errorMessage && (
        <div className="text-red-600 text-sm text-center">{errorMessage}</div>
      )}

      <button
        disabled={isLoading || !stripe || !elements}
        className="w-full flex justify-center items-center bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          'Zweryfikuj kartę i rozpocznij okres próbny'
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Klikając przycisk, akceptujesz warunki. Pierwsza opłata 37 PLN zostanie naliczona automatycznie po 21 dniach. Możesz anulować w dowolnym momencie.
      </p>
    </form>
  );
}