// components/ebooks/SourcePreviewModal.tsx

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Loader2, RotateCcw, Eye, Settings, Key } from 'lucide-react';

// Interfejs dla pobranej treści
interface ScrapedContent {
  url: string;
  title: string;
  content: string;
}

// Interfejs dla response z API podsumowywania
interface SummarizeResponse {
  success: boolean;
  summary?: string;
  originalLength?: number;
  summaryLength?: number;
  compressionRatio?: number;
  modelUsed?: string;
  keySource?: string;
  tokensUsed?: any;
  error?: string;
}

// Interfejs dla ustawień AI użytkownika
interface UserAiSettings {
  textAiProvider: string;
  textAiModel: string;
  imageAiProvider: string;
  imageAiModel: string;
}

// Interfejs dla statusu kluczy API
interface ApiKeysStatus {
  anthropic: { hasKey: boolean; lastUpdated?: Date };
  openai: { hasKey: boolean; lastUpdated?: Date };
  google: { hasKey: boolean; lastUpdated?: Date };
}

// Interfejs dla opcji długości z dodatkowymi informacjami
interface LengthOption {
  value: number;
  label: string;
  isAvailable: boolean;
  reason?: string;
  hint?: string;
}

// Props dla komponentu modal
interface SourcePreviewModalProps {
  isVisible: boolean;
  sourceType: 'web' | 'pdf';
  content: ScrapedContent | null;
  status: 'success' | 'error' | 'empty';
  errorDetails?: string;
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
  // Stany dla podsumowywania
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLength, setSummaryLength] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'ai' | 'traditional'>('ai');
  const [selectedLength, setSelectedLength] = useState<number | null>(null);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [summarizedContent, setSummarizedContent] = useState<string | null>(null);
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Stany modala
  const [contentToDisplay, setContentToDisplay] = useState<string>('');
  const [isFullContentModalOpen, setIsFullContentModalOpen] = useState(false);

  // Stany dla ustawień AI użytkownika
  const [userAiSettings, setUserAiSettings] = useState<UserAiSettings | null>(null);
  const [apiKeysStatus, setApiKeysStatus] = useState<ApiKeysStatus | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Funkcja pobierania ustawień AI użytkownika
  const fetchUserAiSettings = async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);

    try {
      // Pobierz ustawienia AI
      const settingsResponse = await fetch('/api/user/author-settings', {
        method: 'GET',
        credentials: 'include',
      });

      if (!settingsResponse.ok) {
        throw new Error(`Błąd pobierania ustawień: ${settingsResponse.status}`);
      }

      const settingsData = await settingsResponse.json();

      if (!settingsData.success) {
        throw new Error(settingsData.error || 'Nie udało się pobrać ustawień');
      }

      // Pobierz status kluczy API
      const apiKeysResponse = await fetch('/api/user/api-keys', {
        method: 'GET',
        credentials: 'include',
      });

      if (!apiKeysResponse.ok) {
        throw new Error(`Błąd pobierania kluczy API: ${apiKeysResponse.status}`);
      }

      const apiKeysData = await apiKeysResponse.json();

      if (!apiKeysData.success) {
        throw new Error(apiKeysData.error || 'Nie udało się pobrać statusu kluczy API');
      }

      // Zapisz dane w state
      setUserAiSettings({
        textAiProvider: settingsData.authorSettings.textAiProvider,
        textAiModel: settingsData.authorSettings.textAiModel,
        imageAiProvider: settingsData.authorSettings.imageAiProvider,
        imageAiModel: settingsData.authorSettings.imageAiModel,
      });

      setApiKeysStatus(apiKeysData.providers);

      console.log('🎯 Pobrano ustawienia AI:', {
        model: settingsData.authorSettings.textAiModel,
        hasAnthropicKey: apiKeysData.providers.anthropic?.hasKey || false
      });

    } catch (error: any) {
      console.error('Błąd podczas pobierania ustawień AI:', error);
      setSettingsError(error.message || 'Nie udało się pobrać ustawień AI');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Funkcja generowania opcji długości na podstawie modelu i kluczy
  const generateLengthOptions = (contentLength: number): LengthOption[] => {
    const baseLengthOptions = [
      { value: 1000, label: 'ok. 1 000 znaków' },
      { value: 2000, label: 'ok. 2 000 znaków' },
      { value: 5000, label: 'ok. 5 000 znaków' },
      { value: 10000, label: 'ok. 10 000 znaków' }
    ];

    // Filtruj opcje które są mniejsze od treści źródłowej
    const availableBasicOptions = baseLengthOptions.filter(option => option.value < contentLength);

    if (!userAiSettings || !apiKeysStatus) {
      // Jeśli nie ma ustawień, pokaż wszystkie opcje jako niedostępne
      return availableBasicOptions.map(option => ({
        ...option,
        isAvailable: false,
        reason: 'Ładowanie ustawień...'
      }));
    }

    const hasAnthropicKey = apiKeysStatus.anthropic?.hasKey || false;
    const isHaiku = userAiSettings.textAiModel === 'claude-3-haiku';
    const isSonnet = userAiSettings.textAiModel === 'claude-3-sonnet';

    return availableBasicOptions.map(option => {
      // Sonnet: wszystkie opcje dostępne
      if (isSonnet) {
        return {
          ...option,
          isAvailable: true
        };
      }

      // Haiku: tylko 1000 i 2000 znaków
      if (isHaiku) {
        if (option.value <= 2000) {
          return {
            ...option,
            isAvailable: true
          };
        } else {
          // Opcje 5000 i 10000 niedostępne dla haiku
          if (hasAnthropicKey) {
            return {
              ...option,
              isAvailable: false,
              reason: 'Tylko dla Sonnet',
              hint: 'Przełącz na model Sonnet w ustawieniach'
            };
          } else {
            return {
              ...option,
              isAvailable: false,
              reason: 'Niedostępne dla modelu Haiku',
              hint: 'Wymagany klucz API Anthropic lub model Sonnet'
            };
          }
        }
      }

      // Fallback: opcja niedostępna
      return {
        ...option,
        isAvailable: false,
        reason: 'Nieznany model'
      };
    });
  };

  // Pobierz ustawienia AI za każdym razem gdy modal się otwiera
  useEffect(() => {
    if (isVisible && content) {
      fetchUserAiSettings();
    }
  }, [isVisible, content]);

  // Reset stanów gdy zmienia się content
  useEffect(() => {
    if (content) {
      setOriginalContent(content.content);
      setContentToDisplay(content.content);
      setSummarizedContent(null);
      setSummaryGenerated(false);
      setSummaryError(null);
      setSummaryLength(null);
      setSelectedMethod('ai');
      setSelectedLength(null);
    }
  }, [content]);

  // Funkcja obliczająca dostępne opcje długości na podstawie tekstu źródłowego i ustawień
  const getAvailableLengthOptions = (contentLength: number) => {
    return generateLengthOptions(contentLength);
  };

  // Główna funkcja podsumowywania treści
  const handleSummarizeContent = async (targetLength: number) => {
    if (!content) return;

    setIsSummarizing(true);
    setSummaryError(null);
    setSummaryLength(targetLength);

    try {
      const response = await fetch('/api/summarize-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: originalContent,
          targetLength: targetLength,
          title: content.title,
          sourceType: sourceType,
          sourceUrl: content.url
        }),
      });

      const data: SummarizeResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Błąd ${response.status}`);
      }

      // Sukces - aktualizacja stanów
      setSummarizedContent(data.summary || '');
      setSummaryGenerated(true);
      setContentToDisplay(data.summary || ''); // Automatycznie przełącz na podsumowanie
      console.log(`Podsumowanie ukończone: ${data.summaryLength}/${data.originalLength} znaków (kompresja: ${Math.round((data.compressionRatio || 0) * 100)}%)`);

    } catch (error: any) {
      console.error('Błąd podczas podsumowywania:', error);
      setSummaryError(error.message || 'Wystąpił błąd podczas podsumowywania');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Reset stanów podsumowania
  const resetSummaryState = () => {
    setSummarizedContent(null);
    setSummaryGenerated(false);
    setSummaryError(null);
    setSummaryLength(null);
    setSelectedMethod('ai');
    setSelectedLength(null);
    setContentToDisplay(originalContent); // Zawsze wróć do oryginału
  };

  // Funkcja tradycyjnego skracania tekstu (mechaniczne)
  const handleTraditionalSummary = (targetLength: number) => {
    if (!content) return;

    setIsSummarizing(true);
    setSummaryError(null);
    setSummaryLength(targetLength);

    // Symulujemy krótkie opóźnienie dla UX
    setTimeout(() => {
      let finalText: string;

      if (originalContent.length <= targetLength) {
        // Jeśli tekst jest krótszy niż docelowa długość, pozostaw bez zmian
        finalText = originalContent;
      } else {
        // Jeśli tekst jest dłuższy, skróć dokładnie do wybranej długości
        // Uwzględnij "..." w limicie znaków
        const ellipsis = '...';
        const availableLength = targetLength - ellipsis.length;

        if (availableLength > 0) {
          finalText = originalContent.slice(0, availableLength) + ellipsis;
        } else {
          // Jeśli targetLength jest mniejsze niż długość "...", po prostu obetnij bez wielokropka
          finalText = originalContent.slice(0, targetLength);
        }
      }

      setSummarizedContent(finalText);
      setSummaryGenerated(true);
      setContentToDisplay(finalText); // Automatycznie przełącz na podsumowanie
      setIsSummarizing(false);

      console.log(`Skrócenie tradycyjne ukończone: ${finalText.length}/${originalContent.length} znaków`);
    }, 500);
  };

  // Funkcja obsługi podsumowania na podstawie wybranej metody
  const handleSummaryExecution = () => {
    if (!selectedLength) return;

    if (selectedMethod === 'ai') {
      handleSummarizeContent(selectedLength);
    } else {
      handleTraditionalSummary(selectedLength);
    }
  };

  // Przełączanie między oryginałem a podsumowaniem
  const toggleContentView = (showOriginal: boolean) => {
    setContentToDisplay(showOriginal ? originalContent : (summarizedContent || originalContent));
  };

  // Funkcja skróconego podglądu treści - NAPRAWIONA WERSJA
  const getPreviewText = (text: string): React.ReactNode => {
    if (text.length <= 400) {
      return <div className="whitespace-pre-wrap">{text}</div>;
    }

    // Czyścimy tekst z nadmiarowych pustych linii
    const cleanText = text.replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, '').replace(/[\r\n]+\s*[\r\n]+/g, '\n');

    // Definiujemy długość podglądu - początek i koniec
    const startLength = 200;
    const endLength = 200; // Zwiększona długość dla końca

    // Pobieramy początek tekstu
    let startText = cleanText.slice(0, startLength);
    // Znajdujemy ostatnią spację, żeby nie ucinać w środku słowa
    const lastSpaceInStart = startText.lastIndexOf(' ');
    if (lastSpaceInStart > startLength * 0.8) { // Jeśli spacja jest blisko końca
      startText = startText.slice(0, lastSpaceInStart);
    }

    // Pobieramy koniec tekstu
    let endText = cleanText.slice(-endLength);
    // Znajdujemy pierwszą spację, żeby nie zaczynać w środku słowa
    const firstSpaceInEnd = endText.indexOf(' ');
    if (firstSpaceInEnd > -1 && firstSpaceInEnd < endLength * 0.2) { // Jeśli spacja jest blisko początku
      endText = endText.slice(firstSpaceInEnd + 1);
    }

    return (
      <div>
        <div className="font-semibold text-gray-700 mb-1">Początek tekstu źródła:</div>
        <div className="whitespace-pre-wrap mb-3 italic text-gray-600">"{startText}(...)"</div>
        <div className="border-t border-gray-300 my-3"></div>
        <div className="font-semibold text-gray-700 mb-1">Koniec tekstu źródła:</div>
        <div className="whitespace-pre-wrap italic text-gray-600">"(...){endText}"</div>
      </div>
    );
  };

  // Funkcja renderująca etykietę statusu
  const renderStatusLabel = () => {
    switch (status) {
      case 'success':
        return (
          <span className="ml-3 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-md">
            Sukces!
          </span>
        );
      case 'error':
        return (
          <span className="ml-3 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-md">
            Błąd!
          </span>
        );
      case 'empty':
        return (
          <span className="ml-3 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-md">
            Puste!
          </span>
        );
      default:
        return null;
    }
  };

  // Funkcja renderująca informację o modelu AI
  const renderAiModelInfo = () => {
    if (isLoadingSettings) {
      return (
        <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 mb-3 flex items-center">
          <Loader2 size={14} className="mr-2 animate-spin text-gray-500" />
          <span className="text-xs text-gray-600">Ładowanie ustawień AI...</span>
        </div>
      );
    }

    if (settingsError) {
      return (
        <div className="bg-red-50 p-2 rounded-lg border border-red-200 mb-3 flex items-center">
          <AlertCircle size={14} className="mr-2 text-red-500" />
          <span className="text-xs text-red-600">Błąd: {settingsError}</span>
        </div>
      );
    }

    if (!userAiSettings || !apiKeysStatus) {
      return null;
    }

    const hasAnthropicKey = apiKeysStatus.anthropic?.hasKey || false;
    const isHaiku = userAiSettings.textAiModel === 'claude-3-haiku';
    const isSonnet = userAiSettings.textAiModel === 'claude-3-sonnet';

    return (
      <div className={`p-2 rounded-lg border mb-3 flex items-center justify-between ${
        isSonnet ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex items-center">
          <Settings size={14} className={`mr-2 ${isSonnet ? 'text-green-600' : 'text-blue-600'}`} />
          <span className={`text-xs font-medium ${isSonnet ? 'text-green-700' : 'text-blue-700'}`}>
            Model: {isSonnet ? 'Claude Sonnet' : 'Claude Haiku'}
            {!hasAnthropicKey && (
              <span className="ml-1 text-orange-600">(klucz systemowy)</span>
            )}
          </span>
        </div>

        {isHaiku && !hasAnthropicKey && (
          <div className="flex items-center text-xs text-orange-600">
            <Key size={12} className="mr-1" />
            <span>Dodaj klucz API dla większych opcji</span>
          </div>
        )}
      </div>
    );
  };

  // Funkcja formatująca liczby ze spacjami jako separatorami tysięcy
  const formatNumber = (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  if (!isVisible || !content) {
    return null;
  }

  const availableSummaryOptions = getAvailableLengthOptions(content.content.length);
  const shouldShowSummarySection = content.content.length >= 1000; // Pokazuj opcje podsumowania dla treści ≥1000 znaków
  const isMandatorySummary = content.content.length >= 10000; // Obowiązkowe dla ≥10000 znaków

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto animate-fadeIn">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <h3 className="text-xl font-bold text-gray-800">
              {sourceType === 'web' ? 'Podgląd pobranej treści' : 'Podgląd tekstu z PDF'}
            </h3>
            {renderStatusLabel()}
          </div>
          <button
            onClick={onReject}
            className="text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-6">
          {/* Informacja o długości źródła - na samym początku */}
          {content.content.length > 1000 && !summaryGenerated && (
            <div className={`p-3 rounded-lg border mb-4 flex items-center ${
              content.content.length >= 10000
                ? 'bg-orange-50 border-orange-200'
                : content.content.length >= 1000
                ? 'bg-blue-50 border-blue-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <AlertCircle size={14} className={`mr-2 ${
                content.content.length >= 10000
                  ? 'text-orange-500'
                  : content.content.length >= 1000
                  ? 'text-blue-500'
                  : 'text-gray-400'
              }`} />
              <span className="text-sm text-gray-700">
                Długość źródła <span className="font-medium">{formatNumber(content.content.length)} znaków</span>, {' '}
                {content.content.length >= 10000 ? (
                  <span className="text-orange-700 font-medium">konieczne skrócenie</span>
                ) : content.content.length >= 1000 ? (
                  <span className="text-blue-700 font-medium">zalecane skrócenie</span>
                ) : (
                  <span className="text-gray-600">średnia długość</span>
                )}
                {' '} przed dodaniem do kontekstu
              </span>
            </div>
          )}

          {/* Błąd lub informacje o pustej treści */}
          {status === 'error' && errorDetails && (
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

          {status === 'empty' && errorDetails && (
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

          {/* URL/źródło */}
          <div className="bg-green-50 p-2 rounded-lg border border-green-200 mb-4">
            <div className="flex items-center">
              <h4 className="ml-2 text-sm font-medium text-green-800 mr-2 flex-shrink-0">
                {sourceType === 'web' ? 'URL:' : 'Źródło:'}
              </h4>
              <p className="text-green-700 text-sm truncate" title={content.url}>{content.url}</p>
            </div>
          </div>

          {/* Zakładki widoku - nad blokiem treści */}
          {shouldShowSummarySection && (
            <div className="flex gap-0">
              <button
                onClick={() => toggleContentView(true)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-l border-t border-r transition-all ${
                  contentToDisplay === originalContent
                    ? 'bg-white text-gray-800 border-gray-300 border-b-white -mb-px z-10'
                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                }`}
              >
                Oryginał ({formatNumber(originalContent.length)})
              </button>
              <button
                onClick={() => toggleContentView(false)}
                disabled={!summarizedContent}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-l border-t border-r transition-all ${
                  summarizedContent && contentToDisplay === summarizedContent
                    ? 'bg-white text-gray-800 border-gray-300 border-b-white -mb-px z-10'
                    : !summarizedContent
                    ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                }`}
                title={!summarizedContent ? 'Najpierw skróć treść aby zobaczyć podsumowanie' : ''}
              >
                Podsumowanie {summarizedContent ? `(${formatNumber(summarizedContent.length)})` : ''}
              </button>
            </div>
          )}

          {/* Treść - nowy layout z podglądem */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 relative">
            {/* Ikona oczka w prawym górnym rogu */}
            <button
              onClick={() => setIsFullContentModalOpen(true)}
              className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
              title="Zobacz pełną treść"
            >
              <Eye size={16} />
            </button>

            {/* Podgląd treści */}
            {contentToDisplay.length > 0 ? (
              <div className="text-gray-600 text-sm max-h-64 overflow-hidden pr-8">
                {getPreviewText(contentToDisplay)}
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

          {/* Sekcja podsumowania AI - elegancka jak w głównym komponencie */}
          {shouldShowSummarySection && status === 'success' && !summaryGenerated && !isSummarizing && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
              <div className="flex items-center mb-3">
                <h4 className="font-medium text-blue-800">
                  Skróć długość tekstu źródła
                </h4>
                {isMandatorySummary && (
                  <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                    Obowiązkowe
                  </span>
                )}
              </div>

              {/* Status podsumowywania */}
              {isSummarizing && (
                <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-3">
                  <div className="flex items-center text-blue-700">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    <div>
                      <span className="font-medium block">
                        {selectedMethod === 'ai' ? 'Podsumowywanie treści przez AI...' : 'Skracanie treści...'}
                      </span>
                      <span className="text-sm">
                        {selectedMethod === 'ai'
                          ? `To może potrwać 10-30 sekund. Skracam do ${summaryLength} znaków.`
                          : `Mechaniczne skracanie do ${summaryLength} znaków.`
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Błąd podsumowywania */}
              {summaryError && (
                <div className="bg-red-50 p-3 rounded border border-red-200 mb-3">
                  <div className="flex items-start text-red-700">
                    <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium block">Błąd podczas podsumowywania</span>
                      <span className="text-sm">{summaryError}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Opcje podsumowania - nowy design z selectami */}
              {!isSummarizing && !summaryGenerated && availableSummaryOptions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select metody */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Wybierz metodę skracania:
                    </label>
                    <select
                      value={selectedMethod}
                      onChange={(e) => setSelectedMethod(e.target.value as 'ai' | 'traditional')}
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="ai">Podsumowanie AI (TL;DR)</option>
                      <option value="traditional">Skrócenie "mechaniczne"</option>
                    </select>
                  </div>

                  {/* Select długości */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Wybierz długość docelową:
                    </label>
                    <select
                      value={selectedLength || ''}
                      onChange={(e) => setSelectedLength(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                      <option value="">Wybierz długość</option>
                      {availableSummaryOptions.map((option) => (
                        <option
                          key={option.value}
                          value={option.isAvailable ? option.value : ''}
                          disabled={!option.isAvailable}
                          className={!option.isAvailable ? 'text-gray-400' : ''}
                        >
                          {option.label} (~{Math.round((option.value / content.content.length) * 100)}%)
                          {!option.isAvailable && ` - ${option.reason}`}
                        </option>
                      ))}
                    </select>

                    {/* Podpowiedzi dla niedostępnych opcji */}
                    {selectedLength && availableSummaryOptions.find(opt => opt.value === selectedLength && !opt.isAvailable) && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                        💡 {availableSummaryOptions.find(opt => opt.value === selectedLength)?.hint}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Samodzielny moduł sukcesu skrócenia */}
          {summaryGenerated && !isSummarizing && (
            <div className="bg-green-50 p-1 rounded-lg border border-green-200 mb-4">
              <div className="flex items-center justify-between text-green-700">
                <div className="flex items-center">
                  <Check size={16} className="ml-2 mr-2" />
                  <span className="text-sm font-medium">
                    Tekst skrócony pomyślnie do {formatNumber(summarizedContent?.length || 0)} znaków
                  </span>
                </div>
                <button
                  onClick={resetSummaryState}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} className="mr-1" />
                  Ponownie
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Przyciski akcji - tylko dwa */}
        <div className="flex justify-between items-center gap-3">
          <button
            onClick={onReject}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer"
          >
            {status === 'success' ? 'Odrzuć' : 'Zamknij'}
          </button>

          {/* Wielofunkcyjny przycisk po prawej */}
          <button
            onClick={() => {
              // Jeśli można skrócić i nie ma podsumowania - skracaj
              if (shouldShowSummarySection && !summaryGenerated && selectedLength && status === 'success') {
                // Sprawdź czy opcja jest dostępna
                const selectedOption = availableSummaryOptions.find(opt => opt.value === selectedLength);
                if (selectedOption?.isAvailable) {
                  handleSummaryExecution();
                }
              } else {
                // Zatwierdź - przekaż odpowiednią treść
                const contentToSend = summarizedContent ? {
                  ...content,
                  content: summarizedContent
                } : content;
                onAccept(contentToSend);
              }
            }}
            disabled={(() => {
              // Jasna logika: kiedy przycisk ma być nieaktywny
              if (status !== 'success' || isSummarizing) return true;

              // Tryb skracania: aktywny gdy wybrano obie opcje i opcja jest dostępna
              if (shouldShowSummarySection && !summaryGenerated) {
                if (!selectedLength) return true;
                const selectedOption = availableSummaryOptions.find(opt => opt.value === selectedLength);
                return !selectedOption?.isAvailable;
              }

              // Tryb zatwierdzania: aktywny gdy nie ma obowiązku skrócenia LUB już skrócono
              return isMandatorySummary && !summaryGenerated;
            })()}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 shadow-sm ${
              (() => {
                if (status !== 'success' || isSummarizing) return 'bg-gray-300 text-gray-500 cursor-not-allowed';

                // Tryb skracania
                if (shouldShowSummarySection && !summaryGenerated) {
                  if (!selectedLength) return 'bg-gray-300 text-gray-500 cursor-not-allowed';
                  const selectedOption = availableSummaryOptions.find(opt => opt.value === selectedLength);
                  return selectedOption?.isAvailable
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed';
                }

                // Tryb zatwierdzania
                return (!isMandatorySummary || summaryGenerated)
                  ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed';
              })()
            }`}
            title={
              status !== 'success'
                ? 'Można użyć tylko źródła z poprawną treścią'
                : isSummarizing
                ? 'Poczekaj na zakończenie skracania'
                : shouldShowSummarySection && !summaryGenerated && !selectedLength
                ? 'Wybierz metodę i długość skracania'
                : shouldShowSummarySection && !summaryGenerated && selectedLength
                ? (() => {
                    const selectedOption = availableSummaryOptions.find(opt => opt.value === selectedLength);
                    return selectedOption?.isAvailable
                      ? 'Skróć treść źródła'
                      : selectedOption?.hint || 'Ta opcja jest niedostępna';
                  })()
                : isMandatorySummary && !summaryGenerated
                ? 'Wymagane jest skrócenie dla długich treści'
                : 'Zatwierdź i dodaj do źródeł'
            }
          >
            {isSummarizing ? (
              <>
                <Loader2 size={16} className="inline mr-2 animate-spin" />
                Skracanie...
              </>
            ) : shouldShowSummarySection && !summaryGenerated && selectedLength && status === 'success' ? (
              'Skróć źródło'
            ) : (
              'Zatwierdź'
            )}
          </button>
        </div>
      </div>

      {/* Modal pełnej treści */}
      {isFullContentModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden animate-fadeIn">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Pełna treść {summarizedContent && contentToDisplay === summarizedContent ? '(Podsumowanie)' : '(Oryginał)'}
              </h3>
              <button
                onClick={() => setIsFullContentModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[70vh] overflow-y-auto">
              <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                {contentToDisplay}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsFullContentModalOpen(false)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourcePreviewModal;