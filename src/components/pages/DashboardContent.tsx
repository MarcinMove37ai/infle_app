// src/components/pages/DashboardContent.tsx
'use client';

import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  BookOpen, 
  FileSignature, 
  UserCheck,
  Activity,
  Eye,
  Download
} from 'lucide-react';

export default function DashboardContent() {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard
        </h1>
        <p className="text-gray-600 text-lg">
          Przegląd kluczowych metryk i aktywności w panelu administracyjnym
        </p>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium mb-1">Aktywni Twórcy</p>
              <p className="text-2xl font-bold text-blue-900">1,247</p>
              <p className="text-blue-600 text-xs">+12% vs poprzedni miesiąc</p>
            </div>
            <Users className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium mb-1">Odbiorcy</p>
              <p className="text-2xl font-bold text-green-900">8,432</p>
              <p className="text-green-600 text-xs">+8% vs poprzedni miesiąc</p>
            </div>
            <UserCheck className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium mb-1">Opublikowane Ebooki</p>
              <p className="text-2xl font-bold text-purple-900">156</p>
              <p className="text-purple-600 text-xs">+23 w tym miesiącu</p>
            </div>
            <BookOpen className="text-purple-600" size={32} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium mb-1">Strony Zapisu</p>
              <p className="text-2xl font-bold text-orange-900">89</p>
              <p className="text-orange-600 text-xs">Średnia konwersja 12.4%</p>
            </div>
            <FileSignature className="text-orange-600" size={32} />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Menu Options Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Activity className="mr-3 text-blue-600" size={24} />
            Dostępne Funkcje
          </h2>
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
              <BarChart3 className="text-gray-600 mr-4" size={20} />
              <div>
                <h3 className="font-semibold text-gray-900">Statystyki</h3>
                <p className="text-sm text-gray-600">Szczegółowe analizy i raporty wydajności</p>
              </div>
            </div>

            <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
              <TrendingUp className="text-gray-600 mr-4" size={20} />
              <div>
                <h3 className="font-semibold text-gray-900">Trendy</h3>
                <p className="text-sm text-gray-600">Analiza trendów i przewidywania rynkowe</p>
              </div>
            </div>

            <div className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
              <Users className="text-gray-600 mr-4" size={20} />
              <div>
                <h3 className="font-semibold text-gray-900">Raport Twórcy</h3>
                <p className="text-sm text-gray-600">Monitoring aktywności i wyników twórców</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Eye className="mr-3 text-green-600" size={24} />
            Ostatnia Aktywność
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                <div>
                  <p className="font-medium text-gray-900">Nowy ebook opublikowany</p>
                  <p className="text-sm text-gray-600">przez Anna Kowalska</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">2 min temu</span>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                <div>
                  <p className="font-medium text-gray-900">Strona zapisu zaktualizowana</p>
                  <p className="text-sm text-gray-600">"Kurs marketingu cyfrowego"</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">15 min temu</span>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
                <div>
                  <p className="font-medium text-gray-900">Nowy raport wygenerowany</p>
                  <p className="text-sm text-gray-600">Statystyki miesięczne</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">1 godz. temu</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
          <div className="mb-4 md:mb-0">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              ✨ Nowe funkcje sidebar!
            </h3>
            <p className="text-gray-600">
              Sidebar teraz się nie zwija po kliknięciu i ma przycisk toggle! Sprawdź przycisk ← w górnym rogu menu.
            </p>
          </div>
          <div className="flex space-x-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center">
              <BarChart3 className="mr-2" size={18} />
              Zobacz Statystyki
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}