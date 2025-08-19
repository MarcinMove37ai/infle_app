// src/components/pages/EbookiContent.tsx
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, Plus, Edit, Download, Sparkles, Trash2, AlertCircle, RefreshCw, FileText, ImageIcon, Wifi, WifiOff } from 'lucide-react';
import EbookGeneratorModal from '@/components/ebooks/EbookGeneratorModal';
import { useEbooksSSE } from '@/hooks/useEbooksSSE';

// Interfejsy (bez zmian)
interface Ebook {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  status: string | null;
  authorDisplayName: string | null;
  authorLogoUrl: string | null;
  text_ai_provider: string | null;
  text_ai_model: string | null;
  image_ai_provider: string | null;
  image_ai_model: string | null;
  ai_generation_timestamp: string | null;
  created_at: string;
  updated_at: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

interface Stats {
    total: number;
    completed: number;
    inProgress: number;
}

export default function EbookiContent() {
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<'all' | 'completed' | 'draft'>('all');
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingEbookId, setEditingEbookId] = useState<number | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());

  // === NOWA LOGIKA: Stan dla wszystkich e-booków ===
  const [allEbooks, setAllEbooks] = useState<Ebook[]>([]);

  // === NOWA LOGIKA: Stany do obsługi modala usuwania ===
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ebookToDelete, setEbookToDelete] = useState<Ebook | null>(null);


  // Hook SSE dla aktualizacji w czasie rzeczywistym
  const { connected, error: sseError, reconnect, updateTrigger } = useEbooksSSE();
  const error = sseError || localError;

  // Funkcje pomocnicze (bez zmian)
  const isEbookCompleted = (ebook: Ebook) => {
    return ebook.status === 'published' || ebook.status === 'completed';
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'published': return 'Opublikowany';
      case 'completed': return 'Ukończony';
      case 'in-progress': return 'W realizacji';
      case 'draft': return 'Szkic';
      default: return 'Nieznany status';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'published':
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-700';
      case 'draft':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // === ZMIANA: Funkcja pobiera wszystkie e-booki na raz ===
  const fetchAllEbooks = useCallback(async () => {
    setLoading(true);
    setLocalError(null);
    try {
      // Prośba o dużą liczbę e-booków, aby pobrać wszystkie
      const response = await fetch(`/api/ebooks?limit=9999`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się pobrać e-booków');
      }
      setAllEbooks(data.ebooks || []);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Wystąpił nieznany błąd');
      console.error('Błąd podczas pobierania e-booków:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // === NOWA LOGIKA: Filtrowanie i paginacja po stronie frontendu ===
  const { displayedEbooks, pagination, stats } = useMemo(() => {
    let filteredEbooks = [...allEbooks];

    // Filtrowanie według statusu
    if (activeFilter === 'completed') {
      filteredEbooks = filteredEbooks.filter(ebook => isEbookCompleted(ebook));
    } else if (activeFilter === 'draft') {
      filteredEbooks = filteredEbooks.filter(ebook => !isEbookCompleted(ebook));
    }

    // Filtrowanie według wyszukiwanej frazy
    if (searchTerm.trim()) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filteredEbooks = filteredEbooks.filter(ebook =>
        ebook.title?.toLowerCase().includes(lowercasedSearch) ||
        ebook.subtitle?.toLowerCase().includes(lowercasedSearch) ||
        ebook.description?.toLowerCase().includes(lowercasedSearch) ||
        ebook.authorDisplayName?.toLowerCase().includes(lowercasedSearch)
      );
    }

    // Obliczanie statystyk na podstawie pełnej listy
    const statsData: Stats = {
        total: allEbooks.length,
        completed: allEbooks.filter(isEbookCompleted).length,
        inProgress: allEbooks.filter(e => !isEbookCompleted(e)).length,
    };

    // Paginacja
    const limit = 10;
    const total = filteredEbooks.length;
    const totalPages = Math.ceil(total / limit);
    const page = Math.min(currentPage, totalPages) || 1;
    const offset = (page - 1) * limit;

    const paginationData: Pagination = {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };

    return {
      displayedEbooks: filteredEbooks.slice(offset, offset + limit),
      pagination: paginationData,
      stats: statsData,
    };
  }, [allEbooks, currentPage, searchTerm, activeFilter]);

  // Efekt do ustawiania strony, gdyby wyszła poza zakres po filtrowaniu
  useEffect(() => {
    if (currentPage > pagination.totalPages && pagination.totalPages > 0) {
        setCurrentPage(pagination.totalPages);
    }
  }, [currentPage, pagination.totalPages]);


  // Początkowe pobranie danych
  useEffect(() => {
    fetchAllEbooks();
  }, [fetchAllEbooks]);

  // Reakcja na sygnał SSE - ponowne pobranie całej listy
  useEffect(() => {
    if (updateTrigger > 0) {
      console.log('🔄 Otrzymano sygnał SSE, odświeżanie całej listy e-booków...');
      fetchAllEbooks();
    }
  }, [updateTrigger, fetchAllEbooks]);

  // === ZMIANA: Handlery tylko aktualizują stan ===
  const handleFilterClick = (filter: 'all' | 'completed' | 'draft') => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handlePaginationClick = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const downloadPDF = async (ebookId: number, title: string) => {
    setDownloadingIds(prev => new Set(prev).add(ebookId));
    setLocalError(null);
    try {
      const response = await fetch(`/api/ebooks/${ebookId}/export-pdf`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Nie udało się wygenerować PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      console.log(`✅ PDF dla ebooka ID=${ebookId} został pobrany pomyślnie.`);
      // Ponowne pobranie danych, aby zaktualizować status
      fetchAllEbooks();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Wystąpił błąd podczas generowania PDF');
      console.error('Błąd generowania PDF:', err);
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(ebookId);
        return newSet;
      });
    }
  };

  // === NOWA LOGIKA: Funkcje do obsługi modala i usuwania ===

  // Otwiera modal
  const handleDeleteEbook = (ebook: Ebook) => {
    setEbookToDelete(ebook);
    setShowDeleteConfirm(true);
  };

  // Zamyka modal
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setEbookToDelete(null);
  };

  // Potwierdza i wykonuje usunięcie
  const confirmDelete = async () => {
    if (!ebookToDelete) return;

    const ebookId = ebookToDelete.id;
    setShowDeleteConfirm(false);
    setDeletingIds(prev => new Set(prev).add(ebookId));
    setLocalError(null);

    try {
      const response = await fetch(`/api/ebooks?id=${ebookId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Nie udało się usunąć e-booka');
      }
      console.log(`✅ Ebook ID=${ebookId} usunięty pomyślnie.`);
      // Proste odświeżenie całej listy po usunięciu
      fetchAllEbooks();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Wystąpił błąd podczas usuwania');
      console.error('Błąd usuwania e-booka:', err);
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(ebookId);
        return newSet;
      });
      setEbookToDelete(null);
    }
  };

  const handleEbookCreated = () => {
    setActiveFilter('all');
    setSearchTerm('');
    setCurrentPage(1);
    fetchAllEbooks();
  };

  const handleEditEbook = (id: number) => {
    setEditingEbookId(id);
    setIsGeneratorModalOpen(true);
  };

  const handleOpenGenerator = () => {
    setEditingEbookId(null);
    setIsGeneratorModalOpen(true);
  };

  const handleCloseGenerator = () => {
    if (editingEbookId) {
      console.log(`🔄 Zamykanie edytora dla e-booka ID=${editingEbookId}, dyskretne odświeżanie...`);
      fetchAllEbooks();
    }

    // Ustawia filtr na "wszystkie", aby po zamknięciu modala zawsze widzieć pełną listę.
    setActiveFilter('all');
    // Resetuje widok do pierwszej strony, co jest spójne ze zmianą filtra.
    setCurrentPage(1);

    setIsGeneratorModalOpen(false);
    setEditingEbookId(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center lg:justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenGenerator}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm cursor-pointer"
          >
            <Plus size={20} className="mr-2" />
            Utwórz nowy e-book
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 lg:flex-1 lg:max-w-md lg:justify-end">
          <input
            type="text"
            placeholder="Szukaj e-booków..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 lg:min-w-0 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
          >
            Szukaj
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              Wyczyść
            </button>
          )}
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-red-800 font-medium">Wystąpił błąd</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button
            onClick={() => {
              setLocalError(null);
              reconnect();
              fetchAllEbooks();
            }}
            className="w-full sm:w-auto px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors cursor-pointer"
          >
            Spróbuj ponownie
          </button>
        </div>
      )}

      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <button
            onClick={() => handleFilterClick('all')}
            className={`bg-blue-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${
              activeFilter === 'all'
                ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-100'
                : 'border-blue-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Wszystkie e-booki</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <BookOpen className="text-blue-600" size={28} />
            </div>
          </button>

          <button
            onClick={() => handleFilterClick('completed')}
            className={`bg-green-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${
              activeFilter === 'completed'
                ? 'border-green-400 ring-2 ring-green-200 bg-green-100'
                : 'border-green-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Ukończone</p>
                <p className="text-xl sm:text-2xl font-bold text-green-900">{stats.completed}</p>
              </div>
              <Sparkles className="text-green-600" size={28} />
            </div>
          </button>

          <button
            onClick={() => handleFilterClick('draft')}
            className={`bg-orange-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md sm:col-span-2 lg:col-span-1 cursor-pointer ${
              activeFilter === 'draft'
                ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-100'
                : 'border-orange-200 hover:border-orange-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">Szkic</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.inProgress}</p>
              </div>
              <Edit className="text-orange-600" size={28} />
            </div>
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Twoje e-booki</h2>
            {pagination && pagination.total > 0 && (
            <p className="text-sm text-gray-600">
                Wyświetlanie {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} z {pagination.total}
            </p>
            )}
        </div>

        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <RefreshCw size={48} className="mx-auto text-gray-300 mb-4 animate-spin" />
              <p className="text-gray-500">Ładowanie e-booków...</p>
            </div>
          ) : displayedEbooks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || activeFilter !== 'all' ? 'Nie znaleziono e-booków' : 'Nie utworzyłeś jeszcze żadnych e-booków'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm
                  ? 'Spróbuj zmienić frazę wyszukiwania.'
                  : 'Kliknij przycisk powyżej, aby stworzyć swój pierwszy e-book.'
                }
              </p>
            </div>
          ) : (
            displayedEbooks.map((ebook) => {
              const isDeleting = deletingIds.has(ebook.id);
              const isDownloading = downloadingIds.has(ebook.id);

              return (
                <div key={ebook.id} className={`px-6 py-4 hover:bg-gray-50 transition-colors ${isDeleting || isDownloading ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{ebook.title}</h3>
                      {ebook.subtitle && <p className="text-sm text-gray-500 truncate">{ebook.subtitle}</p>}
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(ebook.status)}`}>
                          {getStatusLabel(ebook.status)}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(ebook.created_at)}</span>
                        {ebook.text_ai_model && (
                          <span className="text-xs flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            <FileText size={12} className="text-gray-500" />
                            {ebook.text_ai_model}
                          </span>
                        )}
                        {ebook.image_ai_model && (
                          <span className="text-xs flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            <ImageIcon size={12} className="text-gray-500" />
                            {ebook.image_ai_model}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleEditEbook(ebook.id)}
                        className={`p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 ${isDownloading || isDeleting ? 'cursor-not-allowed' : ''}`}
                        title="Edytuj"
                        disabled={isDownloading || isDeleting}
                      >
                        <Edit size={16} />
                      </button>

                      {isEbookCompleted(ebook) && (
                        <button
                          onClick={() => downloadPDF(ebook.id, ebook.title)}
                          className={`p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 ${isDownloading || isDeleting ? 'cursor-not-allowed' : ''}`}
                          title="Pobierz PDF"
                          disabled={isDownloading || isDeleting}
                        >
                          {isDownloading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteEbook(ebook)}
                        className={`p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 ${isDeleting || isDownloading ? 'cursor-not-allowed' : ''}`}
                        title="Usuń"
                        disabled={isDeleting || isDownloading}
                      >
                        {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => handlePaginationClick(currentPage - 1)}
                disabled={!pagination.hasPrev || loading}
                className={`w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 ${!pagination.hasPrev || loading ? 'cursor-not-allowed' : ''}`}
              >
                ← Poprzednia
              </button>
              <span className="text-sm text-gray-600">
                Strona {pagination.page} z {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePaginationClick(currentPage + 1)}
                disabled={!pagination.hasNext || loading}
                className={`w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 ${!pagination.hasNext || loading ? 'cursor-not-allowed' : ''}`}
              >
                Następna →
              </button>
            </div>
          </div>
        )}
      </div>

      <EbookGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={handleCloseGenerator}
        onEbookCreated={handleEbookCreated}
        ebookId={editingEbookId}
      />

      {/* === NOWY MODAL POTWIERDZAJĄCY USUNIĘCIE === */}
      {showDeleteConfirm && ebookToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">

            {/* Header */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Usuń e-book</h3>
                <p className="text-sm text-gray-500">Tej operacji nie można cofnąć</p>
              </div>
            </div>

            {/* Content */}
            <div className="mb-6">
              <p className="text-gray-700 mb-2">
                Czy na pewno chcesz trwale usunąć e-book:
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="font-medium text-gray-900 truncate" title={ebookToDelete.title}>
                  {ebookToDelete.title}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Usuń
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}