// src/components/ebooks/EbookGeneratorModal.tsx

"use client"
import React, { useState, useRef, useEffect } from 'react';
import SourcePreviewModal from '@/components/ebooks/SourcePreviewModal';
import {
  BookOpen, Edit, Search, Plus, ArrowUp, ArrowDown,
  X, Check, AlertCircle, Loader, ChevronLeft, Save,
  FileText, BookMarked, Sparkles, MoreVertical, Download,
  ChevronRight, Upload, Image, Palette, Eye
} from 'lucide-react';

// Interface for table of contents items, extended with content and image
interface TocItem {
  id: string;
  title: string;
  content?: string;
  position?: number;
  image_url?: string;
}

// Interface for content scraped from URLs
interface ScrapedContent {
  url: string;
  title: string;
  content: string;
}

// Interface for cover status
interface CoverStatus {
  prompt_ready: boolean;
  image_ready: boolean;
  complete: boolean;
}

// Interface for cover data
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

interface EbookGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEbookCreated?: () => void;
  ebookId?: number | null;
}

// Main component for the ebook generator
export default function EbookGeneratorModal({ isOpen, onClose, onEbookCreated, ebookId }: EbookGeneratorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Modal Header with close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-800">Create your ebook with AI</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content - scrollable */}
        <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
          <EbookGeneratorContent isOpen={isOpen} ebookId={ebookId} onEbookCreated={onEbookCreated} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

function EbookGeneratorContent({ isOpen, ebookId, onEbookCreated, onClose }: { isOpen: boolean, ebookId?: number | null, onEbookCreated?: () => void, onClose: () => void }) {
  const [isSavingDraft, setIsSavingDraft] = useState(false); // ✅ NOWY STAN
  const draftSavedByUser = useRef(false); // ✅ NOWA REFERENCJA
  const [originalScrapedContent, setOriginalScrapedContent] = useState<ScrapedContent[]>([]);
  const initialized = useRef(false);
  const wasSuccessfullyCompleted = useRef(false);
  const isNewEbookSession = useRef(!ebookId);
  const [isInitializing, setIsInitializing] = useState(false);
  const [sourcePreviewModal, setSourcePreviewModal] = useState({
      isVisible: false,
      sourceType: null as 'web' | 'pdf' | null,
      content: null as ScrapedContent | null,
      status: null as 'success' | 'error' | 'empty' | null,
      errorDetails: ''
  });
  // NEW STATES for PDF upload
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    // NEW STATES for single URL scraping
  const [pendingUrl, setPendingUrl] = useState('');
  const [isScrapingSingleUrl, setIsScrapingSingleUrl] = useState(false);
  // Existing application states
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

  // NEW STATES for additional functionalities
  const [description, setDescription] = useState('');
  const [urlInputs, setUrlInputs] = useState<string[]>(['']);
  const [isScrapingUrls, setIsScrapingUrls] = useState(false);
  const [scrapedContent, setScrapedContent] = useState<ScrapedContent[]>([]);

  // Other existing states
  const [currentEbookId, setCurrentEbookId] = useState<number | null>(null);
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

  // STATES for cover (moved from step 5)
  const [coverData, setCoverData] = useState<EbookCoverData | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [showCoverPrompt, setShowCoverPrompt] = useState(false);
  const [coverGenerated, setCoverGenerated] = useState(false);

  // ✅ NEW STATE for cache-busting
  const [imageRefreshTimestamp, setImageRefreshTimestamp] = useState(0);

  // Element references
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const editItemInputRef = useRef<HTMLInputElement>(null);
  const contentEditRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // NOWA FUNKCJA POMOCNICZA
  const areSourcesEqual = (sourcesA: ScrapedContent[], sourcesB: ScrapedContent[]): boolean => {
    if (sourcesA.length !== sourcesB.length) {
      return false;
    }

    if (sourcesA.length === 0 && sourcesB.length === 0) {
      return true;
    }

    // Tworzymy "mapę" źródeł z B dla szybkiego dostępu, używając URL jako unikalnego klucza
    const sourcesBMap = new Map(sourcesB.map(item => [item.url, item]));

    // Sprawdzamy, czy każdy element z A istnieje w B i czy ma te same kluczowe dane
    for (const itemA of sourcesA) {
      const itemB = sourcesBMap.get(itemA.url);
      if (!itemB) {
        return false; // Nie znaleziono odpowiednika
      }

      // Porównujemy tylko kluczowe, niezmienne pola
      if (itemA.title !== itemB.title || itemA.content !== itemB.content) {
        return false;
      }
    }

    return true;
  };


  // =================================================================
  // NEW, CENTRAL LOGIC - LOADING FOR EDIT / CREATING FOR NEW
  // =================================================================
  useEffect(() => {
    const resetState = () => {
      console.log('🔄 Resetting state...');
      draftSavedByUser.current = false; // ✅ ZRESETUJ FLAGĘ
      setOriginalScrapedContent([]);
      setStep(1);
      setTitle('');
      setSubtitle('');
      setDescription('');
      setUrlInputs(['']);
      setScrapedContent([]);
      setTocItems([]);
      setCurrentEbookId(null);
      setError(null);
      setTocGenerated(false);
      setContentGenerated(false);
      setGraphicsAdded(false);
      setCoverData(null);
      setCoverGenerated(false);
      setOriginalTitle('');
      setOriginalSubtitle('');
      setOriginalDescription('');
    };

    const loadEbookForEditing = async (id: number) => {
      console.log(`🚀 Wczytywanie danych do edycji dla ebooka o ID: ${id}`);
      try {
        const response = await fetch(`/api/ebooks?id=${id}`);
        if (!response.ok) {
          throw new Error('Nie udało się pobrać danych ebooka do edycji.');
        }
        const data = await response.json();
        console.log('✅ Otrzymano dane podstawowe z API:', data);

        // Ustawienie stanu dla danych podstawowych
        setTitle(data.title || '');
        setSubtitle(data.subtitle || '');
        setDescription(data.description || '');
        setCurrentEbookId(data.id);
        setOriginalTitle(data.title || '');
        setOriginalSubtitle(data.subtitle || '');
        setOriginalDescription(data.description || '');

        if (data.chapters && data.chapters.length > 0) {
          const chapters = data.chapters as TocItem[];
          setTocItems(chapters);
          setTocGenerated(true);

          // ✅ POPRAWKA: Sprawdź, czy wczytane rozdziały mają treść i ustaw flagę
          const hasContent = chapters.some(ch => ch.content && ch.content.trim() !== '');
          if (hasContent) {
            setContentGenerated(true);
            console.log('📖 Wykryto istniejącą treść, ustawiono contentGenerated=true');
          }
        }
        setStep(1);

        try {
          console.log(`📚 Pobieranie źródeł dla ebooka o ID: ${id}...`);
          const sourcesResponse = await fetch(`/api/ebooks/${id}/sources`);
          if (sourcesResponse.ok) {
            const sourcesData = await sourcesResponse.json();
            if (sourcesData.success && Array.isArray(sourcesData.sources)) {
              console.log(`✅ Pomyślnie pobrano ${sourcesData.sources.length} źródeł.`);
              setScrapedContent(sourcesData.sources);
              // ✅ POPRAWKA: Zapisz oryginalny stan źródeł do porównań
              setOriginalScrapedContent(sourcesData.sources);
            }
          } else {
            console.warn(`⚠️ Nie udało się pobrać źródeł (status: ${sourcesResponse.status}).`);
          }
        } catch (sourceErr) {
          console.error("❌ Błąd podczas pobierania źródeł (niekrytyczny):", sourceErr);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Wystąpił nieznany błąd');
        resetState();
      }
    };

    const createNewEbookEntry = async () => {
        console.log('🚀 Creating new ebook entry in the database...');
        setIsInitializing(true);
        try {
            const response = await fetch('/api/ebooks', {
                method: 'POST',
                headers: getUserHeaders(),
                body: JSON.stringify({
                    title: "Nowy Ebook (roboczy)",
                    status: "draft",
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create a new ebook entry.');
            }
            const data = await response.json();
            if (data.success && data.ebookId) {
                console.log(`✅ New ebook created with ID: ${data.ebookId}`);
                setCurrentEbookId(data.ebookId);
            } else {
                throw new Error('Invalid response from the ebook creation API.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not initialize a new ebook.');
        } finally {
            setIsInitializing(false);
        }
    };

    if (isOpen) {
      if (!initialized.current) {
        initialized.current = true;
        console.log('✨ Modal opened, initializing...');
        resetState();
        if (ebookId) {
          loadEbookForEditing(ebookId);
        } else {
          createNewEbookEntry();
        }
      }
    } else {
      initialized.current = false;
      console.log('🚪 Modal closed, reset initialization flag.');
    }
  }, [isOpen, ebookId]);

  const cleanupStateRef = useRef<any>(null);
  useEffect(() => {
    // Ten efekt uruchamia się przy każdym renderowaniu, aby ref zawsze miał świeże dane
    cleanupStateRef.current = {
      isNewEbookSession: isNewEbookSession.current,
      wasSuccessfullyCompleted: wasSuccessfullyCompleted.current,
      draftSavedByUser: draftSavedByUser.current, // ✅ DODAJ FLAGĘ
      currentEbookId,
      title,
      subtitle,
      description,
      scrapedContent,
      tocGenerated
    };
  });

  useEffect(() => {
    // Ten efekt uruchamia się tylko raz (przy montowaniu), a jego funkcja zwrotna
    // wykona się przy zamykaniu modala (odmontowaniu).
    return () => {
      const state = cleanupStateRef.current; // Pobieramy najnowszy stan z refa

      if (state.isNewEbookSession && !state.wasSuccessfullyCompleted && state.currentEbookId) {

        // Warunek usunięcia: tytuł jest wciąż domyślny ("Nowy Ebook (roboczy)") lub pusty
        const isDefaultTitle = !state.title || state.title === "Nowy Ebook (roboczy)";
        const hasNoMeaningfulData = !state.subtitle && !state.description && state.scrapedContent.length === 0;
        const tocWasNotGenerated = !state.tocGenerated;

        if (isDefaultTitle && hasNoMeaningfulData && tocWasNotGenerated) {
          console.log(`🗑️ Usuwanie nieużywanego szkicu ebooka (ID: ${state.currentEbookId})...`);

          fetch(`/api/ebooks/${state.currentEbookId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          }).catch(err => {
            console.error("Błąd podczas usuwania nieużywanego szkicu ebooka:", err);
          });
        }
      }
    };
  }, []);

  // Existing useEffects
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

  // useEffect for fetching cover data in step 4
  useEffect(() => {
    if (currentEbookId && step === 4) {
      // ✅ DEFENSIVE fetching of cover status
      const loadCoverStatus = async () => {
        try {
          await fetchCoverStatus();
        } catch (error) {
          console.warn('⚠️ Failed to fetch cover status upon entering step 4:', error);
          // Do not show error to the user - this is normal on first entry
        }
      };

      loadCoverStatus();

      // Refresh every 5 seconds if cover is being generated
      const interval = setInterval(() => {
        if (isGeneratingCover) {
          loadCoverStatus();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [currentEbookId, step, isGeneratingCover]);

  // ✅ FIXED fetchCoverStatus FUNCTION
  const fetchCoverStatus = async () => {
    if (!currentEbookId) return;

    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/ebooks/${currentEbookId}/generate-cover-complete?_t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      // ✅ HANDLE CASE WHERE COVER DOES NOT YET EXIST
      if (response.status === 404) {
        console.log('📋 Cover has not been generated yet');
        // Set empty cover state
        setCoverData({
          ebook_id: currentEbookId,
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
        // If it's not a 404, but another error, check if it's HTML
        const errorText = await response.text();
        if (errorText.trim().startsWith('<')) {
          console.warn('⚠️ Received HTML page instead of JSON - likely a server error');
          return; // Do not show error to the user
        }
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();
      console.log('📥 Fetched cover data from API:', data);

      // Mapping data from the API
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

      // ✅ SIMPLIFIED URL logic - always add timestamp if URL exists
      if (mappedData.cover_url) {
        const baseUrl = mappedData.cover_url.split('?')[0]; // Remove existing parameters
        mappedData.cover_url = `${baseUrl}?t=${timestamp}`;
        console.log('🔄 Cover URL with cache-bust:', mappedData.cover_url);
      }

      setCoverData(mappedData);

      if (mappedData.cover_status.complete && mappedData.cover_url) {
        setCoverGenerated(true);
        console.log('✅ Cover marked as ready');
      }

    } catch (err: any) {
      console.warn('⚠️ Problem fetching cover status:', err.message);
      // Do not set error for the user - the cover simply doesn't exist yet

      // Set default cover state
      if (!coverData) {
        setCoverData({
          ebook_id: currentEbookId,
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

  // ✅ FIXED generateCover FUNCTION
  const generateCover = async (forceRegenerate = false, generatePdf = false) => {
    if (!currentEbookId) {
      setError('Missing ebook identifier');
      return false;
    }

    setIsGeneratingCover(true);
    setError(null);
    console.log('🎨 Starting cover generation...', { forceRegenerate, generatePdf });

    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/generate-cover-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forceRegenerate,
          generatePdf
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API response error:', response.status, errorText);

        // Check if it's HTML (server error)
        if (errorText.trim().startsWith('<')) {
          throw new Error('Server error - received HTML page instead of JSON');
        }

        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || errorData.message || 'Error generating cover');
        } catch (parseError) {
          throw new Error(`Server error (${response.status}): ${errorText.substring(0, 100)}...`);
        }
      }

      const data = await response.json();
      console.log('📥 Response from cover generation API:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Error generating cover');
      }

      console.log('✅ Cover generated successfully');

      // ✅ SHORTER delay and one-time refresh
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create a new timestamp for cache-bust
      setImageRefreshTimestamp(Date.now());

      // Refresh cover status
      await fetchCoverStatus();

      setCoverGenerated(true);
      console.log('🔄 Cover status refreshed');

      return true;

    } catch (err: any) {
      console.error('❌ Error generating cover:', err);
      setError(err.message);
      return false;
    } finally {
      setIsGeneratingCover(false);
    }
  };
    // NEW FUNCTION for fetching content from a single URL
    const scrapeSingleUrl = async (url: string) => {
      if (!url.trim()) return;

      try {
        new URL(url); // URL validation
      } catch {
        setError('Invalid URL format');
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
          throw new Error('Error fetching content from the link');
        }

        const data = await response.json();

       // ALWAYS show the modal - regardless of the result
        if (data.scrapedContent && data.scrapedContent.length > 0) {
          // Success with content
          showSourcePreview('web', data.scrapedContent[0], 'success');
        } else if (data.errors && data.errors.length > 0) {
          // Scraping error
          const errorContent = {
            url: url,
            title: 'Scraping error',
            content: ''
          };
          showSourcePreview('web', errorContent, 'error', data.errors[0].error || 'Unknown error');
        } else {
          // Empty content
          const emptyContent = {
            url: url,
            title: 'No content',
            content: ''
          };
          showSourcePreview('web', emptyContent, 'empty', 'No content found on this page or the content is too short');
        }

      } catch (err) {
          console.error('Error scraping single URL:', err);

          // Show modal with an error
          const errorContent = {
            url: url,
            title: 'Connection error',
            content: ''
          };
          showSourcePreview('web', errorContent, 'error', err instanceof Error ? err.message : 'Failed to connect to the server');
        } finally {
        setIsScrapingSingleUrl(false);
      }
    };

    // Zaktualizuj interfejs ScrapedContent, aby zawierał opcjonalne ID
    interface ScrapedContent {
      id?: number; // Opcjonalne ID z bazy danych
      url: string;
      title: string;
      content: string;
      source?: string;
      metadata?: any;
    }

    // FUNCTION to remove a source from the list
    const handleRemoveScrapedContent = async (sourceToRemove: ScrapedContent) => {
      // Logika dla źródła, które nie jest jeszcze w bazie
      if (!currentEbookId || !sourceToRemove.id) {
        const newSources = scrapedContent.filter(item => item.url !== sourceToRemove.url);
        setScrapedContent(newSources);
        console.log('🗑️ Usunięto źródło ze stanu lokalnego (nie było w bazie):', sourceToRemove.url);
        return;
      }

      // Logika dla źródła, które jest w bazie
      try {
        const response = await fetch(`/api/ebooks/${currentEbookId}/sources`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceId: sourceToRemove.id
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Nie udało się usunąć źródła z bazy danych.');
        }

        const newSources = scrapedContent.filter(item => item.id !== sourceToRemove.id);
        setScrapedContent(newSources);
        console.log('🗑️ Pomyślnie usunięto źródło z bazy i stanu:', sourceToRemove.url);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Wystąpił nieznany błąd podczas usuwania źródła.');
      }
    };


  // NEW FUNCTIONS for PDF upload
    const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // File validation
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('The selected file is not a PDF file');
        return;
      }

      // Check size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('The PDF file is too large. The maximum size is 10MB');
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
          // Success - show preview
          if (data.scrapedContent && data.scrapedContent.length > 0) {
            showSourcePreview('pdf', data.scrapedContent[0], 'success');
          } else {
            const errorContent = {
              url: file.name,
              title: 'Extraction error',
              content: ''
            };
            showSourcePreview('pdf', errorContent, 'error', 'Failed to extract text from PDF');
          }
        } else {
          // Error
          const errorContent = {
            url: file.name,
            title: 'Processing error',
            content: ''
          };
          showSourcePreview('pdf', errorContent, 'error', data.error || 'Unknown error while processing PDF');
        }

      } catch (err) {
          console.error('Error uploading PDF:', err);

          const errorContent = {
            url: file.name,
            title: 'Connection error',
            content: ''
          };
          showSourcePreview('pdf', errorContent, 'error', 'Error connecting to the server');
      } finally {
        setIsUploadingPdf(false);
        // Clear input
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

    const handleSourceAccept = async (content: ScrapedContent) => {
      console.log('%c--- ROZPOCZYNAM ZAPIS ŹRÓDŁA ---', 'color: blue; font-weight: bold;');

      if (!currentEbookId) {
        setError("Nie można zapisać źródła. Brak ID ebooka.");
        handleSourceReject();
        return;
      }

      try {
        const response = await fetch(`/api/ebooks/${currentEbookId}/sources`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceType: sourcePreviewModal.sourceType === 'pdf' ? 'PDF' : 'WEB',
            url: content.url,
            title: content.title,
            content: content.content,
            sourceLabel: content.source,
            metadata: content.metadata,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Nie udało się zapisać źródła w bazie danych.');
        }

        const newSources = [...scrapedContent, data.source];
        setScrapedContent(newSources);

        const urlIndex = urlInputs.findIndex(url => url === content.url);
        if (urlIndex !== -1) {
          const updatedUrls = [...urlInputs];
          updatedUrls[urlIndex] = '';
          if (updatedUrls.length > 1 && updatedUrls.every(u => u === '')) {
             setUrlInputs(['']);
          } else if (updatedUrls.length > 1) {
             const finalUrls = updatedUrls.filter((u, i) => u !== '' || i === urlIndex);
             setUrlInputs(finalUrls.length > 0 ? finalUrls : ['']);
          } else {
             setUrlInputs(updatedUrls);
          }
        }

        setSourcePreviewModal({
          isVisible: false,
          sourceType: null,
          content: null,
          status: null,
          errorDetails: ''
        });

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Wystąpił nieznany błąd podczas zapisywania źródła.');
        handleSourceReject();
      }
    };

    const handleSourceReject = () => {
      // Clear the URL input if it was a web scrape
      if (sourcePreviewModal.sourceType === 'web' && sourcePreviewModal.content) {
        const urlIndex = urlInputs.findIndex(url => url === sourcePreviewModal.content!.url);
        if (urlIndex !== -1) {
          const newUrls = [...urlInputs];
          newUrls[urlIndex] = '';
          setUrlInputs(newUrls);
        }
      }

      // Close the modal
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

  // NEW FUNCTIONS for handling URLs
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

    // Remove corresponding content from scrapedContent if it exists
    const urlToRemove = urlInputs[index];
    if (urlToRemove) {
      const sourceObjectToRemove = scrapedContent.find(item => item.url === urlToRemove);
      if (sourceObjectToRemove) {
        handleRemoveScrapedContent(sourceObjectToRemove);
      }
    }
  };

  // NEW FUNCTION for fetching content from URLs
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
        throw new Error('Error fetching content from links');
      }

      const data = await response.json();
      setScrapedContent(prev => [...prev, ...(data.scrapedContent || [])]);
      return data.scrapedContent || [];
    } catch (err) {
      console.error('Error scraping URLs:', err);
      setError('Failed to fetch content from some links. Continuing without them.');
      return [];
    } finally {
      setIsScrapingUrls(false);
    }
  };

  // ✅ FIXED refreshImagesStatus FUNCTION
  const refreshImagesStatus = async () => {
    if (!currentEbookId) return;

    console.log('🔄 Refreshing graphics status...');

    try {
      const timestamp = Date.now();
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters?_t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...getUserHeaders()
        }
      });

      if (!response.ok) {
        throw new Error('Error fetching chapters');
      }

      const data = await response.json();
      if (!data.chapters || !Array.isArray(data.chapters)) {
        console.warn('Invalid chapter data:', data);
        return;
      }

      console.log(`📊 Fetched ${data.chapters.length} chapters from the server`);

      // ✅ IMPROVED state update
      setTocItems(currentTocItems => {
        const updatedItems = currentTocItems.map(item => {
          const serverChapter = data.chapters.find((ch: any) => ch.id.toString() === item.id);

          if (serverChapter && serverChapter.image_url) {
            const baseUrl = serverChapter.image_url.split('?')[0];
            const newImageUrl = `${baseUrl}?t=${timestamp}`;

            if (item.image_url !== newImageUrl) {
              console.log(`🔄 Refreshed graphic for "${item.title}": ${newImageUrl}`);
              return { ...item, image_url: newImageUrl };
            }
          }

          return item;
        });

        return updatedItems;
      });

      // Create a new timestamp to force a re-render
      setImageRefreshTimestamp(timestamp);
      console.log('✅ Graphics status refreshed');

    } catch (error) {
      console.error('❌ Error while refreshing graphics status:', error);
    }
  };

  // Existing helper functions
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

    console.log('🔄 Synchronizing chapter status:');
    console.log(`- Chapters with content (${chaptersWithContent.length}):`, chaptersWithContent);
    console.log(`- Chapters without content (${chaptersWithoutContentList.length}):`, chaptersWithoutContentList);

    setCompletedChapterIds(chaptersWithContent);
    setChaptersWithoutContent(chaptersWithoutContentList);

    const hasAnyContent = chaptersWithContent.length > 0;
    setContentGenerated(hasAnyContent);

    console.log(`✅ Status synchronized: contentGenerated=${hasAnyContent}`);
  };

  const changeStep = (newStep: number) => {
      const hasDescriptionChanged = description !== originalDescription;
      const hasUrlsChanged = JSON.stringify(urlInputs) !== JSON.stringify(originalUrlInputs);
      // ✅ POPRAWKA: Niezawodne porównywanie stanu źródeł
      const hasSourcesChanged = !areSourcesEqual(scrapedContent, originalScrapedContent);

      if (newStep === 2 && step === 1 && tocGenerated &&
         (title !== originalTitle ||
          subtitle !== originalSubtitle ||
          hasDescriptionChanged ||
          hasUrlsChanged ||
          hasSourcesChanged)) {
        setShowRegeneratePopup(true);
      }
    else if (newStep === 3 && step === 2) {
      console.log('🔄 Moving to step 3 - synchronizing chapter status...');
      syncChapterStatus();

      const chaptersWithNoContent = tocItems
        .filter(item => !item.content || item.content.trim() === '')
        .map(item => item.id);

      console.log(`📊 Found ${chaptersWithNoContent.length} chapters without content:`, chaptersWithNoContent);

      if (chaptersWithNoContent.length > 0) {
        if (!activeChapterId || !tocItems.find(item => item.id === activeChapterId)) {
          setActiveChapterId(chaptersWithNoContent[0]);
          console.log(`🎯 Set active chapter: ${chaptersWithNoContent[0]}`);
        }
      } else {
        if (!activeChapterId || !tocItems.find(item => item.id === activeChapterId)) {
          const firstChapterId = tocItems.length > 0 ? tocItems[0].id : null;
          setActiveChapterId(firstChapterId);
          console.log(`🎯 Set active chapter (first): ${firstChapterId}`);
        }
      }

      setStep(newStep);
      console.log('✅ Move to step 3 completed');
    }
    else if (newStep === 4 && step === 3) {
      console.log('🔄 Moving to step 4 - graphics and cover...');
      syncChapterStatus();
      setStep(newStep);

      // ✅ DEFENSIVE initialization of cover upon entering step 4
      if (currentEbookId && !coverData) {
        console.log('📋 Initializing default cover state (not yet generated)');
        // Set default cover state before it's fetched from the API
        setCoverData({
          ebook_id: currentEbookId,
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
      console.log('✅ Move to step 4 completed');
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
      setError('Please enter a title for the ebook');
      return;
    }

    if (!currentEbookId) {
        setError('Ebook ID is missing. Cannot proceed. Please try closing and reopening the modal.');
        return;
    }

    setError(null);
    setIsGeneratingToc(true);

    try {
      // Krok 1: Zawsze aktualizuj dane istniejącego ebooka
      console.log(`🔄 Updating ebook data for ID: ${currentEbookId}`);

      setTocItems([]);
      // Resetuj inne stany związane z rozdziałami
      setCompletedChapterIds([]);
      setContentGenerated(false);
      setGraphicsAdded(false);

      const updateEbookResponse = await fetch(`/api/ebooks/${currentEbookId}`, {
        method: 'PUT',
        headers: {
          ...getUserHeaders(),
        },
        body: JSON.stringify({
          title,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null
        }),
      });

      if (!updateEbookResponse.ok) {
        throw new Error('Error updating the ebook data');
      }

      // Usuń stare rozdziały, jeśli istnieją
      await fetch(`/api/ebooks/${currentEbookId}/chapters`, { method: 'DELETE' });
      console.log(`🗑️ Old chapters for ebook ID ${currentEbookId} deleted.`);

      // Krok 2: Generuj nowy spis treści
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
        let errorMessage = 'Error generating the table of contents';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Server error (${response.status})`;
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
        // Zatwierdź aktualny stan źródeł jako nowy stan "oryginalny"
        setOriginalScrapedContent(scrapedContent);

        // Krok 3: Zapisz nowe rozdziały w bazie
        const chaptersResponse = await fetch(`/api/ebooks/${currentEbookId}/chapters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapters: data.tocItems }),
        });

        if (chaptersResponse.ok) {
          const chaptersData = await chaptersResponse.json();
          const updatedTocItemsWithIds = data.tocItems.map((item: TocItem, index: number) => ({
            ...item,
            id: chaptersData.chapters[index].id.toString(),
            position: chaptersData.chapters[index].position
          }));
          setTocItems(updatedTocItemsWithIds);
        } else {
            console.warn('Failed to save new chapters to the database.');
        }

        setStep(2);
        setShowRegeneratePopup(false);
      } else {
        throw new Error('Received invalid data format');
      }
    } catch (err: any) {
      handleApiError(err, 'An error occurred while generating the table of contents. Please try again.');
    } finally {
      setIsGeneratingToc(false);
    }
  };

  const generateSingleChapterContent = async (chapterId: string) => {
    if (!currentEbookId) {
      setError('Missing ebook identifier');
      return;
    }

    const chapter = tocItems.find(item => item.id === chapterId);
    if (!chapter) {
      setError('Chapter not found');
      return;
    }

    setError(null);
    setIsGeneratingSingleChapter(true);

    try {
      // API call with additional context data
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
        let errorMessage = 'Error generating chapter content';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Server error (${response.status})`;
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

        // Better state management
        setCompletedChapterIds(prev => {
          const newCompleted = [...prev];
          if (!newCompleted.includes(chapterId)) {
            newCompleted.push(chapterId);
          }
          console.log(`✅ Added chapter ${chapterId} to completed:`, newCompleted);
          return newCompleted;
        });

        setChaptersWithoutContent(prev => {
          const filtered = prev.filter(id => id !== chapterId);
          console.log(`🗑️ Removed chapter ${chapterId} from chaptersWithoutContent:`, filtered);
          return filtered;
        });

        // Check if all chapters have content
        const allChaptersWithContent = updatedTocItems.every(item =>
          item.content && item.content.trim().length > 0
        );

        if (allChaptersWithContent && !contentGenerated) {
          setContentGenerated(true);
          console.log('🎉 All chapters have content - set contentGenerated=true');
        }

        // Save in the database
        try {
          const updateResponse = await fetch(`/api/ebooks/${currentEbookId}/chapters/${chapterId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: data.chapter.content
            }),
          });

          if (updateResponse.ok) {
            console.log(`💾 Updated content of chapter ID=${chapterId}`);
          }
        } catch (updateError) {
          console.warn('Error while saving:', updateError);
        }

      } else {
        throw new Error('Received invalid data format');
      }

    } catch (err) {
      handleApiError(err, 'An error occurred while generating chapter content');
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

    if (!currentEbookId || !title.trim() || noChanges) {
      if (noChanges) {
        changeStep(2);
        return;
      }
      setError('Cannot update the title');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      // 1. First, scrape URLs if they have changed
      if (hasUrlsChanged) {
        setScrapedContent([]); // Clear old content
        await scrapeUrls(); // Fetch new ones
      }

      // 2. Update ebook data
      const response = await fetch(`/api/ebooks/${currentEbookId}`, {
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
        let errorMessage = 'Error updating the title';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        console.log(`Ebook title updated (ID=${currentEbookId}): ${title}`);
        setOriginalTitle(title);
        setOriginalSubtitle(subtitle);
        setOriginalDescription(description);
        setOriginalUrlInputs([...urlInputs]);
        changeStep(2);
      } else {
        throw new Error('Invalid response from the title update API');
      }
    } catch (err) {
      handleApiError(err, 'An error occurred while updating the title');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateResponse = (regenerate: boolean) => {
    if (regenerate) {
      generateTableOfContents();
    } else {
      // Użytkownik idzie dalej bez regeneracji - aktualne źródła stają się nową "oryginalną" wersją
      setOriginalScrapedContent(scrapedContent);
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
      console.log('Generated content for all missing chapters.');
      setContentGenerated(true);

    } catch (err) {
      handleApiError(err, 'An error occurred while generating missing content');
    } finally {
      setGeneratingChapterIds([]);
      setIsGeneratingMissingContent(false);
    }
  };

  const generateChaptersContent = async () => {
      // ===== PRELIMINARY VALIDATION =====
      if (tocItems.length === 0) {
        setError('No chapters to generate content for');
        return;
      }

      if (!currentEbookId) {
        setError('Missing ebook identifier. Try refreshing the page and starting over.');
        return;
      }

      // ===== RESET STATES =====
      setError(null);
      setIsGeneratingContent(true);
      setGeneratingChapterIds(tocItems.map(item => item.id)); // All at once
      setCompletedChapterIds([]);
      setCurrentGeneratingIndex(-1);

      console.log(`🚀 Starting parallel generation of ${tocItems.length} chapters...`);

      try {
        const chaptersToGenerate = [...tocItems];
        const updatedTocItems = [...tocItems];

        // ===== PARALLEL GENERATION =====
        const generationPromises = chaptersToGenerate.map(async (chapter, index) => {
          try {
            console.log(`📝 [${index + 1}/${chaptersToGenerate.length}] Generating: ${chapter.title}`);

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
              let errorMessage = 'Error generating chapter content';
              try {
                const errorData = await response.json();
                if (errorData && errorData.error) {
                  errorMessage = errorData.error;
                }
              } catch (jsonError) {
                errorMessage = `Server error (${response.status})`;
              }
              throw new Error(errorMessage);
            }

            const data = await response.json();

            if (data.chapter && data.chapter.content) {
              // ===== REAL-TIME STATE UPDATE =====
              setTocItems(currentItems =>
                currentItems.map(item =>
                  item.id === chapter.id
                    ? { ...item, content: data.chapter.content }
                    : item
                )
              );

              setGeneratingChapterIds(prev => prev.filter(id => id !== chapter.id));
              setCompletedChapterIds(prev => [...prev, chapter.id]);

              console.log(`✅ [${index + 1}/${chaptersToGenerate.length}] Completed: ${chapter.title}`);

              // ===== DATABASE SAVE =====
              try {
                const updateResponse = await fetch(`/api/ebooks/${currentEbookId}/chapters/${chapter.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    content: data.chapter.content
                  }),
                });

                if (!updateResponse.ok) {
                  console.warn(`⚠️ Failed to save content of chapter ${chapter.id} in the database, but continuing the process`);
                } else {
                  console.log(`💾 Saved in the database: ${chapter.title}`);
                }
              } catch (updateError) {
                console.warn(`❌ Error while saving content of chapter ${chapter.id}:`, updateError);
              }

              return { success: true, chapter, content: data.chapter.content };
            } else {
              throw new Error('Received invalid data format');
            }
          } catch (error) {
            // ===== SINGLE CHAPTER ERROR HANDLING =====
            setGeneratingChapterIds(prev => prev.filter(id => id !== chapter.id));
            console.error(`❌ Error generating chapter ${chapter.title}:`, error);

            // ✅ FIX: Safely extract message from error
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, chapter, error: errorMessage };
          }
        });

        // ===== WAITING FOR ALL RESULTS =====
        console.log('⏳ Waiting for all generations to finish...');
        const results = await Promise.allSettled(generationPromises);

        // ===== COLLECTING ERRORS =====
        // ✅ FIX: Explicitly specify the array type
        const errors: string[] = [];
        let successCount = 0;

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            // Safely extract reason
            const rejectionReason = result.reason instanceof Error ? result.reason.message : String(result.reason);
            errors.push(`${chaptersToGenerate[index].title}: ${rejectionReason}`);
            console.error(`❌ Promise rejected for ${chaptersToGenerate[index].title}:`, result.reason);
          } else if (!result.value.success) {
            errors.push(`${result.value.chapter.title}: ${result.value.error}`);
            console.error(`❌ Generation failed for ${result.value.chapter.title}:`, result.value.error);
          } else {
            successCount++;
            console.log(`✅ Success for ${result.value.chapter.title}`);
          }
        });

        // ===== ERROR REPORTING =====
        if (errors.length > 0) {
          console.warn(`⚠️ Errors in ${errors.length}/${chaptersToGenerate.length} chapters`);
          setError(`Errors while generating some chapters: ${errors.join(', ')}`);
        } else {
          console.log(`🎉 All ${successCount} chapters generated successfully!`);
        }

        // ===== VALIDATION AND FINAL SETTINGS =====
        // Check the current state of tocItems (may be updated by setTocItems in promises)
        setTocItems(currentTocItems => {
          const chaptersWithContent = currentTocItems.filter(item =>
            item.content && item.content.trim().length > 0
          );

          console.log(`📊 Final status: ${chaptersWithContent.length}/${currentTocItems.length} chapters have content`);

          // Set contentGenerated state only if ALL have content
          if (chaptersWithContent.length === currentTocItems.length) {
            setContentGenerated(true);
            setChaptersWithoutContent([]);
            console.log('🎯 ContentGenerated = true (all chapters have content)');
          } else {
            const withoutContent = currentTocItems
              .filter(item => !item.content || item.content.trim() === '')
              .map(item => item.id);
            setChaptersWithoutContent(withoutContent);
            console.log(`📝 Chapters without content: ${withoutContent.length}`);
          }

          return currentTocItems; // Return without changes
        });

        // ===== SETTING THE ACTIVE CHAPTER =====
        if (tocItems.length > 0) {
          // Get the current state of tocItems
          setTocItems(currentTocItems => {
            // Priority: first chapter with content
            const chaptersWithContent = currentTocItems.filter(item =>
              item.content && item.content.trim().length > 0
            );

            if (chaptersWithContent.length > 0) {
              setActiveChapterId(chaptersWithContent[0].id);
              console.log(`🎯 Set active chapter with content: ${chaptersWithContent[0].title}`);
            } else {
              // Fallback: first chapter without content
              const chaptersWithoutContent = currentTocItems.filter(item =>
                !item.content || item.content.trim() === ''
              );

              if (chaptersWithoutContent.length > 0) {
                setActiveChapterId(chaptersWithoutContent[0].id);
                console.log(`📝 Set active chapter without content: ${chaptersWithoutContent[0].title}`);
              } else {
                // Final fallback: first available
                setActiveChapterId(currentTocItems[0].id);
                console.log(`🔢 Set first available chapter: ${currentTocItems[0].title}`);
              }
            }

            return currentTocItems; // Return without changes
          });
        }

        // ===== SYNCHRONIZATION AND TRANSITION =====
        console.log('🔄 Synchronizing chapter status...');
        syncChapterStatus();

        console.log('🎉 Moving to step 3...');
        setStep(3);

        console.log(`✅ Generation finished: ${successCount}/${chaptersToGenerate.length} success`);

      } catch (err) {
        console.error('❌ General generation error:', err);
        handleApiError(err, 'An error occurred while generating content. Please try again.');
      } finally {
        // ===== CLEANUP =====
        console.log('🧹 Cleaning up states...');
        setIsGeneratingContent(false);
        setCurrentGeneratingIndex(-1);
        setGeneratingChapterIds([]);
      }
  };

  // ✅ FIXED handleGenerateAIImage FUNCTION
  const handleGenerateAIImage = async (chapterId: string, forceRegenerate = false) => {
    const chapter = tocItems.find(item => item.id === chapterId);
    if (!chapter || !chapter.content || !currentEbookId) {
      setError('Chapter has no content to generate a graphic from');
      return;
    }

    setGeneratingAIImageForChapter(chapterId);
    setAiImageGenerationProgress(10);
    setAiImageGenerationError(null);
    setError(null);

    console.log(`🎨 Starting graphic generation for chapter: ${chapter.title}`);

    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters/${chapterId}/generate-image`, {
        method: 'POST',
        headers: getUserHeaders(),
        body: JSON.stringify({
          forceRegenerate,
          size: "1024x1024"
        }),
      });

      setAiImageGenerationProgress(60);

      if (!response.ok) {
        let errorMessage = 'Error generating AI graphic';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      setAiImageGenerationProgress(90);
      const data = await response.json();

      if (!data.success || !data.image_url) {
        throw new Error('Invalid response from the server');
      }

      console.log(`✅ AI graphic generated for chapter ${chapter.title}: ${data.image_url}`);

      // ✅ FIXED state update with cache-bust
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
      console.log(`✅ Updated graphic state for chapter ${chapterId}`);

      if (data.prompt_was_generated) {
        console.log(`Generated new prompt for chapter "${chapter.title}": ${data.prompt_used}`);
      }

    } catch (err) {
      console.error(`❌ Error generating graphic for chapter ${chapter.title}:`, err);
      setAiImageGenerationError(err instanceof Error ? err.message : 'Unknown error');
      handleApiError(err, 'An error occurred while generating AI graphic');
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
    if (!currentEbookId) return;

    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters/${chapterId}`, {
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
      console.warn('Error fetching prompt:', error);
    }
  };

  // ✅ COMPLETELY REWRITTEN handleGenerateAllImages FUNCTION FOR PARALLEL EXECUTION
  const handleGenerateAllImages = async () => {
    const chaptersToGenerate = tocItems.filter(
      item => (item.content && item.content.trim().length > 0) && !item.image_url
    );

    if (chaptersToGenerate.length === 0) {
      setError('Brak rozdziałów z treścią do wygenerowania grafik.');
      return;
    }

    console.log(`🎨 Rozpoczynam równoległe generowanie ${chaptersToGenerate.length} grafik...`);

    setIsGeneratingAllImages(true);
    setGeneratedImagesCount(0);
    setTotalImagesToGenerate(chaptersToGenerate.length);
    setError(null);

    const startTime = Date.now();

    // 1. Stwórz tablicę obietnic (promisów) dla każdego zapytania API
    const generationPromises = chaptersToGenerate.map(chapter =>
      fetch(`/api/ebooks/${currentEbookId}/chapters/${chapter.id}/generate-image`, {
        method: 'POST',
        headers: getUserHeaders(),
        body: JSON.stringify({
          forceRegenerate: false,
          size: "1024x1024"
        }),
      })
      .then(response => {
        if (!response.ok) {
          // Spróbuj odczytać błąd JSON, jeśli się nie uda, rzuć ogólny błąd
          return response.json().then(err => Promise.reject(err)).catch(() => Promise.reject({ error: `Błąd serwera: ${response.status}` }));
        }
        return response.json();
      })
      .then(data => {
        if (!data.success || !data.image_url) {
          throw new Error('Nieprawidłowa odpowiedź z serwera');
        }
        // Zwróć ID rozdziału i nowy URL obrazka
        return { chapterId: chapter.id, imageUrl: data.image_url, title: chapter.title };
      })
      .catch(error => {
        // Zwróć informację o błędzie dla tego konkretnego rozdziału
        return { chapterId: chapter.id, error: error.error || error.message || 'Nieznany błąd', title: chapter.title };
      })
    );

    // 2. Użyj Promise.allSettled, aby poczekać na zakończenie wszystkich zapytań
    const results = await Promise.allSettled(generationPromises);
    console.log('🏁 Wszystkie operacje generowania zakończone, przetwarzanie wyników...');

    const successfulChapters: { chapterId: string, imageUrl: string }[] = [];
    const failedChapters: { title: string, reason: string }[] = [];

    // 3. Przetwórz wyniki
    results.forEach(result => {
      if (result.status === 'fulfilled' && 'imageUrl' in result.value) {
        const { chapterId, imageUrl, title } = result.value;
        console.log(`✅ Sukces dla rozdziału: "${title}"`);
        successfulChapters.push({ chapterId, imageUrl });
      } else {
        const reason = result.status === 'rejected'
          ? result.reason
          : ('error' in result.value ? result.value.error : 'Nieznany błąd');
        const chapterTitle = result.status === 'fulfilled' ? result.value.title : 'Nieznany rozdział';
        console.error(`⌐ Błąd dla rozdziału "${chapterTitle}":`, reason);
        failedChapters.push({ title: chapterTitle, reason });
      }
    });

    // 4. Zaktualizuj stan JEDEN RAZ dla wszystkich udanych operacji
    if (successfulChapters.length > 0) {
      const timestamp = Date.now();
      setTocItems(currentTocItems => {
        const updatedItems = [...currentTocItems];
        successfulChapters.forEach(({ chapterId, imageUrl }) => {
          const index = updatedItems.findIndex(item => item.id === chapterId);
          if (index !== -1) {
            const baseUrl = imageUrl.split('?')[0];
            updatedItems[index] = { ...updatedItems[index], image_url: `${baseUrl}?t=${timestamp}` };
          }
        });
        return updatedItems;
      });
      setGraphicsAdded(true);
    }

    setGeneratedImagesCount(successfulChapters.length);

    // 5. Zakończ proces i wyświetl podsumowanie
    setIsGeneratingAllImages(false);
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log(`📊 Podsumowanie generowania równoległego (czas: ${duration}s):`);
    console.log(`   - Sukcesy: ${successfulChapters.length}/${chaptersToGenerate.length}`);
    console.log(`   - Błędy: ${failedChapters.length}`);

    if (failedChapters.length > 0) {
      const errorTitles = failedChapters.map(f => f.title).join(', ');
      setError(`Nie udało się wygenerować grafiki dla ${failedChapters.length} rozdziałów: ${errorTitles}. Możesz spróbować ponownie dla pojedynczych grafik.`);
    } else {
      setError(null);
    }

    // Odśwież status, aby upewnić się, że wszystkie obrazki są widoczne
    setTimeout(() => refreshImagesStatus(), 1000);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || (!uploadingImageForChapter && !uploadingCoverImage) || !currentEbookId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const fileType = file.type;
    if (!fileType.startsWith('image/')) {
      setError('The selected file is not an image.');
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
        // Uploading cover
        response = await fetch(`/api/ebooks/${currentEbookId}/cover-image`, {
          method: 'POST',
          headers: headers,
          body: formData
        });
      } else if (uploadingImageForChapter) {
        // Uploading chapter graphic
        response = await fetch(`/api/ebooks/${currentEbookId}/chapters/${uploadingImageForChapter}/image`, {
          method: 'POST',
          headers: headers,
          body: formData
        });
      } else {
        throw new Error('Unknown image upload type');
      }

      if (!response.ok) {
        let errorMessage = 'Error uploading image';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        const timestamp = Date.now();
        const baseUrl = data.image_url.split('?')[0];
        const newImageUrl = `${baseUrl}?t=${timestamp}`;

        if (uploadingCoverImage) {
          // Update cover data
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
          console.log(`✅ Cover has been successfully uploaded: ${newImageUrl}`);
        } else if (uploadingImageForChapter) {
          // Update chapter graphic
          setTocItems(prevItems => prevItems.map(item =>
            item.id === uploadingImageForChapter
              ? { ...item, image_url: newImageUrl }
              : item
          ));

          if (previewImage && previewImage.startsWith(baseUrl)) {
            setPreviewImage(newImageUrl);
          }

          console.log(`✅ Image has been successfully uploaded for chapter ID=${uploadingImageForChapter}: ${newImageUrl}`);
        }

        setImageRefreshTimestamp(timestamp);

        if (!graphicsAdded) {
          setGraphicsAdded(true);
        }
      } else {
        throw new Error('Invalid response from the server');
      }
    } catch (err) {
      handleApiError(err, 'An error occurred while uploading the image');
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
    setUploadingImageForChapter(null); // Clear chapter state
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAddItem = async () => {
    if (!newItemTitle.trim()) return;
    if (!currentEbookId) {
      setError('Missing ebook identifier. Try refreshing the page and starting over.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chapters: [{ title: newItemTitle.trim() }]
        }),
      });

      if (!response.ok) {
        throw new Error('Error adding chapter');
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
        throw new Error('Invalid response from the chapter addition API');
      }
    } catch (err) {
      handleApiError(err, 'An error occurred while adding the chapter');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveItem = async (id: string) => {
    if (!currentEbookId) {
      setError('Missing ebook identifier');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error deleting chapter');
      }

      setTocItems(tocItems.filter(item => item.id !== id));
      setContextMenuVisible(null);

      if (chaptersWithoutContent.includes(id)) {
        setChaptersWithoutContent(chaptersWithoutContent.filter(chapterId => chapterId !== id));
      }
    } catch (err) {
      handleApiError(err, 'An error occurred while deleting the chapter');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveItem = async (id: string, direction: 'up' | 'down') => {
    if (!currentEbookId) {
      setError('Missing ebook identifier');
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

      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters`, {
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
        throw new Error(errorData.error || 'Error updating chapter positions');
      }

      const updatedItems = newItems.map((item, idx) => ({
        ...item,
        position: idx
      }));

      setTocItems(updatedItems);
      setContextMenuVisible(null);
    } catch (err) {
      handleApiError(err, 'An error occurred while reordering chapters');
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
    if (!editingItemId || !currentEbookId) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters/${editingItemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editingItemTitle.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Error updating chapter title');
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
      handleApiError(err, 'An error occurred while saving changes');
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
    if (!activeChapterId || !currentEbookId) return;

    setIsSaving(true);

    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters/${activeChapterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editingChapterContent
        }),
      });

      if (!response.ok) {
        throw new Error('Error updating chapter content');
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
      handleApiError(err, 'An error occurred while saving chapter content');
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
    if (!currentEbookId) {
      setError('Missing ebook identifier');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // ✅ BETTER check if cover is ready
      const needsCover = !coverData?.cover_status?.complete || !coverData?.cover_url;

      if (needsCover) {
        console.log('🎨 Cover is not ready - generating automatically...');
        // First, generate the cover
        const coverGenerated = await generateCover(false, false);
        if (!coverGenerated) {
          setError('Failed to automatically generate the cover. Please generate the cover manually before exporting.');
          setIsSaving(false);
          return;
        }

        // Wait a moment for synchronization
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('📄 Starting PDF export...');
      // Now, export the PDF
      const response = await fetch(`/api/ebooks/${currentEbookId}/export-pdf`, {
        method: 'POST',
        headers: getUserHeaders(),
      });

      if (!response.ok) {
        let errorMessage = 'Error generating PDF';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (jsonError) {
          errorMessage = `Server error (${response.status})`;
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

      if (onEbookCreated) {
        onEbookCreated();
      }
      wasSuccessfullyCompleted.current = true;

      onClose();

      console.log('✅ PDF has been successfully downloaded');

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

    } catch (err) {
      handleApiError(err, 'An error occurred while exporting the ebook');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImagePreview = (imageUrl: string | undefined) => {
    console.log('handleImagePreview called with URL:', imageUrl);
    if (imageUrl && imageUrl.trim()) {
      console.log('Setting previewImage to:', imageUrl);
      setPreviewImage(imageUrl);
    } else {
      console.warn('Cannot display preview - empty URL:', imageUrl);
    }
  };

  const handleClosePreview = () => {
    setPreviewImage(null);
  };

  // ✅ NOWA FUNKCJA DO ZAPISU SZKICU
  const handleSaveDraft = async () => {
    if (!currentEbookId || !title.trim()) {
      setError('Tytuł jest wymagany, aby zapisać szkic.');
      return;
    }

    setIsSavingDraft(true);
    setError(null);

    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}`, {
        method: 'PUT',
        headers: getUserHeaders(),
        body: JSON.stringify({
          title,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null,
          status: "draft" // Upewnijmy się, że status to wciąż szkic
        }),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas zapisywania szkicu ebooka.');
      }

      const data = await response.json();
      if (data.success) {
        console.log(`✅ Szkic ebooka (ID: ${currentEbookId}) został zapisany.`);
        draftSavedByUser.current = true; // Ustaw flagę, aby zapobiec usunięciu
        // Opcjonalnie: Można tu dodać chwilową informację zwrotną dla użytkownika
      } else {
        throw new Error('Odpowiedź serwera wskazuje na błąd zapisu.');
      }

    } catch (err) {
      handleApiError(err, 'Wystąpił nieoczekiwany błąd podczas zapisywania szkicu.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // EXTENDED renderStep1 with new fields
  const renderStep1 = () => (
    <div className="bg-gradient-to-br from-white to-blue-50 rounded-xl border border-blue-100 shadow-lg p-8 transition-all duration-300">
      <div className="mb-8 text-center">
        <BookMarked size={48} className="text-blue-500 mb-4 mx-auto drop-shadow-md" />
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">
          {tocGenerated ? 'Edit ebook data' : "Let's Create!"}
        </h2>
        <p className="text-gray-600 max-w-md mx-auto">
          {tocGenerated
            ? 'Make changes to your ebook data.'
            : 'Enter the data based on which we will generate the table of contents for your ebook.'}
        </p>
      </div>

      <div className="mb-6 max-w-2xl mx-auto space-y-6">
        {/* Title section */}
        <div className="bg-white p-4 rounded-lg border border-blue-100">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Ebook Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="E.g. The Complete Guide to Time Management"
            className="w-full px-4 py-3 border border-blue-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200"
            disabled={isGeneratingToc || isSaving || isScrapingUrls}
            ref={titleInputRef}
          />
        </div>

        {/* Subtitle section */}
        <div className="bg-white p-4 rounded-lg border border-blue-100">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Subtitle:
            <span className="text-gray-400 font-normal ml-1">(optional)</span>
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="E.g. Practical Methods and Tools"
            className="w-full px-4 py-3 border border-blue-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200"
            disabled={isGeneratingToc || isSaving || isScrapingUrls}
            ref={subtitleInputRef}
          />
        </div>

        {/* NEW Description section */}
        <div className="bg-white p-4 rounded-lg border border-blue-100">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Description and preferences:
            <span className="text-gray-400 font-normal ml-1">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your preferences for the ebook content, target audience, writing style, main topics you want to include..."
            className="w-full px-4 py-3 border border-blue-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 bg-white transition-all duration-200 resize-none"
            rows={4}
            disabled={isGeneratingToc || isSaving || isScrapingUrls}
            maxLength={1000}
            ref={descriptionInputRef}
          />
          <div className="text-xs text-gray-400 mt-1">
            {description.length}/1000 characters
          </div>
        </div>

        {/* NEW Links section */}
        <div className="bg-white p-4 rounded-lg border border-blue-100 text-gray-700">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-medium text-gray-700">
              WWW Sources:
              <span className="text-gray-400 font-normal ml-1">(optional, max 5)</span>
            </label>
            {scrapedContent.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Fetched {scrapedContent.length} sources
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
                          disabled={isInitializing || isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl}
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
                            'Approve'
                          )}
                      </button>
                    )}

                    {url.trim() && scrapedContent.find(item => item.url === url) && (
                      <span className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg border border-green-200 flex items-center">
                        <Check size={14} className="mr-1" />
                        Already added
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

              {/* Divider line and PDF section */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  PDF Sources:
                  <span className="text-gray-400 font-normal ml-1">(optional, max 10MB)</span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleOpenPdfDialog}
                    disabled={isInitializing || isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl || isUploadingPdf}
                    className={`flex items-center px-4 py-2 border border-dashed border-gray-300 rounded-lg transition-colors ${
                      isGeneratingToc || isSaving || isScrapingUrls || isScrapingSingleUrl || isUploadingPdf
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 cursor-pointer hover:border-blue-300'
                    }`}
                  >
                    {isUploadingPdf ? (
                      <>
                        <Loader size={16} className="animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload size={16} className="mr-2" />
                        Choose PDF file
                      </>
                    )}
                  </button>

                  <span className="text-xs text-gray-500">
                    We support PDF files with text (not scans)
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
          </div>

          {/* Preview of fetched content */}
            {scrapedContent.length > 0 && (
              <div className="mt-4 border-t border-gray-200 pt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Fetched sources:</h4>
                <div className="space-y-2 max-h-128 overflow-y-auto">
                  {scrapedContent.map((item, index) => (
                    <div key={index} className="text-xs bg-gray-50 p-2 rounded border relative">
                      <button
                        onClick={() => handleRemoveScrapedContent(item)} // Zmień z item.url na item
                        className="absolute top-1 right-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1 transition-colors cursor-pointer"
                        title="Remove source"
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
        {/* ✅ NOWY PRZYCISK "ZAPISZ SZKIC" (widoczny tylko dla nowych ebooków) */}
        {!tocGenerated && (
          <button
            onClick={handleSaveDraft}
            disabled={!title.trim() || isGeneratingToc || isSaving || isScrapingUrls || isSavingDraft}
            className={`flex items-center justify-center px-6 py-3 rounded-lg font-medium shadow-md transition-all duration-200 ${
              !title.trim() || isSavingDraft
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 cursor-pointer'
            }`}
          >
            {isSavingDraft ? (
              <>
                <Loader size={20} className="animate-spin mr-3" />
                Zapisywanie...
              </>
            ) : (
              <>
                <Save size={20} className="mr-3" />
                Zapisz szkic
              </>
            )}
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
              Generating...
            </>
          ) : isScrapingUrls ? (
            <>
              <Loader size={20} className="animate-spin mr-3" />
              Fetching sources...
            </>
          ) : tocGenerated ? (
            <>
              <Save size={20} className="mr-3" />
              Save changes
            </>
          ) : (
            <>
              <Sparkles size={20} className="mr-3" />
              Generate table of contents
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
          <h3 className="text-xl font-bold text-gray-800 mb-2">Change of ebook title</h3>
          <p className="text-gray-600">
            {subtitle !== originalSubtitle
              ? 'The title or subtitle of the ebook has been changed, which may affect its content.'
              : 'The basic data of the ebook has been changed, which may affect its content.'}
            Do you want to generate a new proposal for the chapters?
          </p>
        </div>

        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => handleRegenerateResponse(false)}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer"
            disabled={isGeneratingToc}
          >
            NO
          </button>
          <button
            onClick={() => handleRegenerateResponse(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 cursor-pointer"
            disabled={isGeneratingToc}
          >
            {isGeneratingToc ? (
              <>
                <Loader size={16} className="animate-spin mr-2 inline-block" />
                Generating...
              </>
            ) : (
              'YES'
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
            <h3 className="text-xl font-bold text-gray-800 mb-2">Change of chapter title</h3>
            <p className="text-gray-600">
              The chapter title has been changed from "{originalChapterTitle}" to "{chapter.title}".
              Do you want to generate new content for this chapter?
            </p>
          </div>

          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={() => handleChapterRegenerateResponse(false)}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 cursor-pointer"
              disabled={isGeneratingSingleChapter}
            >
              NO
            </button>
            <button
              onClick={() => handleChapterRegenerateResponse(true)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 cursor-pointer"
              disabled={isGeneratingSingleChapter}
            >
              {isGeneratingSingleChapter ? (
                <>
                  <Loader size={16} className="animate-spin mr-2 inline-block" />
                  Generating...
                </>
              ) : (
                'YES'
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
            <h3 className="text-xl font-bold text-gray-800">Prompt for the image</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              <X size={24} />
            </button>
          </div>

          <div className="mb-4">
            <h4 className="font-medium text-gray-700 mb-2">Chapter: {chapter.title}</h4>
            {prompt ? (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{prompt}</p>
                <div className="mt-2 text-xs text-gray-500">
                  Length: {prompt.length}/400 characters
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700">
                  The prompt has not been generated yet. It will be created during the first image generation.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Close
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
                Regenerate with a new prompt
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
            <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Customize the ebook structure</h2>
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
            Chapters ({tocItems.length})
          </div>

          <div className="space-y-2 mb-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
            {tocItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <BookOpen size={36} className="text-gray-400 mb-2" />
                <p>No chapters. Add the first chapter below.</p>
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
                              <span className="text-xs whitespace-nowrap hidden sm:inline">Generating...</span>
                            </span>
                          ) :
                          completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0) ? (
                            <span className="text-green-600 flex items-center">
                              <Check size={14} className="mr-0 sm:mr-1" />
                              <span className="text-xs whitespace-nowrap hidden sm:inline">Ready</span>
                            </span>
                          ) :
                          currentGeneratingIndex < index && !completedChapterIds.includes(item.id) ? (
                            <span className="text-gray-500 hidden sm:flex items-center">
                              <span className="text-xs whitespace-nowrap">Waiting in queue...</span>
                            </span>
                          ) : null}
                        </>
                      )}

                      {!isGeneratingContent && (completedChapterIds.includes(item.id) || (item.content && item.content.trim().length > 0)) && (
                        <span className="text-green-600 flex items-center">
                          <Check size={14} className="mr-0 sm:mr-1" />
                          <span className="text-xs whitespace-nowrap hidden sm:inline">Content added</span>
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
                          title="Save"
                          disabled={isSaving}
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                          title="Cancel"
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
                              Move up
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
                              Move down
                            </button>
                            <button
                              onClick={() => handleStartEditing(item)}
                              disabled={isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                isSaving ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer'
                              } transition-colors`}
                            >
                              <Edit size={14} className="mr-2" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={isSaving}
                              className={`flex items-center w-full px-3 py-2 text-left text-sm ${
                                isSaving ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-red-50 hover:text-red-600 cursor-pointer'
                              } transition-colors rounded-b-lg`}
                            >
                              <X size={14} className="mr-2" />
                              Remove
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
                placeholder="New chapter title"
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
                Add
              </button>
            </div>
          </div>
        </div>

        {isGeneratingContent && (
          <div className="mt-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-blue-800 flex items-center">
                <Loader size={16} className="mr-2 animate-spin text-blue-600" />
                Generating content
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
                `Currently generating: ${tocItems.find(item => generatingChapterIds.includes(item.id))?.title || 'chapter'}`
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
            Change data
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {contentGenerated ? (
              <button
                onClick={() => changeStep(3)}
                className="px-6 py-2.5 rounded-lg text-white flex items-center bg-blue-600 hover:bg-blue-700 hover:shadow-md transition-all duration-200 w-full sm:w-auto justify-center cursor-pointer"
                disabled={isSaving}
              >
                <BookOpen size={18} className="mr-2" />
                Go to content
                <ChevronRight size={16} className="ml-1" />
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                {tocItems.length < 3 && (
                  <div className="text-amber-600 text-sm flex items-center bg-amber-50 px-3 py-1.5 rounded-lg w-full sm:w-auto mb-2 sm:mb-0">
                    <AlertCircle size={14} className="mr-1.5 flex-shrink-0" />
                    <span>The ebook should contain at least 3 chapters</span>
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
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="mr-2" />
                      {tocItems.length < 3
                        ? 'Add min. 3 chapters'
                        : 'Generate content'}
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
                      ? 'A new chapter without content has been detected'
                      : `Detected ${chaptersWithoutContent.length} chapters without content`}
                  </p>
                  <p className="text-yellow-700 text-sm">
                    Do you want to generate content for {chaptersWithoutContent.length === 1 ? 'this chapter' : 'these chapters'}?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 sm:mt-0">
                <button
                  onClick={() => setChaptersWithoutContent([])}
                  className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                  disabled={isGeneratingMissingContent}
                >
                  Not now
                </button>
                <button
                  onClick={generateMissingContent}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center cursor-pointer"
                  disabled={isGeneratingMissingContent}
                >
                  {isGeneratingMissingContent ? (
                    <>
                      <Loader size={14} className="mr-1.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1.5" />
                      Generate content
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
              <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Customize the ebook content</h2>
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
                Chapter {tocItems.findIndex(item => item.id === activeChapterId) + 1} of {tocItems.length}
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
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} className="mr-1.5" />
                        Generate
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
                    Edit
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
                Save
              </button>
              <button
                onClick={handleCancelEditContent}
                className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors flex items-center cursor-pointer"
                disabled={isSaving}
              >
                <X size={12} className="mr-1.5" />
                Cancel
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
                Table of contents
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
                        Content ready
                      </span>
                    ) : isGeneratingContent && generatingChapterIds.includes(item.id) ? (
                      <span className="text-xs text-blue-600 flex items-center">
                        <Loader size={12} className="mr-1 animate-spin" />
                        Generating...
                      </span>
                    ) : isGeneratingContent && currentGeneratingIndex < index && !completedChapterIds.includes(item.id) ? (
                      <span className="text-xs text-gray-600 flex items-center">
                        <span className="w-2 h-2 bg-gray-300 rounded-full mr-1"></span>
                        Waiting in queue
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center">
                        <AlertCircle size={12} className="mr-1" />
                        No content
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
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles size={14} className="mr-1.5" />
                                Generate content
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
                            Edit
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
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditContent}
                          className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center cursor-pointer"
                          disabled={isSaving}
                        >
                          <X size={14} className="mr-1.5" />
                          Cancel
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
                      placeholder="Enter the chapter content..."
                      ref={contentEditRef}
                      disabled={isSaving}
                    />
                  ) : (
                    <div className="text-gray-800 prose prose-blue max-w-none">
                      {isGeneratingSingleChapter && chapterToRegenerate === activeChapterId ? (
                        <div className="flex flex-col items-center justify-center h-64">
                          <Loader size={48} className="text-blue-500 animate-spin mb-4" />
                          <p className="text-center text-gray-600">
                            Generating content for the chapter...
                            <br />
                            This may take a few moments.
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
                            This chapter does not have content yet.
                            <br />
                            Use the "Generate content" button to add content.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select a chapter from the list.</p>
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
            title={editingContent ? "Finish editing content to go to the table of contents" : ""}
          >
            <ChevronLeft size={16} className="mr-1" />
            Table of contents
          </button>

          <button
            onClick={() => setStep(4)}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-lg flex items-center justify-center transition-all duration-200 ${
              editingContent
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md cursor-pointer'
            }`}
            disabled={isSaving || editingContent}
            title={editingContent ? "Finish editing content to go to graphics and cover" : ""}
          >
            <Image size={16} className="mr-2" />
            Graphics and cover
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

  // MODIFIED renderStep4 with the cover as the first graphic
  const renderStep4 = () => {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden transition-all duration-300">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-medium pb-2 border-b border-blue-300 mb-3">Graphics and cover of the ebook</h2>
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
                Graphics ({tocItems.filter(item => item.image_url).length + (coverData?.cover_url ? 1 : 0)}/{tocItems.length + 1})
              </div>

              <div className="bg-blue-50 px-3 py-1 rounded-full text-xs text-blue-700">
                {Math.round(((tocItems.filter(item => item.image_url).length + (coverData?.cover_url ? 1 : 0)) / (tocItems.length + 1)) * 100)}% completed
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
            {/* COVER AS THE FIRST ELEMENT WITH HIGHLIGHT */}
            <div className="border-2 border-dashed border-gray-400 rounded-lg shadow-sm bg-gray-100 overflow-hidden h-full flex flex-col">
              <div className="bg-gray-200 p-3 border-b border-gray-300 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    📖 COVER
                  </span>

                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    coverData?.cover_url
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-300 text-gray-700'
                  }`}>
                    {coverData?.cover_url
                      ? 'Ready ✓'
                      : 'No cover'}
                  </span>
                </div>

                <div className="border-t border-gray-300 mb-2"></div>

                <div className="flex items-baseline">
                  <div className="mr-2 min-w-6 h-6 w-6 bg-gray-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm text-xs flex-shrink-0" style={{transform: 'translateY(-1px)'}}>
                    📖
                  </div>
                  <h3 className="font-medium text-gray-800 text-sm break-words">Ebook cover</h3>
                </div>
              </div>

              <div className="p-3 flex-grow flex flex-col bg-gray-50">
                <div className="w-full aspect-square bg-gray-200 rounded-lg flex items-center justify-center mb-3 border border-dashed border-gray-400 overflow-hidden">
                  {coverData?.cover_url && coverData.cover_url.trim() ? (
                    <img
                      key={`cover-${imageRefreshTimestamp}`}
                      src={coverData.cover_url}
                      alt="Ebook cover"
                      className="object-cover w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        console.log('Cover clicked, URL:', coverData.cover_url);
                        handleImagePreview(coverData.cover_url);
                      }}
                      onLoad={() => console.log('✅ Cover loaded successfully:', coverData.cover_url)}
                      onError={(e) => {
                        console.error('❌ Error loading cover:', coverData.cover_url);
                        setTimeout(() => fetchCoverStatus(), 2000);
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                      <Palette size={32} className="text-gray-400 mb-2" />
                      <p>No cover</p>
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
                        <span className="truncate">Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} className="mr-1.5 flex-shrink-0" />
                        <span className="truncate">{coverData?.cover_url ? 'Regenerate' : 'Generate with AI'}</span>
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
                        <span className="truncate">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={14} className="mr-1.5 flex-shrink-0" />
                        <span className="truncate">{coverData?.cover_url ? 'Change' : 'Add from disk'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* CHAPTER GRAPHICS */}
            {tocItems.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-10 text-gray-500 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <BookOpen size={36} className="text-gray-400 mb-2" />
                <p>No chapters. Go back to step 2 to add chapters.</p>
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
                          Content ✓
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          No content
                        </span>
                      )}

                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.image_url
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {item.image_url
                          ? 'Graphic ✓'
                          : 'No graphic'}
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
                          alt={`Illustration for the chapter: ${item.title}`}
                          className="object-cover w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => handleImagePreview(item.image_url)}
                          onLoad={() => console.log(`✅ Image loaded: ${item.title}`)}
                          onError={(e) => {
                            console.error(`❌ Error loading image for ${item.title}:`, item.image_url);
                            setTimeout(() => refreshImagesStatus(), 2000);
                          }}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-500 text-sm p-4 text-center">
                          <Image size={32} className="text-gray-300 mb-2" />
                          <p>No graphic</p>
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
                            <span className="truncate">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={14} className="mr-1.5 flex-shrink-0" />
                            <span className="truncate">{item.image_url ? 'Change' : 'Add'}</span>
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
                              <span className="truncate">Generating...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} className="mr-1.5 flex-shrink-0" />
                              <span className="truncate">Generate with AI</span>
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
                        <span className="line-clamp-2">First, add chapter content</span>
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
                    Generating graphics
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
                    `Currently generating: graphic for chapter "${
                      tocItems.find(item => item.id === generatingAIImageForChapter)?.title || 'unknown'
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
              Content
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
                    {`Generating (${generatedImagesCount}/${totalImagesToGenerate})`}
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="mr-2" />
                    Generate missing graphics
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
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download size={16} className="mr-2" />
                    Download as PDF
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
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-sm flex items-start animate-fadeIn">
          <AlertCircle className="mr-3 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <div className="font-medium mb-1">An error occurred</div>
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
            } ${tocGenerated ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => tocGenerated && setStep(1)}
            title={tocGenerated ? "Edit data" : ""}
          >
            1
          </div>

          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium z-10 transition-all duration-300 ${
              step >= 2 ? `bg-blue-600 text-white ring-4 ring-blue-100` : 'bg-gray-200 text-gray-500'
            } ${tocGenerated ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => tocGenerated && setStep(2)}
            title={tocGenerated ? "Edit table of contents" : ""}
          >
            2
          </div>

          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium z-10 transition-all duration-300 ${
              step >= 3 ? `bg-blue-600 text-white ring-4 ring-blue-100` : 'bg-gray-200 text-gray-500'
            } ${contentGenerated ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => {
              if (contentGenerated) {
                syncChapterStatus();
                setStep(3);
              }
            }}
            title={contentGenerated ? "Browse content" : ""}
          >
            3
          </div>

          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium z-10 transition-all duration-300 ${
              step >= 4 ? `bg-blue-600 text-white ring-4 ring-blue-100` : 'bg-gray-200 text-gray-500'
            } ${contentGenerated ? 'cursor-pointer' : 'cursor-default'}`}
            onClick={() => contentGenerated && setStep(4)}
            title={contentGenerated ? "Graphics and cover" : ""}
          >
            4
          </div>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <div className="w-20 text-center -ml-5">Data</div>
          <div className="w-20 text-center">Chapters</div>
          <div className="w-20 text-center">Content</div>
          <div className="w-20 text-center -mr-5">Graphics</div>
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
      {/* NEW MODAL - test */}
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
              alt="Image preview"
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