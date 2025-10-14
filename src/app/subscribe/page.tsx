// src/app/subscribe/page.tsx
"use client"

import React, { useState } from 'react';
import { Check, X, CreditCard, Smartphone, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type PaymentMethod = 'card' | 'blik';

interface Plan {
  id: string;
  name: string;
  description: string;
  priceCard: number;
  priceBlik: number;
  currency: string;
  features: string[];
  notIncluded: string[];
  highlighted?: boolean;
  comingSoon?: boolean;
  buttonText: string;
}

export default function SubscribePage() {
  const { data: session } = useSession();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');

  const plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Dla początkujących twórców',
      priceCard: 0,
      priceBlik: 0,
      currency: 'zł',
      features: [
        '1 opublikowana strona',
        'Do 50 leadów/miesiąc',
        'Podstawowe szablony',
        'Watermark "Powered by Inflee"'
      ],
      notIncluded: [
        'Brak dostępu do AI',
        'Brak integracji email',
        'Brak statystyk zaawansowanych'
      ],
      buttonText: 'Aktualny plan'
    },
    {
      id: 'standard',
      name: 'Standard',
      description: 'Dla aktywnych twórców',
      priceCard: 37,
      priceBlik: 87,
      currency: 'zł/miesiąc',
      features: [
        'Do 10 opublikowanych stron',
        'Do 500 leadów/miesiąc',
        'AI generator ebooków (50x/m)',
        'Landing page builder',
        'Integracje email & SMS',
        'System zbierania leadów',
        'Podstawowe statystyki',
        'Bez watermarku'
      ],
      notIncluded: [
        'Brak custom domain',
        'Brak white label'
      ],
      highlighted: true,
      buttonText: 'Wybierz Standard'
    },
    {
      id: 'premium',
      name: 'Premium',
      description: 'Dla profesjonalistów',
      priceCard: 137,
      priceBlik: 187,
      currency: 'zł/miesiąc',
      features: [
        '∞ Nieograniczone strony',
        '∞ Nieograniczone leady',
        '∞ AI generator ebooków',
        'Wszystko ze Standard +',
        'Custom domain',
        'Zaawansowane statystyki',
        'A/B testing',
        'Priority support',
        'API access'
      ],
      notIncluded: [],
      buttonText: 'Wybierz Premium'
    },
    {
      id: 'whitelabel',
      name: 'White Label',
      description: 'Dla agencji i firm',
      priceCard: 0,
      priceBlik: 0,
      currency: '',
      features: [
        'Wszystko z Premium +',
        'Własny branding',
        'Własna domena',
        'Subdomena dla klientów',
        'Multi-user accounts',
        'Dedykowany Account Manager'
      ],
      notIncluded: [],
      comingSoon: true,
      buttonText: 'Wkrótce dostępne'
    }
  ];

  const getPrice = (plan: Plan) => {
    if (plan.priceCard === 0) return 'Darmowy';
    const price = paymentMethod === 'card' ? plan.priceCard : plan.priceBlik;
    return `${price} ${plan.currency}`;
  };

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free' || planId === 'whitelabel') return;

    try {
      console.log(`Creating checkout session for ${planId} with ${paymentMethod}...`);

      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: planId,
          paymentMethod: paymentMethod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }

    } catch (error) {
      console.error('Error creating checkout:', error);
      alert('Wystąpił błąd podczas tworzenia sesji płatności. Spróbuj ponownie.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/strony-zapisu"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Powrót do listy stron
          </Link>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Wybierz plan dla siebie
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Zacznij tworzyć profesjonalne strony zapisu i zarabiaj na swojej wiedzy
          </p>
        </div>

        {/* Payment Method Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 inline-flex">
            <button
              onClick={() => setPaymentMethod('card')}
              className={`flex items-center px-6 py-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                paymentMethod === 'card'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Subskrypcja (Płać kartą)
            </button>
            <button
              onClick={() => setPaymentMethod('blik')}
              className={`flex items-center px-6 py-3 rounded-md text-sm font-medium transition-all cursor-pointer ${
                paymentMethod === 'blik'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Jednorazowo (Zapłać BLIK)
            </button>
          </div>
        </div>

        {paymentMethod === 'blik' && (
          <div className="text-center mb-8">
            <p className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-lg py-2 px-4 inline-block">
              💡 BLIK: Płatność z góry za miesiąc. Brak automatycznego odnowienia.
            </p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all hover:shadow-xl ${
                plan.highlighted
                  ? 'border-blue-500 scale-105'
                  : plan.comingSoon
                  ? 'border-gray-200 opacity-75'
                  : 'border-gray-200'
              }`}
            >
              {/* Highlighted badge */}
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                    Najpopularniejszy
                  </span>
                </div>
              )}

              {/* Coming soon badge */}
              {plan.comingSoon && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gray-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                    Wkrótce
                  </span>
                </div>
              )}

              <div className="p-6">
                {/* Plan name */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  {plan.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <div className="text-4xl font-bold text-gray-900">
                    {getPrice(plan)}
                  </div>
                  {plan.priceCard > 0 && paymentMethod === 'card' && (
                    <div className="text-sm text-gray-500 mt-1">
                      Automatyczne odnowienie
                    </div>
                  )}
                  {plan.priceCard > 0 && paymentMethod === 'blik' && (
                    <div className="text-sm text-gray-500 mt-1">
                      Płatność jednorazowa
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={plan.id === 'free' || plan.comingSoon}
                  className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all mb-6 ${
                    plan.comingSoon
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : plan.id === 'free'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : plan.highlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl cursor-pointer'
                      : 'bg-gray-900 text-white hover:bg-gray-800 cursor-pointer'
                  }`}
                >
                  {plan.buttonText}
                </button>

                {/* Features */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Co zawiera:
                  </div>
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}

                  {plan.notIncluded.length > 0 && (
                    <>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-3">
                        Nie zawiera:
                      </div>
                      {plan.notIncluded.map((feature, index) => (
                        <div key={index} className="flex items-start">
                          <X className="w-5 h-5 text-gray-300 mr-2 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-400">{feature}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Często zadawane pytania
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-200">
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Jaka jest różnica między płatnością kartą a BLIK?
              </h3>
              <p className="text-gray-600 text-sm">
                Płatność kartą tworzy automatyczną subskrypcję - będziemy pobierać opłatę co miesiąc.
                BLIK to płatność jednorazowa z góry za 30 dni - po wygaśnięciu musisz odnowić ręcznie.
              </p>
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Czy mogę anulować subskrypcję w każdej chwili?
              </h3>
              <p className="text-gray-600 text-sm">
                Tak! Możesz anulować subskrypcję w każdej chwili. Będziesz mieć dostęp do końca opłaconego okresu.
              </p>
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-gray-900 mb-2">
                Czy mogę zmienić plan później?
              </h3>
              <p className="text-gray-600 text-sm">
                Tak, możesz zmienić plan w dowolnym momencie. Upgrade działa natychmiast, downgrade po zakończeniu bieżącego okresu.
              </p>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="text-center mt-12">
          <p className="text-gray-600">
            Masz pytania?
            <a href="mailto:support@inflee.app" className="text-blue-600 hover:text-blue-700 ml-1">
              Skontaktuj się z nami
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}