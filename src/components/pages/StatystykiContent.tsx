// src/components/pages/StatystykiContent.tsx (przykład drugiej strony)
'use client';

import { BarChart3, PieChart, LineChart, Clock } from 'lucide-react';

export default function StatystykiContent() {
  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Statystyki
        </h1>
        <p className="text-gray-600 text-lg">
          Szczegółowe analizy i raporty wydajności
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Raporty</p>
              <p className="text-2xl font-bold text-blue-900">47</p>
            </div>
            <BarChart3 className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Wykresy</p>
              <p className="text-2xl font-bold text-green-900">89</p>
            </div>
            <PieChart className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Trendy</p>
              <p className="text-2xl font-bold text-purple-900">+18%</p>
            </div>
            <LineChart className="text-purple-600" size={32} />
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
            Tutaj będą zaawansowane statystyki i analizy
          </p>
        </div>
      </div>
    </div>
  );
}