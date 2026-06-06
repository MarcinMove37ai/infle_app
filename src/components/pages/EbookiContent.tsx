// src/components/pages/EbookiContent.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BookOpen, Plus, Edit, Download, Sparkles, Trash2, AlertCircle, RefreshCw, FileText, ImageIcon, X, Search, LayoutGrid, Check } from 'lucide-react';
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
  total_pages: number | null;
  chapterCount?: number;
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

const translations = {
  pl: {
    // Nagłówki i przyciski
    myEbooks: 'Moje E-booki',
    yourEbooks: 'Twoje E-booki',
    generateNewEbook: 'Generuj nowy E-book',
    createNewEbook: 'Utwórz nowy E-book',
    search: 'Szukaj...',
    all: 'Wszystkie',
    completedFilter: 'Ukończone',
    drafts: 'Szkice',

    // Statusy
    published: 'Opublikowany',
    completed: 'Ukończony',
    inProgress: 'W trakcie',
    draft: 'Szkic',
    unknownStatus: 'Nieznany status',

    // Akcje
    edit: 'Edytuj',
    download: 'Pobierz',
    createLP: 'Utwórz Stronę',
    delete: 'Usuń',
    cancel: 'Anuluj',
    close: 'Zamknij',
    clear: 'Wyczyść',
    previous: 'Poprzednia',
    next: 'Następna',

    // Detale e-booka
    created: 'Utworzono:',
    coverImage: 'Obraz okładki',
    noCoverImage: 'Brak obrazu okładki',
    chaptersLabel: 'Rozdziały:',
    pagesLabel: 'Strony:',

    // Komunikaty
    noEbooksFound: 'Nie znaleziono e-booków',
    noEbooksFoundDesc: 'Spróbuj zmienić kryteria wyszukiwania lub filtry.',
    noEbooksYet: 'Nie stworzyłeś jeszcze żadnych e-booków',
    tryChangingSearch: 'Spróbuj zmienić frazę wyszukiwania.',
    clickToCreateFirst: 'Kliknij przycisk powyżej, aby stworzyć swój pierwszy e-book.',
    createLandingPage: 'Utwórz Stronę Pobierania',
    creatingLandingPage: 'Tworzenie Strony Pobierania...',
    creating: 'Tworzenie...',
    goToPage: 'Przejdź do Stron Pobierania',
    goToPageShort: 'Zobacz Strony',
    loading: 'Ładowanie...',
    errorOccurred: 'Wystąpił błąd',
    retry: 'Spróbuj ponownie',

    // Modal usuwania
    deleteEbook: 'Usuń e-book',
    deleteConfirmation: 'Czy na pewno chcesz trwale usunąć e-book',
    deleteWarning: 'Ta czynność jest nieodwracalna.',
    yesDelete: 'Tak, usuń',

    // Podgląd
    tableOfContents: 'Spis treści',
    noTableOfContents: 'Ten e-book nie ma jeszcze spisu treści.',
    downloadPng: 'Pobierz PNG',
    converting: 'Konwersja...',
    editEbook: 'Edytuj e-book',

    // Paginacja
    pageOf: 'Strona',
    of: 'z',

    // Create spotlight
    startHere: 'Zacznij tutaj',
    startHereDesc: 'Stwórz swój pierwszy ebook w kilka minut. Poprowadzimy Cię krok po kroku, zaczynając od tytułów przygotowanych dla Ciebie.',
    dontShowAgain: 'Nie pokazuj ponownie',
    gotIt: 'Rozumiem',
  },
  en: {
    // Headers and buttons
    myEbooks: 'My E-books',
    yourEbooks: 'Your E-books',
    generateNewEbook: 'Generate New E-book',
    createNewEbook: 'Create new e-book',
    search: 'Search...',
    all: 'All',
    completedFilter: 'Completed',
    drafts: 'Drafts',

    // Statuses
    published: 'Published',
    completed: 'Completed',
    inProgress: 'In progress',
    draft: 'Draft',
    unknownStatus: 'Unknown status',

    // Actions
    edit: 'Edit',
    download: 'Download',
    createLP: 'Create Page',
    delete: 'Delete',
    cancel: 'Cancel',
    close: 'Close',
    clear: 'Clear',
    previous: 'Previous',
    next: 'Next',

    // E-book details
    created: 'Created:',
    coverImage: 'Cover image',
    noCoverImage: 'No cover image',
    chaptersLabel: 'Chapters:',
    pagesLabel: 'Pages:',

    // Messages
    noEbooksFound: 'No e-books found',
    noEbooksFoundDesc: 'Try changing your search criteria or filters.',
    noEbooksYet: 'You haven\'t created any e-books yet',
    tryChangingSearch: 'Try changing your search phrase.',
    clickToCreateFirst: 'Click the button above to create your first e-book.',
    createLandingPage: 'Create Landing Page',
    creatingLandingPage: 'Creating Landing Page...',
    creating: 'Creating...',
    goToPage: 'Go to Landing Pages',
    goToPageShort: 'View Pages',
    loading: 'Loading...',
    errorOccurred: 'An error occurred',
    retry: 'Try again',

    // Delete modal
    deleteEbook: 'Delete e-book',
    deleteConfirmation: 'Are you sure you want to permanently delete the e-book',
    deleteWarning: 'This action cannot be undone.',
    yesDelete: 'Yes, delete',

    // Preview
    tableOfContents: 'Table of Contents',
    noTableOfContents: 'This e-book does not have a table of contents yet.',
    downloadPng: 'Download PNG',
    converting: 'Converting...',
    editEbook: 'Edit e-book',

    // Pagination
    pageOf: 'Page',
    of: 'of',

    // Create spotlight
    startHere: 'Start here',
    startHereDesc: 'Create your first ebook in minutes. We will guide you the whole way, starting with titles made for you.',
    dontShowAgain: "Don't show again",
    gotIt: 'Got it',
  }
};

export default function EbookiContent() {
  const router = useRouter();
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
  const [loadingPreviewId, setLoadingPreviewId] = useState<number | null>(null);
  const [currentLang, setCurrentLang] = useState<'pl' | 'en'>('pl');
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

  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage');
    if (savedLang === 'en' || savedLang === 'pl') {
      setCurrentLang(savedLang);
    }
  }, []);

  const isEbookCompleted = (ebook: Ebook) => {
    return ebook.status === 'published' || ebook.status === 'completed';
  };

  const getStatusLabel = (status: string | null) => {
    const t = translations[currentLang];
    switch (status) {
      case 'published': return t.published;
      case 'completed': return t.completed;
      case 'in-progress': return t.inProgress;
      case 'draft': return t.draft;
      default: return t.unknownStatus;
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
    return new Date(dateString).toLocaleDateString(
      currentLang === 'pl' ? 'pl-PL' : 'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );
  };

  const fetchAllEbooks = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    setLocalError(null);
    try {
      const response = await fetch(`/api/ebooks?limit=9999`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch e-books');
      }
      setAllEbooks(data.ebooks || []);
    } catch (err) {
      if (!silent) setLocalError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      if (!silent) setLoading(false);
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
  const handleGoToLandings = () => {
    router.push('/landings');
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

        const contentResponse = await fetch('/api/pages/new-ai-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: pageData.id, ebookId: ebookId, language: currentLang }),
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
        setLoadingPreviewId(ebook.id);
        setPreviewEbook(ebook);
        // Modal pokazuje DOKŁADNIE tę samą grafikę co karta (sama okładka _COVER),
        // z tym samym cache-bustem na updated_at. Żadnych mockupów (_rawMOCK) tutaj.
        const cacheBust = ebook.updated_at ? new Date(ebook.updated_at).getTime() : '';
        const previewImageUrl = `/api/assets/${ebook.cover_image_webp_url}?t=${cacheBust}`;
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
            setLoadingPreviewId(null);
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

  const [showCreateSpotlight, setShowCreateSpotlight] = useState(false);
  // Tłumi spotlight tuż po zamknięciu kreatora — w tym oknie cichy refresh dolicza ewentualny
  // nowy szkic/ebook, więc spotlight nie mignie zanim lista się zaktualizuje.
  const suppressCreateSpotlight = useRef(false);
  // Po zamknięciu kreatora pokazujemy natychmiast kartę-skeleton (placeholder), żeby strona
  // nie była pusta zanim cichy refresh dociągnie prawdziwą kartę nowego ebooka.
  const [showPostCloseSkeleton, setShowPostCloseSkeleton] = useState(false);

  // Spotlight na "Create new e-book" — dla świeżego usera bez ebooków, jeśli nie wyłączył.
  // Czekamy aż lista się załaduje (loading=false), żeby nie mignąć przed danymi.
  // NIE pokazujemy, gdy modal kreatora jest otwarty (tam jest własny spotlight tytułów),
  // ani w oknie tłumienia tuż po jego zamknięciu.
  useEffect(() => {
    if (loading || isGeneratorModalOpen || suppressCreateSpotlight.current) { setShowCreateSpotlight(false); return; }
    let hidden = false;
    try { hidden = localStorage.getItem('inflee_create_spotlight_hidden') === '1'; } catch {}
    const cleanCount = allEbooks.filter((e) => e.title !== 'New Ebook (draft)').length;
    if (!hidden && cleanCount === 0) {
      const tmr = setTimeout(() => setShowCreateSpotlight(true), 250);
      return () => clearTimeout(tmr);
    }
    setShowCreateSpotlight(false);
  }, [loading, allEbooks, isGeneratorModalOpen]);

  // Skeleton po zamknięciu kreatora znika dopiero, gdy w liście pojawi się realna karta
  // (ciągłe przejście placeholder → karta). Bezpiecznik: jeśli po 3s nic nie wpadło
  // (np. zamknięto pusty modal bez zapisu), też go chowamy, by nie wisiał w nieskończoność.
  useEffect(() => {
    if (!showPostCloseSkeleton) return;
    if (displayedEbooks.length > 0) {
      setShowPostCloseSkeleton(false);
      return;
    }
    const safety = setTimeout(() => setShowPostCloseSkeleton(false), 3000);
    return () => clearTimeout(safety);
  }, [showPostCloseSkeleton, displayedEbooks.length]);

  const dismissCreateSpotlight = () => setShowCreateSpotlight(false);
  const [createSpotlightHidden, setCreateSpotlightHidden] = useState(false);
  useEffect(() => {
    try { setCreateSpotlightHidden(localStorage.getItem('inflee_create_spotlight_hidden') === '1'); } catch {}
  }, []);
  const toggleCreateSpotlightHidden = (checked: boolean) => {
    setCreateSpotlightHidden(checked);
    try {
      if (checked) localStorage.setItem('inflee_create_spotlight_hidden', '1');
      else localStorage.removeItem('inflee_create_spotlight_hidden');
    } catch {}
  };

  const handleOpenGenerator = () => {
    setShowCreateSpotlight(false);
    setEditingEbookId(null);
    setIsGeneratorModalOpen(true);
  };

  const handleCloseGenerator = async () => {
    suppressCreateSpotlight.current = true; // blokuj spotlight, póki lista się nie odświeży
    setShowCreateSpotlight(false);
    setShowPostCloseSkeleton(true); // natychmiast placeholder karty, by strona nie była pusta
    setIsGeneratorModalOpen(false);
    setActiveFilter('all');
    setCurrentPage(1);
    setEditingEbookId(null);
    // Auto-zapis szkicu w modalu jest fire-and-forget przy unmount — odświeżamy listę
    // CICHO (bez spinnera), żeby dane podmieniły się płynnie bez migotania. Dwa przejścia:
    // jedno po krótkiej chwili, drugie z zapasem, by na pewno złapać zapisany tytuł.
    await new Promise(resolve => setTimeout(resolve, 400));
    await fetchAllEbooks({ silent: true });
    // NIE chowamy skeletonu tutaj — zrobi to useEffect, gdy realna karta pojawi się
    // w displayedEbooks (ciągłość: placeholder ustępuje dopiero, gdy jest co pokazać).
    setTimeout(() => {
      fetchAllEbooks({ silent: true });
      // Po odświeżeniu zdejmujemy tłumienie. Jeśli user faktycznie nie ma ebooków
      // (nic nie stworzył), spotlight wróci po tym oknie — co jest pożądane.
      setTimeout(() => { suppressCreateSpotlight.current = false; }, 200);
    }, 700);
  };

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
          <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-red-800 font-medium">{translations[currentLang].errorOccurred}</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button
            onClick={() => { setLocalError(null); reconnect(); fetchAllEbooks(); }}
            className="w-full sm:w-auto px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition-colors cursor-pointer"
          >
            {translations[currentLang].retry}
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
                <p className="text-blue-600 text-sm font-medium">{translations[currentLang].all}</p>
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
                <p className="text-green-600 text-sm font-medium">{translations[currentLang].completedFilter}</p>
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
                <p className="text-orange-600 text-sm font-medium">{translations[currentLang].drafts}</p>
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
              placeholder={translations[currentLang].search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-400"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="hidden sm:inline-flex px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
          >
            {translations[currentLang].search.replace('...', '')}
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              {translations[currentLang].clear}
            </button>
          )}
        </form>
        <div className={`relative w-full sm:w-auto ${showCreateSpotlight ? 'z-[81]' : ''}`}>
          <button
            onClick={handleOpenGenerator}
            className={`w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-pointer ${
              showCreateSpotlight ? 'ring-4 ring-blue-400/50 shadow-lg' : ''
            }`}
          >
            <Plus size={16} className="mr-2" />
            {translations[currentLang].createNewEbook}
          </button>

          {showCreateSpotlight && !isGeneratorModalOpen && (
            <div className="absolute right-0 top-full mt-3 w-80 max-w-[90vw] bg-white rounded-xl shadow-2xl p-4 z-[81]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-md bg-indigo-100 flex items-center justify-center mt-0.5">
                  <Sparkles size={16} className="text-indigo-600" />
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-900">{translations[currentLang].startHere}</div>
                  <div className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">{translations[currentLang].startHereDesc}</div>
                </div>
              </div>
              <div className="border-t border-gray-200 mt-3 pt-2.5 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] text-gray-500 select-none">
                  <input
                    type="checkbox"
                    checked={createSpotlightHidden}
                    onChange={(e) => toggleCreateSpotlightHidden(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-blue-600"
                  />
                  {translations[currentLang].dontShowAgain}
                </label>
                <button
                  onClick={dismissCreateSpotlight}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <Check size={14} /> {translations[currentLang].gotIt}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-transparent sm:bg-white rounded-none sm:rounded-xl border-0 sm:border border-gray-200 overflow-hidden -mx-4 sm:mx-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">{translations[currentLang].yourEbooks}</h2>

            <div className="flex items-center gap-2">
              {pagination && pagination.total > 0 && (
                <p className="text-sm text-gray-600 hidden sm:block">
                    {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
              )}
            </div>
        </div>

        {loading ? (
            <div className="px-6 py-12 text-center"><RefreshCw size={48} className="mx-auto text-gray-300 mb-4 animate-spin" /><p className="text-gray-500">{translations[currentLang].loading}</p></div>
        ) : displayedEbooks.length === 0 && !showPostCloseSkeleton ? (
            <div className="px-6 py-12 text-center">
              <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{searchTerm || activeFilter !== 'all' ? translations[currentLang].noEbooksFound : translations[currentLang].noEbooksYet}</h3>
              <p className="text-gray-500 mb-6">{searchTerm ? translations[currentLang].tryChangingSearch : translations[currentLang].clickToCreateFirst}</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {showPostCloseSkeleton && (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col animate-pulse">
                  <div className="h-1.5 bg-gray-200"></div>
                  <div className="p-4 flex flex-col flex-grow">
                    <div className="flex gap-4">
                      <div className="w-1/3 flex-shrink-0">
                        <div className="w-full aspect-square bg-gray-100 rounded-md"></div>
                      </div>
                      <div className="w-2/3 flex flex-col gap-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                        <div className="h-5 bg-gray-100 rounded-full w-16 mt-1"></div>
                        <div className="border-t border-gray-100 my-2"></div>
                        <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 mt-auto flex justify-between">
                    <div className="h-7 bg-gray-100 rounded w-16"></div>
                    <div className="h-7 bg-gray-100 rounded w-16"></div>
                  </div>
                </div>
              )}
              {displayedEbooks.map((ebook) => {
                const isDeleting = deletingIds.has(ebook.id);
                const isDownloading = downloadingIds.has(ebook.id);
                const isDisabled = isDeleting || isDownloading || loadingPreviewId === ebook.id;

                return (
                  <div key={ebook.id} className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col ${isDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className={`h-1.5 ${getStatusColorForCardBorder(ebook.status)}`}></div>

                    <div className="p-4 flex flex-col flex-grow">
                      <div className="flex gap-4">
                          <div className="w-1/3 flex-shrink-0 flex flex-col justify-center">
                            {ebook.cover_image_webp_url ? (
                                <div className="relative">
                                  <img
                                    src={`/api/assets/${ebook.cover_image_webp_url}?t=${ebook.updated_at ? new Date(ebook.updated_at).getTime() : ''}`}
                                    alt={`Cover: ${ebook.title}`}
                                    className="w-full h-auto object-contain rounded-md bg-gray-200 cursor-pointer"
                                    loading="lazy"
                                    onClick={() => handlePreviewEbook(ebook)}
                                  />
                                  {loadingPreviewId === ebook.id && (
                                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-md">
                                      <RefreshCw size={20} className="animate-spin text-gray-600" />
                                    </div>
                                  )}
                                </div>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-md aspect-square"><ImageIcon className="w-8 h-8 text-gray-400" /></div>
                            )}
                            <p className="text-xs text-gray-500 text-center mt-1">
                              {ebook.cover_image_webp_url ? translations[currentLang].coverImage : translations[currentLang].noCoverImage}
                            </p>
                          </div>
                          <div className="w-2/3 flex flex-col">
                            <h3 className="font-semibold text-gray-900 text-base leading-tight line-clamp-3">{ebook.title}</h3>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ebook.subtitle}</p>
                            <div className="mt-2 flex items-center flex-wrap gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${getStatusColor(ebook.status)}`}>{getStatusLabel(ebook.status)}</span>
                                {ebook.hasLandingPage && (
                                    <span className="text-xs flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">
                                        <FileText size={12} /> Page Ready
                                    </span>
                                )}
                            </div>

                            <div className="border-t border-gray-200 my-3"></div>

                            <div className="text-xs">
                                <div className="flex"><dt className="w-1/3 text-gray-500">{translations[currentLang].created}</dt><dd className="w-2/3 font-medium text-gray-800 truncate">{formatDate(ebook.created_at)}</dd></div>
                                {ebook.authorDisplayName && (
                                  <>
                                    <div className="border-t border-gray-200 my-2"></div>
                                    <div className="flex"><dt className="w-1/3 text-gray-500">Author:</dt><dd className="w-2/3 font-medium text-gray-800 truncate">{ebook.authorDisplayName}</dd></div>
                                  </>
                                )}
                                {typeof ebook.chapterCount === 'number' && ebook.chapterCount > 0 && (
                                  <>
                                    <div className="border-t border-gray-200 my-2"></div>
                                    <div className="flex"><dt className="w-1/3 text-gray-500">{translations[currentLang].chaptersLabel}</dt><dd className="w-2/3 font-medium text-gray-800 truncate">{ebook.chapterCount}</dd></div>
                                  </>
                                )}
                                {typeof ebook.total_pages === 'number' && ebook.total_pages > 0 && (
                                  <>
                                    <div className="border-t border-gray-200 my-2"></div>
                                    <div className="flex"><dt className="w-1/3 text-gray-500">{translations[currentLang].pagesLabel}</dt><dd className="w-2/3 font-medium text-gray-800 truncate">{ebook.total_pages}</dd></div>
                                  </>
                                )}
                            </div>
                          </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 mt-auto space-y-3 sm:space-y-0 sm:flex sm:justify-between sm:items-center">
                        {/* Przycisk "Create LP" LUB "Go to Page" (mobilny) */}
                        {ebook.status !== 'draft' && (
                            <button
                                onClick={() => ebook.hasLandingPage ? handleGoToLandings() : handleCreatePage(ebook.id)}
                                className={`w-full flex sm:hidden items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                                    creatingPageId === ebook.id
                                        ? 'bg-gray-100 text-gray-700 cursor-not-allowed'
                                        : ebook.hasLandingPage
                                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer'
                                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 cursor-pointer'
                                }`}
                                disabled={isDisabled || creatingPageId === ebook.id}
                            >
                                {creatingPageId === ebook.id ? (
                                    <><RefreshCw size={14} className="animate-spin" /> {translations[currentLang].creatingLandingPage}</>
                                ) : ebook.hasLandingPage ? (
                                    <><FileText size={14} /> {translations[currentLang].goToPage}</>
                                ) : (
                                    <><Plus size={14} /> {translations[currentLang].createLandingPage}</>
                                )}
                            </button>
                        )}

                        {/* Kontener na pozostałe przyciski */}
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleEditEbook(ebook.id)} className="text-sm text-sky-600 hover:text-sky-700 font-medium bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center cursor-pointer disabled:cursor-not-allowed" disabled={isDisabled}>
                                    <Edit size={14} className="inline mr-1.5" />
                                    {translations[currentLang].edit}
                                </button>
                                {isEbookCompleted(ebook) && (
                                    <button onClick={() => downloadPDF(ebook.id, ebook.title)} className="text-sm text-green-600 hover:text-green-700 font-medium bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center cursor-pointer disabled:cursor-not-allowed" disabled={isDisabled}>
                                        {isDownloading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} className="inline mr-1.5" />}
                                        {isDownloading ? '' : translations[currentLang].download}
                                    </button>
                                )}
                                {/* Przycisk "Create LP" LUB "Go to Page" (desktop) */}
                                {ebook.status !== 'draft' && (
                                    <button
                                        onClick={() => ebook.hasLandingPage ? handleGoToLandings() : handleCreatePage(ebook.id)}
                                        className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors hidden sm:inline-flex items-center ${
                                            creatingPageId === ebook.id
                                                ? 'text-gray-700 bg-gray-100 cursor-not-allowed'
                                                : ebook.hasLandingPage
                                                    ? 'text-blue-700 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 cursor-pointer'
                                                    : 'text-yellow-700 hover:text-yellow-800 bg-yellow-100 hover:bg-yellow-200 cursor-pointer'
                                        }`}
                                        disabled={isDisabled || creatingPageId === ebook.id}
                                    >
                                        {creatingPageId === ebook.id ? (
                                            <><RefreshCw size={14} className="inline mr-1.5 animate-spin" /> {translations[currentLang].creating}</>
                                        ) : ebook.hasLandingPage ? (
                                            <><FileText size={14} className="inline mr-1.5" /> {translations[currentLang].goToPageShort}</>
                                        ) : (
                                            <><Plus size={14} className="inline mr-1.5" /> {translations[currentLang].createLP}</>
                                        )}
                                    </button>
                                )}
                            </div>
                            <button onClick={() => handleDeleteEbook(ebook)} className="text-sm text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center cursor-pointer disabled:cursor-not-allowed" disabled={isDisabled}>
                                {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} className="inline mr-1.5" />}
                                 {isDeleting ? '' : translations[currentLang].delete}
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
              <button onClick={() => handlePaginationClick(currentPage - 1)} disabled={!pagination.hasPrev || loading} className={`w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 ${!pagination.hasPrev || loading ? 'cursor-not-allowed' : 'cursor-pointer'}`}>← {translations[currentLang].previous}</button>
              <span className="text-sm text-gray-600">{translations[currentLang].pageOf} {pagination.page} {translations[currentLang].of} {pagination.totalPages}</span>
              <button onClick={() => handlePaginationClick(currentPage + 1)} disabled={!pagination.hasNext || loading} className={`w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 ${!pagination.hasNext || loading ? 'cursor-not-allowed' : 'cursor-pointer'}`}>{translations[currentLang].next} →</button>
            </div>
          </div>
        )}
      </div>

      {showCreateSpotlight && !isGeneratorModalOpen && (
        <div className="fixed inset-0 z-[80] bg-[#0a0f1e]/72 backdrop-blur-sm" onClick={dismissCreateSpotlight} />
      )}

      <EbookGeneratorModal isOpen={isGeneratorModalOpen} onClose={handleCloseGenerator} onEbookCreated={handleEbookCreated} ebookId={editingEbookId} lang={currentLang}/>

      {showDeleteConfirm && ebookToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{translations[currentLang].deleteEbook}</h3>
              <p className="text-gray-600">
                {translations[currentLang].deleteConfirmation} "{ebookToDelete.title}"? {translations[currentLang].deleteWarning}
              </p>
            </div>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={cancelDelete} className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer">{translations[currentLang].cancel}</button>
              <button onClick={confirmDelete} className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all duration-200 cursor-pointer">{translations[currentLang].yesDelete}</button>
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
              <button onClick={handleClosePreview} className="text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-4 cursor-pointer">
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
                    e.currentTarget.src = `/api/assets/${previewEbook.cover_image_webp_url}?t=${previewEbook.updated_at ? new Date(previewEbook.updated_at).getTime() : ''}`;
                  }}
                />
              </div>

              {/* Right Side: Table of Contents (Desktop Only) */}
              <div className="hidden md:flex w-full mt-4 md:mt-0 md:w-1/3 bg-black/20 rounded-lg flex-col overflow-hidden border border-white/10 max-h-[40vh] md:max-h-full">
                <div className="p-3 flex-shrink-0 bg-black/20">
                  <h4 className="font-semibold text-white flex items-center">
                    <FileText size={18} className="mr-2 text-gray-300"/>
                    {translations[currentLang].tableOfContents}
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
                        <p>{translations[currentLang].noTableOfContents}</p>
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
                    : "bg-green-600 text-white hover:bg-green-700 cursor-pointer"
                }`}
                title="Download as PNG"
              >
                {isConverting ? (
                  <><RefreshCw size={16} className="animate-spin" /><span>{translations[currentLang].converting}</span></>
                ) : (
                  <><Download size={16} /><span>{translations[currentLang].downloadPng}</span></>
                )}
              </button>
              <button
                onClick={() => {
                  if (previewEbook) {
                    handleClosePreview();
                    handleEditEbook(previewEbook.id);
                  }
                }}
                className="w-full md:w-auto flex items-center justify-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                <Edit size={16} />
                <span>{translations[currentLang].editEbook}</span>
              </button>
              <button onClick={handleClosePreview} className="w-full md:w-auto px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium md:mr-auto cursor-pointer">
                {translations[currentLang].close}
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