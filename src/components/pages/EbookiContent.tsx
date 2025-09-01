// src/components/pages/EbookiContent.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BookOpen, Plus, Edit, Download, Sparkles, Trash2, AlertCircle, RefreshCw, FileText, ImageIcon, X, Search, LayoutGrid } from 'lucide-react';
import EbookGeneratorModal from '@/components/ebooks/EbookGeneratorModal';
import { useEbooksSSE } from '@/hooks/useEbooksSSE';

// Interfaces
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
  cover_image_webp_url: string | null;
  hasLandingPage: boolean;
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
  const [creatingPageId, setCreatingPageId] = useState<number | null>(null);
  const [downloadingIds, setDownloadingIds] = useState<Set<number>>(new Set());

  const [allEbooks, setAllEbooks] = useState<Ebook[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ebookToDelete, setEbookToDelete] = useState<Ebook | null>(null);

  const [previewEbook, setPreviewEbook] = useState<Ebook | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string>('');
  const [previewImageName, setPreviewImageName] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [previewTocItems, setPreviewTocItems] = useState<{ id: number; title: string }[] | null>(null);
  const [isPreviewTocLoading, setIsPreviewTocLoading] = useState(false);

  const previewModalRef = useRef<HTMLDivElement>(null);
  const previewImageRef = useRef<HTMLImageElement>(null);
  const { error: sseError, reconnect, updateTrigger } = useEbooksSSE();
  const error = sseError || localError;

  const isEbookCompleted = (ebook: Ebook) => {
    return ebook.status === 'published' || ebook.status === 'completed';
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'published': return 'Published';
      case 'completed': return 'Completed';
      case 'in-progress': return 'In progress';
      case 'draft': return 'Draft';
      default: return 'Unknown status';
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

  const getStatusColorForCardBorder = (status: string | null) => {
    switch (status) {
      case 'published':
      case 'completed':
        return 'bg-green-500';
      case 'in-progress':
        return 'bg-yellow-500';
      case 'draft':
        return 'bg-orange-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const fetchAllEbooks = useCallback(async () => {
    setLoading(true);
    setLocalError(null);
    try {
      const response = await fetch(`/api/ebooks?limit=9999`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch e-books');
      }
      setAllEbooks(data.ebooks || []);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const { displayedEbooks, pagination, stats } = useMemo(() => {
    const cleanEbooks = allEbooks.filter(ebook => ebook.title !== 'New Ebook (draft)');
    let filteredEbooks = [...cleanEbooks];

    if (activeFilter === 'completed') {
      filteredEbooks = filteredEbooks.filter(isEbookCompleted);
    } else if (activeFilter === 'draft') {
      filteredEbooks = filteredEbooks.filter(ebook => !isEbookCompleted(ebook));
    }

    if (searchTerm.trim()) {
      const lowercasedSearch = searchTerm.toLowerCase();
      filteredEbooks = filteredEbooks.filter(ebook =>
        ebook.title?.toLowerCase().includes(lowercasedSearch) ||
        ebook.subtitle?.toLowerCase().includes(lowercasedSearch) ||
        ebook.description?.toLowerCase().includes(lowercasedSearch) ||
        ebook.authorDisplayName?.toLowerCase().includes(lowercasedSearch)
      );
    }

    const statsData: Stats = {
        total: cleanEbooks.length,
        completed: cleanEbooks.filter(isEbookCompleted).length,
        inProgress: cleanEbooks.filter(e => !isEbookCompleted(e)).length,
    };

    const limit = 9; // Usunięto logikę zależną od viewMode
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

  useEffect(() => {
    if (currentPage > pagination.totalPages && pagination.totalPages > 0) {
        setCurrentPage(pagination.totalPages);
    }
  }, [currentPage, pagination.totalPages]);

  useEffect(() => {
    fetchAllEbooks();
  }, [fetchAllEbooks]);

  useEffect(() => {
    if (updateTrigger > 0) {
      fetchAllEbooks();
    }
  }, [updateTrigger, fetchAllEbooks]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') handleClosePreview();
    };
    const handleClickOutside = (event: MouseEvent) => {
        if (previewModalRef.current && !previewModalRef.current.contains(event.target as Node)) {
            handleClosePreview();
        }
    };

    if (previewImage) {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [previewImage]);

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
        throw new Error(data.error || 'Failed to generate PDF');
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
      fetchAllEbooks();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'An error occurred while generating the PDF');
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(ebookId);
        return newSet;
      });
    }
  };

  const handleDeleteEbook = (ebook: Ebook) => {
    setEbookToDelete(ebook);
    setShowDeleteConfirm(true);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setEbookToDelete(null);
  };

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
        throw new Error(data.error || 'Failed to delete the e-book');
      }
      fetchAllEbooks();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'An error occurred while deleting');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(ebookId);
        return newSet;
      });
      setEbookToDelete(null);
    }
  };

  const handleCreatePage = async (ebookId: number) => {
    setCreatingPageId(ebookId);
    setLocalError(null);

    try {
      console.log('Tworzenie strony dla e-booka ID:', ebookId);
      const pageResponse = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ebookId: ebookId })
      });

      const pageData = await pageResponse.json();
      if (!pageResponse.ok) throw new Error(pageData.error || 'Nie udało się utworzyć strony.');
      console.log('Strona utworzona pomyślnie z ID:', pageData.id);

      try {
        console.log('Rozpoczynam generowanie treści AI...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const contentResponse = await fetch('/api/pages/ai-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: pageData.id, ebookId: ebookId }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const contentData = await contentResponse.json();

        if (!contentResponse.ok) {
          console.error('Błąd generowania treści AI:', contentData.error);
          if (contentResponse.status !== 409) {
            setLocalError(`Strona została utworzona, ale automatyczne generowanie treści nie powiodło się. (Błąd: ${contentData.error})`);
          }
        } else {
          console.log('Treść AI wygenerowana pomyślnie!');
        }
      } catch (contentError) {
        if (contentError instanceof Error) {
          const errorMessage = contentError.name === 'AbortError'
            ? 'Strona została utworzona, ale generowanie treści trwa zbyt długo.'
            : 'Strona została utworzona, ale wystąpił błąd podczas generowania treści AI.';
          setLocalError(errorMessage);
        }
      }
      await fetchAllEbooks();
    } catch (err) {
      console.error('Błąd podczas tworzenia strony:', err);
      setLocalError(err instanceof Error ? err.message : 'Wystąpił nieznany błąd podczas tworzenia strony.');
    } finally {
      setCreatingPageId(null);
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

  const handlePreviewEbook = async (ebook: Ebook) => {
    if (ebook.cover_image_webp_url) {
        setPreviewEbook(ebook);
        const originalFilename = ebook.cover_image_webp_url;
        const lastDotIndex = originalFilename.lastIndexOf('.');
        let previewFilename;

        if (lastDotIndex !== -1) {
            let baseName = originalFilename.substring(0, lastDotIndex);
            const extension = originalFilename.substring(lastDotIndex);
            baseName = baseName.replace('_COVER', '');
            previewFilename = `${baseName}_rawMOCK${extension}`;
        } else {
            let baseName = originalFilename;
            baseName = baseName.replace('_COVER', '');
            previewFilename = `${baseName}_rawMOCK`;
        }
        const previewImageUrl = `/api/assets/${previewFilename}`;
        setPreviewImage(previewImageUrl);
        setPreviewImageTitle(`Cover preview: ${ebook.title}`);
        setPreviewImageName(`cover_${ebook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`);

        setIsPreviewTocLoading(true);
        setPreviewTocItems(null);
        try {
            const response = await fetch(`/api/ebooks/${ebook.id}/chapters`);
            if (response.ok) {
                const data = await response.json();
                setPreviewTocItems(data.ebook?.ebook_chapters || []);
            } else {
                setPreviewTocItems([]);
            }
        } catch (error) {
            console.error("Error fetching table of contents:", error);
            setPreviewTocItems([]);
        } finally {
            setIsPreviewTocLoading(false);
        }
    } else {
        console.warn("Attempted to open preview for an e-book without a cover.");
    }
  };

  const handleClosePreview = () => {
    setPreviewEbook(null);
    setPreviewImage(null);
    setPreviewImageTitle('');
    setPreviewImageName('');
    setIsConverting(false);
    setPreviewTocItems(null);
  };

  const handleDownloadAsPng = async (baseFileName: string) => {
    if (!previewImageRef.current) return;
    const currentImageUrl = previewImageRef.current.src;
    if (!currentImageUrl) return;

    setIsConverting(true);
    setLocalError(null);
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = currentImageUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.drawImage(image, 0, 0);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      const finalFileName = baseFileName.replace(/\.[^/.]+$/, "") + ".png";
      link.download = finalFileName;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error converting image to PNG:", error);
      setLocalError("Could not convert the image. Please try downloading it manually.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleOpenGenerator = () => {
    setEditingEbookId(null);
    setIsGeneratorModalOpen(true);
  };

  const handleCloseGenerator = async () => {
    setIsGeneratorModalOpen(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    fetchAllEbooks();
    setActiveFilter('all');
    setCurrentPage(1);
    setEditingEbookId(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-red-800 font-medium">An error occurred</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button
            onClick={() => { setLocalError(null); reconnect(); fetchAllEbooks(); }}
            className="w-full sm:w-auto px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <button
            onClick={() => handleFilterClick('all')}
            className={`bg-blue-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${
              activeFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-100' : 'border-blue-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">All e-books</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.total}</p>
              </div>
              <BookOpen className="text-blue-600" size={28} />
            </div>
          </button>
          <button
            onClick={() => handleFilterClick('completed')}
            className={`bg-green-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${
              activeFilter === 'completed' ? 'border-green-400 ring-2 ring-green-200 bg-green-100' : 'border-green-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-green-900">{stats.completed}</p>
              </div>
              <Sparkles className="text-green-600" size={28} />
            </div>
          </button>
          <button
            onClick={() => handleFilterClick('draft')}
            className={`bg-orange-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md sm:col-span-2 lg:col-span-1 cursor-pointer ${
              activeFilter === 'draft' ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-100' : 'border-orange-200 hover:border-orange-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium">Drafts</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.inProgress}</p>
              </div>
              <Edit className="text-orange-600" size={28} />
            </div>
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <form onSubmit={handleSearch} className="flex w-full sm:max-w-md items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search e-books..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-400"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="hidden sm:inline-flex px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            Search
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </form>
        <button
          onClick={handleOpenGenerator}
          className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus size={16} className="mr-2" />
          Create new e-book
        </button>
      </div>

      <div className="bg-transparent sm:bg-white rounded-none sm:rounded-xl border-0 sm:border border-gray-200 overflow-hidden -mx-4 sm:mx-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Your e-books</h2>

            <div className="flex items-center gap-2">
              {pagination && pagination.total > 0 && (
                <p className="text-sm text-gray-600 hidden sm:block">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
              )}
            </div>
        </div>

        {loading ? (
            <div className="px-6 py-12 text-center"><RefreshCw size={48} className="mx-auto text-gray-300 mb-4 animate-spin" /><p className="text-gray-500">Loading e-books...</p></div>
        ) : displayedEbooks.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{searchTerm || activeFilter !== 'all' ? 'No e-books found' : 'You haven\'t created any e-books yet'}</h3>
              <p className="text-gray-500 mb-6">{searchTerm ? 'Try changing your search phrase.' : 'Click the button above to create your first e-book.'}</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {displayedEbooks.map((ebook) => {
                const isDeleting = deletingIds.has(ebook.id);
                const isDownloading = downloadingIds.has(ebook.id);
                const isDisabled = isDeleting || isDownloading;

                return (
                  <div key={ebook.id} className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className={`h-1.5 ${getStatusColorForCardBorder(ebook.status)}`}></div>

                    <div className="p-4 flex flex-col flex-grow">
                      <div className="flex gap-4">
                          <div className="w-1/3 flex-shrink-0 flex flex-col justify-center">
                            {ebook.cover_image_webp_url ? (
                                <img
                                  src={`/api/assets/${ebook.cover_image_webp_url}`}
                                  alt={`Cover: ${ebook.title}`}
                                  className="w-full h-auto object-cover rounded-md bg-gray-200 cursor-pointer aspect-square"
                                  loading="lazy"
                                  onClick={() => handlePreviewEbook(ebook)}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md aspect-square"><ImageIcon className="w-8 h-8 text-gray-400" /></div>
                            )}
                            <p className="text-xs text-gray-500 text-center mt-1">
                              {ebook.cover_image_webp_url ? 'Cover image' : 'No cover image'}
                            </p>
                          </div>
                          <div className="w-2/3 flex flex-col">
                            <h3 className="font-semibold text-gray-900 text-base leading-tight line-clamp-3">{ebook.title}</h3>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ebook.subtitle}</p>
                            <div className="mt-2 flex items-center flex-wrap gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${getStatusColor(ebook.status)}`}>{getStatusLabel(ebook.status)}</span>
                                {creatingPageId === ebook.id ? (
                                    <span className="text-xs flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                                        <RefreshCw size={12} className="animate-spin" /> Creating...
                                    </span>
                                ) : ebook.hasLandingPage && (
                                    <span className="text-xs flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                                        <FileText size={12} /> LP Ready
                                    </span>
                                )}
                            </div>

                            <div className="border-t border-gray-200 my-3"></div>

                            <div className="text-xs">
                                <div className="flex"><dt className="w-1/3 text-gray-500">Created:</dt><dd className="w-2/3 font-medium text-gray-800 truncate">{formatDate(ebook.created_at)}</dd></div>
                                {ebook.authorDisplayName && (
                                  <>
                                    <div className="border-t border-gray-200 my-2"></div>
                                    <div className="flex"><dt className="w-1/3 text-gray-500">Author:</dt><dd className="w-2/3 font-medium text-gray-800 truncate">{ebook.authorDisplayName}</dd></div>
                                  </>
                                )}
                            </div>
                          </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 mt-auto space-y-3 sm:space-y-0 sm:flex sm:justify-between sm:items-center">
                        {/* Przycisk "Create LP" na całą szerokość dla widoku mobilnego siatki */}
                        {ebook.status !== 'draft' && !ebook.hasLandingPage && creatingPageId !== ebook.id && (
                            <button
                                onClick={() => handleCreatePage(ebook.id)}
                                className="w-full flex sm:hidden items-center justify-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-2 rounded-lg hover:bg-yellow-200 font-medium text-sm"
                                disabled={isDisabled}
                            >
                                <Plus size={14} />
                                Create Landing Page
                            </button>
                        )}

                        {/* Kontener na pozostałe przyciski */}
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleEditEbook(ebook.id)} className="text-sm text-sky-600 hover:text-sky-700 font-medium bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center" disabled={isDisabled}>
                                    <Edit size={14} className="inline mr-1.5" />
                                    Edit
                                </button>
                                {isEbookCompleted(ebook) && (
                                    <button onClick={() => downloadPDF(ebook.id, ebook.title)} className="text-sm text-green-600 hover:text-green-700 font-medium bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center" disabled={isDisabled}>
                                        {isDownloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} className="inline mr-1.5" />}
                                        {isDownloading ? '' : 'Download'}
                                    </button>
                                )}
                                {/* Przycisk "Create LP" dla widoku desktopowego siatki */}
                                {ebook.status !== 'draft' && !ebook.hasLandingPage && creatingPageId !== ebook.id && (
                                    <button
                                        onClick={() => handleCreatePage(ebook.id)}
                                        className="text-sm text-yellow-700 hover:text-yellow-800 font-medium bg-yellow-100 hover:bg-yellow-200 px-3 py-1.5 rounded-md transition-colors hidden sm:inline-flex items-center"
                                        disabled={isDisabled}
                                    >
                                        <Plus size={14} className="inline mr-1.5" />
                                        Create LP
                                    </button>
                                )}
                            </div>
                            <button onClick={() => handleDeleteEbook(ebook)} className="text-sm text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center" disabled={isDisabled}>
                                {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} className="inline mr-1.5" />}
                                 {isDeleting ? '' : 'Delete'}
                            </button>
                        </div>
                    </div>

                  </div>
                )
              })}
            </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <button onClick={() => handlePaginationClick(currentPage - 1)} disabled={!pagination.hasPrev || loading} className={`w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 ${!pagination.hasPrev || loading ? 'cursor-not-allowed' : ''}`}>← Previous</button>
              <span className="text-sm text-gray-600">Page {pagination.page} of {pagination.totalPages}</span>
              <button onClick={() => handlePaginationClick(currentPage + 1)} disabled={!pagination.hasNext || loading} className={`w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 ${!pagination.hasNext || loading ? 'cursor-not-allowed' : ''}`}>Next →</button>
            </div>
          </div>
        )}
      </div>

      <EbookGeneratorModal isOpen={isGeneratorModalOpen} onClose={handleCloseGenerator} onEbookCreated={handleEbookCreated} ebookId={editingEbookId}/>

      {showDeleteConfirm && ebookToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete e-book</h3>
              <p className="text-gray-600">
                Are you sure you want to permanently delete the e-book "{ebookToDelete.title}"? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={cancelDelete} className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer">Cancel</button>
              <button onClick={confirmDelete} className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all duration-200 cursor-pointer">Yes, delete</button>
            </div>
          </div>
        </div>
      )}

      {previewImage && previewEbook && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div ref={previewModalRef} className="relative w-full max-w-screen-xl max-h-[95vh] flex flex-col bg-gray-900/80 rounded-xl border border-white/10 animate-fadeIn shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-white/10">
              <div className="flex items-center space-x-3 min-w-0">
                <ImageIcon className="h-5 w-5 text-white flex-shrink-0" />
                <h3 className="text-white font-medium truncate">{previewImageTitle}</h3>
              </div>
              <button onClick={handleClosePreview} className="text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-4">
                <X size={24} />
              </button>
            </div>

            {/* Main Content: Image + Table of Contents */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0 overflow-y-auto">
              {/* Left Side: Image */}
              <div className="w-full md:w-2/3 flex items-center justify-center">
                <img
                  ref={previewImageRef}
                  src={previewImage}
                  alt={previewImageTitle}
                  className="w-auto h-auto max-w-full max-h-full object-contain rounded-md"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = `/api/assets/${previewEbook.cover_image_webp_url}`;
                  }}
                />
              </div>

              {/* Right Side: Table of Contents (Desktop Only) */}
              <div className="hidden md:flex w-full mt-4 md:mt-0 md:w-1/3 bg-black/20 rounded-lg flex-col overflow-hidden border border-white/10 max-h-[40vh] md:max-h-full">
                <div className="p-3 flex-shrink-0 bg-black/20">
                  <h4 className="font-semibold text-white flex items-center">
                    <FileText size={18} className="mr-2 text-gray-300"/>
                    Table of Contents
                  </h4>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {isPreviewTocLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <RefreshCw size={24} className="animate-spin text-gray-400" />
                    </div>
                  ) : previewTocItems && previewTocItems.length > 0 ? (
                    <ul className="divide-y divide-white/10">
                      {previewTocItems.map((item, index) => (
                        <li key={item.id} className="p-3 flex items-start text-sm text-gray-200 hover:bg-white/5 transition-colors">
                          <span className="mr-3 font-mono text-gray-400">{index + 1}.</span>
                          <span className="flex-1">{item.title}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center text-gray-400 px-4">
                        <p>This e-book does not have a table of contents yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col md:flex-row-reverse gap-3 p-4 flex-shrink-0 border-t border-white/10">
              <button
                onClick={() => handleDownloadAsPng(previewImageName)}
                disabled={isConverting}
                className={`w-full md:w-auto flex items-center justify-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                  isConverting
                    ? "bg-gray-500 text-white cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
                title="Download as PNG"
              >
                {isConverting ? (
                  <><RefreshCw size={16} className="animate-spin" /><span>Converting...</span></>
                ) : (
                  <><Download size={16} /><span>Download PNG</span></>
                )}
              </button>
              <button
                onClick={() => {
                  if (previewEbook) {
                    handleClosePreview();
                    handleEditEbook(previewEbook.id);
                  }
                }}
                className="w-full md:w-auto flex items-center justify-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                <Edit size={16} />
                <span>Edit e-book</span>
              </button>
              <button onClick={handleClosePreview} className="w-full md:w-auto px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium md:mr-auto">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.2); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.4); }
        .animate-fadeIn { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}