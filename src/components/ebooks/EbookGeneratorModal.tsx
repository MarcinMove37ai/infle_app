// src/components/ebooks/EbookGeneratorModal.tsx

"use client"
import React, { useState, useRef, useEffect } from 'react';
import SourcePreviewModal from '@/components/ebooks/SourcePreviewModal';
import { hasIntroAccess } from '@/lib/planLimits';
import { useAuth } from '@/hooks/useAuth';
import { X, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';

// Import typów
import { TocItem, ScrapedContent, EbookCoverData, EbookGeneratorModalProps } from './types';
import { getChapterLimits } from '@/lib/chapterLimits';

// Import kroków
import { Step1Details } from './steps/Step1Details';
import { Step2Structure } from './steps/Step2Structure';
import { Step3Content } from './steps/Step3Content';
import { Step4Graphics } from './steps/Step4Graphics';

// Modal wyboru wariantu okładki
import { CoverVariantPickerModal } from './CoverVariantPickerModal';
// Modal wyboru wariantu grafiki rozdziału
import { ChapterImageVariantPickerModal } from './ChapterImageVariantPickerModal';
// Limit wariantów wg planu (ile grafik można dogenerować)
import { getVariantLimit } from '@/lib/image-variant-limits';

// Import wspólnych modali
import {
  RegeneratePopup,
  ChapterRegeneratePopup,
  PromptPreviewModal,
  ImagePreviewModal
} from './common/PreviewModals';

export default function EbookGeneratorModal({ isOpen, onClose, onEbookCreated, ebookId, lang = 'en' }: EbookGeneratorModalProps & { lang?: string }) {
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalContentRef.current && !modalContentRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-sm">
      <div
        ref={modalContentRef}
        className="bg-white w-full h-full sm:rounded-xl sm:shadow-2xl sm:w-full sm:max-w-7xl sm:max-h-[95vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Create your ebook with AI</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div
          id="modal-scroll-container"
          className="overflow-y-auto h-[calc(100%-80px)] sm:h-[calc(95vh-80px)] scrollbar-hide"
        >
          <EbookGeneratorContent isOpen={isOpen} ebookId={ebookId} onEbookCreated={onEbookCreated} onClose={onClose} lang={lang} />
        </div>
      </div>
    </div>
  );
}

function EbookGeneratorContent({ isOpen, ebookId, onEbookCreated, onClose, lang = 'en' }: { isOpen: boolean, ebookId?: number | null, onEbookCreated?: () => void, onClose: () => void, lang?: string }) {
  const pl = lang === 'pl';
  const { userRole } = useAuth();
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const draftSavedByUser = useRef(false);
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
  // Liczba rozdziałów do wygenerowania — domyślnie max dla roli (zero regresji).
  // Slider w Step1Details ogranicza zakres, route i tak klampuje server-side.
  const [chapterCount, setChapterCount] = useState(() => getChapterLimits(userRole).default);
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
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);

  // STANY DO PODGLĄDU GRAFIKI
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string>('');
  const [previewImageName, setPreviewImageName] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);

  // STATES for cover
  const [coverData, setCoverData] = useState<EbookCoverData | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [showCoverPrompt, setShowCoverPrompt] = useState(false);
  const [coverGenerated, setCoverGenerated] = useState(false);

  // STATES for cover variants (wybór wariantu okładki)
  const [coverVariants, setCoverVariants] = useState<{ url: string; prompt?: string; createdAt?: string; source?: string }[]>([]);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [isSelectingCoverVariant, setIsSelectingCoverVariant] = useState(false);
  const [isGeneratingMoreCover, setIsGeneratingMoreCover] = useState(false);   // dogenerowanie kolejnego wariantu okładki (Generate more)

  // STATES for chapter image variants (wybór/dogenerowanie wariantu grafiki rozdziału)
  const [chapterPickerId, setChapterPickerId] = useState<string | null>(null);   // który rozdział ma otwarty picker (null = zamknięty)
  const [chapterVariants, setChapterVariants] = useState<{ url: string; prompt?: string; createdAt?: string; source?: string }[]>([]);
  const [isSelectingChapterVariant, setIsSelectingChapterVariant] = useState(false);
  const [isGeneratingMoreChapter, setIsGeneratingMoreChapter] = useState(false);
  const [isChapterPickerLoading, setIsChapterPickerLoading] = useState(false);   // dociąganie puli wariantów przed otwarciem (anty-blink)

  // STATE for cache-busting
  const [imageRefreshTimestamp, setImageRefreshTimestamp] = useState(0);

  // NEW STATE for Intro
  const [introContent, setIntroContent] = useState('');
  // Wstep domyslnie WLACZONY — dla planow bez dostepu i tak nie zostanie wywolany.
  const [includeIntro, setIncludeIntro] = useState(true);

  // Seedy z zaproszenia (3 propozycje tytułów) — spotlight na kroku 1 dla NOWEGO ebooka.
  const [seedSuggestions, setSeedSuggestions] = useState<{ position: number; title: string; subtitle: string; description?: string }[]>([]);
  const [showSeedSpotlight, setShowSeedSpotlight] = useState(false);
  const [seedSpotlightDismissed, setSeedSpotlightDismissed] = useState(false);
  const [seedsLoading, setSeedsLoading] = useState(false);

  // Spotlight pojawia się NATYCHMIAST przy otwarciu (nowy ebook, jeśli user nie wyłączył),
  // a seedy doładowują się w tle ze skeletonem. Eliminuje dysonans "najpierw formularz, potem nakładka".
  // Brak seedów po załadowaniu → cicho zamykamy. Cache `inflee_has_seeds` chroni userów bez seedów
  // przed migotaniem nakładki przy kolejnych otwarciach.
  useEffect(() => {
    if (!isOpen) return;
    let hidden = false;
    let knownNoSeeds = false;
    try {
      hidden = localStorage.getItem('inflee_seed_spotlight_hidden') === '1';
      knownNoSeeds = localStorage.getItem('inflee_has_seeds') === '0';
    } catch {}
    let cancelled = false;
    // Seedy pobieramy ZAWSZE przy otwarciu — zasilaja przycisk "Inspire me",
    // ktory ma byc dostepny rowniez po powrocie do zapisanego szkicu (ebookId ustawione).
    // Samo AUTOMATYCZNE pokazanie nakladki zostaje zarezerwowane dla nowego ebooka.
    const isNewEbook = !ebookId;
    if (isNewEbook && !hidden && !knownNoSeeds) {
      setShowSeedSpotlight(true);
      setSeedsLoading(true);
    }
    (async () => {
      try {
        const res = await fetch('/api/my-seeds', { credentials: 'same-origin' });
        const data = await res.json();
        if (cancelled) return;
        const seeds = Array.isArray(data.seeds) ? data.seeds : [];
        setSeedSuggestions(seeds);
        setSeedsLoading(false);
        try { localStorage.setItem('inflee_has_seeds', seeds.length > 0 ? '1' : '0'); } catch {}
        if (seeds.length === 0) setShowSeedSpotlight(false); // nie ma czego pokazać
      } catch {
        if (cancelled) return;
        setSeedSuggestions([]);
        setSeedsLoading(false);
        setShowSeedSpotlight(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, ebookId]);

  // Checkbox "show on start" — odbicie stanu z localStorage (domyślnie zaznaczony).
  const [seedShowOnStart, setSeedShowOnStart] = useState(true);
  useEffect(() => {
    try { setSeedShowOnStart(localStorage.getItem('inflee_seed_spotlight_hidden') !== '1'); } catch {}
  }, []);
  const toggleSeedShowOnStart = (checked: boolean) => {
    setSeedShowOnStart(checked);
    try {
      if (checked) localStorage.removeItem('inflee_seed_spotlight_hidden');
      else localStorage.setItem('inflee_seed_spotlight_hidden', '1');
    } catch {}
  };

  // "Inspire me" — ręczne przywołanie spotlightu (zawsze, niezależnie od preferencji).
  const openSeedSpotlight = () => setShowSeedSpotlight(true);

  // Gdy rola usera się ustali (useAuth bywa null na 1. renderze), dociągnij domyślną
  // liczbę rozdziałów do limitu roli — żeby slider startował od poprawnej wartości max.
  useEffect(() => {
    setChapterCount(getChapterLimits(userRole).default);
  }, [userRole]);

  // Spotlight źródeł — wyróżnienie sekcji źródeł po wyborze seeda (gdy brak źródeł i niewyłączony).
  const [showSourcesHighlight, setShowSourcesHighlight] = useState(false);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const [sourcesSpotlightHidden, setSourcesSpotlightHidden] = useState(false);
  useEffect(() => {
    try { setSourcesSpotlightHidden(localStorage.getItem('inflee_sources_spotlight_hidden') === '1'); } catch {}
  }, []);
  const toggleSourcesSpotlightHidden = (checked: boolean) => {
    setSourcesSpotlightHidden(checked);
    try {
      if (checked) localStorage.setItem('inflee_sources_spotlight_hidden', '1');
      else localStorage.removeItem('inflee_sources_spotlight_hidden');
    } catch {}
  };
  const [bounceGenerate, setBounceGenerate] = useState(false);
  const triggerGenerateBounce = () => {
    setBounceGenerate(true);
    setTimeout(() => setBounceGenerate(false), 1200);
  };
  const dismissSourcesHighlight = () => {
    setShowSourcesHighlight(false);
    triggerGenerateBounce();
    setTimeout(() => {
      const sc = document.getElementById('modal-scroll-container');
      if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
    }, 80);
  };
  // Gdy user doda źródło przy aktywnym wyróżnieniu — chowamy je (cel osiągnięty) i robimy bounce.
  useEffect(() => {
    if (showSourcesHighlight && scrapedContent.length > 0) {
      setShowSourcesHighlight(false);
      triggerGenerateBounce();
    }
  }, [scrapedContent.length, showSourcesHighlight]);

  const handlePickSeed = (seedTitle: string, seedSubtitle: string, seedDescription?: string) => {
    setTitle(seedTitle);
    setSubtitle(seedSubtitle);
    if (seedDescription && seedDescription.trim()) setDescription(seedDescription);
    setShowSeedSpotlight(false);
    setSeedSpotlightDismissed(true);

    // Po wyborze seeda: jeśli user nie ma jeszcze źródeł i nie wyłączył podpowiedzi,
    // wyróżnij sekcję źródeł (reszta przygasa) i przewiń do niej. Inaczej zwykły scroll na dół.
    let hidden = false;
    try { hidden = localStorage.getItem('inflee_sources_spotlight_hidden') === '1'; } catch {}
    const shouldHighlight = scrapedContent.length === 0 && !hidden;
    if (shouldHighlight) setShowSourcesHighlight(true);
    // Dociągamy scroll na sam dół — sekcja źródeł i CTA są na końcu formularza.
    // Dwa podejścia czasowe: raz szybko, raz po zamontowaniu nakładki (pewność dojścia do końca).
    const scrollDown = () => {
      const sc = document.getElementById('modal-scroll-container');
      if (sc) sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
    };
    setTimeout(scrollDown, 180);
    setTimeout(scrollDown, 420);
  };

  const dismissSeedSpotlight = () => {
    setShowSeedSpotlight(false);
    setSeedSpotlightDismissed(true);
  };

  // "Write my own" — zamyka spotlight i czyści pola, ALE tylko jeśli ich wartość
  // pochodzi z propozycji (nie kasujemy tekstu, który user wpisał samodzielnie).
  const handleWriteMyOwn = () => {
    if (seedSuggestions.some((s) => s.title === title)) setTitle('');
    if (seedSuggestions.some((s) => s.subtitle === subtitle)) setSubtitle('');
    if (seedSuggestions.some((s) => (s.description || '') === description && description !== '')) setDescription('');
    setShowSeedSpotlight(false);
    setSeedSpotlightDismissed(true);
    // Fokus na pole tytułu, gotowe do pisania.
    setTimeout(() => { titleInputRef.current?.focus(); }, 120);
  };

  // Element references
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);
  const editItemInputRef = useRef<HTMLInputElement>(null);
  const contentEditRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const subtitleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  // Helper functions
  const areSourcesEqual = (sourcesA: ScrapedContent[], sourcesB: ScrapedContent[]): boolean => {
    if (sourcesA.length !== sourcesB.length) return false;
    if (sourcesA.length === 0 && sourcesB.length === 0) return true;
    const sourcesBMap = new Map(sourcesB.map(item => [item.url, item]));
    for (const itemA of sourcesA) {
      const itemB = sourcesBMap.get(itemA.url);
      if (!itemB) return false;
      if (itemA.title !== itemB.title || itemA.content !== itemB.content) return false;
    }
    return true;
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

  // --- Effects ---

  useEffect(() => {
    const resetState = () => {
      console.log('🔄 Resetting state...');
      draftSavedByUser.current = false;
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
      setIntroContent('');
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

        setTitle(data.title || '');
        setSubtitle(data.subtitle || '');
        setDescription(data.description || '');
        setIntroContent(data.intro || ''); // Load intro content
        setCurrentEbookId(data.id);
        setOriginalTitle(data.title || '');
        setOriginalSubtitle(data.subtitle || '');
        setOriginalDescription(data.description || '');

        if (data.chapters && data.chapters.length > 0) {
          const chapters = data.chapters as TocItem[];
          setTocItems(chapters);
          setTocGenerated(true);
          setChapterCount(chapters.length); // suwak = faktyczna liczba rozdziałów wczytanego ebooka

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
                    title: "New Ebook (draft)",
                    status: "draft",
                    language: lang,
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
    cleanupStateRef.current = {
      isNewEbookSession: isNewEbookSession.current,
      wasSuccessfullyCompleted: wasSuccessfullyCompleted.current,
      draftSavedByUser: draftSavedByUser.current,
      currentEbookId,
      title,
      subtitle,
      description,
      scrapedContent,
      tocGenerated,
      userHeaders: getUserHeaders()
    };
  });

  useEffect(() => {
    return () => {
      const state = cleanupStateRef.current;
      if (state.isNewEbookSession && !state.wasSuccessfullyCompleted && state.currentEbookId) {
        const isDefaultTitle = !state.title || state.title === "New Ebook (draft)";
        const hasNoMeaningfulData = !state.subtitle && !state.description && state.scrapedContent.length === 0;
        const tocWasNotGenerated = !state.tocGenerated;

        if (isDefaultTitle && hasNoMeaningfulData && tocWasNotGenerated) {
          // Pusty/domyślny szkic bez danych → usuń (zachowanie jak dotąd).
          console.log(`🗑️ Usuwanie nieużywanego szkicu ebooka (ID: ${state.currentEbookId})...`);
          fetch(`/api/ebooks/${state.currentEbookId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          }).catch(err => {
            console.error("Błąd podczas usuwania nieużywanego szkicu ebooka:", err);
          });
        } else if (!isDefaultTitle && !state.draftSavedByUser && !state.tocGenerated) {
          // Sensowny tytuł (np. wybrany z propozycji), ale user nie kliknął "Save & Close"
          // i nie wygenerował spisu treści → AUTO-ZAPIS, żeby szkic trafił na listę z tytułem.
          console.log(`💾 Auto-zapis szkicu przy zamknięciu (ID: ${state.currentEbookId})...`);
          fetch(`/api/ebooks/${state.currentEbookId}`, {
            method: 'PUT',
            headers: state.userHeaders,
            body: JSON.stringify({
              title: state.title,
              subtitle: state.subtitle?.trim() || null,
              description: state.description?.trim() || null,
              status: 'draft',
            }),
          }).catch(err => {
            console.error("Błąd podczas auto-zapisu szkicu ebooka:", err);
          });
        }
      }
    };
  }, []);

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

  useEffect(() => {
    if (currentEbookId && step === 4) {
      const loadCoverStatus = async () => {
        try {
          await fetchCoverStatus();
        } catch (error) {
          console.warn('⚠️ Failed to fetch cover status upon entering step 4:', error);
        }
      };

      loadCoverStatus();
      const interval = setInterval(() => {
        if (isGeneratingCover) {
          loadCoverStatus();
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [currentEbookId, step, isGeneratingCover]);

  // --- Logic Functions ---

  const syncChapterStatus = () => {
    const chaptersWithContent = tocItems
      .filter(item => item.content && item.content.trim().length > 0)
      .map(item => item.id);

    // Add intro to completed chapters if content exists
    if (introContent && introContent.trim().length > 0) {
      chaptersWithContent.unshift('intro');
    }

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
      const hasSourcesChanged = !areSourcesEqual(scrapedContent, originalScrapedContent);
      const hasChapterCountChanged = chapterCount !== tocItems.length;

      if (newStep === 2 && step === 1 && tocGenerated &&
          (title !== originalTitle ||
          subtitle !== originalSubtitle ||
          hasDescriptionChanged ||
          hasUrlsChanged ||
          hasSourcesChanged ||
          hasChapterCountChanged)) {
        setShowRegeneratePopup(true);
      }
      else if (newStep === 3) {
        console.log('🔄 Moving to step 3 - setting first chapter (or intro) as active...');
        syncChapterStatus();
        // Set 'intro' as active by default if available, otherwise first chapter
        setActiveChapterId('intro');
        console.log(`🎯 Set active chapter to Intro`);
        setStep(newStep);
        console.log('✅ Move to step 3 completed');
      }
      else if (newStep === 4 && step === 3) {
        console.log('🔄 Moving to step 4 - graphics and cover...');
        syncChapterStatus();
        setStep(newStep);
        if (currentEbookId && !coverData) {
          console.log('📋 Initializing default cover state (not yet generated)');
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

      if (response.status === 404) {
        console.log('📋 Cover has not been generated yet');
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
        const errorText = await response.text();
        if (errorText.trim().startsWith('<')) {
          console.warn('⚠️ Received HTML page instead of JSON - likely a server error');
          return;
        }
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();
      console.log('📥 Fetched cover data from API:', data);

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

      if (mappedData.cover_url) {
        const baseUrl = mappedData.cover_url.split('?')[0];
        mappedData.cover_url = `${baseUrl}?t=${timestamp}`;
        console.log('🔄 Cover URL with cache-bust:', mappedData.cover_url);
      }

      setCoverData(mappedData);

      // Lista wariantów okładki (do modala wyboru). Pusta tablica = brak wariantów.
      const variants = Array.isArray(data.cover_variants) ? data.cover_variants : [];
      setCoverVariants(variants);
      console.log(`🎛️ Wariantów okładki: ${variants.length}`);

      if (mappedData.cover_status.complete && mappedData.cover_url) {
        setCoverGenerated(true);
        console.log('✅ Cover marked as ready');
      }

    } catch (err: any) {
      console.warn('⚠️ Problem fetching cover status:', err.message);
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

      // ✅ TRIGGER MOCKUP GENERATION IN BACKGROUND
      fetch(`/api/ebooks/${currentEbookId}/generate-mockups`, {
        method: 'POST',
        headers: getUserHeaders(),
      })
      .then(() => console.log('🚀 Mockup generation triggered successfully'))
      .catch(e => console.warn('⚠️ Failed to trigger mockup generation:', e));

      await new Promise(resolve => setTimeout(resolve, 500));
      setImageRefreshTimestamp(Date.now());
      await fetchCoverStatus();
      setCoverGenerated(true);
      console.log('🔄 Cover status refreshed');

      // Po wygenerowaniu wariantów otwórz modal wyboru — user od razu wybiera aktywną okładkę.
      setShowCoverPicker(true);
      return true;

    } catch (err: any) {
      console.error('❌ Error generating cover:', err);
      setError(err.message);
      return false;
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Wybór aktywnego wariantu okładki (z modala) — woła endpoint, który ustawia
  // wskazany wariant jako aktywny i przegenerowuje mockup. Nic nie kasuje.
  const handleSelectCoverVariant = async (variantUrl: string) => {
    if (!currentEbookId) return;
    setIsSelectingCoverVariant(true);
    setError(null);
    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/select-cover-variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantUrl }),
      });

      if (!response.ok) {
        let errorMessage = 'Error selecting cover';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) errorMessage = errorData.error;
        } catch {
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (!data.success || !data.cover_image_url) {
        throw new Error(data.error || 'Invalid response from the server');
      }

      // Zaktualizuj aktywną okładkę w stanie + cache-bust, żeby kafelek/mockup odświeżyły się natychmiast.
      const timestamp = Date.now();
      const baseUrl = data.cover_image_url.split('?')[0];
      const newCoverUrl = `${baseUrl}?t=${timestamp}`;

      setCoverData(prev => prev ? {
        ...prev,
        cover_url: newCoverUrl,
        has_cover_image: true,
        cover_status: { ...prev.cover_status, image_ready: true, complete: true },
      } : prev);
      setCoverGenerated(true);
      setImageRefreshTimestamp(timestamp);
      setShowCoverPicker(false);
      console.log(`✅ Aktywna okładka ustawiona: ${newCoverUrl}`);
    } catch (err: any) {
      console.error('❌ Error selecting cover variant:', err);
      setError(err.message);
    } finally {
      setIsSelectingCoverVariant(false);
    }
  };

  // Dogenerowanie kolejnego wariantu okładki (przycisk "Generate more" w modalu) — woła SILNIK
  // generate-cover bezpośrednio (zwraca all_variants), nie orkiestrator complete. Dopisuje 1 wariant
  // do puli i ustawia go aktywnym. Spójne z handleGenerateMoreChapter dla rozdziałów.
  const handleGenerateMoreCover = async () => {
    if (!currentEbookId) return;
    setIsGeneratingMoreCover(true);
    setError(null);
    try {
      const res = await fetch(`/api/ebooks/${currentEbookId}/generate-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRegenerate: true }),
      });
      if (!res.ok) {
        let msg = 'Error generating cover';
        try { const e = await res.json(); if (e?.error) msg = e.error; } catch { msg = `Server error (${res.status})`; }
        throw new Error(msg);
      }
      const data = await res.json();
      if (!data.success || !data.cover_image_url) throw new Error(data.error || 'Invalid response from the server');

      const timestamp = Date.now();
      const newCoverUrl = `${data.cover_image_url.split('?')[0]}?t=${timestamp}`;
      // Świeżo dogenerowany wariant staje się aktywny; podbijamy pełną pulę i kafelek okładki.
      if (Array.isArray(data.all_variants)) setCoverVariants(data.all_variants);
      setCoverData(prev => prev ? {
        ...prev,
        cover_url: newCoverUrl,
        has_cover_image: true,
        cover_status: { ...prev.cover_status, image_ready: true, complete: true },
      } : prev);
      setCoverGenerated(true);
      setImageRefreshTimestamp(timestamp);
      console.log(`✅ Dogenerowano wariant okładki (pula: ${Array.isArray(data.all_variants) ? data.all_variants.length : '?'})`);
    } catch (err: any) {
      console.error('❌ Error generating more cover variants:', err);
      setError(err.message);
    } finally {
      setIsGeneratingMoreCover(false);
    }
  };

  // === PICKER GRAFIK ROZDZIAŁU =========================================

  // Otwiera picker dla danego rozdziału — ładuje jego pulę image_variants ze stanu (tocItems)
  // lub dociąga z serwera, jeśli stan jest pusty.
  // Migracja w locie dla starych rozdziałów: jeśli pula image_variants jest pusta,
  // a rozdział ma już image_url (grafika sprzed tej funkcji), traktujemy ją jako
  // pierwszy wariant 'generated' — żeby picker pokazał istniejącą grafikę zamiast pustki.
  const seedFromExisting = (variants: any[], imageUrl?: string) => {
    if (Array.isArray(variants) && variants.length > 0) return variants;
    if (imageUrl && imageUrl.trim()) {
      return [{ url: imageUrl.split('?')[0], createdAt: new Date().toISOString(), source: 'generated' }];
    }
    return [];
  };

  const openChapterPicker = async (chapterId: string) => {
    const local = tocItems.find(i => i.id === chapterId) as any;
    const localVariants = Array.isArray(local?.image_variants) ? local.image_variants : [];

    // ANTY-BLINK: otwieramy picker OD RAZU (z id), ale w stanie ładowania.
    // Pulę ustawiamy dopiero, gdy mamy ŚWIEŻĄ z serwera (źródło prawdy) — żeby nie pokazać
    // najpierw 1 grafiki (lokalny seed), a potem przeskoku do N. Modal na czas dociągania
    // pokazuje szkielet (isLoading), nie niepełną listę.
    setChapterPickerId(chapterId);
    setIsChapterPickerLoading(true);

    let resolved: any[] | null = null;
    if (currentEbookId) {
      try {
        const ts = Date.now();
        const res = await fetch(`/api/ebooks/${currentEbookId}/chapters?_t=${ts}`, {
          headers: { 'Cache-Control': 'no-cache', ...getUserHeaders() }
        });
        if (res.ok) {
          const data = await res.json();
          // Endpoint GET /chapters zwraca { ebook: { ebook_chapters: [...] } } — pełne image_variants per rozdział.
          const serverChapters = Array.isArray(data?.ebook?.ebook_chapters)
            ? data.ebook.ebook_chapters
            : (Array.isArray(data?.chapters) ? data.chapters : []);
          const serverCh = serverChapters.find((c: any) => c.id?.toString() === chapterId);
          if (serverCh) {
            const serverVariants = Array.isArray(serverCh.image_variants) ? serverCh.image_variants : [];
            resolved = seedFromExisting(serverVariants, serverCh.image_url);
          }
        }
      } catch (e) {
        console.warn('⚠️ Nie udało się dociągnąć wariantów rozdziału (użyję lokalnych):', e);
      }
    }

    // Fallback na lokalne, jeśli serwer zawiódł — lepsze to niż pusty modal.
    setChapterVariants(resolved ?? seedFromExisting(localVariants, local?.image_url));
    setIsChapterPickerLoading(false);
  };

  // Wybór aktywnego wariantu grafiki rozdziału — woła select-image-variant (kopiuje wariant
  // pod stałą nazwę i ustawia image_url). Aktualizuje kafelek + cache-bust.
  const handleSelectChapterVariant = async (variantUrl: string) => {
    if (!currentEbookId || !chapterPickerId) return;
    setIsSelectingChapterVariant(true);
    setError(null);
    try {
      const res = await fetch(`/api/ebooks/${currentEbookId}/chapters/${chapterPickerId}/select-image-variant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantUrl }),
      });
      if (!res.ok) {
        let msg = 'Error selecting image';
        try { const e = await res.json(); if (e?.error) msg = e.error; } catch { msg = `Server error (${res.status})`; }
        throw new Error(msg);
      }
      const data = await res.json();
      if (!data.success || !data.image_url) throw new Error(data.error || 'Invalid response from the server');

      const timestamp = Date.now();
      const newUrl = `${data.image_url.split('?')[0]}?t=${timestamp}`;
      // Aktywna grafika rozdziału = stała nazwa; podbijamy też pulę, jeśli zwrócona.
      setTocItems(items => items.map(it => it.id === chapterPickerId
        ? { ...it, image_url: newUrl, ...(Array.isArray(data.image_variants) ? { image_variants: data.image_variants } : {}) }
        : it));
      if (Array.isArray(data.image_variants)) setChapterVariants(data.image_variants);
      setImageRefreshTimestamp(timestamp);
      console.log(`✅ Wariant rozdziału ${chapterPickerId} ustawiony jako aktywny`);
    } catch (err: any) {
      console.error('❌ Error selecting chapter variant:', err);
      setError(err.message);
    } finally {
      setIsSelectingChapterVariant(false);
    }
  };

  // Dogenerowanie kolejnego wariantu (przycisk "Generate more" w pickerze) — woła istniejący
  // generator z forceRegenerate:true (nowy obraz tej samej sceny), który dopisuje wariant do puli.
  const handleGenerateMoreChapter = async () => {
    if (!currentEbookId || !chapterPickerId) return;
    setIsGeneratingMoreChapter(true);
    setError(null);
    try {
      const res = await fetch(`/api/ebooks/${currentEbookId}/chapters/${chapterPickerId}/generate-image`, {
        method: 'POST',
        headers: getUserHeaders(),
        body: JSON.stringify({ forceRegenerate: true, size: "1024x1024" }),
      });
      if (!res.ok) {
        let msg = 'Error generating image';
        try { const e = await res.json(); if (e?.error) msg = e.error; } catch { msg = `Server error (${res.status})`; }
        throw new Error(msg);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Invalid response from the server');

      const timestamp = Date.now();
      const newUrl = data.image_url ? `${data.image_url.split('?')[0]}?t=${timestamp}` : undefined;
      // Świeżo dogenerowany wariant staje się aktywny; podbijamy pulę i kafelek.
      if (Array.isArray(data.image_variants)) setChapterVariants(data.image_variants);
      setTocItems(items => items.map(it => it.id === chapterPickerId
        ? { ...it, ...(newUrl ? { image_url: newUrl } : {}), ...(Array.isArray(data.image_variants) ? { image_variants: data.image_variants } : {}) }
        : it));
      setImageRefreshTimestamp(timestamp);
      if (!graphicsAdded) setGraphicsAdded(true);
      console.log(`✅ Dogenerowano wariant rozdziału ${chapterPickerId}`);
    } catch (err: any) {
      console.error('❌ Error generating more chapter variants:', err);
      setError(err.message);
    } finally {
      setIsGeneratingMoreChapter(false);
    }
  };

  const scrapeSingleUrl = async (url: string) => {
      if (!url.trim()) return;
      try {
        new URL(url);
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
        if (data.scrapedContent && data.scrapedContent.length > 0) {
          showSourcePreview('web', data.scrapedContent[0], 'success');
        } else if (data.errors && data.errors.length > 0) {
          const errorContent = {
            url: url,
            title: 'Scraping error',
            content: ''
          };
          showSourcePreview('web', errorContent, 'error', data.errors[0].error || 'Unknown error');
        } else {
          const emptyContent = {
            url: url,
            title: 'No content',
            content: ''
          };
          showSourcePreview('web', emptyContent, 'empty', 'No content found on this page or the content is too short');
        }
      } catch (err) {
          console.error('Error scraping single URL:', err);
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

  const handleRemoveScrapedContent = async (sourceToRemove: ScrapedContent) => {
    if (!currentEbookId || !sourceToRemove.id) {
      const newSources = scrapedContent.filter(item => item.url !== sourceToRemove.url);
      setScrapedContent(newSources);
      console.log('🗑️ Usunięto źródło ze stanu lokalnego (nie było w bazie):', sourceToRemove.url);
      return;
    }
    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/sources`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: sourceToRemove.id }),
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

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('The selected file is not a PDF file');
        return;
      }
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
          headers: { 'Content-Type': 'application/json' },
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
      if (sourcePreviewModal.sourceType === 'web' && sourcePreviewModal.content) {
        const urlIndex = urlInputs.findIndex(url => url === sourcePreviewModal.content!.url);
        if (urlIndex !== -1) {
          const newUrls = [...urlInputs];
          newUrls[urlIndex] = '';
          setUrlInputs(newUrls);
        }
      }
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
    const urlToRemove = urlInputs[index];
    if (urlToRemove) {
      const sourceObjectToRemove = scrapedContent.find(item => item.url === urlToRemove);
      if (sourceObjectToRemove) {
        handleRemoveScrapedContent(sourceObjectToRemove);
      }
    }
  };

  const scrapeUrls = async () => {
    const validUrls = urlInputs.filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) return [];
    setIsScrapingUrls(true);
    setError(null);
    try {
      const response = await fetch('/api/scrape-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (!response.ok) throw new Error('Error fetching chapters');
      const data = await response.json();
      if (!data.chapters || !Array.isArray(data.chapters)) {
        console.warn('Invalid chapter data:', data);
        return;
      }
      console.log(`📊 Fetched ${data.chapters.length} chapters from the server`);

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
      setImageRefreshTimestamp(timestamp);
      console.log('✅ Graphics status refreshed');
    } catch (error) {
      console.error('❌ Error while refreshing graphics status:', error);
    }
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
      console.log(`🔄 Updating ebook data for ID: ${currentEbookId}`);
      setTocItems([]);
      setCompletedChapterIds([]);
      setContentGenerated(false);
      setGraphicsAdded(false);
      setIntroContent(''); // Reset intro on regeneration

      const updateEbookResponse = await fetch(`/api/ebooks/${currentEbookId}`, {
        method: 'PUT',
        headers: { ...getUserHeaders() },
        body: JSON.stringify({
          title,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null
        }),
      });

      if (!updateEbookResponse.ok) throw new Error('Error updating the ebook data');

      await fetch(`/api/ebooks/${currentEbookId}/chapters`, { method: 'DELETE' });
      console.log(`🗑️ Old chapters for ebook ID ${currentEbookId} deleted.`);

      const response = await fetch('/api/anthropic/generate-toc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subtitle: subtitle.trim() || undefined,
          description: description.trim() || undefined,
          scrapedContent: scrapedContent,
          chapterCount,
          lang
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
        setChapterCount(data.tocItems.length); // suwak = faktyczna liczba (brak fałszywego "zmieniono")
        setOriginalTitle(title);
        setOriginalSubtitle(subtitle);
        setOriginalDescription(description);
        setOriginalScrapedContent(scrapedContent);

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
      const response = await fetch('/api/anthropic/generate-single-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subtitle: subtitle.trim() || undefined,
          chapter: chapter,
          allChapters: tocItems,
          description: description.trim() || undefined,
          scrapedContent: scrapedContent,
          lang
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

        const allChaptersWithContent = updatedTocItems.every(item =>
          item.content && item.content.trim().length > 0
        );

        if (allChaptersWithContent && !contentGenerated) {
          setContentGenerated(true);
          console.log('🎉 All chapters have content - set contentGenerated=true');
        }

        try {
          const updateResponse = await fetch(`/api/ebooks/${currentEbookId}/chapters/${chapterId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: data.chapter.content }),
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

  const handleRegenerateResponse = (regenerate: boolean) => {
    if (regenerate) {
      generateTableOfContents();
    } else {
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

  const generateIntro = async () => {
    if (!currentEbookId) return;
    setGeneratingChapterIds(prev => [...prev, 'intro']);
    try {
      console.log('📝 Starting Intro generation...');
      const response = await fetch('/api/anthropic/generate-intro', {
        method: 'POST',
        headers: getUserHeaders(),
        body: JSON.stringify({ ebookId: currentEbookId, debug: true, lang })
      });
      const data = await response.json();
      if (data.success && data.intro) {
        console.log('✅ Intro generated successfully');
        setIntroContent(data.intro);
        // Intro is automatically saved by the endpoint
        setCompletedChapterIds(prev => [...prev, 'intro']);
      } else {
        console.error('❌ Failed to generate intro:', data.error);
      }
    } catch (e) {
      console.error('❌ Error calling generate-intro:', e);
    } finally {
      setGeneratingChapterIds(prev => prev.filter(id => id !== 'intro'));
    }
  };

  const handleGenerateChapterContent = (chapterId: string) => {
    if (chapterId === 'intro') {
      generateIntro();
      return;
    }
    setChapterToRegenerate(chapterId);
    setIsGeneratingSingleChapter(true);
    generateSingleChapterContent(chapterId);
  };

  const generateMissingContent = async () => {
    if (chaptersWithoutContent.length === 0) return;
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
      if (tocItems.length === 0) {
        setError('No chapters to generate content for');
        return;
      }
      if (!currentEbookId) {
        setError('Missing ebook identifier. Try refreshing the page and starting over.');
        return;
      }
      setError(null);
      setIsGeneratingContent(true);
      setGeneratingChapterIds(tocItems.map(item => item.id));
      setCompletedChapterIds([]);
      setCurrentGeneratingIndex(-1);

      console.log(`🚀 Starting parallel generation of ${tocItems.length} chapters...`);

      try {
        // 1. Wstep rownolegle z rozdzialami — tylko gdy user go chce i ma dostep.
        //    hasIntroAccess pilnuje planu takze tutaj, zeby nie strzelac w endpoint,
        //    ktory i tak odpowie 403.
        if (includeIntro && hasIntroAccess(userRole)) {
          generateIntro();
        }

        // 2. Start Chapters Generation
        const chaptersToGenerate = [...tocItems];
        const updatedTocItems = [...tocItems];

        const generationPromises = chaptersToGenerate.map(async (chapter, index) => {
          try {
            console.log(`📝 [${index + 1}/${chaptersToGenerate.length}] Generating: ${chapter.title}`);
            const response = await fetch('/api/anthropic/generate-single-chapter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title,
                subtitle: subtitle.trim() || undefined,
                chapter: chapter,
                allChapters: updatedTocItems,
                description: description.trim() || undefined,
                scrapedContent: scrapedContent,
                lang
              }),
            });

            if (!response.ok) {
              let errorMessage = 'Error generating chapter content';
              try {
                const errorData = await response.json();
                if (errorData && errorData.error) errorMessage = errorData.error;
              } catch (jsonError) {
                errorMessage = `Server error (${response.status})`;
              }
              throw new Error(errorMessage);
            }

            const data = await response.json();

            if (data.chapter && data.chapter.content) {
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

              try {
                const updateResponse = await fetch(`/api/ebooks/${currentEbookId}/chapters/${chapter.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: data.chapter.content }),
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
            setGeneratingChapterIds(prev => prev.filter(id => id !== chapter.id));
            console.error(`❌ Error generating chapter ${chapter.title}:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, chapter, error: errorMessage };
          }
        });

        console.log('⏳ Waiting for all generations to finish...');
        const results = await Promise.allSettled(generationPromises);

        const errors: string[] = [];
        let successCount = 0;

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
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

        if (errors.length > 0) {
          console.warn(`⚠️ Errors in ${errors.length}/${chaptersToGenerate.length} chapters`);
          setError(`Errors while generating some chapters: ${errors.join(', ')}`);
        } else {
          console.log(`🎉 All ${successCount} chapters generated successfully!`);
        }

        setTocItems(currentTocItems => {
          const chaptersWithContent = currentTocItems.filter(item =>
            item.content && item.content.trim().length > 0
          );
          console.log(`📊 Final status: ${chaptersWithContent.length}/${currentTocItems.length} chapters have content`);

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
          return currentTocItems;
        });

        if (tocItems.length > 0) {
          // Wstep jako domyslny TYLKO gdy jest na liscie (plan + wybor usera),
          // inaczej pierwszy rozdzial — bez pustego "Select a chapter from the list".
          const defaultActiveId = (includeIntro && hasIntroAccess(userRole))
            ? 'intro'
            : tocItems[0].id;
          setActiveChapterId(defaultActiveId);
          console.log(`🎯 Set active chapter to ${defaultActiveId}`);
        }

        console.log('🔄 Synchronizing chapter status...');
        syncChapterStatus();
        console.log('🎉 Moving to step 3...');
        setStep(3);
        console.log(`✅ Generation finished: ${successCount}/${chaptersToGenerate.length} success`);

      } catch (err) {
        console.error('❌ General generation error:', err);
        handleApiError(err, 'An error occurred while generating content. Please try again.');
      } finally {
        console.log('🧹 Cleaning up states...');
        setIsGeneratingContent(false);
        setCurrentGeneratingIndex(-1);
        setGeneratingChapterIds(prev => prev.filter(id => id !== 'intro')); // Clear intro just in case
      }
  };

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
        body: JSON.stringify({ forceRegenerate, size: "1024x1024" }),
      });

      setAiImageGenerationProgress(60);

      if (!response.ok) {
        let errorMessage = 'Error generating AI graphic';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) errorMessage = errorData.error;
        } catch (jsonError) {
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      setAiImageGenerationProgress(90);
      const data = await response.json();
      if (!data.success || !data.image_url) throw new Error('Invalid response from the server');

      console.log(`✅ AI graphic generated for chapter ${chapter.title}: ${data.image_url}`);

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
      if (!graphicsAdded) setGraphicsAdded(true);
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

  const handleGenerateAllImages = async () => {
    const chaptersToGenerate = tocItems.filter(
      item => (item.content && item.content.trim().length > 0) && !item.image_url
    );
    if (chaptersToGenerate.length === 0) {
      setError('Brak rozdziałów z treścią do wygenerowania grafik.');
      return;
    }
    console.log(`🎨 Rozpoczynam generowanie ${chaptersToGenerate.length} grafik w paczkach...`);
    setIsGeneratingAllImages(true);
    setGeneratedImagesCount(0);
    setTotalImagesToGenerate(chaptersToGenerate.length);
    setError(null);

    const startTime = Date.now();
    const batchSize = 3;
    const allFailedChapters: { title: string, reason: string }[] = [];
    let totalSuccessCount = 0;

    for (let i = 0; i < chaptersToGenerate.length; i += batchSize) {
      const batch = chaptersToGenerate.slice(i, i + batchSize);
      console.log(`   -> Przetwarzanie paczki nr ${Math.floor(i / batchSize) + 1}: Generowanie ${batch.length} obrazów...`);

      const batchPromises = batch.map(chapter =>
        fetch(`/api/ebooks/${currentEbookId}/chapters/${chapter.id}/generate-image`, {
          method: 'POST',
          headers: getUserHeaders(),
          body: JSON.stringify({ forceRegenerate: false, size: "1024x1024" }),
        })
        .then(response => {
          if (!response.ok) {
            return response.json().then(err => Promise.reject(err)).catch(() => Promise.reject({ error: `Błąd serwera: ${response.status}` }));
          }
          return response.json();
        })
        .then(data => {
          if (!data.success || !data.image_url) {
            throw new Error('Nieprawidłowa odpowiedź z serwera');
          }
          return { chapterId: chapter.id, imageUrl: data.image_url, title: chapter.title };
        })
        .catch(error => {
          return { chapterId: chapter.id, error: error.error || error.message || 'Nieznany błąd', title: chapter.title };
        })
      );

      const results = await Promise.allSettled(batchPromises);
      const successfulChaptersInBatch: { chapterId: string, imageUrl: string }[] = [];

      results.forEach(result => {
        if (result.status === 'fulfilled' && 'imageUrl' in result.value) {
          const { chapterId, imageUrl, title } = result.value;
          console.log(`   ✅ Sukces dla rozdziału: "${title}"`);
          successfulChaptersInBatch.push({ chapterId, imageUrl });
        } else {
          const reason = result.status === 'rejected'
            ? result.reason
            : ('error' in result.value ? result.value.error : 'Nieznany błąd');
          const chapterTitle = result.status === 'fulfilled' ? result.value.title : 'Nieznany rozdział';
          console.error(`   ❌ Błąd dla rozdziału "${chapterTitle}":`, reason);
          allFailedChapters.push({ title: chapterTitle, reason: reason });
        }
      });

      if (successfulChaptersInBatch.length > 0) {
        const timestamp = Date.now();
        setTocItems(currentTocItems => {
          const updatedItems = [...currentTocItems];
          successfulChaptersInBatch.forEach(({ chapterId, imageUrl }) => {
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
      totalSuccessCount += successfulChaptersInBatch.length;
      setGeneratedImagesCount(totalSuccessCount);
    }

    setIsGeneratingAllImages(false);
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`📊 Podsumowanie generowania w paczkach (czas: ${duration}s):`);
    console.log(`   - Sukcesy: ${totalSuccessCount}/${chaptersToGenerate.length}`);
    console.log(`   - Błędy: ${allFailedChapters.length}`);

    if (allFailedChapters.length > 0) {
      const errorTitles = allFailedChapters.map(f => f.title).join(', ');
      setError(`Nie udało się wygenerować grafiki dla ${allFailedChapters.length} rozdziałów: ${errorTitles}. Możesz spróbować ponownie dla pojedynczych grafik.`);
    } else {
      setError(null);
    }
    setTimeout(() => refreshImagesStatus(), 1000);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || (!uploadingImageForChapter && !uploadingCoverImage) || !currentEbookId) return;

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
        response = await fetch(`/api/ebooks/${currentEbookId}/cover-image`, {
          method: 'POST',
          headers: headers,
          body: formData
        });
      } else if (uploadingImageForChapter) {
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
          if (errorData && errorData.error) errorMessage = errorData.error;
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

          // Upload to nowy wariant okładki — odśwież listę wariantów ze zwróconych danych,
          // żeby modal pokazał wgrany plik (już ustawiony przez backend jako aktywny).
          if (Array.isArray(data.all_variants)) {
            setCoverVariants(data.all_variants);
            console.log(`🎛️ Po uploadzie wariantów okładki: ${data.all_variants.length}`);
          }
          console.log(`✅ Cover has been successfully uploaded: ${newImageUrl}`);

          // Mockup jest już przegenerowany po stronie endpointu uploadu — nie wołamy ponownie.

        } else if (uploadingImageForChapter) {
          // Upload to nowy wariant 'uploaded' — zapisz image_url ORAZ pulę wariantów na rozdziale,
          // żeby picker (jeśli otwarty dla tego rozdziału) od razu pokazał wgrany wariant.
          const uploadedVariants = Array.isArray(data.all_variants) ? data.all_variants : null;
          setTocItems(prevItems => prevItems.map(item =>
            item.id === uploadingImageForChapter
              ? { ...item, image_url: newImageUrl, ...(uploadedVariants ? { image_variants: uploadedVariants } : {}) }
              : item
          ));
          if (uploadedVariants && uploadingImageForChapter === chapterPickerId) {
            setChapterVariants(uploadedVariants);
            console.log(`🎛️ Po uploadzie wariantów rozdziału: ${uploadedVariants.length}`);
          }
          if (previewImage && previewImage.startsWith(baseUrl)) {
            setPreviewImage(newImageUrl);
          }
          console.log(`✅ Image has been successfully uploaded for chapter ID=${uploadingImageForChapter}: ${newImageUrl}`);
        }
        setImageRefreshTimestamp(timestamp);
        if (!graphicsAdded) setGraphicsAdded(true);
      } else {
        throw new Error('Invalid response from the server');
      }
    } catch (err) {
      handleApiError(err, 'An error occurred while uploading the image');
    } finally {
      setIsSaving(false);
      setUploadingImageForChapter(null);
      setUploadingCoverImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Otwiera natywny dialog wyboru pliku i wykrywa ANULOWANIE.
  // Gdy okno odzyska focus, a żaden plik nie został wybrany, resetuje flagi uploadu —
  // bez tego uploadingCoverImage / uploadingImageForChapter "wisiały" na true po anulowanym
  // dialogu i blokowały przyciski (change w modalu, upload grafik rozdziałów).
  const triggerFilePicker = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
    const handleFocusBack = () => {
      window.removeEventListener('focus', handleFocusBack);
      setTimeout(() => {
        if (fileInputRef.current && (fileInputRef.current.files?.length ?? 0) === 0) {
          setUploadingCoverImage(false);
          setUploadingImageForChapter(null);
        }
      }, 400);
    };
    window.addEventListener('focus', handleFocusBack);
  };

  const handleOpenFileDialog = (chapterId: string) => {
    setUploadingCoverImage(false);
    setUploadingImageForChapter(chapterId);
    triggerFilePicker();
  };

  const handleOpenCoverFileDialog = () => {
    setUploadingCoverImage(true);
    setUploadingImageForChapter(null);
    triggerFilePicker();
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapters: [{ title: newItemTitle.trim() }] }),
      });
      if (!response.ok) throw new Error('Error adding chapter');
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
        if (newItemInputRef.current) newItemInputRef.current.focus();
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
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error deleting chapter');
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
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === tocItems.length - 1)) return;

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'reorder', chapterId: id, direction: direction }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error updating chapter positions');
      }

      const updatedItems = newItems.map((item, idx) => ({ ...item, position: idx }));
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingItemTitle.trim() }),
      });
      if (!response.ok) throw new Error('Error updating chapter title');

      setTocItems(tocItems.map(item =>
        item.id === editingItemId ? { ...item, title: editingItemTitle.trim() } : item
      ));

      const chapter = tocItems.find(item => item.id === editingItemId);
      if (chapter && editingItemTitle.trim() !== originalChapterTitle && chapter.content && chapter.content.trim() !== '') {
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

    // Handle INTRO save
    if (activeChapterId === 'intro') {
      setIsSaving(true);
      try {
        const response = await fetch(`/api/ebooks/${currentEbookId}`, {
          method: 'PUT',
          headers: getUserHeaders(),
          body: JSON.stringify({
            intro: editingChapterContent
          }),
        });

        if (!response.ok) throw new Error('Error updating intro content');

        setIntroContent(editingChapterContent);
        setEditingContent(false);
        setEditingChapterContent('');

        // Mark intro as completed
        setCompletedChapterIds(prev => {
          if (!prev.includes('intro')) return [...prev, 'intro'];
          return prev;
        });
      } catch (err) {
        handleApiError(err, 'An error occurred while saving intro content');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Handle normal chapter save
    setIsSaving(true);
    try {
      const response = await fetch(`/api/ebooks/${currentEbookId}/chapters/${activeChapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingChapterContent }),
      });
      if (!response.ok) throw new Error('Error updating chapter content');

      setTocItems(tocItems.map(item =>
        item.id === activeChapterId ? { ...item, content: editingChapterContent } : item
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
        menuElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleExportEbook = async () => {
      if (!currentEbookId) {
        setError('Missing ebook identifier');
        return;
      }
      setIsSaving(true);
      setError(null);

      try {
        const needsCover = !coverData?.cover_status?.complete || !coverData?.cover_url;
        if (needsCover) {
          console.log('🎨 Cover is not ready - generating automatically...');
          const coverGenerated = await generateCover(false, false);
          if (!coverGenerated) {
            setError('Failed to automatically generate the cover. Please generate the cover manually before exporting.');
            setIsSaving(false);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('📄 Starting PDF export...');
        const response = await fetch(`/api/ebooks/${currentEbookId}/export-pdf`, {
          method: 'POST',
          headers: getUserHeaders(),
        });

        if (!response.ok) {
          let errorMessage = 'Error generating PDF';
          try {
            const errorData = await response.json();
            if (errorData && errorData.error) errorMessage = errorData.error;
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

        // ✅ DODAJ TO: Aktualizuj status ebooka na "completed"
        console.log('📝 Updating ebook status to completed...');
        const updateStatusResponse = await fetch(`/api/ebooks/${currentEbookId}`, {
          method: 'PUT',
          headers: getUserHeaders(),
          body: JSON.stringify({
            status: 'completed'
          }),
        });

        if (!updateStatusResponse.ok) {
          console.error('Failed to update ebook status');
        }
        // KONIEC DODANEGO KODU

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
      }};

  const handleDownloadAsPng = async (webpUrl: string | null, baseFileName: string) => {
    if (!webpUrl) return;
    setIsConverting(true);
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = webpUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Nie można uzyskać kontekstu canvas");

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
      console.error("Błąd podczas konwersji WebP na PNG:", error);
      setError("Nie udało się przekonwertować obrazka. Spróbuj pobrać go manualnie.");
    } finally {
      setIsConverting(false);
    }
  };

  const handleImagePreview = (imageUrl: string | undefined, title: string, downloadName?: string) => {
      if (imageUrl && imageUrl.trim()) {
          setPreviewImage(imageUrl);
          setPreviewImageTitle(title);
          const finalDownloadName = downloadName || title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.jpg';
          setPreviewImageName(finalDownloadName);
      } else {
          console.warn('Nie można wyświetlić podglądu - pusty URL:', imageUrl);
      }
  };

  const handleClosePreview = () => {
      setPreviewImage(null);
      setPreviewImageTitle('');
      setPreviewImageName('');
  };

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
            status: "draft"
          }),
        });

        if (!response.ok) throw new Error('Błąd podczas zapisywania szkicu ebooka.');

        const titleChanged = title !== originalTitle;
        const subtitleChanged = subtitle !== originalSubtitle;
        // ✅ CHECK IF COVER EXISTS TO TRIGGER MOCKUP UPDATE
        const hasCover = coverData?.cover_url && coverData.cover_url.trim().length > 0;

        if (titleChanged || subtitleChanged || hasCover || coverGenerated) {
          console.log('📸 Saving draft - triggering mockup update...');
          const mockupResponse = await fetch(`/api/ebooks/${currentEbookId}/generate-mockups`, {
            method: 'POST',
            headers: getUserHeaders(),
          });
          if (mockupResponse.ok) console.log('✅ Mockupy zostały zaktualizowane');
          else console.warn('⚠️ Nie udało się zaktualizować mockupów');
        }

        draftSavedByUser.current = true;
        onClose();
      } catch (err) {
        handleApiError(err, 'Wystąpił błąd podczas zapisywania szkicu.');
      } finally {
        setIsSavingDraft(false);
      }
  };

  // Prepare Step 3 items (Intro + Chapters)
  // Wstep trafia na liste TYLKO gdy user go wlaczyl I ma go w planie.
  // Dziala w obie strony: wylaczenie checkboxa usuwa go z listy nawet wtedy,
  // gdy tresc zostala wczesniej wygenerowana i siedzi w introContent.
  const showIntro = includeIntro && hasIntroAccess(userRole);
  const introItem: TocItem = {
    id: 'intro',
    title: pl ? 'Wstęp' : 'Introduction',
    content: introContent,
    position: -1,
    image_url: undefined // Intro doesn't have an explicit image in this editor flow
  };
  const step3TocItems = showIntro ? [introItem, ...tocItems] : tocItems;

  return (
    <div className="max-w-5xl mx-auto p-0 sm:p-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-sm flex items-start animate-fadeIn">
          <AlertCircle className="mr-3 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <div className="font-medium mb-1">An error occurred</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}

      <div className="mb-4 px-4 sm:px-0 mt-4 sm:mt-0">
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
                changeStep(3);
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
          <div className="w-20 text-center sm:-ml-5">Data</div>
          <div className="w-20 text-center">Chapters</div>
          <div className="w-20 text-center">Content</div>
          <div className="w-20 text-center sm:-mr-5">Graphics</div>
        </div>
      </div>

      {step === 1 && (
        <Step1Details
          title={title}
          setTitle={setTitle}
          subtitle={subtitle}
          setSubtitle={setSubtitle}
          description={description}
          setDescription={setDescription}
          urlInputs={urlInputs}
          handleUrlChange={handleUrlChange}
          scrapeSingleUrl={scrapeSingleUrl}
          isScrapingSingleUrl={isScrapingSingleUrl}
          isScrapingUrls={isScrapingUrls}
          scrapedContent={scrapedContent}
          handleRemoveScrapedContent={handleRemoveScrapedContent}
          handlePdfUpload={handlePdfUpload}
          handleOpenPdfDialog={handleOpenPdfDialog}
          isUploadingPdf={isUploadingPdf}
          isSaving={isSaving}
          isSavingDraft={isSavingDraft}
          handleSaveDraft={handleSaveDraft}
          isGeneratingToc={isGeneratingToc}
          tocGenerated={tocGenerated}
          changeStep={changeStep}
          generateTableOfContents={generateTableOfContents}
          userRole={userRole}
          isInitializing={isInitializing}
          seedSuggestions={seedSuggestions}
          onInspireMe={openSeedSpotlight}
          titleInputRef={titleInputRef}
          subtitleInputRef={subtitleInputRef}
          descriptionInputRef={descriptionInputRef}
          pdfInputRef={pdfInputRef}
          highlightSources={showSourcesHighlight}
          sourcesRef={sourcesRef}
          onDismissHighlight={dismissSourcesHighlight}
          sourcesSpotlightHidden={sourcesSpotlightHidden}
          toggleSourcesSpotlightHidden={toggleSourcesSpotlightHidden}
          bounceGenerate={bounceGenerate}
          chapterCount={chapterCount}
          setChapterCount={setChapterCount}
        />
      )}

      {step === 2 && (
        <Step2Structure
          title={title}
          subtitle={subtitle}
          tocItems={tocItems}
          userRole={userRole}
          editingItemId={editingItemId}
          editingItemTitle={editingItemTitle}
          setEditingItemTitle={setEditingItemTitle}
          editItemInputRef={editItemInputRef}
          handleKeyDown={handleKeyDown}
          handleSaveEdit={handleSaveEdit}
          isGeneratingContent={isGeneratingContent}
          generatingChapterIds={generatingChapterIds}
          completedChapterIds={completedChapterIds}
          currentGeneratingIndex={currentGeneratingIndex}
          handleCancelEdit={handleCancelEdit}
          handleContextMenu={handleContextMenu}
          contextMenuVisible={contextMenuVisible}
          handleMoveItem={handleMoveItem}
          isSaving={isSaving}
          handleStartEditing={handleStartEditing}
          handleRemoveItem={handleRemoveItem}
          newItemTitle={newItemTitle}
          setNewItemTitle={setNewItemTitle}
          handleAddItem={handleAddItem}
          newItemInputRef={newItemInputRef}
          setStep={setStep}
          contentGenerated={contentGenerated}
          changeStep={changeStep}
          generateChaptersContent={generateChaptersContent}
          includeIntro={includeIntro}
          setIncludeIntro={setIncludeIntro}
        />
      )}

      {step === 3 && (
        <Step3Content
          title={title}
          subtitle={subtitle}
          tocItems={step3TocItems} // Pass the combined list with Intro
          chaptersWithoutContent={chaptersWithoutContent}
          setChaptersWithoutContent={setChaptersWithoutContent}
          isGeneratingMissingContent={isGeneratingMissingContent}
          generateMissingContent={generateMissingContent}
          activeChapterId={activeChapterId}
          setActiveChapterId={setActiveChapterId}
          editingContent={editingContent}
          isGeneratingContent={isGeneratingContent}
          completedChapterIds={completedChapterIds}
          generatingChapterIds={generatingChapterIds}
          handleGenerateChapterContent={handleGenerateChapterContent}
          isSaving={isSaving}
          isGeneratingSingleChapter={isGeneratingSingleChapter}
          chapterToRegenerate={chapterToRegenerate}
          handleStartEditingContent={handleStartEditingContent}
          handleSaveEditedContent={handleSaveEditedContent}
          handleCancelEditContent={handleCancelEditContent}
          editingChapterContent={editingChapterContent}
          setEditingChapterContent={setEditingChapterContent}
          contentEditRef={contentEditRef}
          currentGeneratingIndex={currentGeneratingIndex}
          setStep={setStep}
        />
      )}

      {step === 4 && (
        <Step4Graphics
          title={title}
          subtitle={subtitle}
          tocItems={tocItems} // Step 4 only needs chapters for now
          coverData={coverData}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          imageRefreshTimestamp={imageRefreshTimestamp}
          handleImagePreview={handleImagePreview}
          fetchCoverStatus={fetchCoverStatus}
          refreshImagesStatus={refreshImagesStatus}
          generateCover={generateCover}
          isGeneratingCover={isGeneratingCover}
          isGeneratingAllImages={isGeneratingAllImages}
          uploadingCoverImage={uploadingCoverImage}
          handleOpenCoverFileDialog={handleOpenCoverFileDialog}
          openCoverPicker={() => setShowCoverPicker(true)}
          openChapterPicker={openChapterPicker}
          handleOpenFileDialog={handleOpenFileDialog}
          isSaving={isSaving}
          uploadingImageForChapter={uploadingImageForChapter}
          handleGenerateAIImage={handleGenerateAIImage}
          completedChapterIds={completedChapterIds}
          generatingAIImageForChapter={generatingAIImageForChapter}
          aiImageGenerationError={aiImageGenerationError}
          generatedImagesCount={generatedImagesCount}
          totalImagesToGenerate={totalImagesToGenerate}
          setStep={setStep}
          handleGenerateAllImages={handleGenerateAllImages}
          handleExportEbook={handleExportEbook}
        />
      )}

      {showRegeneratePopup && (
        <RegeneratePopup
          subtitle={subtitle}
          originalSubtitle={originalSubtitle}
          isGeneratingToc={isGeneratingToc}
          handleRegenerateResponse={handleRegenerateResponse}
        />
      )}

      {showChapterRegeneratePopup && (
        <ChapterRegeneratePopup
          chapterToRegenerate={chapterToRegenerate}
          tocItems={tocItems}
          originalChapterTitle={originalChapterTitle}
          isGeneratingSingleChapter={isGeneratingSingleChapter}
          handleChapterRegenerateResponse={handleChapterRegenerateResponse}
        />
      )}

      <SourcePreviewModal
        lang={lang}
        isVisible={sourcePreviewModal.isVisible}
        sourceType={sourcePreviewModal.sourceType || 'web'}
        content={sourcePreviewModal.content}
        status={sourcePreviewModal.status || 'success'}
        errorDetails={sourcePreviewModal.errorDetails}
        onAccept={handleSourceAccept}
        onReject={handleSourceReject}
      />

      {previewImage && (
        <ImagePreviewModal
          previewImage={previewImage}
          previewImageTitle={previewImageTitle}
          previewImageName={previewImageName}
          handleClosePreview={handleClosePreview}
          handleDownloadAsPng={handleDownloadAsPng}
          isConverting={isConverting}
        />
      )}

      {showPromptPreview && (
        <PromptPreviewModal
          chapterId={showPromptPreview}
          onClose={() => setShowPromptPreview(null)}
          tocItems={tocItems}
          chapterPrompts={chapterPrompts}
          handleRegenerateAIImageWithNewPrompt={handleRegenerateAIImageWithNewPrompt}
          generatingAIImageForChapter={generatingAIImageForChapter}
          isGeneratingAllImages={isGeneratingAllImages}
        />
      )}

      <CoverVariantPickerModal
        isOpen={showCoverPicker}
        variants={coverVariants}
        activeUrl={coverData?.cover_url}
        userRole={userRole}
        variantLimit={getVariantLimit(userRole)}
        cacheBust={imageRefreshTimestamp}
        isSelecting={isSelectingCoverVariant}
        isUploading={uploadingCoverImage}
        isGenerating={isGeneratingMoreCover}
        onSelect={handleSelectCoverVariant}
        onZoom={(variantUrl) => handleImagePreview(variantUrl, `Cover preview: ${title}`, `cover_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`)}
        onUploadOwn={handleOpenCoverFileDialog}
        onGenerateMore={handleGenerateMoreCover}
        onUpgrade={(targetRole) => {
          console.log('🔼 Upgrade CTA →', targetRole);
          // TODO: podpiąć realną ścieżkę weryfikacji/planów
        }}
        onClose={() => setShowCoverPicker(false)}
      />

      <ChapterImageVariantPickerModal
        isOpen={chapterPickerId !== null}
        chapterTitle={tocItems.find(i => i.id === chapterPickerId)?.title}
        variants={chapterVariants}
        activeUrl={tocItems.find(i => i.id === chapterPickerId)?.image_url}
        userRole={userRole}
        variantLimit={getVariantLimit(userRole)}
        cacheBust={imageRefreshTimestamp}
        isLoading={isChapterPickerLoading}
        isSelecting={isSelectingChapterVariant}
        isUploading={isSaving && uploadingImageForChapter === chapterPickerId}
        isGenerating={isGeneratingMoreChapter}
        onSelect={handleSelectChapterVariant}
        onUploadOwn={() => chapterPickerId && handleOpenFileDialog(chapterPickerId)}
        onGenerateMore={handleGenerateMoreChapter}
        onClose={() => setChapterPickerId(null)}
      />

      <style jsx global>{`
        #modal-scroll-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        #modal-scroll-container::-webkit-scrollbar {
          display: none;
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
      `}</style>

      {/* Spotlight propozycji tytułów — nakładka na CAŁY modal, panel wyśrodkowany */}
      {showSeedSpotlight && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0a0f1e]/75 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={dismissSeedSpotlight}
              aria-label="Close"
              className="absolute top-3.5 right-3.5 z-10 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 cursor-pointer flex items-center justify-center text-white transition-colors"
            >
              <X size={16} />
            </button>

            {/* Nagłówek akcentowy */}
            <div className="bg-indigo-700 px-6 pt-6 pb-5">
              <div className="inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[11px] font-medium uppercase tracking-wider text-white">
                  {pl ? 'Zgodnie z obietnicą' : 'As promised'}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white leading-snug">
                {pl
                  ? 'Przyjrzeliśmy się temu, co robisz, i stworzyliśmy mocne tytuły na start z inflee.app'
                  : 'We looked at your work and crafted strong titles to help you start with inflee.app'}
              </h3>
              <p className="text-sm text-white/80 mt-2.5 leading-relaxed">
                {pl
                  ? 'Każdy z nich łączy Twoją wiedzę z tym, czego naprawdę pragną Twoi idealni klienci. Wybierz jeden, aby maksymalizować konwersję i zacząć zbierać wartościowe leady.'
                  : 'Each one connects your expertise with what your perfect clients actually want. Pick one to maximize conversion and start collecting valuable leads.'}
              </p>
            </div>

            {/* Karty */}
            <div className="px-6 pt-5 pb-6">
              <p className="text-[13px] font-medium text-gray-700 mb-3">
                {pl ? 'Wybierz jeden z poniższych tytułów:' : 'Use one of the titles below:'}
              </p>
              <div className="space-y-2.5">
                {seedsLoading ? (
                  [0, 1, 2].map((i) => (
                    <div key={i} className="rounded-xl border border-gray-200 bg-white p-3.5 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  ))
                ) : (
                  seedSuggestions.map((seed) => (
                    <button
                      key={seed.position}
                      type="button"
                      onClick={() => handlePickSeed(seed.title, seed.subtitle, seed.description)}
                      className="group w-full text-left rounded-xl border border-gray-200 bg-white p-3.5 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-center justify-between gap-3"
                    >
                      <span className="flex-1">
                        <span className="block text-[15px] font-semibold text-gray-800 leading-snug">{seed.title}</span>
                        <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{seed.subtitle}</span>
                      </span>
                      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 group-hover:bg-indigo-600 flex items-center justify-center transition-colors">
                        <ArrowRight size={15} className="text-indigo-600 group-hover:text-white transition-colors" />
                      </span>
                    </button>
                  ))
                )}
              </div>

              {!seedsLoading && (
                <>
                  {/* Seedy sa wystawiane raz, razem z kodem zaproszenia (/api/my-seeds),
                      wiec nie ma czego regenerowac — user wybiera jeden albo pisze wlasny. */}
                  <div className="flex items-center justify-end mt-4">
                    <button
                      type="button"
                      onClick={handleWriteMyOwn}
                      className="text-[13px] text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
                    >
                      {pl ? 'albo napisz własny' : 'or write your own'}
                    </button>
                  </div>

                  <div className="border-t border-gray-200 mt-4 pt-3.5">
                    <label className="flex items-center gap-2 cursor-pointer text-[13px] text-gray-500 select-none">
                      <input
                        type="checkbox"
                        checked={seedShowOnStart}
                        onChange={(e) => toggleSeedShowOnStart(e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-indigo-700"
                      />
                      Show this when I start a new ebook
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}