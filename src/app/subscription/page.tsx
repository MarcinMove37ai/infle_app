// src/app/subscription/page.tsx
"use client"

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Calendar,
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

interface SubscriptionData {
  status: string;
  paymentMethod: string | null;
  paymentVerifiedAt: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  isActive: boolean;
  stripe?: {
    status: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
  };
  paymentMethodDetails?: {
    type: string;
    card?: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
  };
  invoices: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    paid: boolean;
    created: string;
    invoicePdf: string | null;
    hostedInvoiceUrl: string | null;
  }>;
}

export default function SubscriptionPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') {
      router.push('/login');
      return;
    }

    fetchSubscriptionData();
  }, [authStatus, router]);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscription/details');

      if (!response.ok) {
        throw new Error('Failed to fetch subscription data');
      }

      const data = await response.json();
      setSubscriptionData(data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setError('Nie udało się pobrać danych subskrypcji');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCanceling(true);
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      const data = await response.json();
      alert(data.message);

      await fetchSubscriptionData();
      setShowCancelDialog(false);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert('Nie udało się anulować subskrypcji');
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Ładowanie danych subskrypcji...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2 text-center">Wystąpił błąd</h2>
          <p className="text-red-700 text-center">{error}</p>
          <button
            onClick={fetchSubscriptionData}
            className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  if (!subscriptionData) return null;

  const getPlanName = (status: string) => {
    switch (status) {
      case 'free': return 'Free';
      case 'standard': return 'Standard';
      case 'premium': return 'Premium';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/strony-zapisu"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Powrót do listy stron
          </Link>

          <h1 className="text-3xl font-bold text-gray-900">Zarządzanie subskrypcją</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Plan: {getPlanName(subscriptionData.status)}
              </h2>
              {subscriptionData.isActive ? (
                subscriptionData.stripe?.cancelAtPeriodEnd ? (
                  <span className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm">
                    Anulowana (do końca okresu)
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm">
                    Aktywna
                  </span>
                )
              ) : (
                <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm">
                  Nieaktywna
                </span>
              )}
            </div>
            <Link
              href="/subscribe"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
            >
              Zmień plan
            </Link>
          </div>

          {subscriptionData.subscriptionEndsAt && (
            <div className="mt-4 flex items-center text-gray-600">
              <Calendar className="w-5 h-5 mr-2" />
              <span>
                {subscriptionData.stripe?.cancelAtPeriodEnd
                  ? 'Dostęp do: '
                  : 'Odnowienie: '}
                {new Date(subscriptionData.subscriptionEndsAt).toLocaleDateString('pl-PL')}
              </span>
            </div>
          )}
        </div>

        {subscriptionData.paymentMethodDetails && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Metoda płatności</h2>

            <div className="flex items-center">
              <CreditCard className="w-8 h-8 text-gray-400 mr-4" />
              <div>
                {subscriptionData.paymentMethodDetails.card && (
                  <>
                    <p className="font-medium text-gray-900">
                      {subscriptionData.paymentMethodDetails.card.brand.toUpperCase()} ••••{subscriptionData.paymentMethodDetails.card.last4}
                    </p>
                    <p className="text-sm text-gray-600">
                      Wygasa: {subscriptionData.paymentMethodDetails.card.expMonth}/{subscriptionData.paymentMethodDetails.card.expYear}
                    </p>
                  </>
                )}
                {subscriptionData.paymentMethod === 'blik' && (
                  <p className="font-medium text-gray-900">BLIK - Płatność jednorazowa</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Historia faktur</h2>

          {subscriptionData.invoices.length === 0 ? (
            <p className="text-gray-600">Brak faktur</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Kwota</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subscriptionData.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(invoice.created).toLocaleDateString('pl-PL')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {invoice.amount.toFixed(2)} {invoice.currency}
                      </td>
                      <td className="px-4 py-3">
                        {invoice.paid ? (
                          <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Opłacone
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                            <XCircle className="w-3 h-3 mr-1" />
                            Nieopłacone
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex justify-end space-x-2">
                          {invoice.invoicePdf && (
                            <a
                              href={invoice.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                              title="Pobierz PDF"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {invoice.hostedInvoiceUrl && (
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                              title="Zobacz fakturę"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {subscriptionData.isActive && !subscriptionData.stripe?.cancelAtPeriodEnd && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Anuluj subskrypcję</h2>
            <p className="text-gray-600 mb-4">
              {subscriptionData.paymentMethod === 'card'
                ? 'Twoja subskrypcja zostanie anulowana na koniec bieżącego okresu rozliczeniowego. Zachowasz dostęp do końca opłaconego okresu.'
                : 'Twoja subskrypcja zostanie anulowana natychmiast.'}
            </p>
            <button
              onClick={() => setShowCancelDialog(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
            >
              Anuluj subskrypcję
            </button>
          </div>
        )}

        {showCancelDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Potwierdź anulowanie</h3>
              <p className="text-gray-600 mb-6">
                Czy na pewno chcesz anulować subskrypcję?
                {subscriptionData.paymentMethod === 'card' && ' Zachowasz dostęp do końca bieżącego okresu rozliczeniowego.'}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  disabled={canceling}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  {canceling ? 'Anulowanie...' : 'Potwierdź'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}