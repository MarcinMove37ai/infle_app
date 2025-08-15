// src/app/(dashboard)/ebooki/page.tsx

"use client"
import React, { useState, useRef, useEffect } from 'react';
import SourcePreviewModal from '@/components/ebooks/SourcePreviewModal';
import {
  BookOpen, Edit, Search, Plus, ArrowUp, ArrowDown,
  X, Check, AlertCircle, Loader, ChevronLeft, Save,
  FileText, BookMarked, Sparkles, MoreVertical, Download,
  ChevronRight, Upload, Image, Palette, Eye
} from 'lucide-react';

// Interfejs dla pozycji w spisie treści, rozszerzony o treść i obraz
interface TocItem {
  id: string;
  title: string;
  content?: string;
  position?: number;
  image_url?: string;
}

// Interfejs dla pobranych treści z URL-ów
interface ScrapedContent {
  url: string;
  title: string;
  content: string;
}

// Interfejs dla statusu okładki
interface CoverStatus {
  prompt_ready: boolean;
  image_ready: boolean;
  complete: boolean;
}

// Interfejs dla danych okładki
interface EbookCoverData {
  ebook_id: number;
  title: string;
  subtitle?: string;
  has_cover_prompt: boolean;
  has_cover_image: boolean;
  cover_url?: string;
  cover_prompt?: string;
  cover_prompt_length: number;
  last_updated: string;
  cover_status: CoverStatus;
}

// Główny komponent generatora ebooków
const EbookGenerator = () => {
  const [sourcePreviewModal, setSourcePreviewModal] = useState({
      isVisible: false,
      sourceType: null as 'web' | 'pdf' | null,
      content: null as ScrapedContent | null,
      status: null as 'success' | 'error' | 'empty' | null,
      errorDetails: ''
  });
  // NOWE STANY dla PDF upload
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    // NOWE STANY dla single URL scraping
  const [pendingUrl, setPendingUrl] = useState('');
  const [isScrapingSingleUrl, setIsScrapingSingleUrl] = useState(false);
  // Istniejące stany aplikacji
  const [isGeneratingAllImages, setIsGeneratingAllImages] = useState(false);
  const [generatedImagesCount, setGeneratedImagesCount] = useState(0);
  const [totalImagesToGenerate, setTotalImagesToGenerate] = useState(0);
  const [generatingChapterIds, setGeneratingChapterIds] = useState<string[]>([]);
  const [completedChapterIds, setCompletedChapterIds] = useState<string[]>([]);
  const [currentGeneratingIndex, setCurrentGeneratingIndex] = useState<number>(-1);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [isGeneratingToc, setIsGeneratingToc] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState('');

  // NOWE STANY dla dodatkowych funkcjonalności
  const [description, setDescription] = useState('');
  const [urlInputs, setUrlInputs] = useState<string[]>(['']);
  const [isScrapingUrls, setIsScrapingUrls] = useState(false);
  const [scrapedContent, setScrapedContent] = useState<ScrapedContent[]>([]);

  // Pozostałe istniejące stany
  const [ebookId, setEbookId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState(false);
  const [editingChapterContent, setEditingChapterContent] = useState('');
  const [chapterPrompts, setChapterPrompts] = useState<Record<string, string>>({});
  const [showPromptPreview, setShowPromptPreview] = useState<string | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState<string | null>(null);
  const [tocGenerated, setTocGenerated] = useState(false);
  const [contentGenerated, setContentGenerated] = useState(false);
  const [graphicsAdded, setGraphicsAdded] = useState(false);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalSubtitle, setOriginalSubtitle] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const [originalUrlInputs, setOriginalUrlInputs] = useState<string[]>(['']);
  const [showRegeneratePopup, setShowRegeneratePopup] = useState(false);
  const [showChapterRegeneratePopup, setShowChapterRegeneratePopup] = useState(false);
  const [chapterToRegenerate, setChapterToRegenerate] = useState<string | null>(null);
  const [originalChapterTitle, setOriginalChapterTitle] = useState('');
  const [isGeneratingSingleChapter, setIsGeneratingSingleChapter] = useState(false);
  const [chaptersWithoutContent, setChaptersWithoutContent] = useState<string[]>([]);
  const [isGeneratingMissingContent, setIsGeneratingMissingContent] = useState(false);
  const [uploadingImageForChapter, setUploadingImageForChapter] = useState<string | null>(null);
  const [generatingAIImageForChapter, setGeneratingAIImageForChapter] = useState<string | null>(null);
  const [aiImageGenerationProgress, setAiImageGenerationProgress] = useState<number>(0);
  const [aiImageGenerationError, setAiImageGenerationError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);

  // STANY dla okładki (przeniesione z kroku 5)
  const [coverData, setCoverData] = useState<EbookCoverData | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [showCoverPrompt, setShowCoverPrompt] = useState(false);
  const [coverGenerated, setCoverGenerated] = useState(false);

  // ✅ NOWY STATE dla cache-busting
  const [imageRefreshTimestamp, setImageRefreshTimestamp] = useState(0);

  // Referencje do elementów
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const editItemInputRef = useRef<HTMLInputElement>(null);
  const contentEditRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // Istniejące useEffects
  useEffect(() => {
    if (editingItemId && editItemInputRef.current) {
      editItemInputRef.current.focus();
    }
  }, [editingItemId]);

  useEffect(() => {
    if (editingContent && contentEditRef.current) {
      contentEditRef.current.focus();
    }
  }, [editingContent]);

  useEffect(() => {
    if (step === 1 && tocGenerated && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [step, tocGenerated]);

  useEffect(() => {
    if (step === 3) {
      syncChapterStatus();
    }
  }, [step]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.context-menu-button') && !target.closest('.context-menu')) {
        setContextMenuVisible(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // useEffect dla pobierania danych okładki w kroku 4
  useEffect(() => {
    if (ebookId && step === 4) {
      // ✅ DEFENSYWNE pobieranie statusu okładki
      const loadCoverStatus = async () => {
        try {
          await fetchCoverStatus();
        } catch (error) {
          console.warn('⚠️ Nie udało się pobrać statusu okładki przy wejściu do kroku 4:', error);
          // Nie pokazuj błędu użytkownikowi - to normalne przy pierwszym wejściu
        }
      };

      loadCoverStatus();

      // Odśwież co 5 sekund jeśli okładka jest w trakcie generowania
      const interval = setInterval(() => {
        if (isGeneratingCover) {
          loadCoverStatus();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [ebookId, step, isGeneratingCover]);

  // ✅ NAPRAWIONA FUNKCJA fetchCoverStatus
  const fetchCoverStatus = async () => {
    if (!ebookId) return;

    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/ebooks/${ebookId}/generate-cover-complete?_t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      // ✅ OBSŁUGA PRZYPADKU GDY OKŁADKA JESZCZE NIE ISTNIEJE
      if (response.status === 404) {
        console.log('📋 Okładka jeszcze nie została wygenerowana');
        // Ustaw pusty stan okładki
        setCoverData({
          ebook_id: ebookId,
          title: title,
          subtitle: subtitle,
          has_cover_prompt: false,
          has_cover_image: false,
          cover_url: undefined,
          cover_prompt: undefined,
          cover_prompt_length: 0,
          last_updated: new Date().toISOString(),
          cover_status: {
            prompt_ready: false,
            image_ready: false,
            complete: false
          }
        });
        setCoverGenerated(false);
        return;
      }

      if (!response.ok) {
        // Jeśli to nie 404, ale inny błąd, sprawdź czy to HTML
        const errorText = await response.text();
        if (errorText.trim().startsWith('<')) {
          console.warn('⚠️ Otrzymano stronę HTML zamiast JSON - prawdopodobnie błąd serwera');
          return; // Nie pokazuj błędu użytkownikowi
        }
        throw new Error(`Błąd serwera (${response.status})`);
      }

      const data = await response.json();
      console.log('📥 Pobrano dane okładki z API:', data);

      // Mapowanie danych z API
      const mappedData = {
        ebook_id: data.ebook_id,
        title: data.title,
        subtitle: data.subtitle,
        has_cover_prompt: data.cover_status?.prompt_ready || false,
        has_cover_image: data.cover_status?.image_ready || false,
        cover_url: data.cover_details?.url || undefined,
        cover_prompt: data.cover_details?.prompt || undefined,
        cover_prompt_length: data.cover_details?.prompt_length || 0,
        last_updated: data.timestamps?.last_updated || data.cover_details?.last_updated,
        cover_status: {
          prompt_ready: data.cover_status?.prompt_ready || false,
          image_ready: data.cover_status?.image_ready || false,
          complete: data.cover_status?.complete || false
        }
      };

      // ✅ UPROSZCZONA logika URL - zawsze dodaj timestamp jeśli istnieje URL
      if (mappedData.cover_url) {
        const baseUrl = mappedData.cover_url.split('?')[0]; // Usuń istniejące parametry
        mappedData.cover_url = `${baseUrl}?t=${timestamp}`;
        console.log('🔄 URL okładki z cache-bust:', mappedData.cover_url);
      }

      setCoverData(mappedData);

      if (mappedData.cover_status.complete && mappedData.cover_url) {
        setCoverGenerated(true);
        console.log('✅ Okładka oznaczona jako gotowa');
      }

    } catch (err: any) {
      console.warn('⚠️ Problem z pobieraniem statusu okładki:', err.message);
      // Nie ustawiaj error dla użytkownika - okładka po prostu jeszcze nie istnieje

      // Ustaw domyślny stan okładki
      if (!coverData) {
        setCoverData({
          ebook_id: ebookId,
          title: title,
          subtitle: subtitle,
          has_cover_prompt: false,
          has_cover_image: false,
          cover_url: undefined,
          cover_prompt: undefined,
          cover_prompt_length: 0,
          last_updated: new Date().toISOString(),
          cover_status: {
            prompt_ready: false,
            image_ready: false,
            complete: false
          }
        });
      }
    }
  };

  // ✅ NAPRAWIONA FUNKCJA generateCover
  const generateCover = async (forceRegenerate = false, generatePdf = false) => {
    if (!ebookId) {
      setError('Brak identyfikatora ebooka');
      return false;
    }

    setIsGeneratingCover(true);
    setError(null);
    console.log('🎨 Rozpoczynam generowanie okładki...', { forceRegenerate, generatePdf });

    try {
      const response = await fetch(`/api/ebooks/${ebookId}/generate-cover-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceRegenerate,
          generatePdf
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Błąd odpowiedzi API:', response.status, errorText);

        // Sprawdź czy to HTML (błąd serwera)
        if (errorText.trim().startsWith('<')) {
          throw new Error('Błąd serwera - otrzymano stronę HTML zamiast JSON');
        }

        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || errorData.message || 'Błąd generowania okładki');
        } catch (parseError) {
          throw new Error(`Błąd serwera (${response.status}): ${errorText.substring(0, 100)}...`);
        }
      }

      const data = await response.json();
      console.log('📥 Odpowiedź z API generowania okładki:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Błąd generowania okładki');
      }

      console.log('✅ Okładka wygenerowana pomyślnie');

      // ✅ KRÓTSZE opóźnienie i jednorazowe odświeżenie
      await new Promise(resolve => setTimeout(resolve, 500));

      // Wymyśl nowy timestamp dla cache-bust
      setImageRefreshTimestamp(Date.now());

      // Odśwież status okładki
      await fetchCoverStatus();

      setCoverGenerated(true);
      console.log('🔄 Status okładki odświeżony');

      return true;

    } catch (err: any) {
      console.error('❌ Błąd generowania okładki:', err);
      setError(err.message);
      return false;
    } finally {
      setIsGeneratingCover(false);
    }
  };
    // NOWA FUNKCJA pobierania treści z pojedynczego URL
    const scrapeSingleUrl = async (url: string) => {
      if (!url.trim()) return;

      try {
        new URL(url); // Walidacja URL
      } catch {
        setError('Nieprawidłowy format URL');
        return;
      }

      setIsScrapingSingleUrl(true);
      setError(null);

      try {
        const response = await fetch('/api/scrape-urls', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ urls: [url] }),
        });

        if (!response.ok) {
          throw new Error('Błąd podczas pobierania treści z linku');
        }

        const data = await response.json();

       // ZAWSZE pokazuj modal - niezależnie od wyniku
        if (data.scrapedContent && data.scrapedContent.length > 0) {
          // Sukces z treścią
          showSourcePreview('web', data.scrapedContent[0], 'success');
        } else if (data.errors && data.errors.length > 0) {
          // Błąd scrapingu
          const errorContent = {
            url: url,
            title: 'Błąd scrapingu',
            content: ''
          };
          showSourcePreview('web', errorContent, 'error', data.errors[0].error || 'Nieznany błąd');
        } else {
          // Pusta treść
          const emptyContent = {
            url: url,
            title: 'Brak treści',
            content: ''
          };
          showSourcePreview('web', emptyContent, 'empty', 'Nie znaleziono treści na tej stronie lub treść jest za krótka');
        }

      } catch (err) {
          console.error('Błąd scraping single URL:', err);

          // Pokaż modal z błędem
          const errorContent = {
            url: url,
            title: 'Błąd połączenia',
            content: ''
          };
          showSourcePreview('web', errorContent, 'error', err instanceof Error ? err.message : 'Nie udało się połączyć z serwerem');
        } finally {
        setIsScrapingSingleUrl(false);
      }
    };

    // FUNKCJA do usuwania źródła z listy
    const handleRemoveScrapedContent = (urlToRemove: string) => {
      setScrapedContent(prev => prev.filter(item => item.url !== urlToRemove));
      console.log('🗑️ Usunięto źródło:', urlToRemove);
    };


  // NOWE FUNKCJE dla PDF upload
    const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Walidacja pliku
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('Wybrany plik nie jest plikiem PDF');
        return;
      }

      // Sprawdź rozmiar (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Plik PDF jest za duży. Maksymalny rozmiar to 10MB');
        return;
      }

      setIsUploadingPdf(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('pdf', file);

        const response = await fetch('/api/extract-pdf-text', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Sukces - pokaż preview
          if (data.scrapedContent && data.scrapedContent.length > 0) {
            showSourcePreview('pdf', data.scrapedContent[0], 'success');
          } else {
            const errorContent = {
              url: file.name,
              title: 'Błąd wyodrębniania',
              content: ''
            };
            showSourcePreview('pdf', errorContent, 'error', 'Nie udało się wyodrębnić tekstu z PDF');
          }
        } else {
          // Błąd
          const errorContent = {
            url: file.name,
            title: 'Błąd przetwarzania',
            content: ''
          };
          showSourcePreview('pdf', errorContent, 'error', data.error || 'Nieznany błąd podczas przetwarzania PDF');
        }

      } catch (err) {
          console.error('Błąd upload PDF:', err);

          const errorContent = {
            url: file.name,
            title: 'Błąd połączenia',
            content: ''
          };
          showSourcePreview('pdf', errorContent, 'error', 'Błąd połączenia z serwerem');
      } finally {
        setIsUploadingPdf(false);
        // Wyczyść input
        if (event.target) {
          event.target.value = '';
        }
      }
    };

    const showSourcePreview = (
      sourceType: 'web' | 'pdf',
      content: ScrapedContent,
      status: 'success' | 'error' | 'empty',
      errorDetails?: string
    ) => {
      setSourcePreviewModal({
        isVisible: true,
        sourceType,
        content,
        status,
        errorDetails: errorDetails || ''
      });
    };

    const handleSourceAccept = (content: ScrapedContent) => {
      setScrapedContent(prev => [...prev, content]);

      // Wyczyść input URL jeśli to był web scraping
      if (sourcePreviewModal.sourceType === 'web') {
        const urlIndex = urlInputs.findIndex(url => url === content.url);
        if (urlIndex !== -1) {
          const newUrls = [...urlInputs];
          newUrls[urlIndex] = '';
          setUrlInputs(newUrls);
        }
      }

      // Zamknij modal
      setSourcePreviewModal({
        isVisible: false,
        sourceType: null,
        content: null,
        status: null,
        errorDetails: ''
      });
    };

    const handleSourceReject = () => {
      // Wyczyść input URL jeśli to był web scraping
      if (sourcePreviewModal.sourceType === 'web' && sourcePreviewModal.content) {
        const urlIndex = urlInputs.findIndex(url => url === sourcePreviewModal.content!.url);
        if (urlIndex !== -1) {
          const newUrls = [...urlInputs];
          newUrls[urlIndex] = '';
          setUrlInputs(newUrls);
        }
      }

      // Zamknij modal
      setSourcePreviewModal({
        isVisible: false,
        sourceType: null,
        content: null,
        status: null,
        errorDetails: ''
      });
    };

    const handleOpenPdfDialog = () => {
      if (pdfInputRef.current) {
        pdfInputRef.current.click();
      }
    };

  // NOWE FUNKCJE obsługi URL-ów
  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urlInputs];
    newUrls[index] = value;
    setUrlInputs(newUrls);
  };

  const addUrlInput = () => {
    if (urlInputs.length < 5) {
      setUrlInputs([...urlInputs, '']);
    }
  };

  const removeUrlInput = (index: number) => {
    const newUrls = urlInputs.filter((_, i) => i !== index);
    setUrlInputs(newUrls.length === 0 ? [''] : newUrls);

    // Usuń odpowiadającą treść ze scrapedContent jeśli istnieje
    const urlToRemove = urlInputs[index];
    if (urlToRemove) {
      setScrapedContent(prev => prev.filter(item => item.url !== urlToRemove));
    }
  };

  // NOWA FUNKCJA pobierania treści z URL-ów
  const scrapeUrls = async () => {
    const validUrls = urlInputs.filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) {
      return [];
    }

    setIsScrapingUrls(true);
    setError(null);

    try {
      const response = await fetch('/api/scrape-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls: validUrls }),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas pobierania treści z linków');
      }

      const data = await response.json();
      setScrapedContent(prev => [...prev, ...(data.scrapedContent || [])]);
      return data.scrapedContent || [];
    } catch (err) {
      console.error('Błąd scraping URLs:', err);
      setError('Nie udało się pobrać treści z niektórych linków. Kontynuujemy bez nich.');
      return [];
    } finally {
      setIsScrapingUrls(false);
    }
  };

  // ✅ NAPRAWIONA FUNKCJA refreshImagesStatus
  const refreshImagesStatus = async () => {
    if (!ebookId) return;

    console.log('🔄 Odświeżanie statusu grafik...');

    try {
      const timestamp = Date.now();
      const response = await fetch(`/api/ebooks/${ebookId}/chapters?_t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...getUserHeaders()
        }
      });

      if (!response.ok) {
        throw new Error('Błąd pobierania rozdziałów');
      }

      const data = await response.json();
      if (!data.chapters || !Array.isArray(data.chapters)) {
        console.warn('Nieprawidłowe dane rozdziałów:', data);
        return;
      }

      console.log(`📊 Pobrano ${data.chapters.length} rozdziałów z serwera`);

      // ✅ POPRAWIONA aktualizacja stanu
      setTocItems(currentTocItems => {
        const updatedItems = currentTocItems.map(item => {
          const serverChapter = data.chapters.find((ch: any) => ch.id.toString() === item.id);

          if (serverChapter && serverChapter.image_url) {
            const baseUrl = serverChapter.image_url.split('?')[0];
            const newImageUrl = `${baseUrl}?t=${timestamp}`;

            if (item.image_url !== newImageUrl) {
              console.log(`🔄 Odświeżono grafikę dla "${item.title}": ${newImageUrl}`);
              return { ...item, image_url: newImageUrl };
            }
          }

          return item;
        });

        return updatedItems;
      });

      // Wymyśl nowy timestamp dla wymuszenia re-render
      setImageRefreshTimestamp(timestamp);
      console.log('✅ Status grafik odświeżony');

    } catch (error) {
      console.error('❌ Błąd podczas odświeżania statusu grafik:', error);
    }
  };

  // Istniejące funkcje pomocnicze
  const handleApiError = (err: any, defaultMessage: string) => {
    console.error(defaultMessage, err);
    let errorMessage = defaultMessage;
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === 'object' && err.error) {
      errorMessage = err.error;
    }
    setError(errorMessage);
  };

  const syncChapterStatus = () => {
    const chaptersWithContent = tocItems
      .filter(item => item.content && item.content.trim().length > 0)
      .map(item => item.id);

    const chaptersWithoutContentList = tocItems
      .filter(item => !item.content || item.content.trim() === '')
      .map(item => item.id);

    console.log('🔄 Synchronizacja statusu rozdziałów:');
    console.log(`- Rozdziały z treścią (${chaptersWithContent.length}):`, chaptersWithContent);
    console.log(`- Rozdziały bez treści (${chaptersWithoutContentList.length}):`, chaptersWithoutContentList);

    setCompletedChapterIds(chaptersWithContent);
    setChaptersWithoutContent(chaptersWithoutContentList);

    const hasAnyContent = chaptersWithContent.length > 0;
    setContentGenerated(hasAnyContent);

    console.log(`✅ Status zsynchronizowany: contentGenerated=${hasAnyContent}`);
  };

  const changeStep = (newStep: number) => {
      const hasDescriptionChanged = description !== originalDescription;
      const hasUrlsChanged = JSON.stringify(urlInputs) !== JSON.stringify(originalUrlInputs);
      const hasSourcesChanged = scrapedContent.length > 0; // NOWA LINIA

      if (newStep === 2 && step === 1 && tocGenerated &&
         (title !== originalTitle ||
          subtitle !== originalSubtitle ||
          hasDescriptionChanged ||
          hasUrlsChanged ||
          hasSourcesChanged)) { // DODANA ZMIANA
        setShowRegeneratePopup(true);
      }
    else if (newStep === 3 && step === 2) {
      console.log('🔄 Przechodzenie do kroku 3 - synchronizacja statusu rozdziałów...');

      syncChapterStatus();

      const chaptersWithNoContent = tocItems
        .filter(item => !item.content || item.content.trim() === '')
        .map(item => item.id);

      console.log(`📊 Znaleziono ${chaptersWithNoContent.length} rozdziałów bez treści:`, chaptersWithNoContent);

      if (chaptersWithNoContent.length > 0) {
        if (!activeChapterId || !tocItems.find(item => item.id === activeChapterId)) {
          setActiveChapterId(chaptersWithNoContent[0]);
          console.log(`🎯 Ustawiono aktywny rozdział: ${chaptersWithNoContent[0]}`);
        }
      } else {
        if (!activeChapterId || !tocItems.find(item => item.id === activeChapterId)) {
          const firstChapterId = tocItems.length > 0 ? tocItems[0].id : null;
          setActiveChapterId(firstChapterId);
          console.log(`🎯 Ustawiono aktywny rozdział (pierwszy): ${firstChapterId}`);
        }
      }

      setStep(newStep);
      console.log('✅ Przejście do kroku 3 zakończone');
    }
    else if (newStep === 4 && step === 3) {
      console.log('🔄 Przechodzenie do kroku 4 - grafiki i okładka...');
      syncChapterStatus();
      setStep(newStep);

      // ✅ DEFENSYWNA inicjalizacja okładki przy wejściu do kroku 4
      if (ebookId && !coverData) {
        console.log('📋 Inicjalizacja domyślnego stanu okładki (jeszcze nie wygenerowana)');
        // Ustaw domyślny stan okładki, zanim jeszcze zostanie pobrana z API
        setCoverData({
          ebook_id: ebookId,
          title: title,
          subtitle: subtitle,
          has_cover_prompt: false,
          has_cover_image: false,
          cover_url: undefined,
          cover_prompt: undefined,
          cover_prompt_length: 0,
          last_updated: new Date().toISOString(),
          cover_status: {
            prompt_ready: false,
            image_ready: false,
            complete: false
          }
        });
      }
      console.log('✅ Przejście do kroku 4 zakończone');
    }
    else {
      setStep(newStep);
    }
  };

  const getUserHeaders = () => {
    let userData = null;
    try {
      const userDataString = sessionStorage.getItem('userData');
      if (userDataString) {
        userData = JSON.parse(userDataString);
      }
    } catch (error) {
      console.error('Error getting user data from session storage:', error);
    }

    return {
      'Content-Type': 'application/json',
      'X-User-Id': userData?.id?.toString() || '1',
      'X-User-Cognito-Sub': userData?.cognito_sub || '',
      'X-User-First-Name': userData?.first_name || '',
      'X-User-Last-Name': userData?.last_name || '',
      'X-User-Email': userData?.email || '',
      'X-User-Role': userData?.role || '',
      'X-User-Status': userData?.status || '',
      'X-User-Supervisor-Code': userData?.supervisor_code || '',
      'X-User-Created-At': userData?.created_at || '',
      'X-User-Updated-At': userData?.updated_at || '',
    };
  };

  const generateTableOfContents = async () => {
    if (!title.trim()) {
      setError('Proszę wprowadzić tytuł e-booka');
      return;
    }

    setError(null);
    setIsGeneratingToc(true);

    try {

      let currentEbookId = ebookId;

      // 2. Utwórz lub zaktualizuj ebook
      if (!currentEbookId) {
        // Tworzenie nowego ebooka...
        const createEbookResponse = await fetch('/api/ebooks', {
          method: 'POST',
          headers: getUserHeaders(),
          body: JSON.stringify({
            title,
            subtitle: subtitle.trim() || undefined,
            description: description.trim() || undefined
          }),
        });

        if (!createEbookResponse.ok) {
          throw new Error('Błąd podczas tworzenia ebooka w bazie danych');
        }

        const ebookData = await createEbookResponse.json();
        if (!ebookData.success || !ebookData.ebookId) {
          throw new Error('Nieprawidłowa odpowiedź z API tworzenia ebooka');
        }

        currentEbookId = ebookData.ebookId;
        setEbookId(currentEbookId);
        console.log(`Utworzono ebook w bazie danych z ID: ${currentEbookId}`);

      } else {
        // Reset stanów przed regeneracją
        console.log('🔄 Resetowanie stanów rozdziałów przed regeneracją...');

        setCompletedChapterIds([]);
        setGeneratingChapterIds([]);
        setChaptersWithoutContent([]);
        setContentGenerated(false);
        setGraphicsAdded(false);
        setActiveChapterId(null);
        setEditingContent(false);
        setEditingChapterContent('');
        setEditingItemId(null);
        setEditingItemTitle('');
        setIsGeneratingContent(false);
        setIsGeneratingSingleChapter(false);
        setIsGeneratingMissingContent(false);
        setCurrentGeneratingIndex(-1);
        setGeneratingAIImageForChapter(null);
        setUploadingImageForChapter(null);
        setIsGeneratingAllImages(false);
        setGeneratedImagesCount(0);
        setTotalImagesToGenerate(0);

        console.log('✅ Stany rozdziałów zostały zresetowane');

        // Aktualizuj dane ebooka
        const updateEbookResponse = await fetch(`/api/ebooks/${currentEbookId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            subtitle: subtitle.trim() || null,
            description: description.trim() || null
          }),
        });

        if (!updateEbookResponse.ok) {
          throw new Error('Błąd podczas aktualizacji tytułu ebooka');
        }

        // Usuń stare rozdziały
        try {
          console.log(`🗑️ Usuwanie wszystkich rozdziałów dla ebooka o ID: ${currentEbookId}`);
          const deleteChaptersResponse = await fetch(`/api/ebooks/${currentEbookId}/chapters`, {
            method: 'DELETE',
          });

          if (deleteChaptersResponse.ok) {
            const deleteData = await deleteChaptersResponse.json();
            console.log(`✅ Usunięto ${deleteData.deletedCount} rozdziałów`);
          }

          setTocItems([]);
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (error) {
          console.warn('Błąd podczas usuwania rozdziałów:', error);
        }
      }

      // 3. Wygeneruj nowy spis treści
      const response = await fetch('/api/anthropic/generate-toc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          subtitle: subtitle.trim() || undefined,
          description: description.trim() || undefined,
          scrapedContent: scrapedContent
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Błąd podczas generowania spisu treści';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Błąd serwera (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.tocItems && Array.isArray(data.tocItems)) {
        setTocItems(data.tocItems);
        setTocGenerated(true);
        setOriginalTitle(title);
        setOriginalSubtitle(subtitle);
        setOriginalDescription(description);
        setOriginalUrlInputs([...urlInputs]);

        // 4. Zapisz nowe rozdziały w bazie danych
        try {
          const chaptersResponse = await fetch(`/api/ebooks/${currentEbookId}/chapters`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chapters: data.tocItems }),
          });

          if (!chaptersResponse.ok) {
            console.warn('Nie udało się zapisać rozdziałów w bazie, ale kontynuujemy proces');
          } else {
            const chaptersData = await chaptersResponse.json();
            console.log(`💾 Zapisano ${chaptersData.chapters.length} rozdziałów w bazie danych`);

            if (chaptersData.chapters && Array.isArray(chaptersData.chapters)) {
              const updatedTocItems = data.tocItems.map((item: TocItem, index: number) => {
                return {
                  ...item,
                  id: chaptersData.chapters[index].id.toString(),
                  position: chaptersData.chapters[index].position
                };
              });
              setTocItems(updatedTocItems);

              // Ustaw nowe ID jako wymagające treści
              const newChapterIds = updatedTocItems.map((item: TocItem) => item.id);
              setChaptersWithoutContent(newChapterIds);
              console.log(`📝 Ustawiono ${newChapterIds.length} rozdziałów jako wymagające treści`);
            }
          }
        } catch (chaptersError) {
          console.warn('Błąd podczas zapisywania rozdziałów:', chaptersError);
        }

        setStep(2);
        setShowRegeneratePopup(false);
      } else {
        throw new Error('Otrzymano nieprawidłowy format danych');
      }
    } catch (err: any) {
      handleApiError(err, 'Wystąpił błąd podczas generowania spisu treści. Spróbuj ponownie.');
    } finally {
      setIsGeneratingToc(false);
    }
  };

  const generateSingleChapterContent = async (chapterId: string) => {
    if (!ebookId) {
      setError('Brak identyfikatora ebooka');
      return;
    }

    const chapter = tocItems.find(item => item.id === chapterId);
    if (!chapter) {
      setError('Nie znaleziono rozdziału');
      return;
    }

    setError(null);
    setIsGeneratingSingleChapter(true);

    try {
      // Wywołanie API z dodatkowymi danymi kontekstowymi
      const response = await fetch('/api/anthropic/generate-single-chapter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          subtitle: subtitle.trim() || undefined,
          chapter: chapter,
          allChapters: tocItems,
          description: description.trim() || undefined,
          scrapedContent: scrapedContent
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Błąd podczas generowania treści rozdziału';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Błąd serwera (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.chapter && data.chapter.content) {
        const updatedTocItems = tocItems.map(item =>
          item.id === chapterId
            ? { ...item, content: data.chapter.content }
            : item
        );

        setTocItems(updatedTocItems);

        // Lepsze zarządzanie stanami
        setCompletedChapterIds(prev => {
          const newCompleted = [...prev];
          if (!newCompleted.includes(chapterId)) {
            newCompleted.push(chapterId);
          }
          console.log(`✅ Dodano rozdział ${chapterId} do completed:`, newCompleted);
          return newCompleted;
        });

        setChaptersWithoutContent(prev => {
          const filtered = prev.filter(id => id !== chapterId);
          console.log(`🗑️ Usunięto rozdział ${chapterId} z chaptersWithoutContent:`, filtered);
          return filtered;
        });

        // Sprawdź czy wszystkie rozdziały mają treść
        const allChaptersWithContent = updatedTocItems.every(item =>
          item.content && item.content.trim().length > 0
        );

        if (allChaptersWithContent && !contentGenerated) {
          setContentGenerated(true);
          console.log('🎉 Wszystkie rozdziały mają treść - ustawiono contentGenerated=true');
        }

        // Zapisz w bazie danych
        try {
          const updateResponse = await fetch(`/api/ebooks/${ebookId}/chapters/${chapterId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: data.chapter.content
            }),
          });

          if (updateResponse.ok) {
            console.log(`💾 Zaktualizowano treść rozdziału ID=${chapterId}`);
          }
        } catch (updateError) {
          console.warn('Błąd podczas zapisywania:', updateError);
        }

      } else {
        throw new Error('Otrzymano nieprawidłowy format danych');
      }

    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas generowania treści rozdziału');
    } finally {
      setIsGeneratingSingleChapter(false);
      setShowChapterRegeneratePopup(false);
      setChapterToRegenerate(null);
    }
  };

  const updateEbookTitle = async () => {
    const hasDescriptionChanged = description !== originalDescription;
    const hasUrlsChanged = JSON.stringify(urlInputs) !== JSON.stringify(originalUrlInputs);
    const noChanges = title === originalTitle &&
                     subtitle === originalSubtitle &&
                     !hasDescriptionChanged &&
                     !hasUrlsChanged;

    if (!ebookId || !title.trim() || noChanges) {
      if (noChanges) {
        changeStep(2);
        return;
      }
      setError('Nie można zaktualizować tytułu');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      // 1. Najpierw zeskrapuj URL-e jeśli się zmieniły
      if (hasUrlsChanged) {
        setScrapedContent([]); // Wyczyść stare treści
        await scrapeUrls(); // Pobierz nowe
      }

      // 2. Zaktualizuj dane ebooka
      const response = await fetch(`/api/ebooks/${ebookId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          subtitle: subtitle.trim() || undefined,
          description: description.trim() || undefined
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Błąd podczas aktualizacji tytułu';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Błąd serwera (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`Tytuł ebooka zaktualizowany (ID=${ebookId}): ${title}`);
        setOriginalTitle(title);
        setOriginalSubtitle(subtitle);
        setOriginalDescription(description);
        setOriginalUrlInputs([...urlInputs]);
        changeStep(2);
      } else {
        throw new Error('Nieprawidłowa odpowiedź z API aktualizacji tytułu');
      }
    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas aktualizacji tytułu');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateResponse = (regenerate: boolean) => {
    if (regenerate) {
      generateTableOfContents();
    } else {
      setShowRegeneratePopup(false);
      setStep(2);
    }
  };

  const handleChapterRegenerateResponse = (regenerate: boolean) => {
    if (regenerate && chapterToRegenerate) {
      generateSingleChapterContent(chapterToRegenerate);
    } else {
      setShowChapterRegeneratePopup(false);
      setChapterToRegenerate(null);
    }
  };

  const handleGenerateChapterContent = (chapterId: string) => {
    setChapterToRegenerate(chapterId);
    setIsGeneratingSingleChapter(true);
    generateSingleChapterContent(chapterId);
  };

  const generateMissingContent = async () => {
    if (chaptersWithoutContent.length === 0) {
      return;
    }

    setError(null);
    setIsGeneratingMissingContent(true);

    try {
      for (const chapterId of chaptersWithoutContent) {
        setGeneratingChapterIds(prev => [...prev, chapterId]);
        await generateSingleChapterContent(chapterId);
        setGeneratingChapterIds(prev => prev.filter(id => id !== chapterId));
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setChaptersWithoutContent([]);
      console.log('Wygenerowano treść dla wszystkich brakujących rozdziałów.');
      setContentGenerated(true);

    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas generowania brakującej treści');
    } finally {
      setGeneratingChapterIds([]);
      setIsGeneratingMissingContent(false);
    }
  };

  const generateChaptersContent = async () => {
    if (tocItems.length === 0) {
      setError('Brak rozdziałów do wygenerowania treści');
      return;
    }

    if (!ebookId) {
      setError('Brak identyfikatora ebooka. Spróbuj odświeżyć stronę i zacząć od początku.');
      return;
    }

    setError(null);
    setIsGeneratingContent(true);
    setGeneratingChapterIds([]);
    setCompletedChapterIds([]);

    try {
      const chaptersToGenerate = [...tocItems];
      const updatedTocItems = [...tocItems];

      for (let i = 0; i < chaptersToGenerate.length; i++) {
        const chapter = chaptersToGenerate[i];

        setCurrentGeneratingIndex(i);
        setGeneratingChapterIds(prev => [...prev, chapter.id]);

        // Wywołanie API z dodatkowymi danymi
        const response = await fetch('/api/anthropic/generate-single-chapter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            subtitle: subtitle.trim() || undefined,
            chapter: chapter,
            allChapters: updatedTocItems,
            description: description.trim() || undefined,
            scrapedContent: scrapedContent
          }),
        });

        if (!response.ok) {
          let errorMessage = 'Błąd podczas generowania treści rozdziału';
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (jsonError) {
            errorMessage = `Błąd serwera (${response.status})`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (data.chapter && data.chapter.content) {
          updatedTocItems[i] = {
            ...updatedTocItems[i],
            content: data.chapter.content
          };

          setGeneratingChapterIds(prev => prev.filter(id => id !== chapter.id));
          await new Promise(resolve => setTimeout(resolve, 10));
          setTocItems(updatedTocItems);
          setCompletedChapterIds(prev => [...prev, chapter.id]);

          try {
            const updateResponse = await fetch(`/api/ebooks/${ebookId}/chapters/${chapter.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                content: data.chapter.content
              }),
            });

            if (!updateResponse.ok) {
              console.warn(`Nie udało się zapisać treści rozdziału ${chapter.id} w bazie, ale kontynuujemy proces`);
            }
          } catch (updateError) {
            console.warn(`Błąd podczas zapisywania treści rozdziału ${chapter.id}:`, updateError);
          }
        }
      }

      setContentGenerated(true);
      setChaptersWithoutContent([]);

      if (updatedTocItems.length > 0) {
        setActiveChapterId(updatedTocItems[0].id);
      }
      syncChapterStatus();
      setStep(3);
    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas generowania treści. Spróbuj ponownie.');
    } finally {
      setIsGeneratingContent(false);
      setCurrentGeneratingIndex(-1);
      setGeneratingChapterIds([]);
    }
  };

  // ✅ NAPRAWIONA FUNKCJA handleGenerateAIImage
  const handleGenerateAIImage = async (chapterId: string, forceRegenerate = false) => {
    const chapter = tocItems.find(item => item.id === chapterId);
    if (!chapter || !chapter.content || !ebookId) {
      setError('Rozdział nie ma treści do wygenerowania grafiki');
      return;
    }

    setGeneratingAIImageForChapter(chapterId);
    setAiImageGenerationProgress(10);
    setAiImageGenerationError(null);
    setError(null);

    console.log(`🎨 Rozpoczynam generowanie grafiki dla rozdziału: ${chapter.title}`);

    try {
      const response = await fetch(`/api/ebooks/${ebookId}/chapters/${chapterId}/generate-image`, {
        method: 'POST',
        headers: getUserHeaders(),
        body: JSON.stringify({
          forceRegenerate,
          size: "1024x1024"
        }),
      });

      setAiImageGenerationProgress(60);

      if (!response.ok) {
        let errorMessage = 'Błąd podczas generowania grafiki AI';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Błąd serwera (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      setAiImageGenerationProgress(90);
      const data = await response.json();

      if (!data.success || !data.image_url) {
        throw new Error('Nieprawidłowa odpowiedź z serwera');
      }

      console.log(`✅ Grafika AI wygenerowana dla rozdziału ${chapter.title}: ${data.image_url}`);

      // ✅ NAPRAWIONA aktualizacja stanu z cache-bust
      const timestamp = Date.now();
      const baseUrl = data.image_url.split('?')[0];
      const newImageUrl = `${baseUrl}?t=${timestamp}`;

      setTocItems(currentTocItems =>
        currentTocItems.map(item =>
          item.id === chapterId
            ? { ...item, image_url: newImageUrl }
            : item
        )
      );

      setImageRefreshTimestamp(timestamp);

      if (!graphicsAdded) {
        setGraphicsAdded(true);
      }

      setAiImageGenerationProgress(100);
      console.log(`✅ Zaktualizowano stan grafiki dla rozdziału ${chapterId}`);

      if (data.prompt_was_generated) {
        console.log(`Wygenerowano nowy prompt dla rozdziału "${chapter.title}": ${data.prompt_used}`);
      }

    } catch (err) {
      console.error(`❌ Błąd generowania grafiki dla rozdziału ${chapter.title}:`, err);
      setAiImageGenerationError(err instanceof Error ? err.message : 'Nieznany błąd');
      handleApiError(err, 'Wystąpił błąd podczas generowania grafiki AI');
    } finally {
      setTimeout(() => {
        setGeneratingAIImageForChapter(null);
        setAiImageGenerationProgress(0);
      }, 1000);
    }
  };

  const handleRegenerateAIImageWithNewPrompt = async (chapterId: string) => {
    await handleGenerateAIImage(chapterId, true);
  };

  const fetchChapterPrompt = async (chapterId: string) => {
    if (!ebookId) return;

    try {
      const response = await fetch(`/api/ebooks/${ebookId}/chapters/${chapterId}`, {
        method: 'GET',
        headers: getUserHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.chapter && data.chapter.image_prompt) {
          setChapterPrompts(prev => ({
            ...prev,
            [chapterId]: data.chapter.image_prompt
          }));
        }
      }
    } catch (error) {
      console.warn('Błąd podczas pobierania promptu:', error);
    }
  };

  // ✅ CAŁKOWICIE PRZEPISANA FUNKCJA handleGenerateAllImages
  const handleGenerateAllImages = async () => {
    const chaptersWithContent = tocItems.filter(
      item => (item.content && item.content.trim().length > 0) && !item.image_url
    );

    if (chaptersWithContent.length === 0) {
      setError('Brak rozdziałów z treścią bez grafik do wygenerowania');
      return;
    }

    console.log(`🎨 Rozpoczynam masowe generowanie ${chaptersWithContent.length} grafik...`);

    setIsGeneratingAllImages(true);
    setGeneratedImagesCount(0);
    setTotalImagesToGenerate(chaptersWithContent.length);
    setError(null);

    const startTime = Date.now();
    const chaptersWithErrors = [];

    try {
      for (let i = 0; i < chaptersWithContent.length; i++) {
        const chapter = chaptersWithContent[i];

        console.log(`🎨 [${i + 1}/${chaptersWithContent.length}] Generuję grafikę dla: ${chapter.title}`);

        setGeneratingAIImageForChapter(chapter.id);
        setAiImageGenerationProgress(10);
        setAiImageGenerationError(null);

        try {
          if (!chapter.content || !ebookId) {
            console.warn(`⚠️ Pominięto rozdział ${chapter.id} - brak treści lub ebookId`);
            chaptersWithErrors.push(chapter.id);
            continue;
          }

          const response = await fetch(`/api/ebooks/${ebookId}/chapters/${chapter.id}/generate-image`, {
            method: 'POST',
            headers: getUserHeaders(),
            body: JSON.stringify({
              forceRegenerate: false,
              size: "1024x1024"
            }),
          });

          setAiImageGenerationProgress(60);

          if (!response.ok) {
            let errorMessage = 'Błąd podczas generowania grafiki AI';
            try {
              const errorData = await response.json();
              if (errorData && errorData.error) {
                errorMessage = errorData.error;
              }
            } catch (jsonError) {
              errorMessage = `Błąd serwera (${response.status})`;
            }

            console.warn(`❌ Błąd dla rozdziału ${chapter.title}: ${errorMessage}`);
            chaptersWithErrors.push(chapter.id);
            continue;
          }

          setAiImageGenerationProgress(90);
          const data = await response.json();

          if (!data.success || !data.image_url) {
            console.warn(`⚠️ Nieprawidłowa odpowiedź z serwera dla rozdziału ${chapter.title}`);
            chaptersWithErrors.push(chapter.id);
            continue;
          }

          // ✅ STABILNA aktualizacja stanu
          const timestamp = Date.now();
          const baseUrl = data.image_url.split('?')[0];
          const newImageUrl = `${baseUrl}?t=${timestamp}`;

          // Użyj callback w setTocItems dla stabilności
          setTocItems(currentTocItems => {
            const updatedItems = currentTocItems.map(item =>
              item.id === chapter.id
                ? { ...item, image_url: newImageUrl }
                : item
            );

            console.log(`✅ [${i + 1}/${chaptersWithContent.length}] Zaktualizowano stan dla: ${chapter.title}`);
            return updatedItems;
          });

          if (!graphicsAdded) {
            setGraphicsAdded(true);
          }

          setAiImageGenerationProgress(100);
          setGeneratedImagesCount(prev => prev + 1);

          console.log(`✅ [${i + 1}/${chaptersWithContent.length}] Grafika wygenerowana dla: ${chapter.title}`);

        } catch (err) {
          console.error(`❌ Ogólny błąd dla rozdziału ${chapter.title}:`, err);
          chaptersWithErrors.push(chapter.id);
        }

        // Wyczyść stan generowania dla tego rozdziału
        setGeneratingAIImageForChapter(null);
        setAiImageGenerationProgress(0);

        // Opóźnienie między generowaniami (ważne dla API)
        if (i < chaptersWithContent.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

    } catch (err) {
      console.error('❌ Ogólny błąd masowego generowania:', err);
      setError('Wystąpił błąd podczas masowego generowania grafik');
    }

    // ✅ KOŃCOWE czyszczenie i podsumowanie
    setIsGeneratingAllImages(false);
    setGeneratingAIImageForChapter(null);
    setAiImageGenerationProgress(0);

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    const successCount = chaptersWithContent.length - chaptersWithErrors.length;

    console.log(`🏁 Masowe generowanie zakończone w ${duration}s:`);
    console.log(`✅ Pomyślnie: ${successCount}/${chaptersWithContent.length}`);
    console.log(`❌ Błędy: ${chaptersWithErrors.length}`);

    // Automatycznie odśwież status po kilku sekundach
    setTimeout(() => {
      console.log('🔄 Automatyczne odświeżanie statusu grafik...');
      refreshImagesStatus();
    }, 3000);

    // Pokaż błędy jeśli wystąpiły
    if (chaptersWithErrors.length > 0) {
      const errorChapterTitles = chaptersWithErrors.map(id => {
        const chapter = tocItems.find(item => item.id === id);
        return chapter ? chapter.title : `Rozdział ${id}`;
      });

      if (chaptersWithErrors.length === chaptersWithContent.length) {
        setError(`Nie udało się wygenerować żadnej grafiki. Spróbuj ponownie później.`);
      } else {
        setError(`Nie udało się wygenerować grafik dla ${chaptersWithErrors.length} rozdziałów: ${errorChapterTitles.join(', ')}. Możesz spróbować wygenerować te grafiki pojedynczo.`);
      }
    } else if (successCount > 0) {
      setError(null);
      console.log('🎉 Wszystkie grafiki wygenerowane pomyślnie');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || (!uploadingImageForChapter && !uploadingCoverImage) || !ebookId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const fileType = file.type;
    if (!fileType.startsWith('image/')) {
      setError('Wybrany plik nie jest obrazem.');
      setIsSaving(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('image', file);
      const userHeaders = getUserHeaders();
      const { 'Content-Type': removed, ...headers } = userHeaders;

      let response;

      if (uploadingCoverImage) {
        // Przesyłanie okładki
        response = await fetch(`/api/ebooks/${ebookId}/cover-image`, {
          method: 'POST',
          headers: headers,
          body: formData
        });
      } else if (uploadingImageForChapter) {
        // Przesyłanie grafiki rozdziału
        response = await fetch(`/api/ebooks/${ebookId}/chapters/${uploadingImageForChapter}/image`, {
          method: 'POST',
          headers: headers,
          body: formData
        });
      } else {
        throw new Error('Nieznany typ przesyłania obrazu');
      }

      if (!response.ok) {
        let errorMessage = 'Błąd podczas przesyłania obrazu';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Błąd serwera (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        const timestamp = Date.now();
        const baseUrl = data.image_url.split('?')[0];
        const newImageUrl = `${baseUrl}?t=${timestamp}`;

        if (uploadingCoverImage) {
          // Aktualizuj dane okładki
          setCoverData(prev => prev ? {
            ...prev,
            cover_url: newImageUrl,
            has_cover_image: true,
            cover_status: {
              ...prev.cover_status,
              image_ready: true,
              complete: true
            }
          } : null);

          setCoverGenerated(true);
          console.log(`✅ Okładka została pomyślnie przesłana: ${newImageUrl}`);
        } else if (uploadingImageForChapter) {
          // Aktualizuj grafikę rozdziału
          setTocItems(prevItems => prevItems.map(item =>
            item.id === uploadingImageForChapter
              ? { ...item, image_url: newImageUrl }
              : item
          ));

          if (previewImage && previewImage.startsWith(baseUrl)) {
            setPreviewImage(newImageUrl);
          }

          console.log(`✅ Obraz został pomyślnie przesłany dla rozdziału ID=${uploadingImageForChapter}: ${newImageUrl}`);
        }

        setImageRefreshTimestamp(timestamp);

        if (!graphicsAdded) {
          setGraphicsAdded(true);
        }
      } else {
        throw new Error('Nieprawidłowa odpowiedź z serwera');
      }
    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas przesyłania obrazu');
    } finally {
      setIsSaving(false);
      setUploadingImageForChapter(null);
      setUploadingCoverImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenFileDialog = (chapterId: string) => {
    setUploadingImageForChapter(chapterId);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleOpenCoverFileDialog = () => {
    setUploadingCoverImage(true);
    setUploadingImageForChapter(null); // Wyczyść stan rozdziału
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;
    if (!ebookId) {
      setError('Brak identyfikatora ebooka. Spróbuj odświeżyć stronę i zacząć od początku.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/ebooks/${ebookId}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapters: [{ title: newItemTitle.trim() }]
        }),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas dodawania rozdziału');
      }

      const data = await response.json();

      if (data.success && data.chapters && data.chapters.length > 0) {
        const newChapter = data.chapters[0];
        const newItem: TocItem = {
          id: newChapter.id.toString(),
          title: newChapter.title,
          position: newChapter.position
        };

        setTocItems([...tocItems, newItem]);
        setNewItemTitle('');
        setChaptersWithoutContent([...chaptersWithoutContent, newItem.id]);

        if (newItemInputRef.current) {
          newItemInputRef.current.focus();
        }
      } else {
        throw new Error('Nieprawidłowa odpowiedź z API dodawania rozdziału');
      }
    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas dodawania rozdziału');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveItem = async (id: string) => {
    if (!ebookId) {
      setError('Brak identyfikatora ebooka');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/ebooks/${ebookId}/chapters/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Błąd podczas usuwania rozdziału');
      }

      setTocItems(tocItems.filter(item => item.id !== id));
      setContextMenuVisible(null);

      if (chaptersWithoutContent.includes(id)) {
        setChaptersWithoutContent(chaptersWithoutContent.filter(chapterId => chapterId !== id));
      }
    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas usuwania rozdziału');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveItem = async (id: string, direction: 'up' | 'down') => {
    if (!ebookId) {
      setError('Brak identyfikatora ebooka');
      return;
    }

    const index = tocItems.findIndex(item => item.id === id);
    if (index === -1) return;

    if ((direction === 'up' && index === 0) ||
        (direction === 'down' && index === tocItems.length - 1)) {
      return;
    }

    setIsSaving(true);

    try {
      const newItems = [...tocItems];

      if (direction === 'up' && index > 0) {
        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      } else if (direction === 'down' && index < tocItems.length - 1) {
        [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      }

      const response = await fetch(`/api/ebooks/${ebookId}/chapters`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'reorder',
          chapterId: id,
          direction: direction
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Błąd podczas aktualizacji pozycji rozdziałów');
      }

      const updatedItems = newItems.map((item, idx) => ({
        ...item,
        position: idx
      }));

      setTocItems(updatedItems);
      setContextMenuVisible(null);
    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas zmiany kolejności rozdziałów');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEditing = (item: TocItem) => {
    setEditingItemId(item.id);
    setEditingItemTitle(item.title);
    setOriginalChapterTitle(item.title);
    setContextMenuVisible(null);
  };

  const handleSaveEdit = async () => {
    if (!editingItemId || !ebookId) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/ebooks/${ebookId}/chapters/${editingItemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editingItemTitle.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas aktualizacji tytułu rozdziału');
      }

      setTocItems(tocItems.map(item =>
        item.id === editingItemId
          ? { ...item, title: editingItemTitle.trim() }
          : item
      ));

      const chapter = tocItems.find(item => item.id === editingItemId);
      if (
        chapter &&
        editingItemTitle.trim() !== originalChapterTitle &&
        chapter.content &&
        chapter.content.trim() !== ''
      ) {
        setChapterToRegenerate(editingItemId);
        setShowChapterRegeneratePopup(true);
      }

      setEditingItemId(null);
      setEditingItemTitle('');
    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas zapisywania zmian');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditingItemTitle('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  const handleStartEditingContent = (item: TocItem) => {
    setEditingContent(true);
    setEditingChapterContent(item.content || '');
  };

  const handleSaveEditedContent = async () => {
    if (!activeChapterId || !ebookId) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/ebooks/${ebookId}/chapters/${activeChapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editingChapterContent
        }),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas aktualizacji treści rozdziału');
      }

      setTocItems(tocItems.map(item =>
        item.id === activeChapterId
          ? { ...item, content: editingChapterContent }
          : item
      ));

      if (editingChapterContent && editingChapterContent.trim() !== '') {
        setChaptersWithoutContent(chaptersWithoutContent.filter(id => id !== activeChapterId));
      }

      setEditingContent(false);
      setEditingChapterContent('');
    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas zapisywania treści rozdziału');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditContent = () => {
    setEditingContent(false);
    setEditingChapterContent('');
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (contextMenuVisible === id) {
      setContextMenuVisible(null);
      return;
    }

    setContextMenuVisible(id);

    setTimeout(() => {
      const menuElement = document.querySelector(`[data-chapter-id="${id}"]`) as HTMLElement;
      if (menuElement) {
        menuElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 50);
  };

  const calculateCompletionPercentage = () => {
    if (tocItems.length === 0) return 0;
    const chaptersWithContent = tocItems.filter(item => item.content && item.content.trim().length > 0).length;
    return Math.round((chaptersWithContent / tocItems.length) * 100);
  };

  const handleExportEbook = async () => {
    if (!ebookId) {
      setError('Brak identyfikatora ebooka');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // ✅ LEPSZE sprawdzenie czy okładka jest gotowa
      const needsCover = !coverData?.cover_status?.complete || !coverData?.cover_url;

      if (needsCover) {
        console.log('🎨 Okładka nie jest gotowa - generuję automatycznie...');
        // Najpierw wygeneruj okładkę
        const coverGenerated = await generateCover(false, false);
        if (!coverGenerated) {
          setError('Nie udało się automatycznie wygenerować okładki. Proszę wygenerować okładkę ręcznie przed eksportem.');
          setIsSaving(false);
          return;
        }

        // Poczekaj chwilę na synchronizację
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('📄 Rozpoczynam eksport PDF...');
      // Teraz eksportuj PDF
      const response = await fetch(`/api/ebooks/${ebookId}/export-pdf`, {
        method: 'POST',
        headers: getUserHeaders(),
      });

      if (!response.ok) {
        let errorMessage = 'Błąd podczas generowania PDF';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Błąd serwera (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();

      console.log('✅ PDF został pomyślnie pobrany');

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

    } catch (err) {
      handleApiError(err, 'Wystąpił błąd podczas eksportu ebooka');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImagePreview = (imageUrl: string | undefined) => {
    console.log('handleImagePreview wywołany z URL:', imageUrl);
    if (imageUrl && imageUrl.trim()) {
      console.log('Ustawiam previewImage na:', imageUrl);
      setPreviewImage(imageUrl);
    } else {
      console.warn('Nie można wyświetlić podglądu - pusty URL:', imageUrl);
    }
  };

  const handleClosePreview = () => {
    setPreviewImage(null);
  };

  // ROZSZERZONE renderStep1 z nowymi polami
  const renderStep1 = () => (
    <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl border border-blue-100 shadow-lg p-8 transition-all duration-300">
      <div className="mb-8 text-center">
        <BookMarked size={48} className="text-blue-500 mb-4 mx-auto drop-shadow-md" />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          {tocGenerated ? 'Edytuj dane e-book`a' : 'Utwórz swój e-book'}
        </h2>
        <p className="text-gray-600 max-w-md mx-auto">
          {tocGenerated
            ? 'Wprowadź zmiany w danych Twojego e-booka.'
            : 'Wprowadź dane, na podstawie których wygenerujemy spis treści dla Twojego e-booka.'}
        </p>
      </div>

      <div className="mb-6 max-w-2xl mx-auto space-y-6">
        {/* Sekcja tytułu */}
        <div className="bg-white p-4 rounded-lg border border-blue-100">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Tytuł e-book'a *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Np. Kompletny przewodnik po zarządzaniu czasem"
            className="w-full px-4 py-3 border border-blue-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200"
            disabled={isGeneratingToc || isSaving || isScrapingUrls}
            ref={titleInputRef}
          />
        </div>

        {/* Sekcja podtytułu */}
        <div className="bg-white p-4 rounded-lg border border-blue-100">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Podtytuł:
            <span className="text-gray-400 font-normal ml-1">(opcjonalnie)</span>
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Np. Praktyczne metody i narzędzia"
            className="w-full px-4 py-3 border border-blue-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200"
            disabled={isGeneratingToc || isSaving || isScrapingUrls}
            ref={subtitleInputRef}
          />
        </div>

        {/* NOWA Sekcja opisu */}
        <div className="bg-white p-4 rounded-lg border border-blue-100">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Opis i preferencje:
            <span className="text-gray-400 font-normal ml-1">(opcjonalnie)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opisz swoje preferencje dotyczące treści ebooka, grupy docelowej, stylu pisania, głównych tematów które chcesz uwzględnić..."
            className="w-full px-4 py-3 border border-blue-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200 resize-none"
            rows={4}
            disabled={isGeneratingToc || isSaving || isScrapingUrls}
            maxLength={1000}
            ref={descriptionInputRef}
          />
          <div className="text-xs text-gray-400 mt-1">
            {description.length}/1000 znaków
          </div>
        </div>

        {/* NOWA Sekcja linków */}
        <div className="bg-white p-4 rounded-lg border border-blue-100 text-gray-700">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-gray-700">
              Źródła WWW:
              <span className="text-gray-400 font-normal ml-1">(opcjonalnie, max 5)</span>
            </label>
            {scrapedContent.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Pobrano {scrapedContent.length} źródeł
              </span>
            )}
          </div>

          <div className="space-y-2">
              {urlInputs.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    placeholder="https://example.com/article"
                    className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl}
                  />

                  {url.trim() && !scrapedContent.find(item => item.url === url) && (
                      <button
                        onClick={() => scrapeSingleUrl(url)}
                        disabled={isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl}
                        className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                          isScrapingSingleUrl
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                        }`}
                      >
                        {isScrapingSingleUrl ? (
                          <>
                            <Loader size={14} className="animate-spin mr-1" />

                          </>
                        ) : (
                          'Zatwierdź'
                        )}
                      </button>
                    )}

                    {url.trim() && scrapedContent.find(item => item.url === url) && (
                      <span className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg border border-green-200 flex items-center">
                        <Check size={14} className="mr-1" />
                        Już dodane
                      </span>
                  )}

                  {urlInputs.length > 1 && (
                    <button
                      onClick={() => removeUrlInput(index)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      disabled={isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Źródła PDF:
                <span className="text-gray-400 font-normal ml-1">(opcjonalnie, max 10MB)</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenPdfDialog}
                  disabled={isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl || isUploadingPdf}
                  className={`flex items-center px-4 py-2 border border-dashed border-gray-300 rounded-lg transition-colors ${
                    isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl || isUploadingPdf
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 cursor-pointer hover:border-blue-300'
                  }`}
                >
                  {isUploadingPdf ? (
                    <>
                      <Loader size={16} className="animate-spin mr-2" />
                      Przetwarzanie...
                    </>
                  ) : (
                    <>
                      <Upload size={16} className="mr-2" />
                      Wybierz plik PDF
                    </>
                  )}
                </button>

                <span className="text-xs text-gray-500">
                  Obsługujemy pliki PDF z tekstem (nie skany)
                </span>
              </div>

              <input
                type="file"
                ref={pdfInputRef}
                className="hidden"
                accept=".pdf,application/pdf"
                onChange={handlePdfUpload}
              />
          </div>
          {/* Podgląd pobranych treści */}
            {scrapedContent.length > 0 && (
              <div className="mt-4 border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Pobrane źródła:</h4>
                <div className="space-y-2 max-h-128 overflow-y-auto">
                  {scrapedContent.map((item, index) => (
                    <div key={index} className="text-xs bg-gray-50 p-2 rounded border relative">
                      <button
                        onClick={() => handleRemoveScrapedContent(item.url)}
                        className="absolute top-1 right-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 transition-colors cursor-pointer"
                        title="Usuń źródło"
                      >
                        <X size={12} />
                      </button>
                      <div className="font-medium text-gray-800 truncate pr-6">{item.title}</div>
                      <div className="text-gray-500 truncate pr-6">{item.url}</div>
                      <div className="text-gray-600 truncate mt-1 pr-6">{item.content.substring(0, 100)}...</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>

      <div className="flex justify-center mt-8 gap-4">
        {tocGenerated && (
          <button
            onClick={() => changeStep(2)}
            className="flex items-center justify-center px-6 py-3 rounded-lg text-gray-700 font-medium border border-gray-300 shadow-sm hover:bg-gray-50 transition-all duration-200 cursor-pointer"
            disabled={isSaving}
          >
            Anuluj
          </button>
        )}

        <button
          onClick={tocGenerated ? updateEbookTitle : generateTableOfContents}
          disabled={!title.trim() || isGeneratingToc || isSaving || isScrapingUrls}
          className={`flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium shadow-md transition-all duration-200 ${
            !title.trim() || isGeneratingToc || isSaving || isScrapingUrls
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 hover:scale-105 hover:shadow-lg cursor-pointer'
          }`}
        >
          {isGeneratingToc ? (
            <>
              <Loader size={20} className="animate-spin mr-3" />
              Generowanie...
            </>
          ) : isScrapingUrls ? (
            <>
              <Loader size={20} className="animate-spin mr-3" />
              Pobieranie źródeł...
            </>
          ) : tocGenerated ? (
            <>
              <Save size={20} className="mr-3" />
              Zapisz zmiany
            </>
          ) : (
            <>
              <Sparkles size={20} className="mr-3" />
              Wygeneruj spis treści
            </>
          )}
        </button>
      </div>
    </div>
  );

  const renderRegeneratePopup = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-fadeIn">
        <div className="text-center mb-6">
          <AlertCircle size={40} className="text-blue-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">Zmiana tytułu e-booka</h3>
          <p className="text-gray-600">
            {subtitle !== originalSubtitle
              ? 'Tytuł lub podtytuł e-booka zostały zmienione, co może wpłynąć na jego zawartość.'
              : 'Podstawowe dane e-booka zostały zmienione co może wpłynąć na jego zawartość.'}
            Czy chcesz wygenerować nową propozycję rozdziałów?
          </p>
        </div>

        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => handleRegenerateResponse(false)}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer"
            disabled={isGeneratingToc}
          >
            NIE
          </button>
          <button
            onClick={() => handleRegenerateResponse(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 cursor-pointer"
            disabled={isGeneratingToc}
          >
            {isGeneratingToc ? (
              <>
                <Loader size={16} className="animate-spin mr-2 inline-block" />
                Generowanie...
              </>
            ) : (
              'TAK'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderChapterRegeneratePopup = () => {
    const chapter = tocItems.find(item => item.id === chapterToRegenerate);
    if (!chapter) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-fadeIn">
          <div className="text-center mb-6">
            <AlertCircle size={40} className="text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Zmiana tytułu rozdziału</h3>
            <p className="text-gray-600">
              Tytuł rozdziału został zmieniony z "{originalChapterTitle}" na "{chapter.title}".
              Czy chcesz wygenerować nową treść dla tego rozdziału?
            </p>
          </div>

          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={() => handleChapterRegenerateResponse(false)}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer"
              disabled={isGeneratingSingleChapter}
            >
              NIE
            </button>
            <button
              onClick={() => handleChapterRegenerateResponse(true)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 cursor-pointer"
              disabled={isGeneratingSingleChapter}
            >
              {isGeneratingSingleChapter ? (
                <>
                  <Loader size={16} className="animate-spin mr-2 inline-block" />
                  Generowanie...
                </>
              ) : (
                'TAK'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const PromptPreviewModal = ({ chapterId, onClose }: { chapterId: string; onClose: () => void; }) => {
    const chapter = tocItems.find(item => item.id === chapterId);
    const prompt = chapterPrompts[chapterId];

    if (!chapter) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-bold text-gray-800">Prompt dla obrazu</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              <X size={24} />
            </button>
          </div>

          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Rozdział: {chapter.title}</h4>
            {prompt ? (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{prompt}</p>
                <div className="mt-2 text-xs text-gray-500">
                  Długość: {prompt.length}/400 znaków
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700">
                  Prompt nie został jeszcze wygenerowany. Zostanie utworzony podczas pierwszego generowania obrazu.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Zamknij
            </button>
            {prompt && (
              <button
                onClick={() => {
                  handleRegenerateAIImageWithNewPrompt(chapterId);
                  onClose();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                disabled={generatingAIImageForChapter === chapterId || isGeneratingAllImages}
              >
                Regeneruj z nowym promptem
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-300">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 sm:p-6 text-white">
        <div className="flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Dostosuj strukturę e-book'a</h2>
            <p className="text-xl sm:text-2xl text-white mt-1 font-bold max-w-2xl line-clamp-3">
              {title}
            </p>
            {subtitle && (
              <p className="text-blue-200 mt-1 font-normal line-clamp-2">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-6">
          <div className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
            <FileText size={16} className="mr-2 text-blue-500" />
            Rozdziały ({tocItems.length})
          </div>

          <div className="space-y-2 mb-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
            {tocItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <BookOpen size={36} className="text-gray-400 mb-2" />
                <p>Brak rozdziałów. Dodaj pierwszy rozdział poniżej.</p>
              </div>
            ) : (
              tocItems.map((item, index) => (
                <div
                  key={item.id}
                  data-chapter-id={item.id}
                  className={`relative flex items-center p-3 ${
                    editingItemId === item.id
                      ? 'bg-blue-50 border border-blue-300'
                      : 'bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  } rounded-lg group transition-all duration-200`}
                >
                  <div className="mr-3 text-gray-700 font-semibold w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                    {index + 1}
                  </div>

                  {editingItemId === item.id ? (
                    <div className="flex-grow mr-2">
                      <input
                        type="text"
                        value={editingItemTitle}
                        onChange={(e) => setEditingItemTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white"
                        onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                        ref={editItemInputRef}
                      />
                    </div>
                  ) : (
                    <div className="flex-grow mr-2 text-gray-800 font-medium break-words min-w-0">
                      {item.title}
                    </div>
                  )}

                  {!editingItemId && (
                    <div className="flex items-center sm:ml-auto ml-auto mt-1 mb-1 sm:mt-0 sm:mb-0 mr-2 flex-shrink-0">
                      {isGeneratingContent && (
                        <>
                          {generatingChapterIds.includes(item.id) ? (
                            <span className="text-blue-600 flex items-center">
                              <Loader size={14} className="animate-spin mr-1 sm:mr-1" />
                              <span className="text-xs whitespace-nowrap hidden sm:inline">Generowanie...</span>
                            </span>
                          ) :
                          completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0) ? (
                            <span className="text-green-600 flex items-center">
                              <Check size={14} className="mr-0 sm:mr-1" />
                              <span className="text-xs whitespace-nowrap hidden sm:inline">Gotowe</span>
                            </span>
                          ) :
                          currentGeneratingIndex < index && !completedChapterIds.includes(item.id) ? (
                            <span className="text-gray-500 hidden sm:flex items-center">
                              <span className="text-xs whitespace-nowrap">Czeka w kolejce...</span>
                            </span>
                          ) : null}
                        </>
                      )}

                      {!isGeneratingContent && (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) && (
                        <span className="text-green-600 flex items-center">
                          <Check size={14} className="mr-0 sm:mr-1" />
                          <span className="text-xs whitespace-nowrap hidden sm:inline">Treść dodana</span>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex ml-auto flex-shrink-0">
                    {editingItemId === item.id ? (
                      <div className="flex space-x-1">
                        <button
                          onClick={handleSaveEdit}
                          className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors cursor-pointer"
                          title="Zapisz"
                          disabled={isSaving}
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                          title="Anuluj"
                          disabled={isSaving}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <button
                          onClick={(e) => handleContextMenu(e, item.id)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors context-menu-button cursor-pointer"
                          disabled={isSaving}
                        >
                          <MoreVertical size={18} />
                        </button>

                        {contextMenuVisible === item.id && (
                          <div className="absolute right-0 top-8 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] animate-fadeIn context-menu cursor-pointer" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleMoveItem(item.id, 'up')}
                              disabled={index === 0 || isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                index === 0 || isSaving
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                              } transition-colors`}
                            >
                              <ArrowUp size={14} className="mr-2" />
                              Przesuń wyżej
                            </button>
                            <button
                              onClick={() => handleMoveItem(item.id, 'down')}
                              disabled={index === tocItems.length - 1 || isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                index === tocItems.length - 1 || isSaving
                                  ? 'text-gray-400 cursor-not-allowed'
                                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                              } transition-colors`}
                            >
                              <ArrowDown size={14} className="mr-2" />
                              Przesuń niżej
                            </button>
                            <button
                              onClick={() => handleStartEditing(item)}
                              disabled={isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                isSaving ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                              } transition-colors`}
                            >
                              <Edit size={14} className="mr-2" />
                              Edytuj
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                isSaving ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-red-50 hover:text-red-600 cursor-pointer'
                              } transition-colors rounded-b-lg`}
                            >
                              <X size={14} className="mr-2" />
                              Usuń
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4">
            <div className="flex flex-col sm:flex-row rounded-lg overflow-hidden shadow-sm border border-gray-200 focus-within:border-blue-300 focus-within:ring-1 focus-within:ring-blue-300 transition-all duration-200 bg-white">
              <input
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Tytuł nowego rozdziału"
                className="flex-grow px-4 py-3 text-gray-700 border-0 focus:ring-0 focus:outline-none"
                onKeyDown={(e) => handleKeyDown(e, handleAddItem)}
                ref={newItemInputRef}
                disabled={isSaving}
              />
              <button
                onClick={handleAddItem}
                disabled={!newItemTitle.trim() || isSaving}
                className={`flex items-center justify-center px-4 py-3 sm:py-2 ${
                  !newItemTitle.trim() || isSaving
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                } transition-colors`}
              >
                {isSaving ? (
                  <Loader size={18} className="animate-spin mr-1" />
                ) : (
                  <Plus size={18} className="mr-1" />
                )}
                Dodaj
              </button>
            </div>
          </div>
        </div>

        {isGeneratingContent && (
          <div className="mt-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-blue-800 flex items-center">
                <Loader size={16} className="mr-2 animate-spin text-blue-600" />
                Generowanie treści
              </h3>
              <span className="text-sm text-blue-600 font-medium">
                {completedChapterIds.length}/{tocItems.length}
              </span>
            </div>

            <div className="w-full bg-white rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(completedChapterIds.length / tocItems.length) * 100}%` }}
              ></div>
            </div>

            <p className="text-xs text-blue-700 mt-2 truncate">
              {generatingChapterIds.length > 0 &&
                `Aktualnie generowany: ${tocItems.find(item => generatingChapterIds.includes(item.id))?.title || 'rozdział'}`
              }
            </p>
          </div>
        )}

        <div className="mt-8 border-t border-gray-200 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
          <button
            onClick={() => setStep(1)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center w-full sm:w-auto justify-center sm:justify-start cursor-pointer"
            disabled={isSaving}
          >
            <Edit size={16} className="mr-1" />
            Zmień dane
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {contentGenerated ? (
              <button
                onClick={() => changeStep(3)}
                className="px-6 py-2.5 rounded-lg text-white flex items-center bg-blue-600 hover:bg-blue-700 hover:shadow-md transition-all duration-200 w-full sm:w-auto justify-center cursor-pointer"
                disabled={isSaving}
              >
                <BookOpen size={18} className="mr-2" />
                Przejdź do treści
                <ChevronRight size={16} className="ml-1" />
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                {tocItems.length < 3 && (
                  <div className="text-amber-600 text-sm flex items-center bg-amber-50 px-3 py-1.5 rounded-lg w-full sm:w-auto mb-2 sm:mb-0">
                    <AlertCircle size={14} className="mr-1.5 flex-shrink-0" />
                    <span>E-book powinien zawierać co najmniej 3 rozdziały</span>
                  </div>
                )}

                <button
                  onClick={generateChaptersContent}
                  disabled={tocItems.length < 3 || isGeneratingContent || isSaving}
                  className={`px-6 py-2.5 rounded-lg text-white flex items-center justify-center transition-all duration-200 w-full ${
                    tocItems.length < 3 || isGeneratingContent || isSaving
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md cursor-pointer'
                  }`}
                >
                  {isGeneratingContent ? (
                    <>
                      <Loader size={18} className="mr-2 animate-spin" />
                      Generowanie...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="mr-2" />
                      {tocItems.length < 3
                        ? 'Dodaj min. 3 rozdziały'
                        : 'Generuj treść'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    const activeChapter = tocItems.find(item => item.id === activeChapterId);
    const completionPercentage = calculateCompletionPercentage();

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-300 flex flex-col">
        {chaptersWithoutContent.length > 0 && (
          <div className="bg-yellow-50 border-b border-yellow-200 p-4 rounded-t-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start sm:items-center">
                <AlertCircle size={20} className="text-yellow-600 mr-3 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <p className="text-yellow-800 font-medium">
                    {chaptersWithoutContent.length === 1
                      ? 'Wykryto nowy rozdział bez treści'
                      : `Wykryto ${chaptersWithoutContent.length} rozdziały bez treści`}
                  </p>
                  <p className="text-yellow-700 text-sm">
                    Czy chcesz wygenerować treść dla {chaptersWithoutContent.length === 1 ? 'tego rozdziału' : 'tych rozdziałów'}?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 sm:mt-0">
                <button
                  onClick={() => setChaptersWithoutContent([])}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  disabled={isGeneratingMissingContent}
                >
                  Nie teraz
                </button>
                <button
                  onClick={generateMissingContent}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center cursor-pointer"
                  disabled={isGeneratingMissingContent}
                >
                  {isGeneratingMissingContent ? (
                    <>
                      <Loader size={14} className="mr-1.5 animate-spin" />
                      Generowanie...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1.5" />
                      Wygeneruj treść
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 sm:p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div>
              <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Dostosuj treść ebook'a</h2>
              <p className="text-xl sm:text-2xl text-white mt-1 font-bold max-w-2xl line-clamp-2">
                {title}
              </p>
              {subtitle && (
                <p className="text-blue-200 mt-1 font-normal line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="sm:hidden border-b border-gray-200 p-3 bg-blue-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FileText size={16} className="mr-2 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">
                Rozdział {tocItems.findIndex(item => item.id === activeChapterId) + 1} z {tocItems.length}
              </span>
            </div>

            {activeChapterId && activeChapter && !editingContent ? (
              <div className="flex items-center">
                {isGeneratingContent && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center mr-2">
                    <Loader size={10} className="animate-spin" />
                  </span>
                )}

                {!(completedChapterIds.includes(activeChapterId) || (activeChapter.content && activeChapter.content.trim().length > 0)) ? (
                  <button
                    onClick={() => handleGenerateChapterContent(activeChapterId)}
                    className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                    disabled={isSaving || isGeneratingSingleChapter}
                  >
                    {isGeneratingSingleChapter && chapterToRegenerate === activeChapterId ? (
                      <>
                        <Loader size={12} className="animate-spin mr-1.5" />
                        Generuję...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} className="mr-1.5" />
                        Wygeneruj
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartEditingContent(activeChapter)}
                    className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                    disabled={isSaving || isGeneratingSingleChapter}
                  >
                    <Edit size={12} className="mr-1.5" />
                    Edytuj
                  </button>
                )}
              </div>
            ) : isGeneratingContent && (
              <div className="flex items-center">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center">
                  <Loader size={10} className="animate-spin" />
                </span>
              </div>
            )}
          </div>

          {editingContent && (
            <div className="flex justify-end space-x-2 mt-2">
              <button
                onClick={handleSaveEditedContent}
                className="px-3 py-1.5 text-xs bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-100 transition-colors flex items-center cursor-pointer"
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader size={12} className="mr-1.5 animate-spin" />
                ) : (
                  <Save size={12} className="mr-1.5" />
                )}
                Zapisz
              </button>
              <button
                onClick={handleCancelEditContent}
                className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors flex items-center cursor-pointer"
                disabled={isSaving}
              >
                <X size={12} className="mr-1.5" />
                Anuluj
              </button>
            </div>
          )}
        </div>

        <div className="sm:hidden flex justify-between items-center px-3 py-2 border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              if (editingContent) return;
              const currentIndex = tocItems.findIndex(item => item.id === activeChapterId);
              if (currentIndex > 0) {
                setActiveChapterId(tocItems[currentIndex - 1].id);
              }
            }}
            disabled={editingContent || tocItems.findIndex(item => item.id === activeChapterId) <= 0}
            className={`flex items-center px-2 py-1.5 rounded-md ${
              editingContent || tocItems.findIndex(item => item.id === activeChapterId) <= 0
                ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                : 'text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer'
            }`}
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center overflow-x-auto hide-scrollbar px-1 space-x-1 max-w-[80%]">
            {tocItems.map((item, index) => {
              let statusIcon = null;
              if (isGeneratingContent && generatingChapterIds.includes(item.id)) {
                statusIcon = <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                  <Loader size={8} className="animate-spin text-blue-600" />
                </div>;
              } else if (isGeneratingContent && currentGeneratingIndex < index && !completedChapterIds.includes(item.id)) {
                statusIcon = <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                </div>;
              }

              return (
                <button
                  key={item.id}
                  onClick={() => !editingContent && setActiveChapterId(item.id)}
                  disabled={editingContent}
                  className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                    activeChapterId === item.id
                      ? 'bg-blue-600 text-white shadow-sm cursor-pointer'
                      : (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0))
                        ? 'bg-green-100 text-green-800 border border-green-300 cursor-pointer'
                        : 'bg-gray-100 text-gray-700 border border-gray-300 cursor-pointer'
                  } ${editingContent ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={item.title}
                >
                  {index + 1}
                  {statusIcon}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              if (editingContent) return;
              const currentIndex = tocItems.findIndex(item => item.id === activeChapterId);
              if (currentIndex < tocItems.length - 1) {
                setActiveChapterId(tocItems[currentIndex + 1].id);
              }
            }}
            disabled={editingContent || tocItems.findIndex(item => item.id === activeChapterId) >= tocItems.length - 1}
            className={`flex items-center px-2 py-1.5 rounded-md ${
              editingContent || tocItems.findIndex(item => item.id === activeChapterId) >= tocItems.length - 1
                ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                : 'text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer'
            }`}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex" style={{ height: "500px", minHeight: "400px" }}>
          <div className="hidden sm:flex sm:flex-col w-1/4 border-r border-gray-200 bg-gray-50">
            <div className="p-3 bg-blue-50 font-medium border-b border-gray-200 text-gray-700 flex items-center justify-between">
              <div className="flex items-center">
                <FileText size={16} className="mr-2 text-blue-500" />
                Spis treści
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {tocItems.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => !editingContent && setActiveChapterId(item.id)}
                  className={`p-3 ${!editingContent ? 'cursor-pointer hover:bg-blue-50' : 'cursor-not-allowed opacity-70'} border-b border-gray-200 transition-colors ${
                    activeChapterId === item.id
                      ? 'bg-blue-100 text-blue-800 font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm text-xs font-semibold mr-2 text-gray-700 flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </div>

                  <div className="flex items-center mt-1 ml-8">
                    {(completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) ? (
                      <span className="text-xs text-green-600 flex items-center">
                        <Check size={12} className="mr-1" />
                        Treść gotowa
                      </span>
                    ) : isGeneratingContent && generatingChapterIds.includes(item.id) ? (
                      <span className="text-xs text-blue-600 flex items-center">
                        <Loader size={12} className="mr-1 animate-spin" />
                        Generowanie...
                      </span>
                    ) : isGeneratingContent && currentGeneratingIndex < index && !completedChapterIds.includes(item.id) ? (
                      <span className="text-xs text-gray-600 flex items-center">
                        <span className="w-2 h-2 bg-gray-300 rounded-full mr-1"></span>
                        Czeka w kolejce
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center">
                        <AlertCircle size={12} className="mr-1" />
                        Brak treści
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full sm:w-3/4 flex flex-col bg-white">
            {activeChapterId && activeChapter ? (
              <>
                <div className="p-3 sm:p-4 border-b border-gray-200 bg-white">
                  <h3 className="font-semibold text-gray-800 text-lg line-clamp-2">
                    {activeChapter.title}
                  </h3>

                  <div className="hidden sm:flex space-x-2 mt-2">
                    {!editingContent ? (
                      <>
                          {!(completedChapterIds.includes(activeChapterId) || (activeChapter.content && activeChapter.content.trim().length > 0)) && (
                            <button
                              onClick={() => handleGenerateChapterContent(activeChapterId)}
                              className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                              disabled={isSaving || isGeneratingSingleChapter}
                            >
                            {isGeneratingSingleChapter && chapterToRegenerate === activeChapterId ? (
                              <>
                                <Loader size={14} className="animate-spin mr-1.5" />
                                Generuję...
                              </>
                            ) : (
                              <>
                                <Sparkles size={14} className="mr-1.5" />
                                Wygeneruj treść
                              </>
                            )}
                          </button>
                        )}
                        {(completedChapterIds.includes(activeChapterId) || (activeChapter.content && activeChapter.content.trim().length > 0)) && (
                          <button
                            onClick={() => handleStartEditingContent(activeChapter)}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center cursor-pointer"
                            disabled={isSaving || isGeneratingSingleChapter}
                          >
                            <Edit size={14} className="mr-1.5" />
                            Edytuj
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleSaveEditedContent}
                          className="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors flex items-center cursor-pointer"
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <Loader size={14} className="mr-1.5 animate-spin" />
                          ) : (
                            <Save size={14} className="mr-1.5" />
                          )}
                          Zapisz
                        </button>
                        <button
                          onClick={handleCancelEditContent}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center cursor-pointer"
                          disabled={isSaving}
                        >
                          <X size={14} className="mr-1.5" />
                          Anuluj
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
                  {editingContent ? (
                    <textarea
                      value={editingChapterContent}
                      onChange={(e) => setEditingChapterContent(e.target.value)}
                      className="w-full h-full p-4 border border-gray-300 rounded-lg text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-text"
                      placeholder="Wprowadź treść rozdziału..."
                      ref={contentEditRef}
                      disabled={isSaving}
                    />
                  ) : (
                    <div className="text-gray-800 prose prose-blue max-w-none">
                      {isGeneratingSingleChapter && chapterToRegenerate === activeChapterId ? (
                        <div className="flex flex-col items-center justify-center h-64">
                          <Loader size={48} className="text-blue-500 animate-spin mb-4" />
                          <p className="text-center text-gray-600">
                            Generowanie treści dla rozdziału...
                            <br />
                            To może potrwać kilka chwil.
                          </p>
                        </div>
                      ) : activeChapter.content ? (
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {activeChapter.content}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                          <BookOpen size={48} className="mb-4 text-gray-300" />
                          <p className="text-center">
                            Ten rozdział nie ma jeszcze treści.
                            <br />
                            Użyj przycisku "Wygeneruj treść" aby dodać treść.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Wybierz rozdział z listy.</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4 px-4 sm:px-6 pb-4 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 mt-auto">
          <button
            onClick={() => setStep(2)}
            className={`w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg flex items-center justify-center sm:justify-start transition-colors ${
              editingContent
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
            }`}
            disabled={isSaving || editingContent}
            title={editingContent ? "Zakończ edycję treści, aby przejść do spisu treści" : ""}
          >
            <ChevronLeft size={16} className="mr-1" />
            Spis treści
          </button>

          <button
            onClick={() => setStep(4)}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg flex items-center justify-center transition-all duration-200 ${
              editingContent
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md cursor-pointer'
            }`}
            disabled={isSaving || editingContent}
            title={editingContent ? "Zakończ edycję treści, aby przejść do grafik i okładki" : ""}
          >
            <Image size={16} className="mr-2" />
            Grafiki i okładka
          </button>
        </div>

        <style jsx global>{`
          .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>
    );
  };

  // ZMODYFIKOWANY renderStep4 z okładką jako pierwszą grafiką
  const renderStep4 = () => {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-300">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Grafiki i okładka ebooka</h2>
              <p className="text-2xl text-white mt-1 font-bold max-w-2xl">
                {title}
              </p>
              {subtitle && (
                <p className="text-blue-200 mt-1 font-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="p-4 md:p-6">

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-gray-800 flex items-center">
                <FileText size={16} className="mr-2 text-blue-500" />
                Grafiki ({tocItems.filter(item => item.image_url).length + (coverData?.cover_url ? 1 : 0)}/{tocItems.length + 1})
              </div>

              <div className="bg-blue-50 px-3 py-1 rounded-full text-xs text-blue-700">
                {Math.round(((tocItems.filter(item => item.image_url).length + (coverData?.cover_url ? 1 : 0)) / (tocItems.length + 1)) * 100)}% ukończono
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((tocItems.filter(item => item.image_url).length + (coverData?.cover_url ? 1 : 0)) / (tocItems.length + 1)) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* OKŁADKA JAKO PIERWSZY ELEMENT Z WYRÓŻNIENIEM */}
            <div className="border-2 border-dashed border-gray-400 rounded-lg shadow-sm bg-gray-100 overflow-hidden h-full flex flex-col">
              <div className="bg-gray-200 p-3 border-b border-gray-300 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    📖 OKŁADKA
                  </span>

                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    coverData?.cover_url
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-300 text-gray-700'
                  }`}>
                    {coverData?.cover_url
                      ? 'Gotowa ✓'
                      : 'Brak okładki'}
                  </span>
                </div>

                <div className="border-t border-gray-300 mb-2"></div>

                <div className="flex items-baseline">
                  <div className="mr-2 min-w-6 h-6 w-6 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm text-xs flex-shrink-0" style={{transform: 'translateY(-1px)'}}>
                    📖
                  </div>
                  <h3 className="font-medium text-gray-800 text-sm break-words">Okładka e-booka</h3>
                </div>
              </div>

              <div className="p-3 flex-grow flex flex-col bg-gray-50">
                <div className="w-full aspect-square bg-gray-200 rounded-lg flex items-center justify-center mb-3 border border-dashed border-gray-400 overflow-hidden">
                  {coverData?.cover_url && coverData.cover_url.trim() ? (
                    <img
                      key={`cover-${imageRefreshTimestamp}`}
                      src={coverData.cover_url}
                      alt="Okładka ebooka"
                      className="object-cover w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        console.log('Kliknięto okładkę, URL:', coverData.cover_url);
                        handleImagePreview(coverData.cover_url);
                      }}
                      onLoad={() => console.log('✅ Okładka załadowana pomyślnie:', coverData.cover_url)}
                      onError={(e) => {
                        console.error('❌ Błąd ładowania okładki:', coverData.cover_url);
                        setTimeout(() => fetchCoverStatus(), 2000);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                      <Palette size={32} className="text-gray-400 mb-2" />
                      <p>Brak okładki</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 mt-auto">
                  <button
                    onClick={() => generateCover(true, false)}
                    disabled={isGeneratingCover || isGeneratingAllImages || uploadingCoverImage}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center text-sm ${
                      isGeneratingCover || isGeneratingAllImages || uploadingCoverImage
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                    }`}
                  >
                    {isGeneratingCover ? (
                      <>
                        <Loader size={14} className="animate-spin mr-1.5" />
                        <span className="truncate">Generowanie...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="mr-1.5 flex-shrink-0" />
                        <span className="truncate">{coverData?.cover_url ? 'Regeneruj' : 'Generuj z AI'}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleOpenCoverFileDialog}
                    disabled={isGeneratingCover || isGeneratingAllImages || uploadingCoverImage}
                    className={`px-3 py-2 border border-gray-300 rounded-lg transition-colors flex items-center justify-center text-sm ${
                      isGeneratingCover || isGeneratingAllImages || uploadingCoverImage
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    {uploadingCoverImage ? (
                      <>
                        <Loader size={14} className="animate-spin mr-1.5" />
                        <span className="truncate">Przesyłanie...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} className="mr-1.5 flex-shrink-0" />
                        <span className="truncate">{coverData?.cover_url ? 'Zmień' : 'Dodaj z dysku'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* GRAFIKI ROZDZIAŁÓW */}
            {tocItems.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <BookOpen size={36} className="text-gray-400 mb-2" />
                <p>Brak rozdziałów. Wróć do kroku 2, aby dodać rozdziały.</p>
              </div>
            ) : (
              tocItems.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden h-full flex flex-col"
                >
                  <div className="bg-gray-50 p-3 border-b border-gray-200 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      {(completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Treść ✓
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Brak treści
                        </span>
                      )}

                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.image_url
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {item.image_url
                          ? 'Grafika ✓'
                          : 'Brak grafiki'}
                      </span>
                    </div>

                    <div className="border-t border-gray-200 mb-2"></div>

                    <div className="flex items-baseline">
                      <div className="mr-2 min-w-6 h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm text-xs flex-shrink-0" style={{transform: 'translateY(-1px)'}}>
                        {index + 1}
                      </div>
                      <h3 className="font-medium text-gray-800 text-sm break-words">{item.title}</h3>
                    </div>
                  </div>

                  <div className="p-3 flex-grow flex flex-col">
                    <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center mb-3 border border-dashed border-gray-300 overflow-hidden">
                      {item.image_url ? (
                        <img
                          key={`${item.id}-${imageRefreshTimestamp}`}
                          src={item.image_url}
                          alt={`Ilustracja do rozdziału: ${item.title}`}
                          className="object-cover w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => handleImagePreview(item.image_url)}
                          onLoad={() => console.log(`✅ Obrazek załadowany: ${item.title}`)}
                          onError={(e) => {
                            console.error(`❌ Błąd ładowania obrazka dla ${item.title}:`, item.image_url);
                            setTimeout(() => refreshImagesStatus(), 2000);
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                          <Image size={32} className="text-gray-300 mb-2" />
                          <p>Brak grafiki</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mt-auto">
                      <button
                        onClick={() => handleOpenFileDialog(item.id)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center text-sm cursor-pointer"
                        disabled={(isSaving && uploadingImageForChapter === item.id) || isGeneratingAllImages || uploadingCoverImage}
                      >
                        {isSaving && uploadingImageForChapter === item.id ? (
                          <>
                            <Loader size={14} className="animate-spin mr-1.5" />
                            <span className="truncate">Przesyłanie...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} className="mr-1.5 flex-shrink-0" />
                            <span className="truncate">{item.image_url ? 'Zmień' : 'Dodaj'}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleGenerateAIImage(item.id, !!item.image_url)}
                        disabled={
                          !((completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)))
                          || isSaving || generatingAIImageForChapter === item.id || isGeneratingAllImages || uploadingCoverImage
                        }
                        className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center text-sm ${
                          !((completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)))
                          || isSaving || generatingAIImageForChapter === item.id || isGeneratingAllImages || uploadingCoverImage
                            ? 'bg-gray-400 text-white cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                        }`}
                      >
                          {generatingAIImageForChapter === item.id ? (
                            <>
                              <Loader size={14} className="animate-spin mr-1.5 flex-shrink-0" />
                              <span className="truncate">Generowanie...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} className="mr-1.5 flex-shrink-0" />
                              <span className="truncate">Generuj z AI</span>
                            </>
                          )}
                      </button>
                    </div>

                    {aiImageGenerationError && generatingAIImageForChapter === item.id && (
                      <div className="mt-2 text-xs text-red-600 bg-red-50 p-1.5 rounded-md">
                        <AlertCircle size={12} className="inline-block mr-1" />
                        <span className="line-clamp-2">{aiImageGenerationError}</span>
                      </div>
                    )}

                    {!((completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0))) && (
                      <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-1.5 rounded-md">
                        <AlertCircle size={12} className="inline-block mr-1" />
                        <span className="line-clamp-2">Najpierw dodaj treść rozdziału</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

            {isGeneratingAllImages && (
              <div className="mt-2 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200 animate-fadeIn">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-blue-800 flex items-center">
                    <Loader size={16} className="mr-2 animate-spin text-blue-600" />
                    Generowanie grafik
                  </h3>
                  <span className="text-sm text-blue-600 font-medium">
                    {generatedImagesCount}/{totalImagesToGenerate}
                  </span>
                </div>

                <div className="w-full bg-white rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(generatedImagesCount / totalImagesToGenerate) * 100}%` }}
                  ></div>
                </div>

                <p className="text-xs text-blue-700 mt-2 truncate">
                  {generatingAIImageForChapter &&
                    `Aktualnie generowana: grafika dla rozdziału "${
                      tocItems.find(item => item.id === generatingAIImageForChapter)?.title || 'nieznany'
                    }"`
                  }
                </p>
              </div>
            )}

          <div className="mt-6 border-t border-gray-200 pt-4 px-4 sm:px-6 pb-4 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <button
              onClick={() => setStep(3)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center sm:justify-start cursor-pointer"
              disabled={isSaving || isGeneratingAllImages || isGeneratingCover || uploadingCoverImage}
            >
              <ChevronLeft size={16} className="mr-1" />
              Treść
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <button
                onClick={handleGenerateAllImages}
                disabled={isGeneratingAllImages || isSaving || isGeneratingCover || uploadingCoverImage || !tocItems.some(item =>
                  (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) && !item.image_url
                )}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-lg flex items-center justify-center ${
                  isGeneratingAllImages || isSaving || isGeneratingCover || uploadingCoverImage || !tocItems.some(item =>
                    (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) && !item.image_url
                  )
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md cursor-pointer'
                } transition-all duration-200`}
              >
                {isGeneratingAllImages ? (
                  <>
                    <Loader size={16} className="mr-2 animate-spin" />
                    {`Generowanie (${generatedImagesCount}/${totalImagesToGenerate})`}
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="mr-2" />
                    Wygeneruj brakujące grafiki
                  </>
                )}
              </button>

              <button
                onClick={handleExportEbook}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-white flex items-center justify-center bg-green-600 hover:bg-green-700 hover:shadow-md transition-all duration-200 cursor-pointer"
                disabled={isSaving || isGeneratingAllImages || isGeneratingCover || uploadingCoverImage}
              >
                {isSaving ? (
                  <>
                    <Loader size={16} className="mr-2 animate-spin" />
                    Eksportowanie...
                  </>
                ) : (
                  <>
                    <Download size={16} className="mr-2" />
                    Pobierz jako PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-gray-200">
        <div className="flex items-center">
          <BookOpen size={24} className="text-blue-600 mr-2" />
          <p className="text-gray-800 text-xl font-semibold">Generator E-booków AI</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-sm flex items-start animate-fadeIn">
          <AlertCircle className="mr-3 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <div className="font-medium mb-1">Wystąpił błąd</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex justify-between relative mb-2">
          <div className="absolute left-5 right-5 top-5 h-1 -translate-y-1/2 bg-gray-200"></div>

          <div
            className="absolute left-5 top-5 h-1 -translate-y-1/2 bg-blue-600 transition-all duration-700"
            style={{
              width: step === 1 ? '0%' :
                    step === 2 ? '33%' :
                    step === 3 ? '66%' :
                    '95%'
            }}
          ></div>

          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium z-10 transition-all duration-300 ${
              step >= 1 ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-gray-200 text-gray-500'
            } ${tocGenerated ? 'cursor-pointer' : ''}`}
            onClick={() => tocGenerated && setStep(1)}
            title={tocGenerated ? "Edytuj dane" : ""}
          >
            1
          </div>

          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium z-10 transition-all duration-300 ${
              step >= 2
                ? `bg-blue-600 text-white ring-4 ring-blue-100 ${tocGenerated && step !== 2 ? 'cursor-pointer' : ''}`
                : 'bg-gray-200 text-gray-500'
            }`}
            onClick={() => tocGenerated && step !== 2 && setStep(2)}
            title={tocGenerated && step !== 2 ? "Edytuj spis treści" : ""}
          >
            2
          </div>

          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium z-10 transition-all duration-300 ${
              step >= 3
                ? `bg-blue-600 text-white ring-4 ring-blue-100 ${contentGenerated && step !== 3 ? 'cursor-pointer' : ''}`
                : 'bg-gray-200 text-gray-500'
            }`}
            onClick={() => {
              if (contentGenerated && step !== 3) {
                syncChapterStatus();
                setStep(3);
              }
            }}
            title={contentGenerated && step !== 3 ? "Przeglądaj treść" : ""}
          >
            3
          </div>

          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium z-10 transition-all duration-300 ${
              step >= 4
                ? `bg-blue-600 text-white ring-4 ring-blue-100 ${graphicsAdded && step !== 4 ? 'cursor-pointer' : ''}`
                : 'bg-gray-200 text-gray-500'
            }`}
            onClick={() => contentGenerated && step !== 4 && setStep(4)}
            title={contentGenerated && step !== 4 ? "Grafiki i okładka" : ""}
          >
            4
          </div>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <div className="w-20 text-center -ml-5">Dane</div>
          <div className="w-20 text-center">Rozdziały</div>
          <div className="w-20 text-center">Treść</div>
          <div className="w-20 text-center -mr-5">Grafiki</div>
        </div>
      </div>

      {step === 1
        ? renderStep1()
        : step === 2
          ? renderStep2()
          : step === 3
            ? renderStep3()
            : renderStep4()}

      {showRegeneratePopup && renderRegeneratePopup()}
      {showChapterRegeneratePopup && renderChapterRegeneratePopup()}
      {/* NOWY MODAL - testowy */}
      <SourcePreviewModal
        isVisible={sourcePreviewModal.isVisible}
        sourceType={sourcePreviewModal.sourceType || 'web'}
        content={sourcePreviewModal.content}
        status={sourcePreviewModal.status || 'success'}
        errorDetails={sourcePreviewModal.errorDetails}
        onAccept={handleSourceAccept}
        onReject={handleSourceReject}
      />

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm cursor-pointer"
          onClick={handleClosePreview}
        >
          <div
            className="relative bg-white rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '95vw',
              maxHeight: '95vh',
              padding: '4px'
            }}
          >
            <img
              src={previewImage}
              alt="Podgląd obrazu"
              className="block rounded-2xl"
              style={{
                maxWidth: 'calc(95vw - 8px)',
                maxHeight: 'calc(95vh - 8px)',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
            <button
              onClick={handleClosePreview}
              className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors cursor-pointer z-10"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {showPromptPreview && (
        <PromptPreviewModal
          chapterId={showPromptPreview}
          onClose={() => setShowPromptPreview(null)}
        />
      )}
      <style jsx global>{`
        button:not(:disabled),
        .cursor-pointer,
        .hover\\:bg-gray-50:not(:disabled),
        .hover\\:bg-blue-50:not(:disabled),
        .hover\\:bg-blue-700:not(:disabled),
        .hover\\:bg-red-50:not(:disabled),
        .hover\\:bg-red-100:not(:disabled),
        .hover\\:bg-green-50:not(:disabled),
        .hover\\:bg-green-100:not(:disabled),
        .hover\\:text-blue-600:not(:disabled),
        .hover\\:text-red-600:not(:disabled),
        .hover\\:text-green-600:not(:disabled),
        .hover\\:scale-105:not(:disabled),
        .hover\\:shadow-md:not(:disabled),
        .hover\\:shadow-lg:not(:disabled),
        input[type="checkbox"],
        input[type="radio"],
        label[for] {
          cursor: pointer;
        }

        button:disabled,
        .cursor-not-allowed,
        input:disabled,
        textarea:disabled {
          cursor: not-allowed;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background-color: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #c1c1c1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #a1a1a1;
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-in-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .prose {
          line-height: 1.7;
        }
        .prose p {
          margin-bottom: 1rem;
        }
        .prose h1, .prose h2, .prose h3, .prose h4 {
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          font-weight: 600;
          color: #333;
        }
      `}</style>

    </div>
  );
};

export default EbookGenerator;