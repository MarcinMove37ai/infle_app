// src/components/pages/EbookiContent.tsx
'use client';

import { useState } from 'react';
import { BookOpen, Plus, Edit, Download, Image, Sparkles } from 'lucide-react';
import EbookGeneratorModal from '@/components/ebooks/EbookGeneratorModal';

export default function EbookiContent() {
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);

  // Mock data - później zastąpisz prawdziwymi danymi z API
  const existingEbooks = [
    {
      id: 1,
      title: "Przewodnik po React",
      subtitle: "Od podstaw do zaawansowanych technik",
      chaptersCount: 8,
      hasContent: true,
      hasGraphics: true,
      createdAt: "2024-01-15"
    },
    {
      id: 2,
      title: "Automatyzacja biznesu",
      subtitle: "Narzędzia i strategie",
      chaptersCount: 12,
      hasContent: false,
      hasGraphics: false,
      createdAt: "2024-01-10"
    }
  ];

  const handleOpenGenerator = () => {
    setIsGeneratorModalOpen(true);
  };

  const handleCloseGenerator = () => {
    setIsGeneratorModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          E-booki AI
        </h1>
        <p className="text-gray-600 text-lg">
          Twórz profesjonalne e-booki z pomocą sztucznej inteligencji
        </p>
      </div>

      {/* Akcje */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleOpenGenerator}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
        >
          <Plus size={20} className="mr-2" />
          Utwórz nowy e-book
        </button>

        <button className="flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
          <BookOpen size={20} className="mr-2" />
          Importuj z pliku
        </button>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Wszystkie e-booki</p>
              <p className="text-2xl font-bold text-blue-900">{existingEbooks.length}</p>
            </div>
            <BookOpen className="text-blue-600" size={32} />
          </div>
        </div>

        <div className="bg-green-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">Ukończone</p>
              <p className="text-2xl font-bold text-green-900">
                {existingEbooks.filter(book => book.hasContent && book.hasGraphics).length}
              </p>
            </div>
            <Sparkles className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">W trakcie</p>
              <p className="text-2xl font-bold text-purple-900">
                {existingEbooks.filter(book => !book.hasContent || !book.hasGraphics).length}
              </p>
            </div>
            <Edit className="text-purple-600" size={32} />
          </div>
        </div>
      </div>

      {/* Lista istniejących e-booków */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Twoje e-booki</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {existingEbooks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nie masz jeszcze żadnych e-booków
              </h3>
              <p className="text-gray-500 mb-6">
                Utwórz swój pierwszy e-book klikając przycisk powyżej
              </p>
              <button
                onClick={handleOpenGenerator}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} className="mr-2" />
                Rozpocznij teraz
              </button>
            </div>
          ) : (
            existingEbooks.map((ebook) => (
              <div key={ebook.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {ebook.title}
                    </h3>
                    {ebook.subtitle && (
                      <p className="text-sm text-gray-500 truncate">
                        {ebook.subtitle}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-gray-500">
                        {ebook.chaptersCount} rozdziałów
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        ebook.hasContent && ebook.hasGraphics
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {ebook.hasContent && ebook.hasGraphics ? 'Gotowy' : 'W trakcie'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(ebook.createdAt).toLocaleDateString('pl-PL')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={handleOpenGenerator}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Edytuj"
                    >
                      <Edit size={16} />
                    </button>

                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Grafiki">
                      <Image size={16} />
                    </button>

                    <button
                      className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                      title="Pobierz PDF"
                      disabled={!ebook.hasContent}
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal z generatorem */}
      <EbookGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={handleCloseGenerator}
      />
    </div>
  );
}