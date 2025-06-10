// src/components/pages/StronyZapisuContent.tsx
'use client';

import { Clock } from 'lucide-react';

export default function StronyZapisuContent() {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Strony Zapisu
        </h1>
        <p className="text-gray-600 text-lg">
          Zarządzanie landing pages i formularzami zapisu
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Aktywne Strony</p>
              <p className="text-2xl font-bold text-blue-900">89</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Funkcje w rozwoju
        </h2>
        <div className="text-center py-12">
          <Clock className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Sekcja w budowie
          </h3>
          <p className="text-gray-500">
            Funkcjonalności tej sekcji będą dostępne wkrótce
          </p>
        </div>
      </div>
    </div>
  );
}