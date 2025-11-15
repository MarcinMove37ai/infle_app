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

// Interface dla danych strony z API
interface PageData {
  id: string;
  status: string;
  type: string;
  color?: string; // Dodane dla kolorystyki
  userId?: string; // Dodane dla sprawdzania właściciela
  url?: string;
  x_amz_meta_title: string;
  x_amz_meta_page_type: string;
  s3_file_key: string;
  author_display_name: string;
  author_logo_url: string;
  visitors?: number; // Dodane dla statystyk

  // Wszystkie pola zawartości strony
  pagecontent_hero_headline?: string;
  pagecontent_hero_subheadline?: string;
  pagecontent_hero_description?: string;
  pagecontent_benefits_items_0_title?: string;
  pagecontent_benefits_items_0_text?: string;
  pagecontent_benefits_items_1_title?: string;
  pagecontent_benefits_items_1_text?: string;
  pagecontent_benefits_items_2_title?: string;
  pagecontent_benefits_items_2_text?: string;
  pagecontent_benefits_items_3_title?: string;
  pagecontent_benefits_items_3_text?: string;
  pagecontent_testimonials_items_0_text?: string;
  pagecontent_testimonials_items_0_author?: string;
  pagecontent_testimonials_items_0_role?: string;
  pagecontent_testimonials_items_1_text?: string;
  pagecontent_testimonials_items_1_author?: string;
  pagecontent_testimonials_items_1_role?: string;
  pagecontent_testimonials_items_2_text?: string;
  pagecontent_testimonials_items_2_author?: string;
  pagecontent_testimonials_items_2_role?: string;
  pagecontent_content_chapters_0_title?: string;
  pagecontent_content_chapters_0_description?: string;
  pagecontent_content_chapters_1_title?: string;
  pagecontent_content_chapters_1_description?: string;
  pagecontent_content_chapters_2_title?: string;
  pagecontent_content_chapters_2_description?: string;
  pagecontent_form_title?: string;
  pagecontent_faq_items_0_question?: string;
  pagecontent_faq_items_0_answer?: string;
  pagecontent_faq_items_1_question?: string;
  pagecontent_faq_items_1_answer?: string;
  pagecontent_faq_items_2_question?: string;
  pagecontent_faq_items_2_answer?: string;
}

// Interfejsy dla komponentów renderowania (bez zmian)
interface PageContent {
  s3_file_key: string;
  hero: {
    headline: string;
    subheadline: string;
    description: string;
    buttonText: string;
    stats: Array<{ value: string; label: string }>;
  };
  benefits: {
    title: string;
    items: Array<{ title: string; text: string }>;
  };
  testimonials: {
    title: string;
    items: Array<{
      avatar: string;
      text: string;
      author: string;
      role: string;
      rating: number;
    }>;
  };
  content: {
    title: string;
    chapters: Array<{
      number: string;
      title: string;
      description: string;
    }>;
  };
  form: {
    title: string;
    subtitle: string;
    namePlaceholder: string;
    emailPlaceholder: string;
    phonePlaceholder: string;
    buttonText: string;
    privacyText: string;
  };
  guarantees: {
    items: Array<{ text: string }>;
  };
  faq: {
    title: string;
    items: Array<{
      question: string;
      answer: string;
    }>;
  };
}

interface VideoPageContent {
  title: string;
  description?: string;
  videoEmbedUrl: string;
  videoThumbnailUrl?: string;
  videoProvider: "vimeo" | "voomly";
  ctaButtonText?: string;
}

// Tłumaczenia
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
    errorIncompleteData: 'Dane strony e-book są niekompletne lub uszkodzone. Proszę sprawdzić konfigurację strony.',
    errorProcessingData: 'Nie udało się przetworzyć danych strony',

    // getStatusChangeInfo
    statusNoPermission: 'Brak uprawnień',
    statusPublish: 'Publikuj',
    statusRevertToDraft: 'Cofnij do edycji',
    statusChangeButton: 'Zmień status',

    // Admin Panel
    adminSelectColor: 'Wybierz kolorystykę:',
    adminBack: 'Powrót',
    adminSaving: 'Zapisywanie...',
    adminSave: 'Zapisz',
    adminProcessing: 'Przetwarzanie...',

    // Domyślna zawartość strony (formatPageContent)
    heroButtonText: 'Pobierz bezpłatny e-book',
    heroStatsReaders: 'czytelników',
    heroStatsRating: 'ocena',
    heroStatsSatisfaction: 'satysfakcji',
    benefitsTitle: 'Co zyskasz dzięki temu przewodnikowi?',
    testimonialsTitle: 'Opinie czytelników',
    contentTitle: 'Co znajdziesz w środku?',
    formTitle: 'Pobierz bezpłatny e-book już teraz',
    formSubtitle: 'Uzupełnij poniższy formularz, aby otrzymać e-book',
    formNamePlaceholder: 'Twoje imię',
    formEmailPlaceholder: 'Twój adres e-mail',
    formPhonePlaceholder: 'Twój numer telefonu (opcjonalnie)',
    formButtonText: 'Wyślij mi e-book',
    formPrivacyText: 'Twoje dane są bezpieczne. Zapoznaj się z polityką prywatności.',
    guarantee1: 'Sprawdzone badania naukowe',
    guarantee2: 'Aktualizacja 2025',
    guarantee3: 'Bezpieczne porady',
    faqTitle: 'Najczęściej zadawane pytania',
  },
  en: {
    // Toast
    changesSaved: 'Changes have been saved',
    errorSaving: 'Failed to save changes',
    editModeEnabled: 'Edit mode enabled without changing page status',
    statusChanged: 'Page status has been changed to: {status}',
    statusChangeError: 'Failed to change page status',
    linkCopied: 'Public link copied to clipboard!',

    // Confirm Dialog
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

    // Subskrypcja
    paymentVerificationRequired: 'Payment Verification Required',
    subscriptionRequired: 'Subscription Required',
    verifyPayment: 'Verify Payment',
    subscribe: 'Subscribe',

    // Statusy
    statusPending: 'pending approval',
    statusPublished: 'published',
    statusDraft: 'draft',
    statusPublicLink: ' Public link: {url}',
    statusPublicLinkGeneric: ' The page is available at the public link.',

    // ColorSchemeButton
    changeColorSchemeTo: 'Change color scheme to',

    // PreviewModeBanner
    previewModeWatermark: 'PREVIEW',
    previewModeTitle: 'PREVIEW MODE (READ-ONLY)',
    previewModeDesc: 'This link is temporary and should not be shared.',
    closePreview: 'Close Preview',
    closeTabConfirm: 'This browser does not allow closing the tab automatically. Go back to the page list?',

    // LoadingState
    loadingPreview: 'Loading page preview...',

    // ErrorState
    errorOccurred: 'An error occurred',
    tryAgain: 'Try again',
    backToList: 'Back to page list',
    errorFetchingData: 'An error occurred while fetching data',
    errorNotFound: 'Page with the given token was not found',
    errorUnauthorized: 'You are not authorized to view this page',
    errorUnknown: 'An unknown error occurred',
    errorNoData: 'No data received from the server',
    errorIncompleteData: 'E-book page data is incomplete or corrupted. Please check the page configuration.',
    errorProcessingData: 'Failed to process page data',

    // getStatusChangeInfo
    statusNoPermission: 'No permissions',
    statusPublish: 'Publish',
    statusRevertToDraft: 'Revert to Draft',
    statusChangeButton: 'Change Status',

    // Admin Panel
    adminSelectColor: 'Select color scheme:',
    adminBack: 'Back',
    adminSaving: 'Saving...',
    adminSave: 'Save',
    adminProcessing: 'Processing...',

    // Domyślna zawartość strony (formatPageContent)
    heroButtonText: 'Get your free e-book',
    heroStatsReaders: 'readers',
    heroStatsRating: 'rating',
    heroStatsSatisfaction: 'satisfaction',
    benefitsTitle: 'What will you gain from this guide?',
    testimonialsTitle: 'Reader reviews',
    contentTitle: "What's inside?",
    formTitle: 'Get your free e-book now',
    formSubtitle: 'Fill out the form below to receive the e-book',
    formNamePlaceholder: 'Your name',
    formEmailPlaceholder: 'Your email address',
    formPhonePlaceholder: 'Your phone number (optional)',
    formButtonText: 'Send me the e-book',
    formPrivacyText: 'Your data is safe. Read our privacy policy.',
    guarantee1: 'Verified scientific research',
    guarantee2: '2025 Update',
    guarantee3: 'Safe advice',
    faqTitle: 'Frequently Asked Questions',
  }
};

// Wspólna klasa tła
const containerClass = "min-h-screen bg-white";

// Komponent Toast Notification
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
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
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
        {type === 'success' ? (
          <Check className="w-5 h-5" />
        ) : (
          <X className="w-5 h-5" />
        )}
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

// Komponent dialogu potwierdzającego
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

// Główny komponent strony podglądu
const PreviewPageContent = ({ t }: { t: typeof translations.pl }) => {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const token = Array.isArray(params.token) ? params.token[0] : params.token as string;
  const isPreviewMode = searchParams.get('view_mode') === 'preview';
  const editMode = searchParams.get('mode') === 'edit';

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentColorScheme, setCurrentColorScheme] = useState<keyof typeof colorSchemes>('harmonia');
  const [originalColorScheme, setOriginalColorScheme] = useState<keyof typeof colorSchemes>('harmonia');
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isTextEditMode, setIsTextEditMode] = useState(false);

  // Stany dla lokalnego śledzenia zmian (gdy nie używamy kontekstu)
  const [localTextChanges, setLocalTextChanges] = useState<Record<string, string>>({});
  const [hasLocalColorChange, setHasLocalColorChange] = useState(false);

  // Stan dla powiadomień toast
  const [toast, setToast] = useState<{type: 'success' | 'error', text: string} | null>(null);

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
    color,
    disabled
  }: {
    scheme: string,
    currentScheme: string,
    onClick: (scheme: string) => void,
    colorName: string,
    color: string,
    disabled?: boolean
  }) => {
    return (
      <button
        onClick={() => !disabled && onClick(scheme)}
        className={`flex items-center justify-center p-1.5 sm:p-2 rounded-full border-2 w-8 h-8 sm:w-10 sm:h-10 transition-all ${
          currentScheme === scheme ? 'border-gray-800' : 'border-gray-300'
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        title={colorName}
        aria-label={`${t.changeColorSchemeTo} ${colorName}`}
        disabled={disabled}
      >
        <div
          className="w-full h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </button>
    );
  };

  // Baner trybu podglądu
  const PreviewModeBanner = ({ onClose }: { onClose: () => void }) => {
    return (
      <>
        {/* Wodoznak informujący o trybie podglądu */}
        <div className="fixed inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div className="text-gray-200 text-9xl font-bold opacity-5 transform -rotate-45 select-none">
            {t.previewModeWatermark}
          </div>
        </div>

        {/* Główny baner na dole ekranu */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-indigo-700/90 backdrop-blur-sm py-3 px-4 text-white flex justify-between items-center shadow-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 mr-3 text-yellow-300" />
            <div>
              <span className="font-bold block text-sm sm:text-base">{t.previewModeTitle}</span>
              <span className="text-indigo-200 text-xs sm:text-sm">
                {t.previewModeDesc}
              </span>
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
  };

  // Komponent ładowania
  const LoadingState = () => (
    <div className={`${containerClass} flex items-center justify-center h-screen`}>
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent"></div>
        <p className="mt-4 text-gray-700">{t.loadingPreview}</p>
      </div>
    </div>
  );

  // Komponent błędu
  const ErrorState = ({ message, onRetry }: { message: string, onRetry?: () => void }) => (
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

  // DEBUG - logowanie sesji
  useEffect(() => {
    console.log('=== DEBUG SESSION ===');
    console.log('Session status:', status);
    console.log('Session user:', session?.user);
    console.log('User role:', (session?.user as any)?.role);
    console.log('=====================');
  }, [status, session]);

  // TEMPORARY DEBUG - wymuś tryb edycji
  useEffect(() => {
    if (!isPreviewMode && pageData) {
      console.log('=== FORCING EDIT MODE ===');
      setIsTextEditMode(true);
      if (useContextMode) {
        editModeContext.setTextEditMode(true);
      }
      console.log('FORCED edit mode ON');
    }
  }, [pageData, isPreviewMode, useContextMode]);

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

  // Funkcja pomocnicza do określania czy można edytować stronę
  const canEdit = () => {
      if (isPreviewMode) return false;
      if (!pageData || status !== 'authenticated' || !session?.user) return false;

      // Jeśli przyszedł z linku ?mode=edit, zawsze pozwól na edycję
      if (editMode) return true;

      const userRole = (session.user as any)?.role?.toUpperCase() || 'USER';
      const userId = session.user.id;
      const isAdmin = userRole === 'ADMIN';
      const isOwner = pageData.userId === userId;

      // Admini mogą zawsze edytować
      if (isAdmin) return true;

      // Właściciel strony może edytować jeśli strona jest w statusie draft lub pending
      if (isOwner) {
        return pageData.status === 'draft' || pageData.status === 'pending';
      }

      // Inne przypadki = brak dostępu
      return false;
    };

  // Funkcja sprawdzająca czy są jakiekolwiek niezapisane zmiany
  const hasAnyChanges = () => {
    if (useContextMode) {
      return editModeContext.hasPendingChanges;
    } else {
      return Object.keys(localTextChanges).length > 0 || hasLocalColorChange;
    }
  };

  // Funkcja pomocnicza do określania możliwości zmiany statusu
  // src/app/preview/[token]/page.tsx

// Zamień całą starą funkcję na tę poniżej:
const getStatusChangeInfo = () => {
    // 1. Podstawowa weryfikacja - bez zmian
    if (!pageData || status !== 'authenticated' || !session?.user || isPreviewMode) {
      return { enabled: false, buttonText: '', newStatus: null };
    }

    // 2. Kluczowa zmiana: Sprawdzamy uprawnienia do edycji zamiast roli
    const canUserEdit = canEdit();
    const currentStatus = pageData.status || 'draft';

    // Jeśli użytkownik nie ma uprawnień do edycji, nic nie może zrobić
    if (!canUserEdit) {
      return { enabled: false, buttonText: t.statusNoPermission, newStatus: null };
    }

    // 3. Uproszczona logika dla każdego, kto może edytować
    switch (currentStatus) {
      case 'draft':
      case 'pending':
        // Jeśli strona jest wersją roboczą lub czeka na akceptację, można ją opublikować
        return { enabled: true, buttonText: t.statusPublish, newStatus: 'published' };

      case 'published':
        // Jeśli strona jest opublikowana, można ją cofnąć do edycji
        return { enabled: true, buttonText: t.statusRevertToDraft, newStatus: 'draft' };

      default:
        // Domyślny stan, na wszelki wypadek
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

        await editModeContext.saveAllChanges(pageData.id, credentials);

        setToast({
          type: 'success',
          text: t.changesSaved
        });
      } else {
        // Przygotuj dane do zapisania
        const changes: Record<string, any> = {
          ...localTextChanges
        };

        if (hasLocalColorChange) {
          changes.color = currentColorScheme;
        }

        const response = await fetch(`/api/pages/${pageData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(changes)
        });

        if (!response.ok) {
          throw new Error(t.errorSaving);
        }

        const updatedPage = await response.json();
        setPageData(updatedPage);

        setLocalTextChanges({});
        setHasLocalColorChange(false);
        setOriginalColorScheme(currentColorScheme);

        setToast({
          type: 'success',
          text: t.changesSaved
        });

      }
    } catch (error) {
      console.error('Błąd podczas zapisywania zmian:', error);
      setToast({
        type: 'error',
        text: (error instanceof Error) ? error.message : t.errorSaving
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Funkcja aktualizująca tekst lokalnie
  const handleTextUpdate = (fieldName: string, newValue: string) => {
    if (isPreviewMode) return;

    if (useContextMode) {
      editModeContext.handleTextChange(fieldName, newValue);
    } else {
      const originalValue = pageData?.[fieldName as keyof PageData];

      if (originalValue === newValue) {
        const updatedChanges = { ...localTextChanges };
        delete updatedChanges[fieldName];
        setLocalTextChanges(updatedChanges);
      } else {
        setLocalTextChanges(prev => ({
          ...prev,
          [fieldName]: newValue
        }));
      }
    }
  };

  // Funkcja inicjująca zmianę statusu z potwierdzeniem
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
                // KLUCZOWA LINIA - zamknij dialog po zapisie
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

    // Dostosowanie komunikatu dla konkretnych przypadków
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
        if (useContextMode) {
          editModeContext.setTextEditMode(true);
        }
        setToast({
          type: 'success',
          text: t.editModeEnabled
        });
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
        // ============================================
        // 🔒 SPRAWDZENIE SUBSKRYPCJI PRZED PUBLIKACJĄ
        // ============================================
        if (status === 'published') {
          const userRole = (session?.user as any)?.role?.toUpperCase() || 'USER';
          const isAdmin = userRole === 'ADMIN';

          // Admini mogą publikować bez sprawdzania
          if (!isAdmin) {
            console.log('🔍 Checking subscription status before publish...');

            const subscriptionCheck = await fetch('/api/user/subscription-status');
            const subData = await subscriptionCheck.json();

            console.log('🔍 Subscription check result:', subData);

            if (!subData.canPublish) {
              // Zamknij obecny dialog
              setShowConfirmDialog(false);
              setIsChangingStatus(false);

              // UŻYJ setTimeout aby React zdążył zamknąć poprzedni dialog
              setTimeout(() => {
                // Pokaż dialog z informacją o wymaganej subskrypcji
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
                    setShowConfirmDialog(false); // Zamknij ten dialog
                    // Przekieruj do odpowiedniej strony
                    const redirectUrl = subData.action === 'VERIFY_PAYMENT'
                      ? '/verify-payment'
                      : '/subscribe';
                    window.location.href = redirectUrl;
                  }
                });

                setShowConfirmDialog(true);
              }, 100); // 100ms opóźnienia

              return; // STOP - nie publikuj
            }

            console.log('✅ Subscription check passed - proceeding with publish');
          }
        }
        // ============================================

        const updateData: Record<string, any> = { status };

        // Jeśli publikujemy stronę, generujemy publiczny URL
        if (status === 'published') {
          const creatorName = pageData.author_display_name || 'autor';
          const title = pageData.x_amz_meta_title || 'ebook';

          const sanitize = (text: string) => text
            .toLowerCase().trim()
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        });

        if (!response.ok) {
          throw new Error(`${t.statusChangeError} ${status}`);
        }

        const updatedPage = await response.json();
        setPageData(prevData => {
          if (!prevData) return null;
          return {
            ...prevData,
            status: status,
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
            if (useContextMode) {
              editModeContext.setTextEditMode(true);
            }
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
            // Mały toast, że skopiowano
            setToast({ type: 'success', text: t.linkCopied });
          }

          setTimeout(() => {
            window.location.href = '/landings';
          }, 1500);
        }

      } catch (error) {
        console.error('Błąd podczas zmiany statusu:', error);
        setToast({
          type: 'error',
          text: t.statusChangeError
        });
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

      console.log('Wywołanie API z trybem podglądu:', isPreviewMode);

      const response = await fetch(`/api/pages/preview/${token}?${isPreviewMode ? 'view_mode=preview' : ''}`);

      if (!response.ok) {
        let errorMsg = t.errorFetchingData;
        if (response.status === 404) {
          errorMsg = t.errorNotFound;
        } else if (response.status === 401) {
          errorMsg = t.errorUnauthorized;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setPageData(data);
    } catch (error) {
      console.error('Błąd podczas pobierania danych:', error);
      setError((error instanceof Error) ? error.message : t.errorUnknown);
    } finally {
      setLoading(false);
    }
  }, [token, isPreviewMode, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Efekt, który ustawi kolorystykę po załadowaniu danych strony
  useEffect(() => {
    if (pageData && pageData.color) {
      const isValidColorScheme = Object.keys(colorSchemes).includes(pageData.color);

      if (isValidColorScheme) {
        setCurrentColorScheme(pageData.color as keyof typeof colorSchemes);
        setOriginalColorScheme(pageData.color as keyof typeof colorSchemes);
        console.log(`Wczytano kolorystykę z bazy danych: ${pageData.color}`);
      } else {
        console.warn(`Nieznana kolorystyka w bazie danych: ${pageData.color}, używam domyślnej`);
      }
    }
  }, [pageData]);

  // Automatycznie włącz tryb edycji gdy strona jest w trybie draft lub gdy przyszliśmy z przycisku "Edytuj"
  useEffect(() => {
    if (isPreviewMode) return;

    if (pageData && canEdit()) {
      const userRole = (session?.user as any)?.role?.toUpperCase() || 'USER';
      const isAdmin = userRole === 'ADMIN';
      const shouldEnableEditMode = pageData.status === 'draft' || editMode || isAdmin;

      if (shouldEnableEditMode) {
        setIsTextEditMode(true);
        if (useContextMode) {
          editModeContext.setTextEditMode(true);
        }

        console.log('Automatycznie włączono tryb edycji tekstu:', {
          isDraft: pageData.status === 'draft',
          isEditMode: editMode,
          isAdmin: isAdmin
        });
      }
    }
  }, [pageData, editMode, useContextMode, session, isPreviewMode, canEdit]);

  // Jeśli używamy kontekstu, zaktualizuj stan trybu edycji
  useEffect(() => {
    if (useContextMode) {
      editModeContext.setTextEditMode(isTextEditMode);
    }
  }, [isTextEditMode, useContextMode]);

  // Dodanie stylów animacji
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes scaleIn {
        from { transform: scale(0.95); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .animate-fadeIn {
        animation: fadeIn 0.2s ease-out forwards;
      }
      .animate-scaleIn {
        animation: scaleIn 0.2s ease-out forwards;
      }
      .animate-slideIn {
        animation: slideIn 0.3s ease-out forwards;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Funkcja walidacji danych strony ebook
  const validatePageData = (data: PageData | null) => {
    if (!data) return false;

    const requiredFields = [
      'x_amz_meta_title',
      'pagecontent_hero_headline',
      'pagecontent_hero_subheadline',
      'pagecontent_hero_description'
    ];

    const validFieldsCount = requiredFields.filter(field =>
      data[field as keyof PageData]
    ).length;

    return validFieldsCount >= Math.floor(requiredFields.length * 0.7);
  };

  // Formatowanie danych dla komponentu DemoView
  const formatPageContent = (): PageContent | null => {
    if (!validatePageData(pageData)) {
      return null;
    }

    return {
      s3_file_key: pageData?.s3_file_key || "",
      hero: {
        headline: pageData?.pagecontent_hero_headline || "",
        subheadline: pageData?.pagecontent_hero_subheadline || "",
        description: pageData?.pagecontent_hero_description || "",
        buttonText: t.heroButtonText,
        stats: [
          { value: "10,000+", label: t.heroStatsReaders },
          { value: "4.9/5", label: t.heroStatsRating },
          { value: "100%", label: t.heroStatsSatisfaction }
        ]
      },
      benefits: {
        title: t.benefitsTitle,
        items: [
          {
            title: pageData?.pagecontent_benefits_items_0_title || "",
            text: pageData?.pagecontent_benefits_items_0_text || ""
          },
          {
            title: pageData?.pagecontent_benefits_items_1_title || "",
            text: pageData?.pagecontent_benefits_items_1_text || ""
          },
          {
            title: pageData?.pagecontent_benefits_items_2_title || "",
            text: pageData?.pagecontent_benefits_items_2_text || ""
          },
          {
            title: pageData?.pagecontent_benefits_items_3_title || "",
            text: pageData?.pagecontent_benefits_items_3_text || ""
          }
        ]
      },
      testimonials: {
        title: t.testimonialsTitle,
        items: [
          {
            avatar: "/avatar1.jpg",
            text: pageData?.pagecontent_testimonials_items_0_text || "",
            author: pageData?.pagecontent_testimonials_items_0_author || "",
            role: pageData?.pagecontent_testimonials_items_0_role || "",
            rating: 5
          },
          {
            avatar: "/avatar2.jpg",
            text: pageData?.pagecontent_testimonials_items_1_text || "",
            author: pageData?.pagecontent_testimonials_items_1_author || "",
            role: pageData?.pagecontent_testimonials_items_1_role || "",
            rating: 5
          },
          {
            avatar: "/avatar3.jpg",
            text: pageData?.pagecontent_testimonials_items_2_text || "",
            author: pageData?.pagecontent_testimonials_items_2_author || "",
            role: pageData?.pagecontent_testimonials_items_2_role || "",
            rating: 5
          }
        ]
      },
      content: {
        title: t.contentTitle,
        chapters: [
          {
            number: "01",
            title: pageData?.pagecontent_content_chapters_0_title || "",
            description: pageData?.pagecontent_content_chapters_0_description || ""
          },
          {
            number: "02",
            title: pageData?.pagecontent_content_chapters_1_title || "",
            description: pageData?.pagecontent_content_chapters_1_description || ""
          },
          {
            number: "03",
            title: pageData?.pagecontent_content_chapters_2_title || "",
            description: pageData?.pagecontent_content_chapters_2_description || ""
          }
        ]
      },
      form: {
        title: pageData?.pagecontent_form_title || t.formTitle,
        subtitle: t.formSubtitle,
        namePlaceholder: t.formNamePlaceholder,
        emailPlaceholder: t.formEmailPlaceholder,
        phonePlaceholder: t.formPhonePlaceholder,
        buttonText: t.formButtonText,
        privacyText: t.formPrivacyText
      },
      guarantees: {
        items: [
          { text: t.guarantee1 },
          { text: t.guarantee2 },
          { text: t.guarantee3 }
        ]
      },
      faq: {
        title: t.faqTitle,
        items: [
          {
            question: pageData?.pagecontent_faq_items_0_question || "",
            answer: pageData?.pagecontent_faq_items_0_answer || ""
          },
          {
            question: pageData?.pagecontent_faq_items_1_question || "",
            answer: pageData?.pagecontent_faq_items_1_answer || ""
          },
          {
            question: pageData?.pagecontent_faq_items_2_question || "",
            answer: pageData?.pagecontent_faq_items_2_answer || ""
          }
        ]
      }
    };
  };

  // Obsługa ponownej próby
  const handleRetry = () => {
    fetchData();
  };

  // Przygotuj zawartość komponentu
  const renderContent = () => {
    if (loading) {
      return <LoadingState />;
    }

    if (error) {
      return <ErrorState message={error} onRetry={handleRetry} />;
    }

    if (!pageData) {
      return <ErrorState message={t.errorNoData} onRetry={handleRetry} />;
    }

    const pageType = pageData.x_amz_meta_page_type || pageData.type || 'ebook';

    if (pageType === 'ebook' && !validatePageData(pageData)) {
      return <ErrorState message={t.errorIncompleteData} />;
    }

    const formattedContent = formatPageContent();
    if (!formattedContent) {
      return <ErrorState message={t.errorProcessingData} />;
    }

    const statusInfo = getStatusChangeInfo();
    const canEditPage = canEdit();

    console.log('=== RENDER DEBUG ===');
    console.log('canEditPage:', canEditPage);
    console.log('isTextEditMode:', isTextEditMode);
    console.log('pageData status:', pageData.status);
    console.log('editMode param:', editMode);
    console.log('DemoView will receive isTextEditMode:', isTextEditMode && canEditPage);
    console.log('==================');

    return (
      <div className={containerClass}>
        <div className="pb-24">
          <DemoView
            pageContent={formattedContent}
            colorSchemeName={currentColorScheme}
            partnerName={pageData.author_display_name || "Autor"}
            visitors={pageData.visitors || 0}
            pageId={pageData.id}
            pageData={pageData}
            isPreviewMode={isPreviewMode}
            isTextEditMode={isTextEditMode && canEditPage}
            onTextUpdate={useContextMode ? undefined : handleTextUpdate}
          />
        </div>

        {/* Panel administracyjny - umieszczony na dole strony - ukryty w trybie podglądu */}
        {!isPreviewMode && (
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white shadow-lg py-3 px-4 border-t border-gray-200">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4">
              {/* Sekcja wyboru kolorystyki */}
              <div className="flex-grow flex flex-col items-center">
                <p className="text-xs text-gray-600 mb-1 font-medium text-center">{t.adminSelectColor}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {Object.entries(colorSchemes).map(([key, scheme]) => (
                    <ColorSchemeButton
                      key={key}
                      scheme={key}
                      currentScheme={currentColorScheme}
                      onClick={(scheme) => handleColorChange(scheme as keyof typeof colorSchemes)}
                      colorName={scheme.name}
                      color={scheme.accent}
                      disabled={!canEditPage}
                    />
                  ))}
                </div>
              </div>

              {/* Przyciski akcji */}
              <div className="flex flex-wrap gap-2 sm:gap-3 justify-end">
                <Link
                  href="/landings"
                  className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  {t.adminBack}
                </Link>

                <button
                  onClick={saveChanges}
                  disabled={isSaving || !canEditPage || !hasAnyChanges()}
                  className={`flex items-center ${
                    !canEditPage || !hasAnyChanges()
                      ? 'bg-blue-200 cursor-not-allowed'
                      : isSaving
                        ? 'bg-blue-300'
                        : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  } text-white px-4 py-2 rounded text-sm transition-colors`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      {t.adminSaving}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      {t.adminSave}
                      {hasAnyChanges() && (
                        <span className="ml-1 bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-xs font-bold">
                          {useContextMode ? editModeContext.getPendingChangesCount() : (Object.keys(localTextChanges).length + (hasLocalColorChange ? 1 : 0))}
                        </span>
                      )}
                    </>
                  )}
                </button>

                <button
                  onClick={initiateStatusChange}
                  disabled={isChangingStatus || !statusInfo.enabled}
                  className={`flex items-center ${
                    !statusInfo.enabled
                      ? 'bg-gray-300 cursor-not-allowed'
                      : isChangingStatus
                        ? 'bg-green-300'
                        : pageData.status === 'pending'
                          ? 'bg-yellow-500 hover:bg-yellow-600 cursor-pointer'
                          : 'bg-green-600 hover:bg-green-700 cursor-pointer'
                  } text-white px-4 py-2 rounded text-sm transition-colors`}
                >
                  {isChangingStatus ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
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

        {/* Toast notification */}
        {toast && (
          <ToastNotification
            type={toast.type}
            message={toast.text}
            onClose={() => setToast(null)}
          />
        )}

        {/* Baner podglądu - tylko w trybie podglądu */}
        {isPreviewMode && (
          <PreviewModeBanner onClose={closePreview} />
        )}

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

// Główny komponent strony podglądu - owinięty w EditModeProvider
export default function PreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token as string;
  const isPreviewMode = searchParams.get('view_mode') === 'preview';
  const editMode = searchParams.get('mode') === 'edit';

  const autoEnableEditMode = !isPreviewMode && editMode;

  const [toast, setToast] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [currentLang, setCurrentLang] = useState<'pl' | 'en'>('pl');

  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage');
    if (savedLang === 'en' || savedLang === 'pl') {
      setCurrentLang(savedLang);
    }
  }, []);

  const t = translations[currentLang];

  const handleToast = (message: {type: 'success' | 'error', text: string}) => {
    // Tłumaczenie wiadomości z providera (jeśli to konieczne)
    let translatedText = message.text;
    if (message.text === 'Changes saved successfully') {
      translatedText = t.changesSaved;
    } else if (message.text === 'Error saving changes') {
      translatedText = t.errorSaving;
    }
    setToast({ ...message, text: translatedText });
  };

  return (
    <EditModeProvider
      initialValues={{}}
      autoEnableEditMode={autoEnableEditMode}
      onToast={handleToast}
    >
      <PreviewPageContent t={t} />
      {toast && (
        <ToastNotification
          type={toast.type}
          message={toast.text}
          onClose={() => setToast(null)}
        />
      )}
    </EditModeProvider>
  );
}