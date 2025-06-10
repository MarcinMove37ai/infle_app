// src/components/pages/RaportOdbiorcówContent.tsx
'use client';

import { Clock } from 'lucide-react';

export default function RaportOdbiorcówContent() {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Raport Odbiorców
        </h1>
        <p className="text-gray-600 text-lg">
          Analiza zachowań i preferencji odbiorców treści
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Aktywni Odbiorcy</p>
              <p className="text-2xl font-bold text-green-900">8,432</p>
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