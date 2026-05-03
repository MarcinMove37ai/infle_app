// src/app/preview/[token]/page.tsx
"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AlertCircle, X, AlertTriangle, ArrowLeft, Save, Edit, Check } from 'lucide-react';
import Link from 'next/link';
import DemoView, { colorSchemes } from '@/components/views/demo';
import DemoVideo from '@/components/views/demoVideo';
import EditModeProvider, { useEditMode } from '@/contexts/EditModeContext';
import type { PageContent } from '@/types/landing-page';

// ───────────────────────────────────────────────────────────────────────────
// Typy danych z preview API (/api/pages/preview/[token])
// ───────────────────────────────────────────────────────────────────────────

interface EbookFromApi {
  id: number;
  title: string;
  subtitle: string | null;
  total_pages: number | null;
  estimatedPages: number;
  chapterCount: number;
  chapters: Array<{
    position: number;
    title: string;
    preview: string;
  }>;
}

interface PageData {
  id: string;
  title: string;
  status: string;
  type: string | null;
  language: string;
  color?: string | null;
  url?: string | null;
  draft_url?: string | null;
  visitors?: number;
  userId?: string | null;
  ebookId?: number | null;
  authorDisplayName?: string | null;
  authorLogoUrl?: string;
  profilePicture?: string | null;  // Zdjęcie profilowe usera (Google original z tabeli users)

  // ─── Header configuration z Settings → Landing Page Header Setup ─────
  // headerStyle: 'profile' | 'logo' | 'none' — co user wybrał w toggle'ach Settings
  // activeProfileSource: 'custom' | 'google' — wybór źródła avatara gdy user ma oba
  // customProfilePicture: URL custom uploadu (Google original jest w profilePicture)
  headerStyle?: 'profile' | 'logo' | 'none' | null;
  activeProfileSource?: 'custom' | 'google' | null;
  customProfilePicture?: string | null;

  // Treść strony — nowy schemat 7 sekcji jsonb (lub null jeśli nie wygenerowana)
  pageContent: PageContent | null;

  // E-book — okładka + spis treści
  ebook: EbookFromApi | null;

  // Resolved mockup URL
  resolvedMockupUrl?: string;
}

interface VideoPageContent {
  title: string;
  description?: string;
  videoEmbedUrl: string;
  videoThumbnailUrl?: string;
  videoProvider: 'vimeo' | 'voomly';
  ctaButtonText?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Helpery do operacji na ścieżkach edycji (konwencja: "hero.headline_l1")
// ───────────────────────────────────────────────────────────────────────────

/** Parsuje pojedynczy segment ścieżki — liczba lub klucz. */
function parsePathSegment(p: string): string | number {
  const num = Number(p);
  return Number.isInteger(num) && p !== '' ? num : p;
}

/** Czyta wartość z obiektu po ścieżce typu "hero.headline_l1" lub "benefits.items.0.title". */
function lookupByPath(obj: any, path: string): any {
  if (!obj) return undefined;
  const parts = path.split('.').map(parsePathSegment);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p as any];
  }
  return cur;
}

/** Ustawia wartość w obiekcie po ścieżce (mutuje). */
function setByPath(obj: any, path: string, value: string): void {
  if (!obj) return;
  const parts = path.split('.').map(parsePathSegment);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i] as any];
    if (next == null) return;
    cur = next;
  }
  cur[parts[parts.length - 1] as any] = value;
}

/**
 * Buduje URL do pliku w /uploads — dla relative path zwraca endpoint
 * /api/assets/uploads/..., dla pełnego URL zwraca bez zmian. Identyczny
 * wzorzec jak w PublicPageClient — żeby preview wyglądał jak public.
 */
const buildAssetUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads/')) {
    return `/api/assets/uploads/${path.substring('/uploads/'.length)}`;
  }
  return `/api/assets/uploads/${path}`;
};

// ───────────────────────────────────────────────────────────────────────────
// Tłumaczenia
// ───────────────────────────────────────────────────────────────────────────

const translations = {
  pl: {
    // Toast
    changesSaved: 'Zmiany zostały zapisane',
    errorSaving: 'Nie udało się zapisać zmian',
    editModeEnabled: 'Włączono tryb edycji bez zmiany statusu strony',
    statusChanged: 'Status strony został zmieniony na: {status}',
    statusChangeError: 'Nie udało się zmienić statusu strony',
    linkCopied: 'Link publiczny skopiowany do schowka!',

    // Confirm Dialog
    unsavedChanges: 'Niezapisane zmiany',
    unsavedChangesMsg: 'Masz niezapisane zmiany. Zapisz je przed zmianą statusu strony.',
    saveChanges: 'Zapisz zmiany',
    cancel: 'Anuluj',
    statusChange: 'Zmiana statusu',
    statusChangeMsg: 'Czy na pewno chcesz zmienić status strony?',
    confirmStatusChange: 'Tak, zmień status',
    sendToApproval: 'Wysyłanie do akceptacji',
    sendToApprovalMsg: 'Czy przesłać stronę do akceptacji opiekuna?',
    confirmSend: 'Tak, prześlij',
    acceptPage: 'Akceptacja strony',
    acceptPageMsg: 'Czy chcesz zaakceptować i opublikować tę stronę?',
    confirmPublish: 'Tak, publikuj',
    editPage: 'Edycja strony',
    editPageMsg: 'Zmiana statusu na "draft" umożliwi edycję strony. Kontynuować?',
    confirmEdit: 'Tak, edytuj',
    publishPage: 'Publikacja strony',
    publishPageMsg: 'Czy chcesz opublikować tę stronę?',

    // Subskrypcja
    paymentVerificationRequired: 'Wymagana weryfikacja płatności',
    subscriptionRequired: 'Wymagana subskrypcja',
    verifyPayment: 'Zweryfikuj płatność',
    subscribe: 'Wykup subskrypcję',

    // Statusy
    statusPending: 'oczekujący na akceptację',
    statusPublished: 'opublikowany',
    statusDraft: 'wersja robocza',
    statusPublicLink: ' Publiczny link: {url}',
    statusPublicLinkGeneric: ' Strona jest dostępna pod publicznym linkiem.',

    // ColorSchemeButton
    changeColorSchemeTo: 'Zmień kolorystykę na',
    colorSchemeDark: 'Ciemny',
    colorSchemeLight: 'Jasny',
    colorSchemeEarth: 'Ziemia',
    colorSchemeFrost: 'Mróz',

    // PreviewModeBanner
    previewModeWatermark: 'PODGLĄD',
    previewModeTitle: 'TRYB PODGLĄDU (TYLKO DO ODCZYTU)',
    previewModeDesc: 'Ten link jest tymczasowy i nie powinien być udostępniany.',
    closePreview: 'Zamknij podgląd',
    closeTabConfirm: 'Ta przeglądarka nie pozwala na automatyczne zamknięcie zakładki. Czy chcesz wrócić do listy stron?',

    // LoadingState
    loadingPreview: 'Ładowanie podglądu strony...',

    // ErrorState
    errorOccurred: 'Wystąpił błąd',
    tryAgain: 'Spróbuj ponownie',
    backToList: 'Powrót do listy stron',
    errorFetchingData: 'Wystąpił błąd podczas pobierania danych',
    errorNotFound: 'Nie znaleziono strony o podanym tokenie',
    errorUnauthorized: 'Brak uprawnień do wyświetlenia tej strony',
    errorUnknown: 'Wystąpił nieznany błąd',
    errorNoData: 'Nie otrzymano danych z serwera',
    errorIncompleteData: 'Strona nie ma jeszcze wygenerowanej treści. Wygeneruj treść AI w panelu edycji.',
    errorProcessingData: 'Nie udało się przetworzyć danych strony',

    // getStatusChangeInfo
    statusNoPermission: 'Brak uprawnień',
    statusPublish: 'Publikuj',
    statusRevertToDraft: 'Cofnij do edycji',
    statusChangeButton: 'Zmień status',

    // Admin Panel
    adminSelectColor: 'Wybierz kolorystykę:',
    adminThemeLabel: 'Motyw',
    adminBack: 'Powrót',
    adminSaving: 'Zapisywanie...',
    adminSave: 'Zapisz',
    adminProcessing: 'Przetwarzanie...',
  },
  en: {
    changesSaved: 'Changes have been saved',
    errorSaving: 'Failed to save changes',
    editModeEnabled: 'Edit mode enabled without changing page status',
    statusChanged: 'Page status has been changed to: {status}',
    statusChangeError: 'Failed to change page status',
    linkCopied: 'Public link copied to clipboard!',

    unsavedChanges: 'Unsaved Changes',
    unsavedChangesMsg: 'You have unsaved changes. Save them before changing the page status.',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    statusChange: 'Status Change',
    statusChangeMsg: 'Are you sure you want to change the page status?',
    confirmStatusChange: 'Yes, change status',
    sendToApproval: 'Sending for Approval',
    sendToApprovalMsg: 'Are you sure you want to send this page for supervisor approval?',
    confirmSend: 'Yes, send',
    acceptPage: 'Approve Page',
    acceptPageMsg: 'Do you want to approve and publish this page?',
    confirmPublish: 'Yes, publish',
    editPage: 'Edit Page',
    editPageMsg: 'Changing status to "draft" will allow editing. Continue?',
    confirmEdit: 'Yes, edit',
    publishPage: 'Publish Page',
    publishPageMsg: 'Do you want to publish this page?',

    paymentVerificationRequired: 'Payment Verification Required',
    subscriptionRequired: 'Subscription Required',
    verifyPayment: 'Verify Payment',
    subscribe: 'Subscribe',

    statusPending: 'pending approval',
    statusPublished: 'published',
    statusDraft: 'draft',
    statusPublicLink: ' Public link: {url}',
    statusPublicLinkGeneric: ' The page is available at the public link.',

    changeColorSchemeTo: 'Change color scheme to',
    colorSchemeDark: 'Dark',
    colorSchemeLight: 'Light',
    colorSchemeEarth: 'Earth',
    colorSchemeFrost: 'Frost',

    previewModeWatermark: 'PREVIEW',
    previewModeTitle: 'PREVIEW MODE (READ-ONLY)',
    previewModeDesc: 'This link is temporary and should not be shared.',
    closePreview: 'Close Preview',
    closeTabConfirm: 'This browser does not allow closing the tab automatically. Go back to the page list?',

    loadingPreview: 'Loading page preview...',

    errorOccurred: 'An error occurred',
    tryAgain: 'Try again',
    backToList: 'Back to page list',
    errorFetchingData: 'An error occurred while fetching data',
    errorNotFound: 'Page with the given token was not found',
    errorUnauthorized: 'You are not authorized to view this page',
    errorUnknown: 'An unknown error occurred',
    errorNoData: 'No data received from the server',
    errorIncompleteData: 'The page does not have generated content yet. Generate AI content in the editor.',
    errorProcessingData: 'Failed to process page data',

    statusNoPermission: 'No permissions',
    statusPublish: 'Publish',
    statusRevertToDraft: 'Revert to Draft',
    statusChangeButton: 'Change Status',

    adminSelectColor: 'Select color scheme:',
    adminThemeLabel: 'Theme',
    adminBack: 'Back',
    adminSaving: 'Saving...',
    adminSave: 'Save',
    adminProcessing: 'Processing...',
  }
};

// Wspólna klasa tła
const containerClass = 'min-h-screen bg-white';

// ───────────────────────────────────────────────────────────────────────────
// Toast Notification
// ───────────────────────────────────────────────────────────────────────────

const ToastNotification = ({
  type = 'success',
  message,
  onClose
}: {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed left-4 bottom-16 z-50 p-3 rounded-md shadow-lg flex items-center space-x-3 transition-all duration-300 animate-slideUp ${
        type === 'success'
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-800 border border-red-200'
      }`}
    >
      <div className={`flex-shrink-0 w-5 h-5 ${type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
        {type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
      </div>
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// ConfirmDialog
// ───────────────────────────────────────────────────────────────────────────

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-sm bg-white/30 transition-all duration-300 animate-fadeIn">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-200 animate-scaleIn">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Główny komponent strony podglądu
// ───────────────────────────────────────────────────────────────────────────

const PreviewPageContent = ({ t, lang }: { t: typeof translations.pl; lang: 'pl' | 'en' }) => {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string);
  const isPreviewMode = searchParams.get('view_mode') === 'preview';
  const editMode = searchParams.get('mode') === 'edit';

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentColorScheme, setCurrentColorScheme] = useState<keyof typeof colorSchemes>('light');
  const [originalColorScheme, setOriginalColorScheme] = useState<keyof typeof colorSchemes>('light');
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isTextEditMode, setIsTextEditMode] = useState(false);

  // Stany dla lokalnego śledzenia zmian (gdy nie używamy kontekstu)
  const [localTextChanges, setLocalTextChanges] = useState<Record<string, string>>({});
  const [hasLocalColorChange, setHasLocalColorChange] = useState(false);

  // Stan dla powiadomień toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Stany dla obsługi dialogów
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    onConfirm: () => {}
  });
  const [newStatus, setNewStatus] = useState<string | null>(null);

  // Sprawdź czy używamy kontekstu
  const editModeContext = useEditMode();
  const useContextMode = !!editModeContext;

  // Przycisk kolorystyki
  const ColorSchemeButton = ({
    scheme,
    currentScheme,
    onClick,
    colorName,
    disabled
  }: {
    scheme: string;
    currentScheme: string;
    onClick: (scheme: string) => void;
    colorName: string;
    disabled?: boolean;
  }) => {
    const isActive = currentScheme === scheme;
    return (
      <button
        onClick={() => !disabled && onClick(scheme)}
        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
          isActive
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-label={`${t.changeColorSchemeTo} ${colorName}`}
        disabled={disabled}
      >
        {colorName}
      </button>
    );
  };

  // Baner trybu podglądu
  const PreviewModeBanner = ({ onClose }: { onClose: () => void }) => (
    <>
      <div className="fixed inset-0 pointer-events-none z-30 flex items-center justify-center">
        <div className="text-gray-200 text-9xl font-bold opacity-5 transform -rotate-45 select-none">
          {t.previewModeWatermark}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-indigo-700/90 backdrop-blur-sm py-3 px-4 text-white flex justify-between items-center shadow-lg">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 mr-3 text-yellow-300" />
          <div>
            <span className="font-bold block text-sm sm:text-base">{t.previewModeTitle}</span>
            <span className="text-indigo-200 text-xs sm:text-sm">{t.previewModeDesc}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center bg-white text-indigo-700 px-3 py-2 rounded text-sm font-medium hover:bg-indigo-50 transition-colors ml-2 cursor-pointer"
        >
          <X className="h-4 w-4 mr-1" />
          {t.closePreview}
        </button>
      </div>
    </>
  );

  // Komponenty stanu
  const LoadingState = () => (
    <div className={`${containerClass} flex items-center justify-center h-screen`}>
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
        <p className="mt-4 text-gray-700">{t.loadingPreview}</p>
      </div>
    </div>
  );

  const ErrorState = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div className={`${containerClass} flex items-center justify-center h-screen`}>
      <div className="text-center max-w-md p-6 bg-red-50 rounded-lg border border-red-200">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-red-800 mb-2">{t.errorOccurred}</h2>
        <p className="text-red-700 mb-4">{message}</p>
        <div className="flex justify-center space-x-4">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
            >
              {t.tryAgain}
            </button>
          )}
          <Link
            href="/landings"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors cursor-pointer"
          >
            {t.backToList}
          </Link>
        </div>
      </div>
    </div>
  );

  // Funkcja zamykania podglądu
  const closePreview = () => {
    window.close();
    setTimeout(() => {
      if (!window.closed) {
        const confirmation = window.confirm(t.closeTabConfirm);
        if (confirmation) {
          window.location.href = '/pages';
        }
      }
    }, 300);
  };

  // Czy użytkownik może edytować
  const canEdit = useCallback((): boolean => {
    if (isPreviewMode) return false;
    if (!pageData || status !== 'authenticated' || !session?.user) return false;
    if (editMode) return true;

    const userRole = (session.user as any)?.role?.toUpperCase() || 'USER';
    const userId = session.user.id;
    const isAdmin = userRole === 'ADMIN';
    const isOwner = pageData.userId === userId;

    if (isAdmin) return true;
    if (isOwner) return pageData.status === 'draft' || pageData.status === 'pending';
    return false;
  }, [isPreviewMode, pageData, status, session, editMode]);

  // Czy są niezapisane zmiany
  const hasAnyChanges = () =>
    useContextMode
      ? editModeContext.hasPendingChanges
      : Object.keys(localTextChanges).length > 0 || hasLocalColorChange;

  // Info o zmianie statusu
  const getStatusChangeInfo = () => {
    if (!pageData || status !== 'authenticated' || !session?.user || isPreviewMode) {
      return { enabled: false, buttonText: '', newStatus: null };
    }

    const canUserEdit = canEdit();
    const currentStatus = pageData.status || 'draft';

    if (!canUserEdit) {
      return { enabled: false, buttonText: t.statusNoPermission, newStatus: null };
    }

    switch (currentStatus) {
      case 'draft':
      case 'pending':
        return { enabled: true, buttonText: t.statusPublish, newStatus: 'published' };
      case 'published':
        return { enabled: true, buttonText: t.statusRevertToDraft, newStatus: 'draft' };
      default:
        return { enabled: false, buttonText: t.statusChangeButton, newStatus: null };
    }
  };

  // Obsługa zmiany kolorystyki
  const handleColorChange = (colorScheme: keyof typeof colorSchemes) => {
    if (isPreviewMode) return;

    setCurrentColorScheme(colorScheme);

    if (useContextMode) {
      editModeContext.handleColorChange(colorScheme);
    } else {
      setHasLocalColorChange(colorScheme !== originalColorScheme);
    }
  };

  // Funkcja zapisująca wszystkie zmiany
  const saveChanges = async () => {
    if (isPreviewMode || !pageData?.id || !canEdit()) return;
    if (!hasAnyChanges()) return;

    setIsSaving(true);

    try {
      if (useContextMode) {
        const credentials = {
          userId: session?.user?.id,
          cognitoSub: (session?.user as any)?.cognitoSub
        };

        // Zarejestruj zmiany przed save (saveAllChanges czyści pendingChanges)
        const savedTextChanges = { ...editModeContext.pendingChanges };
        const savedColorChange = editModeContext.pendingColorChange;

        const success = await editModeContext.saveAllChanges(pageData.id, credentials);
        if (!success) return;

        // Merge zapisanych zmian do pageData (path-based update jsonb)
        setPageData(prev => {
          if (!prev) return null;
          const updated: PageData = { ...prev };

          // Klonowanie deep żeby nie mutować pierwotnego obiektu
          if (prev.pageContent) {
            const clonedContent = JSON.parse(JSON.stringify(prev.pageContent));
            for (const [path, value] of Object.entries(savedTextChanges)) {
              if (path.includes('.')) {
                setByPath(clonedContent, path, value);
              } else {
                // Page-level field (np. headline na 'pages.headline')
                (updated as any)[path] = value;
              }
            }
            updated.pageContent = clonedContent;
          }

          if (savedColorChange) {
            updated.color = savedColorChange;
          }

          return updated;
        });
      } else {
        // Tryb bez kontekstu — wysyła wszystko jednym requestem (legacy)
        const changes: Record<string, any> = { ...localTextChanges };
        if (hasLocalColorChange) changes.color = currentColorScheme;

        const response = await fetch(`/api/pages/${pageData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes)
        });

        if (!response.ok) throw new Error(t.errorSaving);

        const updatedPage = await response.json();
        setPageData(prev => (prev ? { ...prev, ...updatedPage } : null));

        setLocalTextChanges({});
        setHasLocalColorChange(false);
        setOriginalColorScheme(currentColorScheme);

        setToast({ type: 'success', text: t.changesSaved });
      }
    } catch (error) {
      console.error('Błąd podczas zapisywania zmian:', error);
      setToast({
        type: 'error',
        text: error instanceof Error ? error.message : t.errorSaving
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Funkcja aktualizująca tekst lokalnie (gdy nie używamy kontekstu)
  // Konwencja fieldName: "hero.headline_l1", "benefits.items.2.title" itd.
  const handleTextUpdate = (fieldName: string, newValue: string) => {
    if (isPreviewMode) return;

    if (useContextMode) {
      editModeContext.handleTextChange(fieldName, newValue);
      return;
    }

    // Lokalny tracking — sprawdź oryginał po ścieżce
    const originalValue = fieldName.includes('.')
      ? lookupByPath(pageData?.pageContent, fieldName)
      : (pageData as any)?.[fieldName];

    if (originalValue === newValue) {
      const updatedChanges = { ...localTextChanges };
      delete updatedChanges[fieldName];
      setLocalTextChanges(updatedChanges);
    } else {
      setLocalTextChanges(prev => ({ ...prev, [fieldName]: newValue }));
    }
  };

  // Funkcja inicjująca zmianę statusu
  const initiateStatusChange = () => {
    if (isPreviewMode) return;

    if (hasAnyChanges()) {
      setConfirmDialogConfig({
        title: t.unsavedChanges,
        message: t.unsavedChangesMsg,
        confirmText: t.saveChanges,
        cancelText: t.cancel,
        onConfirm: async () => {
          await saveChanges();
          setShowConfirmDialog(false);
        }
      });
      setShowConfirmDialog(true);
      return;
    }

    const statusInfo = getStatusChangeInfo();
    if (!statusInfo.enabled || !statusInfo.newStatus) return;

    let dialogConfig = {
      title: t.statusChange,
      message: t.statusChangeMsg,
      confirmText: t.confirmStatusChange,
      cancelText: t.cancel,
      onConfirm: () => executeStatusChange(statusInfo.newStatus!)
    };

    if (pageData?.status === 'draft' && statusInfo.newStatus === 'pending') {
      dialogConfig = {
        title: t.sendToApproval,
        message: t.sendToApprovalMsg,
        confirmText: t.confirmSend,
        cancelText: t.cancel,
        onConfirm: () => executeStatusChange('pending')
      };
    } else if (pageData?.status === 'pending' && statusInfo.newStatus === 'published') {
      dialogConfig = {
        title: t.acceptPage,
        message: t.acceptPageMsg,
        confirmText: t.confirmPublish,
        cancelText: t.cancel,
        onConfirm: () => executeStatusChange('published')
      };
    } else if (pageData?.status === 'published') {
      const userRole = (session?.user as any)?.role?.toUpperCase() || 'USER';
      const isAdmin = userRole === 'ADMIN';

      if (isAdmin) {
        setIsTextEditMode(true);
        if (useContextMode) editModeContext.setTextEditMode(true);
        setToast({ type: 'success', text: t.editModeEnabled });
        setShowConfirmDialog(false);
        return;
      } else {
        dialogConfig = {
          title: t.editPage,
          message: t.editPageMsg,
          confirmText: t.confirmEdit,
          cancelText: t.cancel,
          onConfirm: () => executeStatusChange('draft')
        };
      }
    } else if (pageData?.status === 'draft' && statusInfo.newStatus === 'published') {
      dialogConfig = {
        title: t.publishPage,
        message: t.publishPageMsg,
        confirmText: t.confirmPublish,
        cancelText: t.cancel,
        onConfirm: () => executeStatusChange('published')
      };
    }

    setConfirmDialogConfig(dialogConfig);
    setShowConfirmDialog(true);
    setNewStatus(statusInfo.newStatus);
  };

  // Funkcja wykonująca faktyczną zmianę statusu
  const executeStatusChange = async (status: string) => {
    if (isPreviewMode || !token || !pageData) return;

    setIsChangingStatus(true);

    try {
      // ─── Sprawdzenie subskrypcji przed publikacją ────────────────────
      if (status === 'published') {
        const userRole = (session?.user as any)?.role?.toUpperCase() || 'USER';
        const isAdmin = userRole === 'ADMIN';

        if (!isAdmin) {
          const subscriptionCheck = await fetch('/api/user/subscription-status');
          const subData = await subscriptionCheck.json();

          if (!subData.canPublish) {
            setShowConfirmDialog(false);
            setIsChangingStatus(false);

            setTimeout(() => {
              setConfirmDialogConfig({
                title: subData.action === 'VERIFY_PAYMENT'
                  ? t.paymentVerificationRequired
                  : t.subscriptionRequired,
                message: subData.reason,
                confirmText: subData.action === 'VERIFY_PAYMENT'
                  ? t.verifyPayment
                  : t.subscribe,
                cancelText: t.cancel,
                onConfirm: () => {
                  setShowConfirmDialog(false);
                  const redirectUrl = subData.action === 'VERIFY_PAYMENT'
                    ? '/verify-payment'
                    : '/subscribe';
                  window.location.href = redirectUrl;
                }
              });
              setShowConfirmDialog(true);
            }, 100);

            return;
          }
        }
      }

      const updateData: Record<string, any> = { status };

      // Generowanie publicznego URL przy publikacji
      if (status === 'published') {
        const creatorName = pageData.authorDisplayName || 'autor';
        const title = pageData.title || 'ebook';

        const sanitize = (text: string) =>
          text.toLowerCase().trim()
            .replace(/ł/g, 'l').replace(/ą/g, 'a').replace(/ę/g, 'e')
            .replace(/ś/g, 's').replace(/ć/g, 'c').replace(/ń/g, 'n')
            .replace(/ó/g, 'o').replace(/ż/g, 'z').replace(/ź/g, 'z')
            .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const sanitizedCreator = sanitize(creatorName);
        const sanitizedTitle = sanitize(title);
        const uniqueIndex = pageData.id.slice(-3);
        const pathUrl = `/ebookpage/by-${sanitizedCreator}/${sanitizedTitle}-${uniqueIndex}`;
        const fullUrl = `${window.location.origin}${pathUrl}`;

        updateData.url = fullUrl;
      }

      const response = await fetch(`/api/pages/${pageData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) throw new Error(`${t.statusChangeError} ${status}`);

      const updatedPage = await response.json();
      setPageData(prevData => {
        if (!prevData) return null;
        return {
          ...prevData,
          status,
          url: updatedPage.url || prevData.url,
        };
      });

      let statusText = '';
      let additionalMessage = '';

      switch (status) {
        case 'pending':
          statusText = t.statusPending;
          break;
        case 'published':
          statusText = t.statusPublished;
          additionalMessage = updatedPage?.url
            ? t.statusPublicLink.replace('{url}', updatedPage.url)
            : t.statusPublicLinkGeneric;
          break;
        case 'draft':
          statusText = t.statusDraft;
          setIsTextEditMode(true);
          if (useContextMode) editModeContext.setTextEditMode(true);
          break;
        default:
          statusText = status;
      }

      setToast({
        type: 'success',
        text: t.statusChanged.replace('{status}', statusText) + additionalMessage
      });

      if (status === 'published') {
        if (updatedPage?.url) {
          await navigator.clipboard.writeText(updatedPage.url);
          setToast({ type: 'success', text: t.linkCopied });
        }

        setTimeout(() => {
          window.location.href = '/landings';
        }, 1500);
      }
    } catch (error) {
      console.error('Błąd podczas zmiany statusu:', error);
      setToast({ type: 'error', text: t.statusChangeError });
    } finally {
      setIsChangingStatus(false);
      setShowConfirmDialog(false);
    }
  };

  // Pobieranie danych strony
  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/pages/preview/${token}?${isPreviewMode ? 'view_mode=preview' : ''}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        let errorMsg = t.errorFetchingData;
        if (response.status === 404) errorMsg = t.errorNotFound;
        else if (response.status === 401) errorMsg = t.errorUnauthorized;
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setPageData(data as PageData);
    } catch (err) {
      console.error('Błąd podczas pobierania danych:', err);
      setError(err instanceof Error ? err.message : t.errorUnknown);
    } finally {
      setLoading(false);
    }
  }, [token, isPreviewMode, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Ustaw kolorystykę po załadowaniu danych
  useEffect(() => {
    if (pageData?.color) {
      const isValidColorScheme = Object.keys(colorSchemes).includes(pageData.color);
      if (isValidColorScheme) {
        setCurrentColorScheme(pageData.color as keyof typeof colorSchemes);
        setOriginalColorScheme(pageData.color as keyof typeof colorSchemes);
      } else {
        console.warn(`Nieznana kolorystyka w bazie: ${pageData.color}, używam domyślnej`);
      }
    }
  }, [pageData]);

  // Automatyczne włączenie trybu edycji
  useEffect(() => {
    if (isPreviewMode) return;

    if (pageData && canEdit()) {
      const userRole = (session?.user as any)?.role?.toUpperCase() || 'USER';
      const isAdmin = userRole === 'ADMIN';
      const shouldEnableEditMode = pageData.status === 'draft' || editMode || isAdmin;

      if (shouldEnableEditMode) {
        setIsTextEditMode(true);
        if (useContextMode) editModeContext.setTextEditMode(true);
      }
    }
  }, [pageData, editMode, useContextMode, session, isPreviewMode, canEdit]);

  // Synchronizacja z kontekstem
  useEffect(() => {
    if (useContextMode) {
      editModeContext.setTextEditMode(isTextEditMode);
    }
  }, [isTextEditMode, useContextMode]);

  // Style animacji
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      .animate-fadeIn { animation: fadeIn 0.2s ease-out forwards; }
      .animate-scaleIn { animation: scaleIn 0.2s ease-out forwards; }
      .animate-slideIn { animation: slideIn 0.3s ease-out forwards; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ─── Walidacja danych ─────────────────────────────────────────────────
  // Strona jest "kompletna" gdy ma id i wygenerowaną treść (pageContent)
  const validatePageData = (data: PageData | null): boolean => {
    if (!data) return false;
    if (!data.id) return false;
    const pageType = data.type || 'ebook';
    if (pageType === 'ebook' && !data.pageContent) return false;
    return true;
  };

  // Obsługa ponownej próby
  const handleRetry = () => fetchData();

  // ─── Render ────────────────────────────────────────────────────────────
  const renderContent = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={handleRetry} />;
    if (!pageData) return <ErrorState message={t.errorNoData} onRetry={handleRetry} />;

    const pageType = pageData.type || 'ebook';

    if (pageType === 'ebook' && !validatePageData(pageData)) {
      return <ErrorState message={t.errorIncompleteData} />;
    }

    const statusInfo = getStatusChangeInfo();
    const canEditPage = canEdit();

    // EbookMeta zbudowane z pageData.ebook (z naszego API)
    const ebookMeta = pageData.ebook
      ? {
          chapterCount: pageData.ebook.chapterCount,
          estimatedPages: pageData.ebook.estimatedPages,
          chapters: pageData.ebook.chapters,
        }
      : undefined;

    return (
      <div className={containerClass}>
        <div className="pb-24">
          {pageType === 'ebook' ? (
            (() => {
              // ─── Header config — fallback dla legacy users (null w DB) ────
              // Jeśli user nie ustawił headerStyle w Settings, wybierz domyślny:
              // 'profile' gdy ma jakiekolwiek zdjęcie, inaczej 'none'.
              const hasAnyPic = !!pageData.profilePicture || !!pageData.customProfilePicture;
              const resolvedHeaderStyle: 'profile' | 'logo' | 'none' =
                pageData.headerStyle ?? (hasAnyPic ? 'profile' : 'none');
              const googlePic = buildAssetUrl(pageData.profilePicture);
              const customPic = buildAssetUrl(pageData.customProfilePicture);
              const brandLogo = buildAssetUrl(pageData.authorLogoUrl);

              return (
                <DemoView
                  pageContent={pageData.pageContent as any}
                  colorSchemeName={currentColorScheme}
                  language={lang}
                  ebookMeta={ebookMeta}
                  partnerName={pageData.authorDisplayName || 'Autor'}
                  partnerLogoUrl={googlePic}
                  visitors={pageData.visitors || 0}
                  pageId={pageData.id}
                  pageData={pageData}
                  isPreviewMode={isPreviewMode}
                  isTextEditMode={isTextEditMode && canEditPage}
                  onTextUpdate={useContextMode ? undefined : handleTextUpdate}
                  // ─── NOWE: header config z Settings ──────────────────────
                  headerStyle={resolvedHeaderStyle}
                  activeProfileSource={pageData.activeProfileSource ?? 'google'}
                  googleProfilePicture={googlePic}
                  customProfilePicture={customPic}
                  brandLogoUrl={brandLogo}
                />
              );
            })()
          ) : (
            <DemoVideo
              pageContent={{
                title: pageData.pageContent?.hero?.headline_l1 || pageData.title || 'Strona wideo',
                videoEmbedUrl: '',
                videoProvider: 'vimeo' as const,
                description: pageData.pageContent?.hero?.subheadline,
                videoThumbnailUrl: undefined,
                ctaButtonText: pageData.pageContent?.form?.cta || 'Obejrzyj teraz',
              }}
              colorSchemeName={currentColorScheme}
              partnerName={pageData.authorDisplayName || 'Autor'}
              pageId={pageData.id}
              pageData={pageData}
              isPreviewMode={isPreviewMode}
            />
          )}
        </div>

        {/* Panel administracyjny */}
        {!isPreviewMode && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white shadow-lg py-3 px-4 border-t border-gray-200">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
              {/* Motyw kolorystyczny */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">
                  {t.adminThemeLabel}
                </span>
                {Object.entries(colorSchemes).map(([key, scheme]) => {
                  const nameMap: Record<string, string> = {
                    dark: t.colorSchemeDark,
                    light: t.colorSchemeLight,
                    earth: t.colorSchemeEarth,
                    frost: t.colorSchemeFrost,
                  };
                  const translatedName = nameMap[key] || scheme.name;
                  return (
                    <ColorSchemeButton
                      key={key}
                      scheme={key}
                      currentScheme={currentColorScheme}
                      onClick={(s) => handleColorChange(s as keyof typeof colorSchemes)}
                      colorName={translatedName}
                      disabled={!canEditPage}
                    />
                  );
                })}
              </div>

              <div className="hidden sm:block w-px h-8 bg-gray-200"></div>

              <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                <Link
                  href="/landings"
                  className="flex items-center bg-gray-100 text-gray-600 px-4 py-2 rounded text-sm font-medium hover:bg-gray-200 hover:text-gray-800 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  {t.adminBack}
                </Link>

                <button
                  onClick={saveChanges}
                  disabled={isSaving || !canEditPage || !hasAnyChanges()}
                  className={`flex items-center px-4 py-2 rounded text-sm font-medium transition-colors ${
                    !canEditPage || !hasAnyChanges()
                      ? 'bg-blue-100 text-blue-300 cursor-not-allowed'
                      : isSaving
                      ? 'bg-blue-400 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                      {t.adminSaving}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      {t.adminSave}
                      {hasAnyChanges() && (
                        <span className="ml-1.5 bg-white text-blue-600 rounded w-5 h-5 flex items-center justify-center text-xs font-bold">
                          {useContextMode
                            ? editModeContext.getPendingChangesCount()
                            : Object.keys(localTextChanges).length + (hasLocalColorChange ? 1 : 0)}
                        </span>
                      )}
                    </>
                  )}
                </button>

                <button
                  onClick={initiateStatusChange}
                  disabled={isChangingStatus || !statusInfo.enabled}
                  className={`flex items-center px-4 py-2 rounded text-sm font-medium transition-colors ${
                    !statusInfo.enabled
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : isChangingStatus
                      ? 'bg-green-400 text-white'
                      : pageData.status === 'pending'
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600 cursor-pointer'
                      : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                  }`}
                >
                  {isChangingStatus ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                      {t.adminProcessing}
                    </>
                  ) : (
                    <>{statusInfo.buttonText}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <ToastNotification
            type={toast.type}
            message={toast.text}
            onClose={() => setToast(null)}
          />
        )}

        {/* Baner podglądu */}
        {isPreviewMode && <PreviewModeBanner onClose={closePreview} />}

        {/* Dialog potwierdzający */}
        <ConfirmDialog
          isOpen={showConfirmDialog}
          title={confirmDialogConfig.title}
          message={confirmDialogConfig.message}
          confirmText={confirmDialogConfig.confirmText}
          cancelText={confirmDialogConfig.cancelText}
          onConfirm={confirmDialogConfig.onConfirm}
          onCancel={() => setShowConfirmDialog(false)}
        />
      </div>
    );
  };

  return renderContent();
};

// ───────────────────────────────────────────────────────────────────────────
// Wrapper z EditModeProvider
// ───────────────────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string);
  const isPreviewMode = searchParams.get('view_mode') === 'preview';
  const editMode = searchParams.get('mode') === 'edit';

  const autoEnableEditMode = !isPreviewMode && editMode;

  const [currentLang, setCurrentLang] = useState<'pl' | 'en'>('pl');

  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage');
    if (savedLang === 'en' || savedLang === 'pl') {
      setCurrentLang(savedLang);
    }
  }, []);

  const t = translations[currentLang];

  return (
    <EditModeProvider initialValues={{}} autoEnableEditMode={autoEnableEditMode}>
      <PreviewPageContent t={t} lang={currentLang} />
    </EditModeProvider>
  );
}