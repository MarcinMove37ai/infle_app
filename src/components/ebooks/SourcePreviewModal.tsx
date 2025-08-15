// components/ebooks/SourcePreviewModal.tsx

import React from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

// Interfejs dla pobranej treści (przeniesiony z głównego komponentu)
interface ScrapedContent {
  url: string;
  title: string;
  content: string;
}

// Props dla komponentu modal
interface SourcePreviewModalProps {
  // Stan modal
  isVisible: boolean;
  sourceType: 'web' | 'pdf';

  // Dane źródła
  content: ScrapedContent | null;

  // Status operacji
  status: 'success' | 'error' | 'empty';
  errorDetails?: string;

  // Callbacks
  onAccept: (content: ScrapedContent) => void;
  onReject: () => void;
}

const SourcePreviewModal: React.FC<SourcePreviewModalProps> = ({
  isVisible,
  sourceType,
  content,
  status,
  errorDetails,
  onAccept,
  onReject
}) => {
  if (!isVisible || !content) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-fadeIn">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            {sourceType === 'web' ? 'Podgląd pobranej treści' : 'Podgląd tekstu z PDF'}
          </h3>
          <button
            onClick={onReject}
            className="text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-6">
          {/* Status scraping/upload */}
          {status === 'success' && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-200 mb-4">
              <div className="flex items-center text-green-700">
                <Check size={16} className="mr-2" />
                <span className="font-medium">
                  {sourceType === 'web' ? 'Treść pobrana pomyślnie' : 'Tekst wyodrębniony pomyślnie'}
                </span>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 p-3 rounded-lg border border-red-200 mb-4">
              <div className="flex items-start text-red-700">
                <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium block">
                    {sourceType === 'web' ? 'Błąd podczas pobierania' : 'Błąd podczas przetwarzania PDF'}
                  </span>
                  <span className="text-sm">{errorDetails}</span>
                </div>
              </div>
            </div>
          )}

          {status === 'empty' && (
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4">
              <div className="flex items-start text-yellow-700">
                <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium block">Brak treści</span>
                  <span className="text-sm">{errorDetails}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tytuł dokumentu */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
            <h4 className="font-medium text-blue-800 mb-2">
              {sourceType === 'web' ? 'Tytuł:' : 'Tytuł dokumentu:'}
            </h4>
            <p className="text-blue-700">{content.title}</p>
          </div>

          {/* URL/Źródło */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
            <h4 className="font-medium text-gray-700 mb-2">
              {sourceType === 'web' ? 'URL:' : 'Źródło:'}
            </h4>
            <p className="text-gray-600 text-sm break-all">{content.url}</p>
          </div>

          {/* Treść */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2">
              {sourceType === 'web'
                ? `Treść (${content.content.length} znaków):`
                : `Wyodrębniony tekst (${content.content.length} znaków):`
              }
            </h4>
            {content.content.length > 0 ? (
              <div className="text-gray-600 text-sm max-h-48 overflow-y-auto whitespace-pre-wrap">
                {content.content}
              </div>
            ) : (
              <div className="text-gray-400 text-sm italic">
                {sourceType === 'web'
                  ? 'Brak treści do wyświetlenia'
                  : 'Nie udało się wyodrębnić tekstu z tego PDF'
                }
              </div>
            )}
          </div>
        </div>

        {/* Przyciski akcji */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onReject}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer"
          >
            {status === 'success' ? 'Odrzuć' : 'Zamknij'}
          </button>

          <button
            onClick={() => onAccept(content)}
            disabled={status !== 'success'}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              status === 'success'
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            title={status !== 'success' ? 'Można dodać tylko źródła z poprawną treścią' : ''}
          >
            {status === 'success' ? 'Dodaj do źródeł' : 'Nie można dodać'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SourcePreviewModal;