// src/components/pages/StronyZapisuContent.tsx
"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileText, Search, Plus, Eye, Edit, Trash2, Clock, Check, AlertTriangle,
         BookOpen, ShoppingCart, Copy, X, Video, QrCode, Lock, Sparkles, ImageIcon, Film } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/hooks/useAuth';
import { useReelSessionState, clearReelSession } from '@/hooks/useReelSessionState';
import { ReelModal } from './ReelModal';

// Interfaces
interface PageItem {
  id: string;
  title: string;
  headline?: string;
  subtitle?: string;
  creator: string;
  supervisorCode?: string;
  visits: number;
  leads: number;
  type: string;
  status: string;
  createdAt: string;
  url: string;
  draft_url: string;
  coverImage: string;
  x_amz_meta_title?: string;
  videoPassword?: string;
  isOwnedByUser?: boolean;
}

interface SupervisorDescription {
  code: string;
  description: string;
}

interface PageStats {
  total: number;
  published: number;
  pending: number;
  draft: number;
  ebook: number;
  sales: number;
}

interface PagesApiResponse {
  pages: PageItem[];
  stats: PageStats;
}

// ─── Translations ────────────────────────────────────────────────────────────

const translations = {
  pl: {
    allPages: 'Wszystkie Strony',
    published: 'Opublikowane',
    pending: 'Oczekujące',
    drafts: 'Szkice',
    searchPages: 'Szukaj stron...',
    search: 'Szukaj',
    clear: 'Wyczyść',
    yourPages: 'Twoje Strony',
    showing: 'Wyświetlanie',
    of: 'z',
    pages: 'stron',
    mustBeLoggedIn: 'Musisz być zalogowany, aby zobaczyć tę stronę.',
    errorLoadingPages: 'Błąd ładowania stron',
    noPages: 'Brak Stron',
    noPagesMatch: 'Brak stron pasujących do kryteriów.',
    noPagesFound: 'Nie znaleziono żadnych stron.',
    loading: 'Ładowanie...',
    mockupPreview: 'Podgląd mockupu',
    visits: 'wizyt',
    leads: 'leadów',
    author: 'Autor:',
    created: 'Utworzono:',
    supervisor: 'Opiekun:',
    password: 'Hasło:',
    copied: 'Skopiowano!',
    awaitingModeration: 'Oczekuje na moderację',
    ebook: 'e-book',
    sales: 'sprzedaż',
    link: 'Link:',
    awaitingPublication: 'Oczekuje na publikację',
    noCover: 'Brak okładki',
    edit: 'Edytuj',
    editAndPublish: 'Edytuj i opublikuj',
    preview: 'Podgląd',
    delete: 'Usuń',
    generateReel: 'Utwórz rolkę',
    showReel: 'Pokaż rolkę',
    reelGenerator: 'Generator Rolki',
    reelPreview: 'Podgląd Rolki',
    reelHeader: 'Nagłówek Rolki',
    reelHeaderPlaceholder: 'Wprowadź nagłówek rolki...',
    reelCTA: 'Przycisk CTA',
    ctaDownload: 'Pobierz',
    ctaComment: 'Komentarz (Menychat)',
    ctaCommentShort: 'Komentarz',
    ctaPassword: 'Hasło/Słowo kluczowe',
    ctaPasswordPlaceholder: 'np. Lista',
    voice: 'Głos',
    voiceMale: 'Męski',
    voiceFemale: 'Żeński',
    generate: 'Generuj',
    generating: 'Generowanie...',
    generatingMessage: 'Inflee.app właśnie generuje Twoją rolkę. To zajmie ok. 3 minut — nie zamykaj tego okna. Po ukończeniu rolka pojawi się w miejscu podglądu.',
    reelConfig: 'Konfiguracja',
    reelCtaDownloadFull: 'Pobierz darmowy E-BOOK',
    reelCtaCommentPrefix: 'Skomentuj',
    reelCtaCommentSuffix: 'aby pobrać',
    markerScale: 'Skala zaznaczenia',
    markerPosition: 'Pozycja Y zaznaczenia',
    markerSeed: 'Kształt zaznaczenia',
    reelIntroPlaceholder: 'Czy wiesz, że większość osób popełnia ten sam błąd?',
    actionError: 'Błąd Akcji',
    confirmDeletion: 'Potwierdź Usunięcie',
    deleteConfirmation: 'Czy na pewno chcesz usunąć stronę',
    deleteWarning: 'Ta akcja jest nieodwracalna. Wszystkie pliki i dane powiązane z tą stroną zostaną usunięte.',
    cancel: 'Anuluj',
    deleting: 'Usuwanie...',
    deletePage: 'Usuń Stronę',
    ebookMockupPreview: 'Podgląd mockupu e-booka',
    pageInfo: 'Informacje o Stronie',
    title: 'Tytuł',
    subtitle: 'Podtytuł',
    close: 'Zamknij',
    openingPreview: 'Otwieranie podglądu w nowej karcie...',
    creator: 'Autor:',
    scanQrCode: 'Zeskanuj kod QR, aby odwiedzić stronę',
    copying: 'Kopiowanie...',
    copiedToClipboard: 'Skopiowano do schowka!',
    copyQrCode: 'Skopiuj kod QR do schowka',
    status_published: 'Opublikowana',
    status_pending: 'Oczekująca',
    status_draft: 'Szkic',
    status_unknown: 'Nieznany',
    // ── CTA Options ──
    ctaOption: 'Wariant CTA',
    ctaTextPreview: 'Podgląd tekstu CTA',
    ctaDownloadTemplate: 'Pobierz bezpłatny ebook',
    ctaCommentTemplate: 'Skomentuj',
    noCtaOptions: 'Brak wariantów CTA dla tej strony',
    ttsPreview: 'Tekst do odczytania (TTS)',
  },
  en: {
    allPages: 'All Pages',
    published: 'Published',
    pending: 'Pending',
    drafts: 'Drafts',
    searchPages: 'Search pages...',
    search: 'Search',
    clear: 'Clear',
    yourPages: 'Your Pages',
    showing: 'Showing',
    of: 'of',
    pages: 'pages',
    mustBeLoggedIn: 'You must be logged in to view this page.',
    errorLoadingPages: 'Error Loading Pages',
    noPages: 'No Pages',
    noPagesMatch: 'No pages match the search criteria.',
    noPagesFound: 'No pages were found.',
    loading: 'Loading...',
    mockupPreview: 'Mockup preview',
    visits: 'visits',
    leads: 'leads',
    author: 'Author:',
    created: 'Created:',
    supervisor: 'Supervisor:',
    password: 'Password:',
    copied: 'Copied!',
    awaitingModeration: 'Awaiting moderation',
    ebook: 'e-book',
    sales: 'sales',
    link: 'Link:',
    awaitingPublication: 'Awaiting publication',
    noCover: 'No cover',
    edit: 'Edit',
    editAndPublish: 'Edit and publish',
    preview: 'Preview',
    delete: 'Delete',
    generateReel: 'Generate reel',
    showReel: 'Show reel',
    reelGenerator: 'Reel Generator',
    reelPreview: 'Reel Preview',
    reelHeader: 'Reel Header',
    reelHeaderPlaceholder: 'Enter reel header...',
    reelCTA: 'CTA Button',
    ctaDownload: 'Download',
    ctaComment: 'Comment (Menychat)',
    ctaCommentShort: 'Comment',
    ctaPassword: 'Password/Keyword',
    ctaPasswordPlaceholder: 'e.g. List',
    voice: 'Voice',
    voiceMale: 'Male',
    voiceFemale: 'Female',
    generate: 'Generate',
    generating: 'Generating...',
    generatingMessage: 'Inflee.app is generating your reel. This will take about 3 minutes — don\'t close this window. Once complete, the reel will appear in the preview area.',
    reelConfig: 'Configuration',
    reelCtaDownloadFull: 'Download free E-BOOK',
    reelCtaCommentPrefix: 'Comment',
    reelCtaCommentSuffix: 'to download',
    markerScale: 'Marker scale',
    markerPosition: 'Marker Y position',
    markerSeed: 'Marker shape',
    reelIntroPlaceholder: 'Did you know that most people make the same mistake?',
    actionError: 'Action Error',
    confirmDeletion: 'Confirm Deletion',
    deleteConfirmation: 'Are you sure you want to delete the page',
    deleteWarning: 'This action is irreversible. All files and data associated with this page will be deleted.',
    cancel: 'Cancel',
    deleting: 'Deleting...',
    deletePage: 'Delete Page',
    ebookMockupPreview: 'Ebook mockup preview',
    pageInfo: 'Page Information',
    title: 'Title',
    subtitle: 'Subtitle',
    close: 'Close',
    openingPreview: 'Opening preview in a new tab...',
    creator: 'Creator:',
    scanQrCode: 'Scan the QR code to visit the page',
    copying: 'Copying...',
    copiedToClipboard: 'Copied to clipboard!',
    copyQrCode: 'Copy QR Code to clipboard',
    status_published: 'Published',
    status_pending: 'Pending',
    status_draft: 'Draft',
    status_unknown: 'Unknown',
    // ── CTA Options ──
    ctaOption: 'CTA Variant',
    ctaTextPreview: 'CTA Text Preview',
    ctaDownloadTemplate: 'Download free ebook',
    ctaCommentTemplate: 'Comment',
    noCtaOptions: 'No CTA variants for this page',
    ttsPreview: 'Text to read (TTS)',
  }
};

const PagesView = () => {
  const { user, userRole, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const coverImageSize = 240;
  const [activeFilter, setActiveFilter] = useState<'all' | 'published' | 'draft' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [stats, setStats] = useState<PageStats>({ total: 0, published: 0, pending: 0, draft: 0, ebook: 0, sales: 0 });
  const [supervisorDescriptions, setSupervisorDescriptions] = useState<Record<string, string>>({});
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{url: string, title: string, subtitle?: string} | null>(null);
  const [previewNotification, setPreviewNotification] = useState<boolean>(false);
  const [qrCodeData, setQrCodeData] = useState<{url: string, title: string, creator: string, logoUrl?: string} | null>(null);
  const [copyingQr, setCopyingQr] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reelUrls, setReelUrls] = useState<Record<string, string>>({});

  // Reel Modal State
  const [reelModalOpen, setReelModalOpen] = useState(false);
  const [reelPageId, setReelPageId] = useState<string | null>(null);
  const reel = useReelSessionState(reelModalOpen ? reelPageId : null);

  // Derived reel state (convenience aliases)
  const reelHeader = reel.state.reelHeader;
  const reelCTA = (reel.state.reelCTA || 'download') as 'download' | 'comment';
  const reelCTAPassword = reel.state.CTAtext;
  const reelVoice = (reel.state.audioGender === 'FEMALE' ? 'female' : 'male') as 'male' | 'female';
  const reelMarkerScale = reel.state.coverParams.scale;
  const reelMarkerOffsetY = reel.state.coverParams.positionY;
  const reelMarkerSeed = reel.state.coverParams.seed ?? 42;
  const reelIntroText = reel.state.reelIntro;

  // Setters
  const setReelHeader = (v: string) => reel.updateField('reelHeader', v);
  const setReelCTA = (v: 'download' | 'comment') => reel.updateField('reelCTA', v);
  const setReelCTAPassword = (v: string) => reel.updateField('CTAtext', v);
  const setReelVoice = (v: 'male' | 'female') => reel.updateField('audioGender', v === 'female' ? 'FEMALE' : 'MALE');
  const setReelMarkerScale = (v: number) => reel.updateCoverParams({ scale: v });
  const setReelMarkerOffsetY = (v: number) => reel.updateCoverParams({ positionY: v });
  const setReelMarkerSeed = (v: number) => reel.updateCoverParams({ seed: v });
  const reelMarkerEnabled = reel.state.coverParams.markerEnabled ?? true;
  const setReelMarkerEnabled = (v: boolean) => reel.updateCoverParams({ markerEnabled: v });
  const setReelIntroText = (v: string) => reel.updateField('reelIntro', v);

  // ── CTA Options state (z kolumny CTAoptions w tabeli reels) ──
  const [reelCtaOptions, setReelCtaOptions] = useState<Record<string, string>>({});
  const [selectedCtaKey, setSelectedCtaKey] = useState<string>('');
  const [reelEbookTitle, setReelEbookTitle] = useState<string | undefined>();
  const [reelEbookSubtitle, setReelEbookSubtitle] = useState<string | undefined>();

  const [currentLang, setCurrentLang] = useState<'pl' | 'en'>('pl');

  const qrCodeRef = React.useRef<SVGSVGElement>(null);
  const previewModalRef = useRef<HTMLDivElement>(null);
  const reelModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage');
    if (savedLang === 'en' || savedLang === 'pl') {
      setCurrentLang(savedLang);
    }
  }, []);

  const t = translations[currentLang];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(
      currentLang === 'pl' ? 'pl-PL' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' }
    );
  };

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'published': return t.status_published;
      case 'pending': return t.status_pending;
      case 'draft': return t.status_draft;
      default: return t.status_unknown;
    }
  };

  const VideoCoverPlaceholder = ({ width, height, className = "" }: { width: number | string; height: number | string; className?: string; }) => (
    <div className={`bg-gray-100 rounded-md flex flex-col items-center justify-center border border-gray-200 ${className}`} style={{ width, height }}>
      <Video size={typeof width === 'number' ? width/3 : 48} className="text-gray-400 mb-2" />
      <span className="text-gray-400 text-xs">{t.noCover}</span>
    </div>
  );

  const getOrCreatePreviewUrl = useCallback(async (pageId: string, existingDraftUrl?: string): Promise<string | null> => {
    if (existingDraftUrl) {
      return `${window.location.origin}${existingDraftUrl}`;
    }
    try {
      setActionLoading(pageId);
      setActionError(null);
      const response = await fetch(`/api/pages/${pageId}/preview`, { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview link');
      }
      const data = await response.json();
      if (data.success && data.preview_url) {
        setPages(prevPages => prevPages.map(p => p.id === pageId ? { ...p, draft_url: data.draft_url } : p));
        return data.preview_url;
      } else {
        throw new Error('Invalid response from preview API');
      }
    } catch (error) {
      console.error('Error in getOrCreatePreviewUrl:', error);
      setActionError(error instanceof Error ? error.message : 'Unknown error');
      setTimeout(() => setActionError(null), 5000);
      return null;
    } finally {
      setActionLoading(null);
    }
  }, []);

  const getAssetUrl = (coverImagePath: string | null | undefined) => {
    if (!coverImagePath) return '';
    if (coverImagePath.startsWith('/uploads/')) {
      const filename = coverImagePath.substring('/uploads/'.length);
      return `/api/assets/uploads/${filename}`;
    }
    return `/api/assets/uploads/${coverImagePath}`;
  };

  const PlaceholderCard = () => (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden animate-pulse">
      <div className="h-2 bg-gray-300"></div>
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <div className="h-6 bg-gray-300 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
        <div className="border-t border-gray-200"></div>
        <div className="flex gap-6">
          <div className="w-1/2 h-32 bg-gray-300 rounded"></div>
          <div className="w-1/2 space-y-3">
            <div className="flex space-x-2 justify-end"><div className="h-5 w-12 bg-gray-200 rounded-full"></div><div className="h-5 w-16 bg-gray-200 rounded-full"></div></div>
            <div className="border-t border-gray-200"></div>
            <div className="space-y-2"><div className="h-4 bg-gray-200 rounded"></div><div className="h-4 bg-gray-200 rounded w-2/3"></div></div>
            <div className="border-t border-gray-200"></div>
            <div className="flex gap-4"><div className="flex-1 h-16 bg-gray-200 rounded-lg"></div><div className="flex-1 h-16 bg-gray-200 rounded-lg"></div></div>
          </div>
        </div>
        <div className="h-8 bg-gray-200 rounded"></div>
      </div>
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
        <div className="space-x-2 flex"><div className="h-7 w-12 bg-gray-200 rounded"></div><div className="h-7 w-16 bg-gray-200 rounded"></div></div>
        <div className="h-7 w-14 bg-gray-200 rounded"></div>
      </div>
    </div>
  );

  const fetchSupervisorDescription = useCallback(async (code: string) => {
    if (!code) return null;
    try {
      const response = await fetch(`/api/supervisor/${code}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.description;
    } catch (error) { return null; }
  }, []);

  const fetchAllSupervisorDescriptions = useCallback(async (pagesToProcess: PageItem[]) => {
    if (!pagesToProcess || pagesToProcess.length === 0) return;
    setLoadingSupervisors(true);
    try {
      const supervisorCodes = Array.from(new Set(pagesToProcess.filter(page => page.supervisorCode).map(page => page.supervisorCode as string)));
      if (supervisorCodes.length === 0) { setLoadingSupervisors(false); return; }
      const results = await Promise.all(supervisorCodes.map(async (code) => ({ code, description: await fetchSupervisorDescription(code) })));
      const descriptionsMap: Record<string, string> = {};
      results.forEach(result => { if (result.code && result.description) descriptionsMap[result.code] = result.description; });
      setSupervisorDescriptions(descriptionsMap);
    } catch (error) {
      console.error('Error fetching supervisor descriptions:', error);
    } finally { setLoadingSupervisors(false); }
  }, [fetchSupervisorDescription]);

  const copyUrlToClipboard = (pageId: string, url: string) => {
    if (url) {
      navigator.clipboard.writeText(url).then(() => { setCopiedUrl(pageId); setTimeout(() => setCopiedUrl(null), 800); });
    }
  };

  const openCoverPreview = (url: string, title: string, subtitle?: string) => setPreviewImage({ url, title, subtitle });
  const closeCoverPreview = () => setPreviewImage(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeCoverPreview(); };
    const handleClickOutside = (event: MouseEvent) => { if (previewModalRef.current && !previewModalRef.current.contains(event.target as Node)) closeCoverPreview(); };
    if (previewImage) { document.addEventListener('keydown', handleKeyDown); document.addEventListener('mousedown', handleClickOutside); }
    return () => { document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('mousedown', handleClickOutside); };
  }, [previewImage]);

  const openQrCode = (url: string, title: string, creator: string) => setQrCodeData({ url, title, creator, logoUrl: '/logo.png' });
  const closeQrCode = () => { setQrCodeData(null); setQrCopied(false); };

  const copyQrCodeToClipboard = async () => {
    if (!qrCodeRef.current) return;
    try {
      setCopyingQr(true);
      const svgElement = qrCodeRef.current;
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = async () => {
        canvas.width = img.width; canvas.height = img.height;
        if (ctx) { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); }
        canvas.toBlob(async (blob) => {
          if (blob) { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setQrCopied(true); setTimeout(() => setQrCopied(false), 2000); } catch (error) { console.error('Error copying to clipboard:', error); } }
          setCopyingQr(false);
        }, 'image/png');
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) { console.error('Error copying QR code:', error); setCopyingQr(false); }
  };

  // ── Helper: wyciągnij CTAoptions z odpowiedzi API reela ──
  const extractCtaOptions = (data: any): Record<string, string> => {
    if (!data?.CTAoptions) return {};
    try {
      return typeof data.CTAoptions === 'string' ? JSON.parse(data.CTAoptions) : data.CTAoptions;
    } catch { return {}; }
  };

  const handleReelToggle = async (pageId: string) => {
    // Cache hit → otwórz modal w trybie player
    if (reelUrls[pageId]) {
      setReelPageId(pageId);
      setReelReadyUrl(reelUrls[pageId]);
      setReelGenerateError(null);
      setReelModalOpen(true);
      return;
    }
    // Sprawdź w API
    try {
      const res = await fetch(`/api/reel/${pageId}`);
      if (res.ok) {
        const data = await res.json();
        // Wyciągnij CTAoptions z odpowiedzi
        const opts = extractCtaOptions(data);
        if (Object.keys(opts).length > 0) {
          setReelCtaOptions(opts);
        }
        if (data.reelURL) {
          setReelUrls(prev => ({ ...prev, [pageId]: data.reelURL }));
          setReelPageId(pageId);
          setReelReadyUrl(data.reelURL);
          setReelGenerateError(null);
          setReelModalOpen(true);
          return;
        }
      }
    } catch {}
    // Brak rolki → otwórz modal konfiguracji
    openReelModal(pageId);
  };

  const openReelModal = (pageId: string) => {
    setReelPageId(pageId);
    setReelReadyUrl(null);
    setReelGenerateError(null);
    setReelModalOpen(true);
  };

  // Pobierz CTAoptions gdy modal się otwiera (jeśli nie załadowano wcześniej)
  // Pobierz CTAoptions gdy modal się otwiera (jeśli nie załadowano wcześniej)
  useEffect(() => {
    if (!reelModalOpen || !reelPageId) return;
    if (Object.keys(reelCtaOptions).length > 0) return; // już załadowane
    const fetchCtaOpts = async () => {
      try {
        const res = await fetch(`/api/reel/${reelPageId}`);
        if (res.ok) {
          const data = await res.json();
          const opts = extractCtaOptions(data);
          if (Object.keys(opts).length > 0) setReelCtaOptions(opts);
        }
      } catch {}
    };
    fetchCtaOpts();
  }, [reelModalOpen, reelPageId]);

  // Pobierz tytuł/podtytuł e-booka przy każdym otwarciu modala
  useEffect(() => {
    if (!reelModalOpen || !reelPageId) return;
    const fetchEbook = async () => {
      try {
        const res = await fetch(`/api/reel/${reelPageId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ebookId) {
            const ebookRes = await fetch(`/api/ebooks/${data.ebookId}`);
            if (ebookRes.ok) {
              const ebook = await ebookRes.json();
              setReelEbookTitle(ebook.title ?? undefined);
              setReelEbookSubtitle(ebook.subtitle ?? undefined);
            }
          }
        }
      } catch {}
    };
    fetchEbook();
  }, [reelModalOpen, reelPageId]);

  const closeReelModal = async () => {
    if (reelPageId) {
      await reel.saveToDB();
    }
    setReelModalOpen(false);
    setReelPageId(null);
    setReelCtaOptions({});
    setReelEbookTitle(undefined);
    setReelEbookSubtitle(undefined);
    setSelectedCtaKey('');
  };

  const isReelFormValid = () => {
    if (!reelHeader.trim()) return false;
    if (reelCTA === 'comment' && !reelCTAPassword.trim()) return false;
    return true;
  };

  const [reelGenerating, setReelGenerating] = useState(false);
  const [reelGenerateError, setReelGenerateError] = useState<string | null>(null);
  const [reelReadyUrl, setReelReadyUrl] = useState<string | null>(null);

  const handleGenerateReel = async () => {
    if (!isReelFormValid() || !reelPageId) return;

    // Zapisz konfigurację do bazy i wyczyść sessionStorage
    const saved = await reel.saveToDB();
    if (saved && reelPageId) {
      clearReelSession(reelPageId);
    }

    // Odpal generowanie TTS
    setReelGenerating(true);
    setReelGenerateError(null);

    try {
      const res = await fetch(`/api/reel/${reelPageId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ttsText: fullTtsText || null,
          selectedCtaKey: selectedCtaKey || null,
        }),
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || `HTTP ${res.status}`);
      }

      console.log('✅ [reel] Rolka wygenerowana:', result);
      if (result.reelURL) {
        setReelUrls(prev => ({ ...prev, [reelPageId]: result.reelURL }));
        setReelReadyUrl(result.reelURL);
      }
    } catch (err) {
      console.error('❌ [reel] Błąd generowania:', err);
      setReelGenerateError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setReelGenerating(false);
    }
  };

  // ── Reel preview: computed CTA text & cover URL ──
  const reelPage = pages.find(p => p.id === reelPageId);
  const reelCoverUrl = reelPage?.coverImage ? getAssetUrl(reelPage.coverImage) : undefined;
  const reelCtaDisplayText = reelCTA === 'download'
    ? t.reelCtaDownloadFull
    : reelCTAPassword
      ? `${t.reelCtaCommentPrefix} "${reelCTAPassword}" ${t.reelCtaCommentSuffix}`
      : '';

  // ── CTA Options: computed values ──
  const ctaOptionKeys = useMemo(() => Object.keys(reelCtaOptions).sort(), [reelCtaOptions]);
  const selectedCtaValue = reelCtaOptions[selectedCtaKey] || '';

  // Auto-select pierwszej opcji przy otwarciu / zmianie strony
  useEffect(() => {
    if (ctaOptionKeys.length > 0 && !ctaOptionKeys.includes(selectedCtaKey)) {
      setSelectedCtaKey(ctaOptionKeys[0]);
    }
  }, [reelPageId, ctaOptionKeys.join(',')]);

  // Podgląd tekstu CTA (dynamiczny)
  const ctaPreviewText = useMemo(() => {
    if (!selectedCtaValue) return '';
    if (reelCTA === 'download') {
      return `${t.ctaDownloadTemplate} ${selectedCtaValue}!`;
    }
    const keyword = reelCTAPassword.trim();
    if (!keyword) return `${t.ctaCommentTemplate} ${selectedCtaValue}!`;
    return `${t.ctaCommentTemplate} "${keyword}" ${selectedCtaValue}!`;
  }, [reelCTA, reelCTAPassword, selectedCtaValue, t]);

  // Pełny tekst do TTS (podgląd — backend komponuje niezależnie)
  const fullTtsText = useMemo(() => {
    const intro = reelIntroText.trim();
    const cta = ctaPreviewText.trim();
    if (!intro && !cta) return '';
    if (!intro) return cta;
    if (!cta) return intro;
    return `${intro} [short pause] ${cta}`;
  }, [reelIntroText, ctaPreviewText]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeReelModal(); };
    const handleClickOutside = (event: MouseEvent) => { if (reelModalRef.current && !reelModalRef.current.contains(event.target as Node)) closeReelModal(); };
    if (reelModalOpen) { document.addEventListener('keydown', handleKeyDown); document.addEventListener('mousedown', handleClickOutside); }
    return () => { document.removeEventListener('keydown', handleKeyDown); document.removeEventListener('mousedown', handleClickOutside); };
  }, [reelModalOpen]);

  const fetchPages = useCallback(async () => {
    if (!isAuthenticated) { setIsLoading(false); return; }
    setIsLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (activeFilter === 'published') params.append('status', 'published');
      else if (activeFilter === 'draft') params.append('status', 'draft');
      else if (activeFilter === 'pending') params.append('status', 'pending');
      if (searchTerm.trim()) params.append('search', searchTerm);
      const response = await fetch(`/api/pages?${params.toString()}`);
      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Error fetching data'); }
      const data = await response.json() as PagesApiResponse;
      setPages(data.pages || []); setStats(data.stats || { total: 0, published: 0, pending: 0, draft: 0, ebook: 0, sales: 0 });
      await fetchAllSupervisorDescriptions(data.pages || []);
    } catch (err) { console.error('Error fetching pages:', err); setError(err instanceof Error ? err.message : 'Unknown error'); }
    finally { setIsLoading(false); }
  }, [isAuthenticated, activeFilter, searchTerm, fetchAllSupervisorDescriptions]);

  useEffect(() => { if (!isAuthLoading && isAuthenticated) fetchPages(); }, [isAuthLoading, isAuthenticated]);
  useEffect(() => { if (!isAuthLoading && isAuthenticated) fetchPages(); }, [activeFilter, fetchPages]);

  const openEditor = async (pageId: string, draftUrl?: string) => {
    const finalUrl = await getOrCreatePreviewUrl(pageId, draftUrl);
    if (finalUrl) { window.location.href = finalUrl.split('?')[0] + '?mode=edit'; }
  };

  const openPreview = async (pageId: string, draftUrl?: string) => {
    const finalUrl = await getOrCreatePreviewUrl(pageId, draftUrl);
    if (finalUrl) {
      const previewUrl = new URL(finalUrl); previewUrl.searchParams.set('view_mode', 'preview');
      setPreviewNotification(true); setTimeout(() => setPreviewNotification(false), 2000);
      window.open(previewUrl.toString(), '_blank');
    }
  };

  const handleDeletePage = (page: PageItem) => { setPageToDelete(page); setIsDeleteModalOpen(true); setDeleteError(null); };
  const handleFilterClick = (filter: 'all' | 'published' | 'draft' | 'pending') => { setActiveFilter(filter); };
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchPages(); };
  const handleClearSearch = () => { setSearchTerm(''); };

  const confirmDeletePage = async () => {
    if (!pageToDelete || !isAuthenticated) { console.error('Missing page data to delete or user not logged in'); setDeleteError('Missing required data or authorization to delete the page'); return; }
    setIsDeleting(true); setDeleteError(null);
    try {
      const response = await fetch('/api/pages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: pageToDelete.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Error deleting page: ${response.status}`);
      await fetchPages(); setIsDeleteModalOpen(false); setPageToDelete(null);
    } catch (err) { console.error('Error while deleting page:', err); setDeleteError(err instanceof Error ? err.message : 'An unknown error occurred while deleting the page'); }
    finally { setIsDeleting(false); }
  };

  const cancelDeletePage = () => { setIsDeleteModalOpen(false); setPageToDelete(null); setDeleteError(null); };
  const getSupervisorDescription = (code?: string) => code ? supervisorDescriptions[code] || code : null;
  const isGodRole = userRole === 'payd';

  if (isAuthLoading) {
    return (<div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div></div>);
  }
  if (!isAuthenticated) {
    return (<div className="text-center py-20 text-gray-500"><p>{t.mustBeLoggedIn}</p></div>);
  }

  return (
    <div className="space-y-6 overflow-hidden">
        {error && (<div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 rounded-md"><p>{error}</p></div>)}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <button onClick={() => handleFilterClick('all')} className={`bg-blue-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-100' : 'border-blue-200 hover:border-blue-300'}`}>
            <div className="flex items-center justify-between"><div><p className="text-blue-600 text-sm font-medium">{t.allPages}</p><p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.total}</p></div><BookOpen className="text-blue-600" size={28} /></div>
          </button>
          <button onClick={() => handleFilterClick('published')} className={`bg-green-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md cursor-pointer ${activeFilter === 'published' ? 'border-green-400 ring-2 ring-green-200 bg-green-100' : 'border-green-200 hover:border-green-300'}`}>
            <div className="flex items-center justify-between"><div><p className="text-green-600 text-sm font-medium">{t.published}</p><p className="text-xl sm:text-2xl font-bold text-green-900">{stats.published}</p></div><Sparkles className="text-green-600" size={28} /></div>
          </button>
          <button onClick={() => handleFilterClick('pending')} className={`bg-orange-50 rounded-xl p-4 sm:p-6 border transition-all duration-200 text-left hover:shadow-md sm:col-span-2 lg:col-span-1 cursor-pointer ${activeFilter === 'pending' ? 'border-orange-400 ring-2 ring-orange-200 bg-orange-100' : 'border-orange-200 hover:border-orange-300'}`}>
            <div className="flex items-center justify-between"><div><p className="text-orange-600 text-sm font-medium">{t.pending}</p><p className="text-xl sm:text-2xl font-bold text-orange-900">{stats.pending}</p></div><Edit className="text-orange-600" size={28} /></div>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <form onSubmit={handleSearch} className="flex w-full sm:max-w-md items-center gap-2">
                <div className="relative flex-1">
                    <input type="text" placeholder={t.searchPages} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gray-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                <button type="submit" disabled={isLoading} className="hidden sm:inline-flex px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer">{t.search}</button>
                {searchTerm && (<button type="button" onClick={handleClearSearch} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer">{t.clear}</button>)}
            </form>
        </div>

        <div className="bg-transparent sm:bg-white rounded-none border-0 sm:rounded-xl sm:border border-gray-200 overflow-hidden -mx-4 sm:mx-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">{t.yourPages}</h2>
                {stats && stats.total > 0 && (<p className="text-sm text-gray-600">{t.showing} {pages.length} {t.of} {stats.total} {t.pages}</p>)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {isLoading ? (
                    Array.from({ length: 6 }, (_, index) => (<PlaceholderCard key={`placeholder-${index}`} />))
                ) : error ? (
                    <div className="col-span-full"><div className="text-center py-20 text-red-600"><AlertTriangle size={48} className="mx-auto text-red-300 mb-4" /><h3 className="text-lg font-medium text-red-900 mb-2">{t.errorLoadingPages}</h3><p>{error}</p></div></div>
                ) : pages.length === 0 ? (
                    <div className="col-span-full"><div className="text-center py-20 text-gray-500"><FileText size={48} className="mx-auto text-gray-300 mb-4" /><h3 className="text-lg font-medium text-gray-900 mb-2">{t.noPages}</h3><p>{searchTerm || activeFilter !== 'all' ? t.noPagesMatch : t.noPagesFound}</p></div></div>
                ) : (
                    pages.map(page => (
                    <div key={page.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 flex flex-col">
                        <div className={`h-2 ${page.status === 'published' ? 'bg-green-500' : page.status === 'pending' ? 'bg-amber-400' : 'bg-gray-400'}`}></div>

                        {/* Mobile card */}
                        <div className="block sm:hidden p-4 flex flex-col flex-grow">
                            <div>
                                <h3 className="font-semibold text-gray-900 text-lg leading-tight line-clamp-3">{page.title}</h3>
                                {page.subtitle && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{page.subtitle}</p>}
                            </div>
                            <div className="border-t border-gray-200 my-4"></div>
                            <div className="flex gap-4">
                                <div className="w-1/3 flex-shrink-0 flex flex-col justify-center">
                                    {page.coverImage ? (<img src={getAssetUrl(page.coverImage)} alt={`Cover for ${page.title}`} className="w-full h-auto object-contain cursor-pointer rounded-md max-h-48" onClick={() => openCoverPreview(getAssetUrl(page.coverImage), page.headline || page.title, page.subtitle)}/>) : (<VideoCoverPlaceholder width="100%" height="160px" />)}
                                    {page.coverImage && (<p className="text-xs text-gray-500 text-center mt-1">{t.mockupPreview}</p>)}
                                </div>
                                <div className="w-2/3 flex flex-col gap-2">
                                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-100"><p className="text-blue-600 text-lg font-semibold">{page.visits}</p><p className="text-blue-500 text-xs uppercase tracking-wide font-medium">{t.visits}</p></div>
                                    <div className="bg-green-50 rounded-lg p-2 border border-green-100"><p className="text-green-600 text-lg font-semibold">{page.leads}</p><p className="text-green-500 text-xs uppercase tracking-wide font-medium">{t.leads}</p></div>
                                    <div className="bg-gray-50 rounded-lg p-3 mt-2 space-y-2 border border-gray-100">
                                        <dl className="text-xs space-y-2">
                                            <div className="flex justify-between items-center"><dt className="text-gray-500 flex-shrink-0">{t.author}</dt><dd className="font-medium text-gray-800 truncate text-right pl-2">{page.creator}</dd></div>
                                            <div className="border-t border-gray-200"></div>
                                            <div className="flex justify-between items-center pt-1"><dt className="text-gray-500 flex-shrink-0">{t.created}</dt><dd className="font-medium text-gray-800 truncate text-right pl-2">{formatDate(page.createdAt)}</dd></div>
                                            {page.supervisorCode && !isGodRole && <div className="flex justify-between items-center"><dt className="text-gray-500 flex-shrink-0">{t.supervisor}</dt><dd className="font-medium text-gray-800 truncate text-right pl-2">{getSupervisorDescription(page.supervisorCode)}</dd></div>}
                                            {page.isOwnedByUser && page.videoPassword && <div className="flex justify-between items-center"><dt className="text-gray-500 flex items-center flex-shrink-0"><Lock size={12} className="mr-1 text-amber-500"/>{t.password}</dt><dd className="font-medium text-amber-600 truncate text-right pl-2">{page.videoPassword}</dd></div>}
                                        </dl>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto pt-4">
                                <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                                    {page.url && (<div className="flex items-center relative"><p className="text-xs text-gray-500 truncate flex-grow"><span className="text-sky-600 font-medium">{page.url}</span></p><div className="flex items-center ml-2 flex-shrink-0"><button onClick={() => openQrCode(page.url, page.headline || page.title, page.creator)} className="p-1 text-gray-500 hover:text-sky-600 rounded cursor-pointer" title="Generate QR Code"><QrCode className="h-4 w-4" /></button><button onClick={() => copyUrlToClipboard(page.id, page.url)} className="p-1 text-gray-500 hover:text-sky-600 rounded cursor-pointer" title="Copy link"><Copy className="h-4 w-4" /></button></div>{copiedUrl === page.id && <div className="absolute right-0 -top-7 bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs z-10">{t.copied}</div>}</div>)}
                                    {page.status === 'pending' && <div className="text-amber-600 flex items-center text-sm mt-2"><Clock size={16} className="mr-2" />{t.awaitingModeration}</div>}
                                </div>
                            </div>
                        </div>

                        {/* Desktop card */}
                        <div className="hidden sm:flex flex-col p-5 flex-grow">
                            <div className="flex flex-col justify-center min-h-[100px]">
                                <h3 className="font-semibold text-gray-900 text-xl leading-tight line-clamp-2">{page.title}</h3>
                                {page.subtitle && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{page.subtitle}</p>}
                            </div>
                            <div className="border-t border-gray-200 my-4"></div>
                            <div className="flex gap-6">
                                <div className="w-1/2 flex-shrink-0">
                                    {page.coverImage ? (<img src={getAssetUrl(page.coverImage)} alt={`Cover for ${page.title}`} className="w-full h-full object-contain cursor-pointer rounded-md" onClick={() => openCoverPreview(getAssetUrl(page.coverImage), page.headline || page.title, page.subtitle)} />) : (<VideoCoverPlaceholder width="100%" height="100%" />)}
                                </div>
                                <div className="w-1/2 flex flex-col justify-center">
                                    <div className="flex flex-nowrap space-x-1.5 min-w-fit justify-end">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${page.type === 'ebook' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'}`}>{page.type === 'ebook' ? t.ebook : t.sales}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${page.status === 'published' ? 'bg-green-100 text-green-700' : page.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>{getStatusLabel(page.status)}</span>
                                    </div>
                                    <div className="border-t border-gray-200 my-4"></div>
                                    <dl className="text-sm space-y-2.5">
                                        <div className="flex"><dt className="w-1/2 text-gray-500 flex-shrink-0">{t.author}</dt><dd className="w-1/2 font-medium text-gray-800 truncate min-w-0">{page.creator}</dd></div>
                                        <div className="border-t border-gray-200"></div>
                                        <div className="flex pt-2"><dt className="w-1/2 text-gray-500 flex-shrink-0">{t.created}</dt><dd className="w-1/2 font-medium text-gray-800 truncate min-w-0">{formatDate(page.createdAt)}</dd></div>
                                        {page.supervisorCode && !isGodRole && <div className="flex"><dt className="w-1/4 text-gray-500 flex-shrink-0">{t.supervisor}</dt><dd className="w-3/4 font-medium text-gray-800 truncate min-w-0">{getSupervisorDescription(page.supervisorCode)}</dd></div>}
                                        {page.isOwnedByUser && page.videoPassword && <div className="flex items-center"><dt className="w-1/2 text-gray-500 flex items-center flex-shrink-0"><Lock size={14} className="mr-1.5 text-amber-500"/>{t.password}</dt><dd className="w-1/2 font-medium text-amber-600 truncate min-w-0">{page.videoPassword}</dd></div>}
                                    </dl>
                                    <div className="border-t border-gray-200 my-4"></div>
                                    <div className="flex gap-4">
                                        <div className="flex-1 bg-blue-50 rounded-lg p-3 border border-blue-100 hover:border-blue-200 transition-colors"><p className="text-blue-600 text-2xl font-semibold">{page.visits}</p><p className="text-blue-500 text-xs uppercase tracking-wide font-medium">{t.visits}</p></div>
                                        <div className="flex-1 bg-green-50 rounded-lg p-3 border border-green-100 hover:border-green-200 transition-colors"><p className="text-green-600 text-2xl font-semibold">{page.leads}</p><p className="text-green-500 text-xs uppercase tracking-wide font-medium">{t.leads}</p></div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-auto pt-4">
                                <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                                    {page.url && (<div className="flex items-center relative"><p className="text-xs text-gray-500 truncate flex-grow"><span className="text-gray-400 mr-1">{t.link}</span><span className="text-sky-600 font-medium">{page.url}</span></p><div className="flex items-center ml-2 flex-shrink-0"><button onClick={() => openQrCode(page.url, page.headline || page.title, page.creator)} className="p-1 text-gray-500 hover:text-sky-600 rounded cursor-pointer" title="Generate QR Code"><QrCode className="h-4 w-4" /></button><button onClick={() => copyUrlToClipboard(page.id, page.url)} className="p-1 text-gray-500 hover:text-sky-600 rounded cursor-pointer" title="Copy link"><Copy className="h-4 w-4" /></button></div>{copiedUrl === page.id && <div className="absolute right-0 -top-7 bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs z-10">{t.copied}</div>}</div>)}
                                    {page.status === 'pending' && <div className="text-amber-600 flex items-center text-sm mt-2"><Clock size={16} className="mr-2" />{t.awaitingPublication}</div>}
                                </div>
                            </div>
                        </div>

                        {/* Desktop Actions */}
                        <div className="hidden sm:flex px-4 py-3 border-t border-gray-100 justify-between items-center bg-gray-50/50">
                            <div className="space-x-2">
                                <button className="text-sm text-sky-600 hover:text-sky-700 font-medium bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center cursor-pointer disabled:cursor-not-allowed" onClick={() => openEditor(page.id, page.draft_url)} disabled={actionLoading === page.id}>
                                    {actionLoading === page.id ? <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5"></div> : <Edit size={14} className="inline mr-1.5" />}{page.status === 'published' ? t.edit : t.editAndPublish}
                                </button>
                                {page.status === 'published' && (
                                <button className="text-sm text-gray-600 hover:text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors inline-flex items-center disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed" onClick={() => openPreview(page.id, page.draft_url)} disabled={actionLoading === page.id}>
                                    {actionLoading === page.id ? <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5"></div> : <Eye size={14} className="inline mr-1.5" />}{t.preview}
                                </button>
                                )}
                            </div>
                            <div className="space-x-2">
                                <button className="text-sm text-purple-600 hover:text-purple-700 font-medium bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center cursor-pointer" onClick={() => handleReelToggle(page.id)} title={reelUrls[page.id] ? t.showReel : t.generateReel}>
                                    <Film size={14} className="inline mr-1.5" />{reelUrls[page.id] ? t.showReel : t.generateReel}
                                </button>
                                <button className="text-sm text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors inline-flex items-center cursor-pointer" onClick={() => handleDeletePage(page)} title={t.delete}>
                                    <Trash2 size={14} className="inline mr-1.5" />{t.delete}
                                </button>
                            </div>
                        </div>

                        {/* Mobile Actions */}
                        <div className="flex sm:hidden flex-col px-4 py-3 border-t border-gray-100 bg-gray-50/50 gap-2">
                            <div className="flex gap-2">
                                <button className="flex-1 text-sm text-sky-600 hover:text-sky-700 font-medium bg-sky-50 hover:bg-sky-100 px-3 py-2 rounded-md transition-colors inline-flex items-center justify-center cursor-pointer disabled:cursor-not-allowed" onClick={() => openEditor(page.id, page.draft_url)} disabled={actionLoading === page.id}>
                                    {actionLoading === page.id ? <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5"></div> : <Edit size={14} className="inline mr-1.5" />}{page.status === 'published' ? t.edit : t.editAndPublish}
                                </button>
                                {page.status === 'published' && (
                                <button className="flex-1 text-sm text-gray-600 hover:text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-md transition-colors inline-flex items-center justify-center disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed" onClick={() => openPreview(page.id, page.draft_url)} disabled={actionLoading === page.id}>
                                    {actionLoading === page.id ? <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5"></div> : <Eye size={14} className="inline mr-1.5" />}{t.preview}
                                </button>
                                )}
                                <button className="flex-1 text-sm text-red-600 hover:text-red-700 font-medium bg-red-50 hover:bg-red-100 px-3 py-2 rounded-md transition-colors inline-flex items-center justify-center cursor-pointer" onClick={() => handleDeletePage(page)} title={t.delete}>
                                    <Trash2 size={14} className="inline mr-1.5" />{t.delete}
                                </button>
                            </div>
                            <button className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-md transition-colors inline-flex items-center justify-center cursor-pointer" onClick={() => handleReelToggle(page.id)} title={reelUrls[page.id] ? t.showReel : t.generateReel}>
                                <Film size={14} className="inline mr-1.5" />{reelUrls[page.id] ? t.showReel : t.generateReel}
                            </button>
                        </div>
                    </div>
                    ))
                )}
            </div>
        </div>

      {actionError && (
        <div className="fixed bottom-4 left-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center max-w-md">
          <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
          <div><p className="font-medium">{t.actionError}</p><p className="text-sm opacity-90">{actionError}</p></div>
          <button onClick={() => setActionError(null)} className="ml-3 text-white hover:text-gray-200 cursor-pointer"><X size={16} /></button>
        </div>
      )}

      {isDeleteModalOpen && pageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer" onClick={cancelDeletePage} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{t.confirmDeletion}</h3>
            <div className="my-4">
              <p className="text-gray-600 mb-2">{t.deleteConfirmation} <span className="font-semibold text-gray-800">{pageToDelete.headline || pageToDelete.title}</span>?</p>
              <p className="text-sm text-red-600">{t.deleteWarning}</p>
            </div>
            {deleteError && (<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm"><p>{deleteError}</p></div>)}
            <div className="flex justify-end space-x-3 mt-6">
              <button type="button" onClick={cancelDeletePage} disabled={isDeleting} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">{t.cancel}</button>
              <button type="button" onClick={confirmDeletePage} disabled={isDeleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white disabled:bg-red-400 cursor-pointer disabled:cursor-not-allowed">
                {isDeleting ? (<div className="flex items-center"><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div><span>{t.deleting}</span></div>) : (t.deletePage)}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-2 backdrop-blur-sm">
            <div ref={previewModalRef} className="relative w-auto max-h-[95vh] flex flex-col bg-black/50 rounded-lg animate-fadeIn">
                <div className="flex items-center justify-between p-4 flex-shrink-0 border-b border-white/10">
                    <div className="flex items-center space-x-3 min-w-0"><ImageIcon className="h-5 w-5 text-white flex-shrink-0" /><h3 className="text-white font-medium truncate">{t.ebookMockupPreview}</h3></div>
                    <button onClick={closeCoverPreview} className="text-white hover:text-gray-300 transition-colors flex-shrink-0 ml-4 cursor-pointer"><X size={24} /></button>
                </div>
                <div className="flex-1 flex flex-col md:flex-row gap-6 px-4 py-2 md:p-4 min-h-0">
                    <div className="flex items-center justify-center"><div className="max-w-full max-h-full shadow-2xl"><img src={previewImage.url} alt={`Cover for: ${previewImage.title}`} className="w-auto h-auto object-contain max-h-[85vh] rounded-lg" /></div></div>
                    <div className="hidden md:w-1/3 md:bg-black/20 md:rounded-lg md:flex md:flex-col md:overflow-hidden md:border md:border-white/10">
                        <div className="p-3 flex-shrink-0 bg-black/20"><h4 className="font-semibold text-white flex items-center"><FileText size={18} className="mr-2 text-gray-300"/>{t.pageInfo}</h4></div>
                        <div className="flex-1 overflow-y-auto p-3">
                            <ul className="space-y-4">
                                <li><span className="block text-xs text-gray-400 font-medium uppercase tracking-wider">{t.title}</span><p className="text-gray-200 text-base">{previewImage.title}</p></li>
                                {previewImage.subtitle && (<li><span className="block text-xs text-gray-400 font-medium uppercase tracking-wider">{t.subtitle}</span><p className="text-gray-300 text-sm">{previewImage.subtitle}</p></li>)}
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center items-center p-4 flex-shrink-0 space-x-3">
                    <button onClick={closeCoverPreview} className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium cursor-pointer">{t.close}</button>
                </div>
            </div>
        </div>
      )}

      {previewNotification && (
        <div className="fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center animate-fade-in"><Eye className="h-5 w-5 mr-3" /><span>{t.openingPreview}</span></div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          REEL MODAL — editable preview + config form
          ═══════════════════════════════════════════════════════════ */}
      {reelModalOpen && (
          <ReelModal
            reelModalRef={reelModalRef}
            closeReelModal={closeReelModal}
            currentLang={currentLang}
            t={t}
            reelIsSaving={reel.isSaving}
            reelGenerating={reelGenerating}
            reelGenerateError={reelGenerateError}
            reelReadyUrl={reelReadyUrl}
            reelHeader={reelHeader}
            setReelHeader={setReelHeader}
            reelCTA={reelCTA}
            setReelCTA={setReelCTA}
            reelCTAPassword={reelCTAPassword}
            setReelCTAPassword={setReelCTAPassword}
            reelVoice={reelVoice}
            setReelVoice={setReelVoice}
            reelMarkerEnabled={reelMarkerEnabled}
            setReelMarkerEnabled={setReelMarkerEnabled}
            reelMarkerScale={reelMarkerScale}
            setReelMarkerScale={setReelMarkerScale}
            reelMarkerOffsetY={reelMarkerOffsetY}
            setReelMarkerOffsetY={setReelMarkerOffsetY}
            reelMarkerSeed={reelMarkerSeed}
            setReelMarkerSeed={setReelMarkerSeed}
            reelIntroText={reelIntroText}
            setReelIntroText={setReelIntroText}
            ebookTitle={reelPage?.title}
            ebookSubtitle={reelPage?.subtitle}
            reelCtaDisplayText={reelCtaDisplayText}
            reelCoverUrl={reelCoverUrl}
            ctaOptionKeys={ctaOptionKeys}
            reelCtaOptions={reelCtaOptions}
            selectedCtaKey={selectedCtaKey}
            setSelectedCtaKey={setSelectedCtaKey}
            ctaPreviewText={ctaPreviewText}
            hasReelPage={!!reelPage}
            isReelFormValid={isReelFormValid}
            handleGenerateReel={handleGenerateReel}
          />
      )}


      {qrCodeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={closeQrCode} />
          <div className="relative bg-white rounded-lg shadow-lg p-6 mx-4 max-w-md w-full">
            <button onClick={closeQrCode} className="absolute top-2 right-2 p-2 rounded-full bg-white/80 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"><X size={24} /></button>
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{qrCodeData.title}</h3>
              <div className="mb-4 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-2 overflow-hidden border border-gray-200">{qrCodeData.logoUrl ? (<img src={qrCodeData.logoUrl} alt="Company Logo" className="w-full h-full object-contain p-1" onError={(e) => { const imgElement = e.currentTarget as HTMLImageElement; imgElement.style.display = 'none'; const parent = imgElement.parentElement; if (parent) { const fallbackIcon = document.createElement('div'); fallbackIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8"y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`; parent.appendChild(fallbackIcon); } }} />) : (<FileText size={32} className="text-blue-600" />)}</div>
                <p className="text-sm text-gray-600 mb-1">{t.creator} {qrCodeData.creator}</p>
                <p className="text-xs text-gray-500 truncate max-w-xs">{qrCodeData.url}</p>
              </div>
              <div className="w-64 h-64 bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-center relative">
                <QRCodeSVG value={qrCodeData.url} size={200} bgColor={"#ffffff"} fgColor={"#000000"} level={"H"} includeMargin={true} ref={qrCodeRef} />
                <div className="absolute -bottom-8 text-center w-full"><p className="text-xs text-gray-500">{t.scanQrCode}</p></div>
              </div>
              <div className="mt-14 flex flex-col space-y-3">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center cursor-pointer disabled:cursor-not-allowed" onClick={copyQrCodeToClipboard} disabled={copyingQr || qrCopied}>
                  {copyingQr ? (<><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div><span>{t.copying}</span></>) : qrCopied ? (<><Check className="h-4 w-4 mr-2" /><span>{t.copiedToClipboard}</span></>) : (<><Copy className="h-4 w-4 mr-2" /><span>{t.copyQrCode}</span></>)}
                </button>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors cursor-pointer" onClick={closeQrCode}>{t.close}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default PagesView;