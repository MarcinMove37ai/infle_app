// src/components/pages/SettingsContent.tsx
'use client';

import DiskExplorerModal from '@/components/ui/DiskExplorerModal';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  User, Key, Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle, Loader2,
  Palette, Type, ChevronDown, Check, Image as ImageIcon, X, AlertTriangle, FolderOpen,
  Shield, CreditCard, ShieldCheck, Smartphone, RotateCcw,
  // Landing Page Header Setup — nowa sekcja
  Camera, Upload, Sparkles, Lock, Info, Crop
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import UpgradeModal from '@/components/ui/UpgradeModal';
import ProfilePictureCropModal from '@/components/ui/ProfilePictureCropModal';
import BrandLogoModal from '@/components/ui/BrandLogoModal';
import { signOut } from 'next-auth/react';

interface Model {
  id: string;
  name: string;
  description: string; // Teraz to jest klucz tłumaczenia
  tier: 'basic' | 'premium';
  cost?: string;
}

interface Provider {
  id: string;
  name: string;
  icon: string;
  available: boolean;
  models: Model[];
}


interface UserSettings {
  username: string;
  logo: string | null;
  textProvider: string;
  textModel: string;
  imageProvider: string;
  imageModel: string;
}

interface ApiKey {
  value: string;
  showValue: boolean;
  isSaved: boolean;
}

interface AuthorSettings {
  authorDisplayName: string | null;
  authorLogoUrl: string | null;
  authorLogoOriginalUrl: string | null;  // raw original do re-edycji w BrandLogoModal
  fallbackName: string;
  textAiProvider: string | null;
  textAiModel: string | null;
  imageAiProvider: string | null;
  imageAiModel: string | null;
}

interface SubscriptionData {
  role: string;
  plan: string;
  planDescription: string;
  features?: string[];
  limitation?: string;
  upgradeRequired?: boolean;
  isTrialing?: boolean;
  subscriptionStatus?: string | null;
  nextBillingDate?: string | null;
  nextBillingAmount?: string;
  paymentVerifiedAt?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  oneTimePrice?: string;
  // Nowe pola bilingowe
  billingName?: string | null;
  billingAddress?: any;
  companyName?: string | null;
  taxId?: string | null;
  taxIdType?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  billingPreference?: 'company' | 'personal' | null; // <--- DODANO (status blokady)
}


interface ConfirmModal {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmLabel?: string;  // opcjonalny custom label (domyślnie t.confirmRemove)
}

// --- Komponent BillingChoiceModal (Wymuszenie wyboru właściciela) ---
interface BillingChoiceModalProps {
  isOpen: boolean;
  subscriptionData: SubscriptionData | null;
  onSave: (preference: 'company' | 'personal') => Promise<void>;
  t: typeof translations['pl'];
}

const handleManageBilling = async () => {
  try {
    // Automatyczne wykrycie języka
    const detectedLang =
      (typeof window !== 'undefined' && localStorage.getItem('language')) ||
      (typeof navigator !== 'undefined' && navigator.language?.startsWith('pl') ? 'pl' : 'en') ||
      'pl';

    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: detectedLang }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    window.location.href = data.url;
  } catch (error) {
    console.error(error);
    alert('Błąd - spróbuj ponownie');
  }
};

function BillingChoiceModal({ isOpen, subscriptionData, onSave, t }: BillingChoiceModalProps) {
  const [selectedProfile, setSelectedProfile] = useState<'company' | 'personal'>('company');
  const [isSaving, setIsSaving] = useState(false);

  // Helper do formatowania adresu
  const formatAddress = (addr: any) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    const { line1, line2, city, postal_code, country } = addr;
    return [line1, line2, postal_code, city, country].filter(Boolean).join(', ');
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    await onSave(selectedProfile);
    setIsSaving(false);
  };

  if (!isOpen || !subscriptionData) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative overflow-hidden">

        {/* Dekoracyjny nagłówek */}
        <div className="text-center mb-8">
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.confirmOwnerSaveTitle}</h2>
          <p className="text-gray-600 text-sm max-w-lg mx-auto">
            {t.confirmOwnerSaveMsg}
          </p>
        </div>

        {/* Opcje wyboru */}
        <div className="space-y-4 mb-8">
          {/* Opcja 1: Firma */}
          <label
            className={`relative flex items-start p-5 border-2 rounded-xl cursor-pointer transition-all ${
              selectedProfile === 'company'
                ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedProfile('company')}
          >
            <div className="flex items-center h-5 mt-1">
              <input
                type="radio"
                name="modalBilling"
                checked={selectedProfile === 'company'}
                onChange={() => setSelectedProfile('company')}
                className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
            </div>
            <div className="ml-4">
              <span className={`block text-lg font-bold ${selectedProfile === 'company' ? 'text-blue-900' : 'text-gray-900'}`}>
                {subscriptionData.companyName} <span className="text-gray-400 font-normal mx-2">|</span> {subscriptionData.taxId}
              </span>
              {/* Usunięto oddzielną linię z NIP-em, teraz jest powyżej */}
              <span className="block text-sm text-gray-500 mt-1">
                {formatAddress(subscriptionData.billingAddress)}
              </span>
            </div>
            {selectedProfile === 'company' && (
              <div className="absolute top-4 right-4">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase">Firma</span>
              </div>
            )}
          </label>

          {/* Opcja 2: Osoba Prywatna */}
          <label
            className={`relative flex items-start p-5 border-2 rounded-xl cursor-pointer transition-all ${
              selectedProfile === 'personal'
                ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => setSelectedProfile('personal')}
          >
            <div className="flex items-center h-5 mt-1">
              <input
                type="radio"
                name="modalBilling"
                checked={selectedProfile === 'personal'}
                onChange={() => setSelectedProfile('personal')}
                className="h-5 w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
            </div>
            <div className="ml-4">
              <span className={`block text-lg font-bold ${selectedProfile === 'personal' ? 'text-blue-900' : 'text-gray-900'}`}>
                {subscriptionData.billingName || 'Osoba Prywatna'}
              </span>
              <span className="block text-sm text-gray-500 mt-1">
                {formatAddress(subscriptionData.billingAddress)}
              </span>
            </div>
             {selectedProfile === 'personal' && (
              <div className="absolute top-4 right-4">
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase">Osoba</span>
              </div>
            )}
          </label>
        </div>

        {/* Przycisk akcji */}
        <button
          onClick={handleConfirm}
          disabled={isSaving}
          className="w-full py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t.processing || 'Przetwarzanie...'}
            </>
          ) : (
            t.confirmSave
          )}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// HEADER PREVIEW THEMES — wycinek z demo.tsx (tylko tokeny używane
// w mini-headerze: bg, border, shadow, text colors, CTA, divider).
// Nazwy 1:1 z colorSchemes w src/components/views/demo.tsx żeby preview
// pozostał wierny po zmianach motywu w pliku źródłowym.
// ════════════════════════════════════════════════════════════════════════
interface HeaderPreviewTheme {
  key: 'light' | 'dark' | 'earth' | 'frost';
  label: string;          // wyświetlana nazwa w switcherze
  pageBg: string;         // tło strony (otoczenie headera)
  pageText: string;
  pageSubtext: string;
  headerBg: string;
  headerBorder: string;
  headerShadow: string;
  cardBorder: string;     // border okręgu avatara
  ctaBg: string;
  ctaText: string;
  ctaShadow: string;
  divider: string;
  accent: string;
}

const HEADER_PREVIEW_THEMES: HeaderPreviewTheme[] = [
  {
    key: 'light',
    label: 'Light',
    pageBg: '#FAFBFC',
    pageText: '#1E293B',
    pageSubtext: '#64748B',
    headerBg: 'rgba(255,255,255,0.85)',
    headerBorder: 'rgba(0,0,0,0.06)',
    headerShadow: '0 1px 12px rgba(0,0,0,0.06)',
    cardBorder: 'rgba(0,0,0,0.06)',
    ctaBg: 'linear-gradient(135deg, #6366F1, #4F46E5)',
    ctaText: '#FFFFFF',
    ctaShadow: '0 6px 20px rgba(99,102,241,0.30)',
    divider: 'rgba(0,0,0,0.06)',
    accent: '#6366F1',
  },
  {
    key: 'dark',
    label: 'Dark',
    pageBg: '#0A0A0F',
    pageText: '#E2E8F0',
    pageSubtext: '#94A3B8',
    headerBg: 'rgba(10, 10, 15, 0.70)',
    headerBorder: 'rgba(255,255,255,0.08)',
    headerShadow: '0 1px 24px rgba(0,0,0,0.4)',
    cardBorder: 'rgba(255,255,255,0.08)',
    ctaBg: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
    ctaText: '#FFFFFF',
    ctaShadow: '0 8px 24px rgba(139,92,246,0.35)',
    divider: 'rgba(255,255,255,0.06)',
    accent: '#A78BFA',
  },
  {
    key: 'earth',
    label: 'Earth',
    pageBg: '#FAF6F1',
    pageText: '#3D2E1E',
    pageSubtext: '#7C6A56',
    headerBg: 'rgba(250,246,241,0.85)',
    headerBorder: 'rgba(60,46,30,0.08)',
    headerShadow: '0 1px 12px rgba(60,46,30,0.06)',
    cardBorder: 'rgba(60,46,30,0.08)',
    ctaBg: 'linear-gradient(135deg, #2E7D6E, #1D6B5D)',
    ctaText: '#FFFFFF',
    ctaShadow: '0 6px 20px rgba(46,125,110,0.30)',
    divider: 'rgba(60,46,30,0.08)',
    accent: '#2E7D6E',
  },
  {
    key: 'frost',
    label: 'Frost',
    pageBg: '#0C1222',
    pageText: '#CBD5E1',
    pageSubtext: '#64748B',
    headerBg: 'rgba(12,18,34,0.75)',
    headerBorder: 'rgba(148,163,184,0.08)',
    headerShadow: '0 1px 24px rgba(0,0,0,0.5)',
    cardBorder: 'rgba(148,163,184,0.10)',
    ctaBg: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
    ctaText: '#FFFFFF',
    ctaShadow: '0 8px 24px rgba(14,165,233,0.30)',
    divider: 'rgba(148,163,184,0.06)',
    accent: '#38BDF8',
  },
];

// --- Tłumaczenia ---
const translations = {
  pl: {
    // Komunikaty (Toast)
    apiKeyStatusError: 'Nie udało się pobrać statusu kluczy API',
    serverError: 'Błąd połączenia z serwerem',
    settingsFetchError: 'Nie udało się pobrać ustawień autora',
    apiKeySaved: 'Klucz API dla {providerName} został zapisany.',
    apiKeySaveError: 'Nie udało się zapisać klucza API dla {providerName}',
    apiKeyRemoved: 'Klucz API dla {providerName} został usunięty.',
    apiKeyRemoveError: 'Nie udało się usunąć klucza API dla {providerName}',
    avatarUpdated: 'Awatar został zaktualizowany',
    avatarUploadError: 'Nie udało się wgrać awatara',
    avatarRemoved: 'Awatar został usunięty',
    avatarRemoveError: 'Nie udało się usunąć awatara',
    usernameUpdated: 'Nazwa autora została zaktualizowana',
    usernameSaveError: 'Nie udało się zapisać nazwy autora',

    // Modal potwierdzający
    confirmRemoveApiKeyTitle: 'Usuń klucz API',
    confirmRemoveApiKeyMsg: 'Czy na pewno chcesz usunąć klucz API dla {providerName}?',
    confirmCancel: 'Anuluj',
    confirmRemove: 'Usuń klucz',

    // Selektor Modeli
    selectModel: 'Wybierz model',
    activeModel: 'Aktywny model',
    modelAvailable: 'Model dostępny',
    apiKeyRequired: 'Wymagany klucz API',

    // Placeholder Klucza API
    apiKeyPlaceholderAnthropic: 'sk-ant-... lub sk-ant-api03-...',
    apiKeyPlaceholderOpenAI: 'sk-...',
    apiKeyPlaceholderGoogle: 'AIza... (z Google AI Studio)',
    apiKeyPlaceholderDefault: 'Wklej swój klucz API',

    // Selektor Providera
    providerSoon: 'wkrótce',

    // Ustawienia Główne
    authorProfile: 'Profil Autora',
    authorName: 'Nazwa Autora',
    usernamePlaceholder: 'Wpisz swoją nazwę',
    save: 'Zapisz',
    saving: 'Zapisywanie...',
    subscription: 'Subskrypcja',
    currentPlan: 'Aktualny plan',
    features: 'Funkcje',
    planFree: 'Darmowy',
    planDescriptionFree: 'Darmowy plan na początek',
    planRookie: 'Rookie',
    planRookieTrial: 'Rookie (Okres próbny)',
    planDescriptionRookie: 'Plan dla początkujących autorów',
    planDescriptionRookieTrial: 'Korzystasz z 21-dniowego okresu próbnego planu Rookie',
    planCreator: 'Creator',
    planDescriptionCreator: 'Zaawansowane narzędzia dla twórców',
    planUnlimited: 'Unlimited',
    planDescriptionUnlimited: 'Pełna swoboda i wszystkie funkcje',

    // Funkcje Free
    featureFree1: 'Możliwość utworzenia 1 e-booka',
    featureFree2: 'Możliwość utworzenia 1 strony zapisu',
    featureFree3: 'Podstawowa analityka',
    // Funkcje Rookie
    featureRookie1: 'Do 5 e-booków',
    featureRookie2: 'Do 5 stron zapisu',
    featureRookie3: 'Własne logo i branding',
    // Funkcje Creator
    featureCreator1: 'Do 20 e-booków',
    featureCreator2: 'Zaawansowane integracje',
    featureCreator3: 'Automatyzacje e-mail',
    // Funkcje Unlimited
    featureUnlimited1: 'Nielimitowane e-booki i strony',
    featureUnlimited2: 'Priorytetowe wsparcie',
    featureUnlimited3: 'Dostęp do API',

    // Ograniczenia
    limitationPublish: 'Aby opublikować stronę zapisu, należy zweryfikować formę płatności.',

    trialEnds: 'Okres próbny kończy się',
    nextBilling: 'Następna płatność',
    upgradePlan: 'Zaktualizuj Plan',
    // planFree: 'Darmowy', // Już zdefiniowane
    planStandard: 'Standard',
    planPremium: 'Premium',
    planActive: 'Aktywna',
    planInactive: 'Nieaktywna',
    renewsAt: 'Plan aktywny do:',
    manageSubscription: 'Zarządzaj subskrypcją',
    managePlan: 'Zarządzaj planem',
    verifyPayment: 'Zweryfikuj tożsamości ze Stripe',
    billingAmount: 'Kwota:',
    nextPaymentAmount: 'Następna płatność:',

    // Info weryfikacji
    verifyIdentityInfo: 'Aby opublikować Twoją pierwszą Stronę Zapisu musimy poznać Twoją tożsamość. Niezbędne dane, zostaną umieszczone w Polityce Prywatności (wzór) dotyczącej pozyskiwania kontaktów oraz do oznaczenia Strony Zapisu, która jest Twoją własnością w czasie trwania subskrypcji.',

    // Tłumaczenia Modala Upgrade
    upgradeModalTitle: 'Zmień swój plan',
    upgradeModalSubtitle: 'Wybierz plan, który najlepiej pasuje do Twoich potrzeb. Możesz go zmienić w dowolnym momencie.',
    currentPlanBadge: 'Aktualny plan',
    upgradeTo: 'Przejdź na {planName}', // np. Przejdź na Creator
    managePlanStripe: 'Zarządzaj w Stripe', // Dla planu Unlimited

    // Zarządzanie płatnościami (Karta)
    managePaymentMethods: 'Zarządzanie Płatnościami',
    currentPaymentMethod: 'Aktualna forma płatności',
    paymentMethodPlaceholder: 'Nie znaleziono formy płatności. Dodaj ją w Stripe.',
    billingHistory: 'Historia Płatności (Faktury)',
    cancelSubscription: 'Anuluj Subskrypcję',

    // Sekcja Właściciela
    billingOwner: 'Oznaczenie właściciela strony zapisu',
    billingTaxId: 'NIP',
    billingAddress: 'Adres',

    // Modal anulowania subskrypcji
    confirmCancelSubTitle: 'Anuluj Subskrypcję',
    confirmCancelSubMsg: 'Czy na pewno chcesz anulować subskrypcję? Dostęp pozostanie aktywny do końca bieżącego okresu rozliczeniowego.',

    // Modal zapisu właściciela (Task Lock)
    confirmOwnerSaveTitle: 'Potwierdź właściciela strony zapisu',
    confirmOwnerSaveMsg: 'UWAGA: Ta operacja jest nieodwracalna dla tego konta. Wybrane dane (Firma lub Osoba) zostaną na stałe przypisane do Twoich stron zapisu i Polityki Prywatności. Czy na pewno chcesz zapisać?',
    confirmSave: 'Zapisz na stałe',

    // Modal Wyboru Weryfikacji (PL ONLY)
    verifyModalTitle: 'Wybierz metodę weryfikacji',
    verifyModalSubtitle: 'Aby publikować Strony Zapisu, musimy poznać Twoją tożsamość. Rozpocznij bezpłątny okres próbny lub opłać plan Rookie.',
    verifyOptionCardTitle: 'Plan Rookie - 21 dni za darmo',
    verifyOptionCardBadge: 'Karta płatnicza',
    verifyOptionCardDesc: 'Rozpocznij darmowy okres próbny. Żadne środki nie zostaną dziś pobrane. Możesz anulować w dowolnym momencie.',
    verifyOptionCardBtn: 'Rozpocznij Subskrypcję',
    verifyOptionBlikTitle: 'Plan Rookie - płatność jednorazowa',
    verifyOptionBlikBadge: 'Blik/Przelew/Karta',
    verifyOptionBlikDesc: 'Opłać dostęp na 1 miesiąc z góry. Bez podawania karty, bez automatycznego odnawiania, bez zobowiązań',
    verifyOptionBlikBtn: 'Zapłać BLIKiem (29 zł)',

    authorLogo: 'Logo Autora / Zdjęcie',
    processing: 'Przetwarzanie...',
    logoRestrictedTitle: 'Własne logo dostępne w planach Creator i Unlimited',
    logoRestrictedBtn: 'Zaktualizuj swój Plan Inflee.app',
    uploading: 'Wgrywanie...',
    processingAvatar: 'Przetwarzanie awatara',
    addLogo: 'Dodaj logo',
    logoFormats: 'PNG, JPG do 5MB',
    restoreDefaultLogo: 'Przywróć domyślne logo',
    logoHint: 'Widoczne w nagłówku okładki i na stronach lądowania',

    // Konfiguracja AI
    aiConfig: 'Konfiguracja AI',
    aiConfigDesc: 'Wybierz modele i skonfiguruj klucze API',
    aiForText: 'AI dla Tekstu',
    textGeneration: 'Generowanie Tekstu',
    apiActive: 'API Aktywne',
    provider: 'Provider',
    apiKey: 'Klucz API',
    pasteApiKey: 'Wklej swój klucz API...',
    keyIncomplete: 'Klucz wydaje się niekompletny',
    keySecured: 'Kryptograficznie zabezpieczone:',
    keySecuredDesc: 'Twój klucz będzie tutaj bezpieczny!',
    aiForImages: 'AI dla Obrazów',
    imageGeneration: 'Generowanie Obrazów',

    // Zarządzanie Systemem
    systemManagement: 'Zarządzanie Systemem',
    diskExplorer: 'Eksplorator Dysku',
    diskExplorerDesc: 'Przeglądaj i zarządzaj plikami na serwerze',
    exploreDisk: 'Eksploruj Dysk',

    // Opisy Modeli (Klucze)
    modelDescClaudeHaiku: 'Dostępny za darmo przez 30 dni',
    modelDescClaudeSonnet: 'Input $3 / MTo | Output $15 / MTok',
    modelDescGpt4o: 'Najnowszy model ($0.030)',
    modelDescGeminiPro: 'Model Google ($0.020)',
    modelDescGrok2: 'Model X.AI ($0.040)',
    modelDescBielik: 'Polski model ($0.015)',
    modelDescImagen3: 'Dostępny za darmo przez 30 dni',
    modelDescImagen4: 'Wysoka jakość ($0.04) - wymaga własnego klucza API',
    modelDescImagen4Ultra: 'Najwyższa jakość ($0.06) - wymaga własnego klucza API',
    modelDescDalle3: 'Standard - nie wymaga klucza',
    modelDescGptImage1: 'Premium ($0.19) - wymaga klucza',

    // ─── Landing Page Header Setup ─────────────────────────────────────
    headerSetupTitle:           'Wygląd nagłówka strony zapisu',
    headerSetupSubtitle:        'Dostosuj nagłówek widoczny na każdej Twojej stronie zapisu',

    // Preview — symulacja headera landing page'a
    headerPreviewLabel:         'Podgląd nagłówka',
    headerImageSetupLabel:      'Ustawienia obrazu',
    headerImageSetupInfo:       'Ustawienia obrazu mają zastosowanie do wszystkich Twoich stron zapisu',
    headerPreviewMadeBy:        'stworzone przez',
    headerPreviewWith:          'z',
    headerPreviewCta:           'Pobierz e-book',           // hardcoded jak navCta w demo.tsx
    headerPreviewThemeLabel:    'Motyw:',
    headerPreviewThemeInfo:     'Motyw jest tylko poglądowy — nie ma wpływu na istniejące ani przyszłe strony zapisu',
    headerAuthorNameInfo:       'Nazwa jest również widoczna w stopce każdej strony Twojego e-booka',

    // Author Name (tutejszy label, identyczny jak Author Profile)
    headerAuthorNameLabel:      'Nazwa autora',
    headerAuthorNamePlaceholder:'Wpisz swoją nazwę',

    // Profile picture column
    headerPicTitle:             'Zdjęcie profilowe',
    headerPicEnabled:           'Aktywne',
    headerPicDisabled:          'Wyłączone',
    headerToggleTurnOn:         'Włącz',
    headerToggleTurnOff:        'Wyłącz',
    headerToggleLockedHint:     'Dostępne w planach Creator i Unlimited',
    headerPicSourceGoogle:      'z Google',
    headerPicSourceCustom:      'Custom',
    headerPicSourceNone:        'Brak zdjęcia',
    headerPicChangeBtn:         'Zmień zdjęcie',
    headerPicUploadBtn:         'Wgraj zdjęcie',
    headerPicGoogleBtn:         'Zdjęcie z Google',
    headerPicAddBtn:            'Dodaj zdjęcie',
    headerPicRemoveBtn:         'Usuń',
    headerPicUpdated:           'Zdjęcie profilowe zaktualizowane',
    headerPicUploadError:       'Nie udało się zapisać zdjęcia',
    headerPicRemoved:           'Zdjęcie usunięte',
    headerPicRemoveError:       'Nie udało się usunąć zdjęcia',
    headerPicToggleError:       'Nie udało się zmienić ustawienia',

    // Brand logo column
    headerBrandTitle:           'Logo brandu',
    headerBrandEnabled:         'Aktywne',
    headerBrandDisabled:        'Wyłączone',
    headerBrandStatusActive:    'Twoje logo',
    headerBrandStatusNone:      'Nie ustawione',
    headerBrandStatusLocked:    'Plan PLUS',
    headerBrandUploadBtn:       'Wgraj logo',
    headerBrandChangeBtn:       'Zmień',
    headerBrandEditBtn:         'Edytuj',
    headerBrandRemoveBtn:       'Usuń',
    headerBrandLockedHint:      'Zastąp podpis własnym logo brandu',
    headerBrandUnlockBtn:       'Zaktualizuj plan',

    // Mutual exclusion
    headerMutualExclusionInfo:  'Aktywne może być tylko jedno: zdjęcie LUB logo brandu',
  },
  en: {
    // Komunikaty (Toast)
    apiKeyStatusError: 'Failed to fetch API key status',
    serverError: 'Server connection error',
    settingsFetchError: 'Failed to fetch author settings',
    apiKeySaved: 'API key for {providerName} has been saved.',
    apiKeySaveError: 'Failed to save API key for {providerName}',
    apiKeyRemoved: 'API key for {providerName} has been removed.',
    apiKeyRemoveError: 'Failed to remove API key for {providerName}',
    avatarUpdated: 'Avatar has been updated',
    avatarUploadError: 'Failed to upload avatar',
    avatarRemoved: 'Avatar has been removed',
    avatarRemoveError: 'Failed to remove avatar',
    usernameUpdated: 'Author name has been updated',
    usernameSaveError: 'Failed to save author name',

    // Modal potwierdzający
    confirmRemoveApiKeyTitle: 'Remove API Key',
    confirmRemoveApiKeyMsg: 'Are you sure you want to remove the API key for {providerName}?',
    confirmCancel: 'Cancel',
    confirmRemove: 'Remove Key',

    // Selektor Modeli
    selectModel: 'Select a model',
    activeModel: 'Active Model',
    modelAvailable: 'Model available',
    apiKeyRequired: 'API key required',

    // Placeholder Klucza API
    apiKeyPlaceholderAnthropic: 'sk-ant-... or sk-ant-api03-...',
    apiKeyPlaceholderOpenAI: 'sk-...',
    apiKeyPlaceholderGoogle: 'AIza... (from Google AI Studio)',
    apiKeyPlaceholderDefault: 'Paste your API key',

    // Selektor Providera
    providerSoon: 'soon',

    // Ustawienia Główne
    authorProfile: 'Author Profile',
    authorName: 'Author Name',
    usernamePlaceholder: 'Enter your name',
    save: 'Save',
    saving: 'Saving...',
    subscription: 'Subscription',
    currentPlan: 'Current plan',
    features: 'Features',
    planFree: 'Free',
    planDescriptionFree: 'Free plan for a good start',
    planRookie: 'Rookie',
    planRookieTrial: 'Rookie (Trial)',
    planDescriptionRookie: 'Plan for beginner authors',
    planDescriptionRookieTrial: 'You are using a 21-day trial of the Rookie plan',
    planCreator: 'Creator',
    planDescriptionCreator: 'Advanced tools for creators',
    planUnlimited: 'Unlimited',
    planDescriptionUnlimited: 'Full freedom and all features',

    // Free Features
    featureFree1: 'Ability to create 1 e-book',
    featureFree2: 'Ability to create 1 landing page',
    featureFree3: 'Basic analytics',
    // Rookie Features
    featureRookie1: 'Up to 5 e-books',
    featureRookie2: 'Up to 5 landing pages',
    featureRookie3: 'Custom logo and branding',
    // Creator Features
    featureCreator1: 'Up to 20 e-books',
    featureCreator2: 'Advanced integrations',
    featureCreator3: 'Email automations',
    // Unlimited Features
    featureUnlimited1: 'Unlimited e-books and pages',
    featureUnlimited2: 'Priority support',
    featureUnlimited3: 'API Access',

    // Limitations
    limitationPublish: 'To publish landing page, you need to verify payment method.',

    trialEnds: 'Trial ends',
    nextBilling: 'Next billing',
    upgradePlan: 'Upgrade Plan',
    // planFree: 'Free', // Już zdefiniowane
    planStandard: 'Standard',
    planPremium: 'Premium',
    planActive: 'Active',
    planInactive: 'Inactive',
    renewsAt: 'Renews at:',
    manageSubscription: 'Manage Subscription',
    managePlan: 'Manage Plan',
    verifyPayment: 'Verify Identity with Stripe',
    billingAmount: 'Amount:',
    nextPaymentAmount: 'Next payment:',

    // Verification Info
    verifyIdentityInfo: 'To publish your first Landing Page, we must know your identity. The data will be used in the Privacy Policy regarding acquired Leads and to designate the Landing Page as your property during the subscription period. To confirm your identity, start a 21-day trial of the Rookie plan; you can cancel at any time.',

    // Upgrade Modal Translations
    upgradeModalTitle: 'Change Your Plan',
    upgradeModalSubtitle: 'Choose the plan that best suits your needs. You can change it at any time.',
    currentPlanBadge: 'Current Plan',
    upgradeTo: 'Upgrade to {planName}', // e.g. Upgrade to Creator
    managePlanStripe: 'Manage in Stripe', // For Unlimited plan

    // Payment Management (Card)
    managePaymentMethods: 'Payment Management',
    currentPaymentMethod: 'Current Payment Method',
    paymentMethodPlaceholder: 'No payment method found. Add one in Stripe.',
    billingHistory: 'Billing History (Invoices)',
    cancelSubscription: 'Cancel Subscription',

    // Owner Section (NEW)
    billingOwner: 'Landing Page Owner',
    billingTaxId: 'Tax ID',
    billingAddress: 'Address',

    // Cancel subscription modal
    confirmCancelSubTitle: 'Cancel Subscription',
    confirmCancelSubMsg: 'Are you sure you want to cancel? Your access will remain active until the end of your billing period.',

    // NEW: Landing Page Owner Lock
    confirmOwnerSaveTitle: 'Confirm Landing Page Owner',
    confirmOwnerSaveMsg: 'WARNING: This action is irreversible for this account. The selected data (Company or Individual) will be permanently assigned to your landing pages and Privacy Policy. Are you sure you want to save?',
    confirmSave: 'Save permanently',
    verifyModalTitle: 'Choose verification method',
    verifyModalSubtitle: 'To publish the page, we must verify your identity. Choose the method that suits you.',
    verifyOptionCardTitle: 'Payment Card',
    verifyOptionCardBadge: '21 Day Trial',
    verifyOptionCardDesc: 'Start a free trial. No funds will be charged today. You can cancel at any time.',
    verifyOptionCardBtn: 'Start Subscription',
    verifyOptionBlikTitle: 'Quick Transfer / BLIK',
    verifyOptionBlikBadge: 'One-time Payment',
    verifyOptionBlikDesc: 'Pay for 1 month access in advance. No card required, no automatic renewal. No trial period.',
    verifyOptionBlikBtn: 'Pay with BLIK (29 PLN)',
    saved: 'Saved',

    authorLogo: 'Author Logo / Photo',
    processing: 'Processing...',
    logoRestrictedTitle: 'Custom logo available in paid plans',
    logoRestrictedBtn: 'Upgrade your Inflee.app Plan',
    uploading: 'Uploading...',
    processingAvatar: 'Processing avatar',
    addLogo: 'Add logo',
    logoFormats: 'PNG, JPG up to 5MB',
    restoreDefaultLogo: 'Restore default logo',
    logoHint: 'Visible in the cover header and on landing pages',

    // Konfiguracja AI
    aiConfig: 'AI Configuration',
    aiConfigDesc: 'Choose models and configure API keys',
    aiForText: 'AI for Text',
    textGeneration: 'Text Generation',
    apiActive: 'API Active',
    provider: 'Provider',
    apiKey: 'API Key',
    pasteApiKey: 'Paste your API key...',
    keyIncomplete: 'The key seems incomplete',
    keySecured: 'Cryptographically secured:',
    keySecuredDesc: 'Your key will be safe here!',
    aiForImages: 'AI for Images',
    imageGeneration: 'Image Generation',

    // Zarządzanie Systemem
    systemManagement: 'System Management',
    diskExplorer: 'Disk Explorer',
    diskExplorerDesc: 'Browse and manage files stored on the server',
    exploreDisk: 'Explore Disk',

    // Opisy Modeli (Klucze)
    modelDescClaudeHaiku: 'Available for free for 30 days',
    modelDescClaudeSonnet: 'Input $3 / MTo | Output $15 / MTok',
    modelDescGpt4o: 'The latest model ($0.030)',
    modelDescGeminiPro: 'Google\'s model ($0.020)',
    modelDescGrok2: 'X.AI\'s model ($0.040)',
    modelDescBielik: 'Polish model ($0.015)',
    modelDescImagen3: 'Available for free for 30 days',
    modelDescImagen4: 'High quality ($0.04) - requires your own API key',
    modelDescImagen4Ultra: 'Highest quality ($0.06) - requires your own API key',
    modelDescDalle3: 'Standard - no key needed',
    modelDescGptImage1: 'Premium ($0.19) - key required',

    // ─── Landing Page Header Setup ─────────────────────────────────────
    headerSetupTitle:           'Landing Page Header Setup',
    headerSetupSubtitle:        'Customize the header visible on every landing page you create',

    // Preview — landing page header simulation
    headerPreviewLabel:         'Header preview',
    headerImageSetupLabel:      'Image setup',
    headerImageSetupInfo:       'Image setup will be applied for all your Landing Pages',
    headerPreviewMadeBy:        'made by',
    headerPreviewWith:          'with',
    headerPreviewCta:           'Get the e-book',          // hardcoded same as navCta in demo.tsx
    headerPreviewThemeLabel:    'Theme:',
    headerPreviewThemeInfo:     'Header preview only — theme setup here has no impact on existing or future landing pages',
    headerAuthorNameInfo:       'This name is also visible in the footer of every page of your e-books',

    // Author Name (local label, mirrors Author Profile)
    headerAuthorNameLabel:      'Author name',
    headerAuthorNamePlaceholder:'Enter your name',

    // Profile picture column
    headerPicTitle:             'Profile picture',
    headerPicEnabled:           'Active',
    headerPicDisabled:          'Disabled',
    headerToggleTurnOn:         'Turn on',
    headerToggleTurnOff:        'Turn off',
    headerToggleLockedHint:     'Available at Creator and Unlimited Plan',
    headerPicSourceGoogle:      'from Google',
    headerPicSourceCustom:      'Custom',
    headerPicSourceNone:        'No picture',
    headerPicChangeBtn:         'Change photo',
    headerPicUploadBtn:         'Upload photo',
    headerPicGoogleBtn:         'Google profile picture',
    headerPicAddBtn:            'Add picture',
    headerPicRemoveBtn:         'Remove',
    headerPicUpdated:           'Profile picture updated',
    headerPicUploadError:       'Failed to save picture',
    headerPicRemoved:           'Picture removed',
    headerPicRemoveError:       'Failed to remove picture',
    headerPicToggleError:       'Failed to update setting',

    // Brand logo column
    headerBrandTitle:           'Brand logo',
    headerBrandEnabled:         'Active',
    headerBrandDisabled:        'Disabled',
    headerBrandStatusActive:    'Your logo',
    headerBrandStatusNone:      'Not set',
    headerBrandStatusLocked:    'PLUS plan',
    headerBrandUploadBtn:       'Upload logo',
    headerBrandChangeBtn:       'Change',
    headerBrandEditBtn:         'Edit',
    headerBrandRemoveBtn:       'Remove',
    headerBrandLockedHint:      'Replace the signature with your brand logo',
    headerBrandUnlockBtn:       'Upgrade plan',

    // Mutual exclusion
    headerMutualExclusionInfo:  'Only one can be active: picture OR brand logo',
  }
};

// Text provider configuration
const TEXT_PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    available: true,
    models: [
      { id: 'claude-3-haiku', name: 'Claude Haiku 3.5', description: 'modelDescClaudeHaiku', tier: 'basic' },
      { id: 'claude-3-sonnet', name: 'Claude Sonnet 4', description: 'modelDescClaudeSonnet', tier: 'premium', cost: '$0.025' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    available: false,
    models: [{ id: 'gpt-4o', name: 'GPT-4o', description: 'modelDescGpt4o', tier: 'premium', cost: '$0.030' }]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    available: false,
    models: [{ id: 'gemini-pro', name: 'Gemini Pro', description: 'modelDescGeminiPro', tier: 'premium', cost: '$0.020' }]
  },
  {
    id: 'grok',
    name: 'Grok (X.AI)',
    icon: '⚡',
    available: false,
    models: [{ id: 'grok-2', name: 'Grok 2', description: 'modelDescGrok2', tier: 'premium', cost: '$0.040' }]
  },
  {
    id: 'bielik',
    name: 'Bielik',
    icon: '🦅',
    available: false,
    models: [{ id: 'bielik-11b', name: 'Bielik 11B', description: 'modelDescBielik', tier: 'premium', cost: '$0.015' }]
  }
];

const IMAGE_PROVIDERS: Provider[] = [
  {
    id: 'google',
    name: 'Google AI Studio',
    icon: '✨',
    available: true,
    models: [
      {
        id: 'imagen-3',
        name: 'Imagen 3',
        description: 'modelDescImagen3',
        tier: 'basic'
      },
      {
        id: 'imagen-4',
        name: 'Imagen 4',
        description: 'modelDescImagen4',
        tier: 'premium',
        cost: '$0.04'
      },
      {
        id: 'imagen-4-ultra',
        name: 'Imagen 4 Ultra',
        description: 'modelDescImagen4Ultra',
        tier: 'premium',
        cost: '$0.06'
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🎨',
    available: false,
    models: [
      {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        description: 'modelDescDalle3',
        tier: 'basic'
      },
      {
        id: 'gpt-image-1',
        name: 'GPT-Image-1',
        description: 'modelDescGptImage1',
        tier: 'premium',
        cost: '$0.19'
      },
    ]
  }
];

// --- Komponent VerificationChoiceModal (Z POPRAWKĄ CENY) ---
interface VerificationChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCard: () => void;
  onSelectBlik: () => void;
  t: typeof translations['pl'];
  processingType: 'card' | 'blik' | null;
  priceBlik?: string; // <--- 1. DODANO NOWY PROP
}

function VerificationChoiceModal({
  isOpen,
  onClose,
  onSelectCard,
  onSelectBlik,
  t,
  processingType,
  priceBlik // <--- 2. ODBIERAMY PROP
}: VerificationChoiceModalProps) {

  if (!isOpen) return null;
  const isAnyProcessing = processingType !== null;

  // Helper do tekstu przycisku
  const getBlikButtonText = () => {
    // Jeśli mamy cenę z backendu, używamy jej. Jeśli nie, fallback do tłumaczenia.
    if (priceBlik) {
      return `Zapłać BLIKiem (${priceBlik})`;
    }
    return t.verifyOptionBlikBtn; // Domyślne "Zapłać BLIKiem (29 zł)"
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex justify-center items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={!isAnyProcessing ? onClose : undefined} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-4xl w-full text-white overflow-hidden">

        <button
          onClick={onClose}
          disabled={isAnyProcessing}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-3">{t.verifyModalTitle}</h2>
          <p className="text-gray-400 max-w-lg mx-auto">{t.verifyModalSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* OPCJA 1: KARTA */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-600/20 to-purple-600/20 rounded-2xl blur-sm group-hover:blur-md transition-all duration-300 opacity-50 group-hover:opacity-100" />
            <div className="relative h-full bg-gray-950 border border-gray-700 group-hover:border-blue-500/50 rounded-2xl p-6 flex flex-col transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl"><CreditCard className="w-8 h-8 text-blue-400" /></div>
                <span className="bg-blue-500/10 text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/20">{t.verifyOptionCardBadge}</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t.verifyOptionCardTitle}</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-grow">{t.verifyOptionCardDesc}</p>

              <button
                onClick={onSelectCard}
                disabled={isAnyProcessing}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                {processingType === 'card' ? <Loader2 className="animate-spin w-5 h-5"/> : t.verifyOptionCardBtn}
              </button>
            </div>
          </div>

          {/* OPCJA 2: BLIK */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-600/20 to-red-600/20 rounded-2xl blur-sm group-hover:blur-md transition-all duration-300 opacity-50 group-hover:opacity-100" />
            <div className="relative h-full bg-gray-950 border border-gray-700 group-hover:border-orange-500/50 rounded-2xl p-6 flex flex-col transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-orange-500/10 rounded-xl"><Smartphone className="w-8 h-8 text-orange-400" /></div>
                <span className="bg-orange-500/10 text-orange-300 text-xs font-bold px-3 py-1 rounded-full border border-orange-500/20">{t.verifyOptionBlikBadge}</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t.verifyOptionBlikTitle}</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed flex-grow">{t.verifyOptionBlikDesc}</p>

              <button
                onClick={onSelectBlik}
                disabled={isAnyProcessing}
                className="w-full py-3 px-4 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group-hover:border-orange-500/50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              >
                {processingType === 'blik' ? (
                  <Loader2 className="animate-spin w-5 h-5"/>
                ) : (
                  // 3. UŻYCIE NOWEGO TEKSTU Z CENĄ
                  getBlikButtonText()
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Komponent Subscription Card
interface SubscriptionCardProps {
  lang: 'pl' | 'en';
  t: typeof translations['pl'];
  compact?: boolean;
  subscriptionData: SubscriptionData | null;
  loading: boolean;
  setConfirmModal: (modalData: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }) => void;
  onOpenVerificationModal: () => void; // <--- DODANO
}

function SubscriptionCard({
  lang,
  t,
  compact = false,
  subscriptionData,
  loading,
  setConfirmModal,
  onOpenVerificationModal
}: SubscriptionCardProps) {
  const [isRedirectingToStripe, setIsRedirectingToStripe] = React.useState(false);
  const [isResuming, setIsResuming] = React.useState(false); // <--- NOWY STAN

  // Funkcja wznawiania (analogiczna do tej w modalu)
  const handleResumeSubscription = async () => {
    setIsResuming(true);
    try {
      const response = await fetch('/api/subscription/resume', { method: 'POST' });
      if (response.ok) {
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Błąd podczas wznawiania.');
      }
    } catch (error) {
      console.error('Error resuming subscription:', error);
      alert('Błąd połączenia z serwerem.');
    } finally {
      setIsResuming(false);
    }
  };

  // Helper function to translate plan names and descriptions
  const translatePlan = (key: string) => {
    return (t as any)[key] || key;
  };

  // Helper do formatowania adresu
  const formatAddress = (addr: any) => {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;

    const { line1, line2, city, postal_code, state, country } = addr;
    const parts = [line1, line2, postal_code, city, country];
    return parts.filter(Boolean).join(', ');
  };

  const handleCancelClick = () => {
    setConfirmModal({
      isOpen: true,
      title: t.confirmCancelSubTitle,
      message: t.confirmCancelSubMsg,
      onConfirm: async () => {
        try {
          const response = await fetch('/api/subscription/cancel', {
            method: 'POST',
          });

          if (response.ok) {
            window.location.reload();
          } else {
            const data = await response.json();
            alert(data.error || 'Wystąpił błąd podczas anulowania.');
          }
        } catch (error) {
          console.error('Error canceling subscription:', error);
          alert('Błąd połączenia z serwerem.');
        } finally {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }
      }
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 1. WIDOK ŁADOWANIA
  if (loading) {
    return (
      <div className={compact ? "" : "bg-white rounded-xl border border-gray-200 p-6"}>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  // 2. WIDOK KOMPAKTOWY (Starter, Demo, Paid, Trial)
  if (compact) {
    const isFree = subscriptionData?.role === 'free';
    const isTrialVer = subscriptionData?.role === 'free_ver';
    const isDemo = subscriptionData?.role === 'demo';

    // 1. ZMIANA NAZWY: Dla free wymuszamy nazwę "Starter"
    let planName = translatePlan(subscriptionData?.plan || 'planFree');
    if (isFree) {
        planName = "Starter";
    }

    // 2. OPIS PLANU: Ukrywamy go dla DEMO oraz TRIAL
    let planDescription = translatePlan(subscriptionData?.planDescription || 'planDescriptionFree');
    if (isDemo || isTrialVer) {
        planDescription = null;
    }

    const renewsDate = formatDate(subscriptionData?.nextBillingDate);
    const nextAmount = subscriptionData?.nextBillingAmount || '---';
    const valueLabel = lang === 'pl' ? 'Wartość:' : 'Value:';

    // Tekst statusu obok nazwy (Tylko dla Triala - Twoje customowe tłumaczenie)
    let statusText = '';
    if (isTrialVer) {
      statusText = lang === 'pl' ? '(Bezpłatny Okres Próbny)' : '(Free Trial Period)';
    }

    // Sprawdzamy, czy potrzebujemy prawej kolumny (tylko dla Starter i Demo)
    const hasRightColumn = isFree || isDemo;

    // --- NOWE: Logika rodzaju płatności (Badge) ---
    let paymentTypeLabel = null;
    let paymentTypeClass = '';

    if (subscriptionData?.subscriptionStatus === 'one_time_paid') {
        paymentTypeLabel = lang === 'pl' ? 'Płatność jednorazowa' : 'One-time payment';
        paymentTypeClass = 'bg-purple-100 text-purple-700 border border-purple-200';
    } else if (subscriptionData?.subscriptionStatus === 'canceled') {
        paymentTypeLabel = lang === 'pl' ? 'Subskrypcja anulowana' : 'Subscription Canceled';
        paymentTypeClass = 'bg-red-100 text-red-700 border border-red-200';
    } else if (subscriptionData?.subscriptionStatus === 'active' || subscriptionData?.subscriptionStatus === 'trialing') {
        // Pokazujemy "Subskrypcja" tylko dla płatnych ról (nie Free/Demo)
        if (!isFree && !isDemo) {
            paymentTypeLabel = lang === 'pl' ? 'Subskrypcja' : 'Subscription';
            paymentTypeClass = 'bg-blue-100 text-blue-700 border border-blue-200';
        }
    }

    // --- NOWE: Logika etykiety daty (Active / Canceled / One-time) ---
    let dateLabel = t.renewsAt; // Domyślnie "Plan aktywny do:" (fallback)

    if (subscriptionData?.subscriptionStatus === 'canceled') {
        dateLabel = lang === 'pl' ? 'Data wygaśnięcia:' : 'Expiration date:';
    } else if (subscriptionData?.subscriptionStatus === 'one_time_paid') {
        dateLabel = lang === 'pl' ? 'Konieczne odnowienie:' : 'Renewal required:';
    } else if (subscriptionData?.subscriptionStatus === 'active' || subscriptionData?.subscriptionStatus === 'trialing') {
        dateLabel = lang === 'pl' ? 'Kolejne odnowienie:' : 'Next renewal:';
    }

    return (
      <div className="space-y-6">

        {/* === CZĘŚĆ 1: KARTA WIZUALNA === */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm relative overflow-hidden">

          {/* KONTENER GŁÓWNY GÓRY */}
          <div className={(!isDemo && !isFree) ? "mb-4" : "mb-0"}>

             {/* UKŁAD: Grid tylko jeśli mamy prawą kolumnę (Starter/Demo). */}
             <div className={hasRightColumn ? "grid grid-cols-1 sm:grid-cols-3 gap-6 items-center" : "block"}>

                {/* --- LEWA KOLUMNA (Nazwa planu) --- */}
                <div className={hasRightColumn ? "sm:col-span-1" : "w-full"}>

                   {/* BADGE CONTAINER */}
                   {/* ZMIANA: flex-col-reverse wrzuca status (ostatni element w DOM) na górę wizualnie na mobile */}
                   <div className="flex flex-col-reverse items-start gap-2 mb-3 sm:flex-row sm:items-center sm:flex-wrap">
                       <span className="inline-block px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-md uppercase tracking-wider">
                         {t.currentPlan}
                       </span>

                       {/* NOWY BADGE: Rodzaj płatności */}
                       {paymentTypeLabel && (
                           <span className={`inline-block px-2 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${paymentTypeClass}`}>
                             {paymentTypeLabel}
                           </span>
                       )}
                   </div>

                   {/* Tytuł i Status obok siebie */}
                   <div className="flex items-baseline flex-wrap gap-2">
                      <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 capitalize leading-none">
                        {planName}
                      </h3>
                      {statusText && (
                        <p className="text-sm sm:text-base text-gray-500 font-normal italic">
                          {statusText}
                        </p>
                      )}
                   </div>

                   {/* Opis planu (Wyświetlany tylko jeśli nie został wyczyszczony wyżej) */}
                   {planDescription && (
                     <p className="text-sm text-gray-500 mt-2 font-medium">
                       {planDescription}
                     </p>
                   )}
                </div>

                {/* --- PRAWA KOLUMNA (2/3 szerokości) - Twoje Komunikaty (Tylko Free/Demo) --- */}
                {hasRightColumn && (
                  <div className="sm:col-span-2 flex justify-start sm:justify-end">

                     {/* Komunikat dla STARTERA */}
                     {isFree && (
                       <div className="py-3 px-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 items-center w-full justify-center sm:justify-start">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <p className="text-sm text-amber-800 font-medium leading-relaxed">
                            {lang === 'pl'
                              ? 'Zweryfikuj tożsamość, aby opublikować Twoją pierwszą Stronę Zapisu.'
                              : 'Verify Identity to publish your first Landing Page'}
                          </p>
                       </div>
                     )}

                     {/* Komunikat dla DEMO */}
                     {isDemo && (
                       <div className="py-3 px-5 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 items-center w-full justify-center sm:justify-start shadow-sm">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                          <p className="text-sm text-amber-800 font-medium leading-relaxed">
                            {lang === 'pl'
                              ? 'Tylko dostęp do Kontaktów. Aktywuj dowolny Plan, aby Tworzyć, Publikować i gromadzić nowe Kontakty'
                              : 'Leads Access Only. Activate any Plan to Create, Publish and collect new Leads'}
                          </p>
                       </div>
                     )}
                  </div>
                )}
             </div>
          </div>

          {/* DÓŁ: Data i Cena - Widoczne dla Trial i Paid (Ukryte dla Demo i Free) */}
          {!isDemo && !isFree && (
            <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-200">
               {/* LEWA STRONA: Data + Opcja Wznowienia */}
               <div className="flex flex-col items-start">
                 <div className="text-sm text-gray-500 font-medium">
                   {dateLabel} <span className="text-gray-900 whitespace-nowrap font-semibold ml-1">{renewsDate}</span>
                 </div>

                 {/* --- PRZYCISK WZNÓW (Z Borderem i Odstępem) --- */}
                 {subscriptionData?.subscriptionStatus === 'canceled' && (
                    <div className="mt-2 pt-5 border-t border-gray-200 w-full">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResumeSubscription();
                          }}
                          disabled={isResuming}
                          className="group flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isResuming ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3 group-hover:-rotate-90 transition-transform duration-300" />
                          )}
                          <span>{lang === 'pl' ? 'Wznów subskrypcję' : 'Resume subscription'}</span>
                        </button>
                    </div>
                 )}
               </div>

               {/* PRAWA STRONA: Cena */}
               <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">{valueLabel}</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">{nextAmount}</p>
               </div>
            </div>
          )}
        </div>

        {/* === CZĘŚĆ 2: INFORMACJE O WŁAŚCICIELU (Ukryte dla Free/Demo) === */}
        {subscriptionData?.role !== 'free' && subscriptionData?.role !== 'demo' && (
          <div>
              <p className="text-xs font-medium text-gray-700 mb-2">{t.billingOwner}</p>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                {(subscriptionData?.billingPreference === 'company' || (!subscriptionData?.billingPreference && subscriptionData?.companyName)) ? (
                   <div className="text-sm text-gray-900">
                     <p className="font-semibold">
                        {subscriptionData?.companyName} <span className="text-gray-400 font-normal mx-1">|</span> {subscriptionData?.taxId}
                     </p>
                     <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap leading-relaxed">
                       {formatAddress(subscriptionData?.billingAddress)}
                     </p>
                   </div>
                 ) : (
                   <div className="text-sm text-gray-900">
                     <p className="font-semibold">{subscriptionData?.billingName || '---'}</p>
                     <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap leading-relaxed">
                       {formatAddress(subscriptionData?.billingAddress)}
                     </p>
                   </div>
                 )}
              </div>
          </div>
        )}

        {/* === CZĘŚĆ 3: PRZYCISKI AKCJI === */}
        <div className="pt-2">
          {subscriptionData?.role === 'free' ? (
            <>
              {/* Przycisk z obsługą Loadera */}
              <button
                onClick={async () => {
                  if (lang === 'pl') {
                    onOpenVerificationModal();
                    return;
                  }

                  // Dla EN włączamy spinner
                  setIsRedirectingToStripe(true);

                  try {
                    const response = await fetch('/api/stripe/create-trial-checkout-session', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ locale: lang }),
                    });
                    const data = await response.json();

                    if (!response.ok) {
                      console.error('Error:', data.error);
                      alert('Błąd: ' + (data.error || 'Nie udało się utworzyć sesji'));
                      setIsRedirectingToStripe(false);
                      return;
                    }

                    window.location.href = data.url;

                  } catch (error) {
                    console.error('Error:', error);
                    alert('Wystąpił błąd podczas tworzenia sesji płatności');
                    setIsRedirectingToStripe(false);
                  }
                }}
                disabled={isRedirectingToStripe}
                className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isRedirectingToStripe ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {lang === 'pl' ? 'Przekierowywanie...' : 'Redirecting...'}
                  </>
                ) : (
                  t.verifyPayment
                )}
              </button>

              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800 leading-relaxed text-justify">
                  {t.verifyIdentityInfo}
                </p>
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                // Mode 'manage' (default) → modal otwiera się Z przyciskiem cancel.
                // To wywołanie z karty Subscription (managePlan) — user może chcieć zarządzać/anulować.
                (window as any).openUpgradeModal('manage');
              }}
              className="w-full inline-flex justify-center items-center px-4 py-3 bg-gray-800 text-white text-sm font-medium rounded-xl hover:bg-gray-900 transition-all cursor-pointer shadow-sm hover:shadow-md"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {t.managePlan}
            </button>
          )}
        </div>

      </div>
    );
  }

  // 3. WIDOK PEŁNY (STANDARDOWY)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center mb-6">
        <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
        <h2 className="text-xl font-bold text-gray-900">{t.subscription}</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.currentPlan}
          </label>
          <p className="text-lg font-semibold text-gray-900">
            {subscriptionData?.plan || 'Free'}
          </p>
          {subscriptionData?.planDescription && (
            <p className="text-sm text-gray-500 mt-1">
              {subscriptionData.planDescription}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => { (window as any).openUpgradeModal('manage'); }}
            className="w-full inline-flex justify-center items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {t.managePlan}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// KOMPONENT GŁÓWNY
// ==================================================================
export default function SettingsContent() {
  const { user, userRole } = useAuth();
  console.log("DEBUG: ROLA UŻYTKOWNIKA:", userRole, "CAŁY UŻYTKOWNIK:", user);

  // Globalna funkcja do otwierania modala (Krok 37) — przyjmuje opcjonalny mode.
  // Bez argumentu (lub z 'manage') → tryb zarządzania subskrypcją (cancel widoczny).
  // Z 'upgrade' → tryb upgrade only (cancel ukryty, np. z karty Brand logo).
  useEffect(() => {
    const openModal = (mode: 'upgrade' | 'manage' = 'manage') => {
      setUpgradeModalMode(mode);
      setIsUpgradeModalOpen(true);
    };
    (window as any).openUpgradeModal = openModal;

    // Cleanup
    return () => {
      delete (window as any).openUpgradeModal;
    }
  }, []); // Uruchom tylko raz

  // 🆕 Język
  const [currentLang, setCurrentLang] = useState<'pl' | 'en'>('pl');
  useEffect(() => {
    const savedLang = localStorage.getItem('appLanguage');
    if (savedLang === 'en' || savedLang === 'pl') {
      setCurrentLang(savedLang);
    }
  }, []);
  const t = translations[currentLang];

  // Stan dla pełnych danych subskrypcji (przeniesiony z SubscriptionCard)
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(true);

  // 1) PRZENIESIONE TU — zanim użyjesz w useMemo
  const [subscriptionBasics, setSubscriptionBasics] = useState<{
    status: string;
    planName: string;
    isActive: boolean;
    renewsAt: string | null;
    loading: boolean;
  } | null>(null);

  // 2) POPRAWIONE — uprawnienia do logo na podstawie ROLI
  const canCustomizeLogo = useMemo(() => {
      // Użyj nowej, aktualnej roli z pobranych danych
      const roleRaw = subscriptionData?.role ?? '';
      const role = String(roleRaw).toLowerCase();

      // Zestaw ról, które NIE MOGĄ edytować
      const restricted = new Set(['free', 'free_ver', 'rookie', 'demo']);

      // Jeśli rola nie jest określona (np. ładowanie), blokuj
      if (!role) return false;

      // Zwróć 'true' (może edytować), jeśli rola NIE ZNAJDUJE SIĘ na liście zablokowanych
      return !restricted.has(role);

  }, [subscriptionData]); // Zależność od aktualnych danych subskrypcji

  // ✅ DOBRZE: Ścieżka względna. Przeglądarka sama użyje poprawnej domeny (https://app.inflee.app)
  const defaultAppLogoUrl = '/api/assets/uploads/logo_inflee.webp';
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<UserSettings>({
    username: '',
    logo: null,
    textProvider: 'anthropic',
    textModel: 'claude-3-haiku',
    imageProvider: 'google',
    imageModel: 'imagen-3'
  });

  const [initialUsername, setInitialUsername] = useState('');
  const [lastSavedUsername, setLastSavedUsername] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [isLoadingAuthorSettings, setIsLoadingAuthorSettings] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);

  const [apiKeys, setApiKeys] = useState<Record<string, ApiKey>>({
    anthropic: { value: '', showValue: false, isSaved: false },
    openai: { value: '', showValue: false, isSaved: false },
    google: { value: '', showValue: false, isSaved: false }
  });

  const [dropdowns, setDropdowns] = useState({
    textProvider: false,
    textModel: false,
    imageProvider: false,
    imageModel: false
  });

  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isDiskExplorerOpen, setIsDiskExplorerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  // Mode upgrade modala — 'upgrade' (z innego CTA, ukrywamy cancel) | 'manage' (z karty subscription, pokazujemy cancel)
  const [upgradeModalMode, setUpgradeModalMode] = useState<'upgrade' | 'manage'>('manage');
  const [isActivatingPlan, setIsActivatingPlan] = useState(false);
  // Stan dla modala weryfikacji (PL)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  // Zmiana: null oznacza brak akcji, 'card' lub 'blik' oznacza przetwarzanie konkretnej opcji
  const [processingType, setProcessingType] = useState<'card' | 'blik' | null>(null);
    const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'delete my inflee.app account') return;
    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationPhrase: deleteConfirmText }),
      });
      if (!res.ok) throw new Error();
      await signOut({ callbackUrl: '/' });
    } catch {
      setIsDeletingAccount(false);
      setMessage({ type: 'error', text: currentLang === 'pl'
        ? 'Nie udało się usunąć konta. Spróbuj ponownie.'
        : 'Failed to delete account. Please try again.' });
    }
  };

  // 1. Definiujemy funkcję pobierania danych jako useCallback
  const fetchSubscriptionStatus = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch('/api/subscription/status');
      if (response.ok) {
        const data = await response.json();
        setSubscriptionData(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, [user?.id]);

  // --- Fix 1: Płynna obsługa powrotu ze Stripe z pollingiem ---
    useEffect(() => {
      if (!window.location.search.includes('success=true')) return;

      setIsActivatingPlan(true);
      window.history.replaceState({}, '', window.location.pathname);
      setIsSubscriptionLoading(true);

      const previousRole = subscriptionData?.role;
      let attempts = 0;
      const maxAttempts = 8;

      const poll = async () => {
        attempts++;
        try {
          const response = await fetch('/api/subscription/status');
          if (response.ok) {
            const data = await response.json();
            if (data.role !== previousRole || data.subscriptionStatus) {
              setSubscriptionData(data);
              setIsSubscriptionLoading(false);
              return;
            }
          }
        } catch (e) {}

        if (attempts < maxAttempts) {
          setTimeout(poll, 1500);
        } else {
          fetchSubscriptionStatus();
        }
      };

      setTimeout(poll, 1000);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Logika Blocking Modal (Wymuszenie wyboru) ---
  const showBillingChoiceModal = useMemo(() => {
    if (!subscriptionData) return false;

    // 1. Rola płatna (nie free, nie demo)
    const isPaidRole = subscriptionData.role !== 'free' && subscriptionData.role !== 'demo';
    // 2. Mamy dane firmy (jest wybór)
    const hasCompanyData = !!subscriptionData.companyName;
    // 3. Nie dokonano jeszcze wyboru (brak wpisu w bazie)
    const isNotLocked = !subscriptionData.billingPreference;

    return isPaidRole && hasCompanyData && isNotLocked;
  }, [subscriptionData]);

  // Funkcja zapisu z Modala
  const handleBillingChoiceSave = async (preference: 'company' | 'personal') => {
    try {
      const response = await fetch('/api/user/billing-preference', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingPreference: preference }),
      });

      if (response.ok) {
        // Odśwież stronę, aby pobrać zablokowane dane
        window.location.reload();
      } else {
        alert(t.serverError);
      }
    } catch (error) {
      console.error("Error saving billing preference:", error);
      alert(t.serverError);
    }
  };

  // --- Obsługa Płatności z Modala Weryfikacji (PL) ---
  const handleCardVerification = async () => {
    setProcessingType('card'); // Ustawiamy, że to Karta się kręci
    try {
      const response = await fetch('/api/stripe/create-trial-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: currentLang }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert('Błąd: ' + (data.error || 'Nie udało się utworzyć sesji'));
        setProcessingType(null); // Reset w razie błędu
        return;
      }
      window.location.href = data.url;
    } catch (error) {
      console.error('Error:', error);
      alert('Wystąpił błąd');
      setProcessingType(null); // Reset w razie błędu
    }
  };

  const handleBlikVerification = async () => {
    setProcessingType('blik'); // Ustawiamy spinner na przycisku BLIK
    try {
      // Wywołujemy nowy endpoint do płatności jednorazowej
      const response = await fetch('/api/stripe/create-one-time-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: currentLang,
          paymentMethod: 'blik' // Opcjonalnie, dla pewności
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Nie udało się utworzyć sesji płatności');
      }

      // Przekierowanie do Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Brak adresu URL przekierowania');
      }

    } catch (error) {
      console.error('Błąd płatności BLIK:', error);
      alert('Wystąpił błąd podczas inicjowania płatności. Spróbuj ponownie.');
      setProcessingType(null); // Resetujemy spinner tylko w przypadku błędu (sukces przeładowuje stronę)
    }
  };

  // --- Przeniesione komponenty i funkcje pomocnicze (aby miały dostęp do `t`) ---

  // Status helpers
  const getModelDisplayInfo = (model: any, apiKey: any, isSelected: boolean) => {
    if (!model) {
      return { text: t.selectModel, indicator: 'default' };
    }

    if (model.tier === 'basic') {
      if (isSelected) {
        return { text: t.activeModel, indicator: 'active' };
      }
      return { text: t.modelAvailable, indicator: 'active' };
    }

    const hasApiKey = apiKey?.isSaved;

    if (hasApiKey) {
      if (isSelected) {
        return { text: t.activeModel, indicator: 'active' };
      }
      return { text: t.modelAvailable, indicator: 'active' };
    } else {
      return { text: t.apiKeyRequired, indicator: 'key-needed' };
    }
  };

  const StatusIndicator = ({ status, size = 'sm' }: { status: string, size?: 'sm' | 'xs' }) => {
    const sizeClass = size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2';

    switch (status) {
      case 'active':
        return <div className={`${sizeClass} rounded-full bg-emerald-500`} />;
      case 'key-needed':
        return <div className={`${sizeClass} rounded-full bg-red-500`} />;
      default:
        return <div className={`${sizeClass} rounded-full bg-gray-300`} />;
    }
  };

  const ProviderSelector = ({
    label,
    providers,
    currentProviderId,
    currentModelId,
    onProviderChange,
    onModelChange,
    apiKey,
    type,
    dropdowns,
    toggleDropdown
  }: {
    label: string;
    providers: Provider[];
    currentProviderId: string;
    currentModelId: string;
    onProviderChange: (providerId: string) => void;
    onModelChange: (modelId: string) => void;
    apiKey: any;
    type: 'text' | 'image';
    dropdowns: any;
    toggleDropdown: any;
  }) => {
    const currentProvider = providers.find(p => p.id === currentProviderId);
    const currentModel = currentProvider?.models.find(m => m.id === currentModelId);
    const dropdownKey = `${type}Provider` as keyof typeof dropdowns;
    const modelDropdownKey = `${type}Model` as keyof typeof dropdowns;

    const currentModelInfo = getModelDisplayInfo(currentModel, apiKey, true);

    return (
      <div className="space-y-3">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
          <button
            onClick={() => toggleDropdown(dropdownKey)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-left flex items-center justify-between hover:border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
          >
            <span className="font-medium text-gray-900">{currentProvider?.name}</span>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${dropdowns[dropdownKey] ? 'rotate-180' : ''}`} />
          </button>

          {dropdowns[dropdownKey] && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => {
                    if (provider.available !== false) {
                      onProviderChange(provider.id);
                      toggleDropdown(dropdownKey);
                    }
                  }}
                  disabled={provider.available === false}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between first:rounded-t-lg last:rounded-b-lg transition-colors ${
                    provider.available === false
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-gray-50 cursor-pointer'
                  } ${currentProviderId === provider.id ? 'bg-blue-50' : ''}`}
                >
                  <span className="font-medium text-gray-900">{provider.name}</span>
                  {provider.available === false && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{t.providerSoon}</span>
                  )}
                  {currentProviderId === provider.id && provider.available !== false && (
                    <Check className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => toggleDropdown(modelDropdownKey)}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-left flex items-center justify-between hover:border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <StatusIndicator status={currentModelInfo.indicator} />
              <div>
                <div className="font-medium text-gray-900">{currentModel?.name}</div>
                <div className="text-xs text-gray-500">
                  {currentModelInfo.text}
                </div>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${dropdowns[modelDropdownKey] ? 'rotate-180' : ''}`} />
          </button>

          {dropdowns[modelDropdownKey] && currentProvider && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {currentProvider.models
                .filter(model => model.id !== currentModelId)
                .map((model) => {
                  const isSelected = false;
                  const modelInfo = getModelDisplayInfo(model, apiKey, isSelected);

                  return (
                    <button
                      key={model.id}
                      onClick={() => {
                        onModelChange(model.id);
                        toggleDropdown(modelDropdownKey);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <StatusIndicator status={modelInfo.indicator} />
                          <div>
                            <div className="font-medium text-gray-900">{model.name}</div>
                            <div className="text-xs text-gray-500">
                              {/* Użycie 't' do tłumaczenia opisu */}
                              {t[model.description as keyof typeof t] || model.description}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                    </button>
                  );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const getApiKeyPlaceholder = useCallback((provider: string) => {
    switch (provider) {
      case 'anthropic': return t.apiKeyPlaceholderAnthropic;
      case 'openai': return t.apiKeyPlaceholderOpenAI;
      case 'google': return t.apiKeyPlaceholderGoogle;
      default: return t.apiKeyPlaceholderDefault;
    }
  }, [t]);

  // --- Koniec przeniesionych komponentów ---


  const loadApiKeysStatus = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingApiKeys(true);
    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Fetched API key status:', data);

        setApiKeys(prev => {
          const updated = { ...prev };
          Object.keys(data.providers).forEach(provider => {
            if (updated[provider]) {
              updated[provider] = {
                ...updated[provider],
                isSaved: data.providers[provider].hasKey
              };
            }
          });
          return updated;
        });
      } else {
        console.error('❌ Error fetching API key status:', response.status);
        setMessage({ type: 'error', text: t.apiKeyStatusError });
      }
    } catch (error) {
      console.error('❌ Network error fetching API key status:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsLoadingApiKeys(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [user?.id, t]);

  const updateUserAiSettings = useCallback(async (settings: Partial<UserSettings>) => {
    if (!user?.id || isSavingAiSettings) return;

    setIsSavingAiSettings(true);
    try {
      const updateData: any = {};

      if (settings.textProvider) updateData.textAiProvider = settings.textProvider;
      if (settings.textModel) updateData.textAiModel = settings.textModel;
      if (settings.imageProvider) updateData.imageAiProvider = settings.imageProvider;
      if (settings.imageModel) updateData.imageAiModel = settings.imageModel;

      const response = await fetch('/api/user/author-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        console.log('✅ Updated AI settings:', updateData);
      } else {
        console.error('❌ Error saving AI settings:', response.status);
      }
    } catch (error) {
      console.error('❌ Network error while saving AI settings:', error);
    } finally {
      setIsSavingAiSettings(false);
    }
  }, [user?.id, isSavingAiSettings]);

  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    setImageAspectRatio(aspectRatio);
    console.log(`🔍 Image dimensions: ${img.naturalWidth}x${img.naturalHeight}, ratio: ${aspectRatio.toFixed(2)}`);
  }, []);

  const resetImageAspectRatio = useCallback(() => {
    setImageAspectRatio(null);
  }, []);

  useEffect(() => {
    if (user) {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
      if (fullName && fullName !== initialUsername) {
        setSettings(prev => ({ ...prev, username: fullName }));
        setInitialUsername(fullName);
        setLastSavedUsername(fullName);
      }
    }
  }, [user, initialUsername]);

  useEffect(() => {
    let isMounted = true;

    if (user?.id) {
      const loadAuthorSettings = async () => {
        setIsLoadingAuthorSettings(true);
        try {
          const response = await fetch('/api/user/author-settings', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok && isMounted) {
            const data = await response.json();
            const authorSettings: AuthorSettings = data.authorSettings;

            let logoUrl = authorSettings.authorLogoUrl;
            if (logoUrl) {
              const separator = logoUrl.includes('?') ? '&' : '?';
              logoUrl = `${logoUrl}${separator}t=${Date.now()}`;
            }

            setSettings(prev => ({
              ...prev,
              username: authorSettings.authorDisplayName || authorSettings.fallbackName,
              logo: logoUrl || defaultAppLogoUrl,
              textProvider: authorSettings.textAiProvider || 'anthropic',
              textModel: authorSettings.textAiModel || 'claude-3-haiku',
              imageProvider: authorSettings.imageAiProvider || 'google',
              imageModel: authorSettings.imageAiModel || 'imagen-3'
            }));

            // Sync original URL (raw, do re-edycji w modalu)
            setBrandLogoOriginalUrl(authorSettings.authorLogoOriginalUrl || null);

            setLastSavedUsername(authorSettings.authorDisplayName || authorSettings.fallbackName);

            console.log('✅ Fetched author settings:', authorSettings);
            console.log('🔧 Loaded AI settings from server:', {
              textProvider: authorSettings.textAiProvider || 'anthropic (default)',
              textModel: authorSettings.textAiModel || 'claude-3-haiku (default)',
              imageProvider: authorSettings.imageAiProvider || 'google (default)',
              imageModel: authorSettings.imageAiModel || 'imagen-3 (default)'
            });
          } else if (isMounted) {
            console.error('❌ Error fetching author settings:', response.status);
            setMessage({ type: 'error', text: t.settingsFetchError });
          }
        } catch (error) {
          if (isMounted) {
            console.error('❌ Network error fetching author settings:', error);
            setMessage({ type: 'error', text: t.serverError });
          }
        } finally {
          if (isMounted) {
            setIsLoadingAuthorSettings(false);
            setTimeout(() => setMessage(null), 3000);
          }
        }
      };

      loadAuthorSettings();
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, t, defaultAppLogoUrl]);

  // 2. Wywołujemy ją przy starcie
  useEffect(() => {
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  useEffect(() => {
    if (user?.id) {
      loadApiKeysStatus();
    }
  }, [user?.id, loadApiKeysStatus]);

  useEffect(() => {
    if (user?.id) {
      const loadSubscriptionBasics = async () => {
        try {
          setSubscriptionBasics(prev => prev ? { ...prev, loading: true } : {
            status: 'free',
            planName: t.planFree,
            isActive: false,
            renewsAt: null,
            loading: true
          });

          const response = await fetch('/api/subscription/details');

          if (response.ok) {
            const data = await response.json();

            const planNames: Record<string, string> = {
              'free': t.planFree,
              'standard': t.planStandard,
              'premium': t.planPremium
            };

            setSubscriptionBasics({
              status: data.status,
              planName: planNames[data.status] || data.status,
              isActive: data.isActive,
              renewsAt: data.subscriptionEndsAt,
              loading: false
            });
          }
        } catch (error) {
          console.error('Error loading subscription basics:', error);
          setSubscriptionBasics({
            status: 'free',
            planName: t.planFree,
            isActive: false,
            renewsAt: null,
            loading: false
          });
        }
      };

      // loadSubscriptionBasics(); // Ta logika jest teraz w SubscriptionCard
    }
  }, [user?.id, t]);

  useEffect(() => {
    if (!settings.logo) {
      resetImageAspectRatio();
    }
  }, [settings.logo, resetImageAspectRatio]);

  useEffect(() => {
    return () => {
      if (settings.logo && settings.logo.startsWith('blob:')) {
        URL.revokeObjectURL(settings.logo);
      }
    };
  }, [settings.logo]);

  const textProvider = useMemo(() =>
    TEXT_PROVIDERS.find(p => p.id === settings.textProvider),
    [settings.textProvider]
  );

  const textModel = useMemo(() =>
    textProvider?.models.find(m => m.id === settings.textModel),
    [textProvider, settings.textModel]
  );

  const needsTextApiKey = useMemo(() =>
    textModel?.tier === 'premium',
    [textModel]
  );

  const imageProvider = useMemo(() =>
    IMAGE_PROVIDERS.find(p => p.id === settings.imageProvider),
    [settings.imageProvider]
  );

  const imageModel = useMemo(() =>
    imageProvider?.models.find(m => m.id === settings.imageModel),
    [imageProvider, settings.imageModel]
  );

  const needsImageApiKey = useMemo(() =>
    imageModel?.tier === 'premium',
    [imageModel]
  );

  const currentTextApiKey = useMemo(() =>
    apiKeys[settings.textProvider],
    [apiKeys, settings.textProvider]
  );

  const currentImageApiKey = useMemo(() => {
    const providerKeyMap: Record<string, string> = {
      'google': 'google',
      'openai': 'openai'
    };
    const keyName = providerKeyMap[settings.imageProvider] || settings.imageProvider;
    return apiKeys[keyName];
  }, [apiKeys, settings.imageProvider]);

  const isValidApiKey = useCallback((provider: string, key: string): boolean => {
    if (!key || key.length < 20) return false;
    switch (provider) {
      case 'anthropic': return key.startsWith('sk-ant-');
      case 'openai': return key.startsWith('sk-');
      case 'google': return key.startsWith('AIza');
      default: return false;
    }
  }, []);

  const isValidTextKey = useMemo(() =>
    currentTextApiKey?.value ? isValidApiKey(settings.textProvider, currentTextApiKey.value) : false,
    [currentTextApiKey?.value, settings.textProvider, isValidApiKey]
  );

  const isValidImageKey = useMemo(() => {
    const providerKeyMap: Record<string, string> = {
      'google': 'google',
      'openai': 'openai'
    };
    const keyName = providerKeyMap[settings.imageProvider] || settings.imageProvider;
    return currentImageApiKey?.value ? isValidApiKey(keyName, currentImageApiKey.value) : false;
  }, [currentImageApiKey?.value, settings.imageProvider, isValidApiKey]);

  const toggleDropdown = useCallback((dropdown: keyof typeof dropdowns) => {
    setDropdowns(prev => ({
      textProvider: false,
      textModel: false,
      imageProvider: false,
      imageModel: false,
      [dropdown]: !prev[dropdown]
    }));
  }, []);

  const updateApiKey = useCallback((provider: string, value: string) => {
    const providerKeyMap: Record<string, string> = {
      'google': 'google',
      'openai': 'openai',
      'anthropic': 'anthropic'
    };
    const keyName = providerKeyMap[provider] || provider;

    setApiKeys(prev => ({
      ...prev,
      [keyName]: {
        value: value,
        showValue: prev[keyName]?.showValue || false,
        isSaved: false
      }
    }));
  }, []);

  const toggleApiKeyVisibility = useCallback((provider: string) => {
    const providerKeyMap: Record<string, string> = {
      'google': 'google',
      'openai': 'openai',
      'anthropic': 'anthropic'
    };
    const keyName = providerKeyMap[provider] || provider;

    setApiKeys(prev => {
      const currentKey = prev[keyName];
      if (!currentKey) {
        return prev;
      }
      return {
        ...prev,
        [keyName]: { ...currentKey, showValue: !currentKey.showValue }
      };
    });
  }, []);

  const saveApiKey = useCallback(async (provider: string) => {
    const providerKeyMap: Record<string, string> = {
      'google': 'google',
      'openai': 'openai',
      'anthropic': 'anthropic'
    };
    const keyName = providerKeyMap[provider] || provider;
    const keyInfo = apiKeys[keyName];

    if (!keyInfo || !keyInfo.value || !isValidApiKey(keyName, keyInfo.value) || savingApiKey) return;

    setSavingApiKey(provider);
    const providerName = TEXT_PROVIDERS.find(p=>p.id === provider)?.name || IMAGE_PROVIDERS.find(p=>p.id === provider)?.name || provider;

    try {
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: keyName,
          apiKey: keyInfo.value
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ API key saved:', data);

        setApiKeys(prev => ({
          ...prev,
          [keyName]: { ...prev[keyName], value: '', showValue: false, isSaved: true }
        }));

        setMessage({ type: 'success', text: t.apiKeySaved.replace('{providerName}', providerName) });

        const isTextProvider = TEXT_PROVIDERS.some(p => p.id === provider);
        const isImageProvider = IMAGE_PROVIDERS.some(p => p.id === provider);

        if (isTextProvider) {
          const currentTextModel = TEXT_PROVIDERS
            .find(p => p.id === provider)?.models
            .find(m => m.id === settings.textModel);

          if (currentTextModel?.tier === 'premium') {
            console.log(`🚀 Saving pending text model: ${currentTextModel.name}`);
            updateUserAiSettings({ textModel: settings.textModel });
          }
        }

        if (isImageProvider) {
          const currentImageModel = IMAGE_PROVIDERS
            .find(p => p.id === provider)?.models
            .find(m => m.id === settings.imageModel);

          if (currentImageModel?.tier === 'premium') {
            console.log(`🚀 Saving pending image model: ${currentImageModel.name}`);
            updateUserAiSettings({ imageModel: settings.imageModel });
          }
        }

      } else {
        const errorData = await response.json();
        console.error('❌ Error saving API key:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || t.apiKeySaveError.replace('{providerName}', providerName)
        });
      }
    } catch (error) {
      console.error('❌ Network error while saving API key:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setSavingApiKey(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [apiKeys, isValidApiKey, savingApiKey, settings.textModel, settings.imageModel, updateUserAiSettings, t]);

  const removeApiKey = useCallback((provider: string) => {
    const providerName = TEXT_PROVIDERS.find(p=>p.id === provider)?.name || IMAGE_PROVIDERS.find(p=>p.id === provider)?.name || provider;
    setConfirmModal({
      isOpen: true,
      title: t.confirmRemoveApiKeyTitle,
      message: t.confirmRemoveApiKeyMsg.replace('{providerName}', providerName),
      onConfirm: async () => {
        try {
          const providerKeyMap: Record<string, string> = {
            'google': 'google',
            'openai': 'openai',
            'anthropic': 'anthropic'
          };
          const keyName = providerKeyMap[provider] || provider;

          const response = await fetch('/api/user/api-keys', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ provider: keyName }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ API key removed:', data);

            setApiKeys(prev => ({
              ...prev,
              [keyName]: { value: '', showValue: false, isSaved: false }
            }));

            const settingsToUpdate: Partial<UserSettings> = {};

            if (settings.textProvider === provider) {
              const currentTextProvider = TEXT_PROVIDERS.find(p => p.id === provider);
              const currentTextModel = currentTextProvider?.models.find(m => m.id === settings.textModel);

              if (currentTextModel?.tier === 'premium') {
                const basicModel = currentTextProvider?.models.find(m => m.tier === 'basic');
                if (basicModel) {
                  settingsToUpdate.textModel = basicModel.id;
                  setSettings(prev => ({ ...prev, textModel: basicModel.id }));
                  console.log(`🔄 Switched to basic model: ${basicModel.name}`);
                } else {
                  const anthropicProvider = TEXT_PROVIDERS.find(p => p.id === 'anthropic');
                  const anthropicBasic = anthropicProvider?.models.find(m => m.tier === 'basic');
                  if (anthropicBasic) {
                    settingsToUpdate.textProvider = 'anthropic';
                    settingsToUpdate.textModel = anthropicBasic.id;
                    setSettings(prev => ({ ...prev, textProvider: 'anthropic', textModel: anthropicBasic.id }));
                    console.log(`🔄 Switched to Anthropic: ${anthropicBasic.name}`);
                  }
                }
              }
            }

            if (settings.imageProvider === provider) {
              const currentImageProvider = IMAGE_PROVIDERS.find(p => p.id === provider);
              const currentImageModel = currentImageProvider?.models.find(m => m.id === settings.imageModel);

              if (currentImageModel?.tier === 'premium') {
                const basicModel = currentImageProvider?.models.find(m => m.tier === 'basic');
                if (basicModel) {
                  settingsToUpdate.imageModel = basicModel.id;
                  setSettings(prev => ({ ...prev, imageModel: basicModel.id }));
                  console.log(`🔄 Switched to basic image model: ${basicModel.name}`);
                } else {
                  const googleProvider = IMAGE_PROVIDERS.find(p => p.id === 'google');
                  const googleBasic = googleProvider?.models.find(m => m.tier === 'basic');
                  if (googleBasic) {
                    settingsToUpdate.imageProvider = 'google';
                    settingsToUpdate.imageModel = googleBasic.id;
                    setSettings(prev => ({ ...prev, imageProvider: 'google', imageModel: googleBasic.id }));
                    console.log(`🔄 Switched to Google: ${googleBasic.name}`);
                  }
                }
              }
            }

            if (Object.keys(settingsToUpdate).length > 0) {
              await updateUserAiSettings(settingsToUpdate);
            }

            setMessage({ type: 'success', text: t.apiKeyRemoved.replace('{providerName}', providerName) });
          } else {
            const errorData = await response.json();
            console.error('❌ Error removing API key:', errorData);
            setMessage({
              type: 'error',
              text: errorData.error || t.apiKeyRemoveError.replace('{providerName}', providerName)
            });
          }
        } catch (error) {
          console.error('❌ Network error while removing API key:', error);
          setMessage({ type: 'error', text: t.serverError });
        } finally {
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
          setTimeout(() => setMessage(null), 3000);
        }
      }
    });
  }, [settings.textProvider, settings.textModel, settings.imageProvider, settings.imageModel, updateUserAiSettings, t]);

  const handleTextProviderChange = useCallback((providerId: string) => {
    const provider = TEXT_PROVIDERS.find(p => p.id === providerId);
    if (provider && provider.available) {
      const newSettings = {
        textProvider: providerId,
        textModel: provider.models[0].id
      };
      setSettings(prev => ({ ...prev, ...newSettings }));
      updateUserAiSettings(newSettings);
    }
  }, [updateUserAiSettings]);

  const handleTextModelChange = useCallback((modelId: string) => {
    const provider = TEXT_PROVIDERS.find(p => p.id === settings.textProvider);
    const model = provider?.models.find(m => m.id === modelId);

    if (!model) return;

    const newSettings = { textModel: modelId };
    setSettings(prev => ({ ...prev, ...newSettings }));

    const isPremium = model.tier === 'premium';
    const hasApiKey = apiKeys[settings.textProvider]?.isSaved;

    if (!isPremium || (isPremium && hasApiKey)) {
      updateUserAiSettings(newSettings);
      console.log(`✅ Saved model ${model.name} to the database.`);
    } else {
      console.log(`🟡 Selected premium model ${model.name}, awaiting API key. Change not saved to the database.`);
    }
  }, [settings.textProvider, apiKeys, updateUserAiSettings]);

  const handleImageProviderChange = useCallback((providerId: string) => {
    const provider = IMAGE_PROVIDERS.find(p => p.id === providerId);
    if (provider && provider.available) {
      const newSettings = {
        imageProvider: providerId,
        imageModel: provider.models[0].id
      };
      setSettings(prev => ({ ...prev, ...newSettings }));
      updateUserAiSettings(newSettings);
    }
  }, [updateUserAiSettings]);

  const handleImageModelChange = useCallback((modelId: string) => {
    const provider = IMAGE_PROVIDERS.find(p => p.id === settings.imageProvider);
    const model = provider?.models.find(m => m.id === modelId);

    if (!model) return;

    const newSettings = { imageModel: modelId };
    setSettings(prev => ({ ...prev, ...newSettings }));

    const isPremium = model.tier === 'premium';
    const providerKeyMap: Record<string, string> = { 'google': 'google', 'openai': 'openai' };
    const keyName = providerKeyMap[settings.imageProvider] || settings.imageProvider;
    const hasApiKey = apiKeys[keyName]?.isSaved;

    if (!isPremium || (isPremium && hasApiKey)) {
      updateUserAiSettings(newSettings);
      console.log(`✅ Saved model ${model.name} to the database.`);
    } else {
      console.log(`🟡 Selected premium model ${model.name}, awaiting API key. Change not saved to the database.`);
    }
  }, [settings.imageProvider, apiKeys, updateUserAiSettings]);

  const handleLogoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isUploadingAvatar) return;

    console.log('🖼️ Starting avatar upload:', file.name, file.type, file.size);

    if (settings.logo && settings.logo.startsWith('blob:')) {
      URL.revokeObjectURL(settings.logo);
    }

    resetImageAspectRatio();

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/user/author-settings', {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const authorSettings: AuthorSettings = data.authorSettings;

        let newAvatarUrl = authorSettings.authorLogoUrl;
        if (newAvatarUrl) {
          const separator = newAvatarUrl.includes('?') ? '&' : '?';
          newAvatarUrl = `${newAvatarUrl}${separator}t=${Date.now()}`;
        }

        setSettings(prev => ({
          ...prev,
          logo: newAvatarUrl
        }));

        setMessage({ type: 'success', text: t.avatarUpdated });
        console.log('✅ Avatar updated:', newAvatarUrl);
      } else {
        const errorData = await response.json();
        console.error('❌ Error uploading avatar:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || t.avatarUploadError
        });
      }
    } catch (error) {
      console.error('❌ Network error while uploading avatar:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsUploadingAvatar(false);
      setTimeout(() => setMessage(null), 3000);

      if (event.target) {
        event.target.value = '';
      }
    }
  }, [isUploadingAvatar, settings.logo, resetImageAspectRatio, t]);

  const removeLogo = useCallback(async () => {
    if (isDeletingAvatar) return;

    if (settings.logo && settings.logo.startsWith('blob:')) {
      URL.revokeObjectURL(settings.logo);
    }

    resetImageAspectRatio();

    setIsDeletingAvatar(true);

    try {
      const response = await fetch('/api/user/author-settings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // const authorSettings: AuthorSettings = data.authorSettings; // Dane są już w defaultAppLogoUrl

        setSettings(prev => ({ ...prev, logo: defaultAppLogoUrl }));

        setMessage({ type: 'success', text: t.avatarRemoved });
        console.log('✅ Avatar removed');
      } else {
        const errorData = await response.json();
        console.error('❌ Error removing avatar:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || t.avatarRemoveError
        });
      }
    } catch (error) {
      console.error('❌ Network error while removing avatar:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsDeletingAvatar(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isDeletingAvatar, settings.logo, resetImageAspectRatio, t, defaultAppLogoUrl]);

  // ════════════════════════════════════════════════════════════════════════
  // Landing Page Header Setup — state + handlery
  // ════════════════════════════════════════════════════════════════════════

  // Settings zwracane przez GET /api/user/profile-picture
  // headerStyle wymusza mutual exclusion z brand logo (typ enum, nie boolean).
  // activeProfileSource — gdy headerStyle='profile' i user ma OBA źródła (Google + custom),
  // to pole decyduje które pokazać. Switch nie usuwa custom z bazy.
  interface ProfilePictureSettings {
    profilePicture: string | null;            // Google original (read-only)
    customProfilePicture: string | null;      // wgrane przez usera
    headerStyle: 'profile' | 'logo' | 'none';
    activeProfileSource: 'custom' | 'google';
    resolvedUrl: string | null;               // co się pokazuje teraz w headerze
    hasGoogleOriginal: boolean;
    hasCustomPicture: boolean;
    authProvider: string | null;
  }

  const [profilePicSettings, setProfilePicSettings] = useState<ProfilePictureSettings | null>(null);
  const [isLoadingProfilePic, setIsLoadingProfilePic] = useState(false);
  const [isSavingProfilePic, setIsSavingProfilePic] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const profilePicFileInputRef = useRef<HTMLInputElement>(null);

  // Brand logo — derived state z settings.logo (synchronizowane z authorLogoUrl w bazie).
  // settings.logo === defaultAppLogoUrl → brak własnego logo (domyślne Inflee'owe).
  // Aktywny/wyłączony brand logo wynika z headerStyle === 'logo' (mutual exclusion).
  const hasBrandLogo = !!settings.logo && settings.logo !== defaultAppLogoUrl;

  // Brand logo modal state
  const [isBrandLogoModalOpen, setIsBrandLogoModalOpen] = useState(false);
  const [brandLogoImageSrc, setBrandLogoImageSrc] = useState<string | null>(null);
  const [isSavingBrandLogo, setIsSavingBrandLogo] = useState(false);
  const brandLogoFileInputRef = useRef<HTMLInputElement>(null);

  // Original raw URL — używany przez handleBrandLogoEdit do otwarcia modala z oryginałem.
  // Pobierany z author-settings GET response (authorLogoOriginalUrl).
  const [brandLogoOriginalUrl, setBrandLogoOriginalUrl] = useState<string | null>(null);

  // Raw oryginał z dysku usera — track'ujemy od momentu wybrania pliku w pickerze do save w modalu.
  // Jeśli !== null przy save → fresh upload (wysyłamy do backendu w field 'avatarOriginal').
  // Jeśli null → Edit mode (oryginał już na serwerze, nie nadpisujemy).
  const [brandLogoOriginalFile, setBrandLogoOriginalFile] = useState<File | null>(null);
  // UWAGA: handlery brand logo (handleBrandLogoFileSelect/Save/Remove) zdefiniowane PONIŻEJ
  // — po `handleHeaderStyleChange` żeby uniknąć TDZ (Temporal Dead Zone) erroru przy useCallback deps.

  // Theme preview — TYLKO podgląd w settings, NIC się nie zapisuje do bazy
  const [previewThemeKey, setPreviewThemeKey] = useState<HeaderPreviewTheme['key']>('light');
  const previewTheme = useMemo(
    () => HEADER_PREVIEW_THEMES.find(th => th.key === previewThemeKey) || HEADER_PREVIEW_THEMES[0],
    [previewThemeKey]
  );

  // ─── Pobierz aktualny stan zdjęcia profilowego z serwera ───────────────
  const loadProfilePictureSettings = useCallback(async () => {
    if (!user?.id) return;
    setIsLoadingProfilePic(true);
    try {
      const response = await fetch('/api/user/profile-picture');
      if (response.ok) {
        const data = await response.json();
        setProfilePicSettings(data.profilePictureSettings);
      } else {
        console.error('❌ Error fetching profile-picture settings:', response.status);
      }
    } catch (error) {
      console.error('❌ Network error fetching profile-picture:', error);
    } finally {
      setIsLoadingProfilePic(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadProfilePictureSettings();
    }
  }, [user?.id, loadProfilePictureSettings]);

  // ─── Zmiana headerStyle (mutual exclusion wymuszone przez enum) ────────
  // Jedno źródło prawdy: 'profile' | 'logo' | 'none'. Klik na toggle pic ON
  // gdy aktualnie 'logo'/'none' → ustaw 'profile' (auto-wyłącza logo).
  // Klik na toggle pic OFF gdy 'profile' → ustaw 'none'.
  // Klik na toggle logo ON → ustaw 'logo' (auto-wyłącza profile).
  // Klik na toggle logo OFF gdy 'logo' → ustaw 'none'.
  const handleHeaderStyleChange = useCallback(async (newStyle: 'profile' | 'logo' | 'none') => {
    if (isSavingProfilePic || !profilePicSettings) return;
    if (profilePicSettings.headerStyle === newStyle) return; // brak zmiany

    setIsSavingProfilePic(true);
    try {
      const response = await fetch('/api/user/profile-picture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headerStyle: newStyle }),
      });
      if (response.ok) {
        const data = await response.json();
        setProfilePicSettings(data.profilePictureSettings);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || t.headerPicToggleError });
      }
    } catch (error) {
      console.error('❌ Network error changing headerStyle:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsSavingProfilePic(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isSavingProfilePic, profilePicSettings, t]);

  // Handler dla toggle profile picture — flip między 'profile' a 'none'
  const handleProfilePicToggle = useCallback(() => {
    if (!profilePicSettings) return;
    const newStyle = profilePicSettings.headerStyle === 'profile' ? 'none' : 'profile';
    handleHeaderStyleChange(newStyle);
  }, [profilePicSettings, handleHeaderStyleChange]);

  // ─── Switch między custom a Google (bez usuwania custom z bazy) ────────
  // Wywołuje PUT z activeProfileSource — backend zmienia tylko to pole, custom zostaje.
  const handleSwitchProfileSource = useCallback(async (source: 'custom' | 'google') => {
    if (isSavingProfilePic || !profilePicSettings) return;
    if (profilePicSettings.activeProfileSource === source) return; // brak zmiany
    // Jeśli przy okazji headerStyle nie był 'profile' — aktywujemy też (user świadomie klika thumbnail)
    const needsHeaderActivation = profilePicSettings.headerStyle !== 'profile';

    setIsSavingProfilePic(true);
    try {
      const body: { activeProfileSource: string; headerStyle?: string } = { activeProfileSource: source };
      if (needsHeaderActivation) body.headerStyle = 'profile';

      const response = await fetch('/api/user/profile-picture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = await response.json();
        setProfilePicSettings(data.profilePictureSettings);
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || t.headerPicToggleError });
      }
    } catch (error) {
      console.error('❌ Network error switching profile source:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsSavingProfilePic(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isSavingProfilePic, profilePicSettings, t]);

  // ════════════════════════════════════════════════════════════════════════
  // Brand logo handlers — po handleHeaderStyleChange (TDZ-safe)
  // ════════════════════════════════════════════════════════════════════════

  // ─── Wybór pliku z dysku → otwórz modal cropu ──────────────────────────
  // Track'ujemy raw File w state — zostanie wysłany do backendu jako 'avatarOriginal'
  // przy save w modalu (zachowuje się jako pixel-perfect oryginał na serwerze).
  const handleBrandLogoFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: t.headerPicUploadError });
      return;
    }
    setBrandLogoOriginalFile(file);  // zachowaj raw File do wysłania jako avatarOriginal
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setBrandLogoImageSrc(dataUrl);
      setIsBrandLogoModalOpen(true);
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  }, [t]);

  // ─── Zapis zcropowanego logo (z modala) ────────────────────────────────
  // Endpoint: PUT /api/user/author-settings (FormData "avatar") — istniejący endpoint dla logo.
  const handleBrandLogoSave = useCallback(async (croppedFile: File) => {
    setIsBrandLogoModalOpen(false);
    setBrandLogoImageSrc(null);
    setIsSavingBrandLogo(true);
    // Snapshot raw File z state — czyścimy state OD RAZU (przed setIsSavingBrandLogo to było reset),
    // żeby kolejne Save w modalu (po Edit) nie odziedziczyło starego File.
    const rawOriginal = brandLogoOriginalFile;
    setBrandLogoOriginalFile(null);
    try {
      const formData = new FormData();
      formData.append('avatar', croppedFile);
      // Wyślij raw oryginał TYLKO przy fresh upload (rawOriginal !== null).
      // Edit mode → rawOriginal === null → backend nie ruszy istniejącego _ORIG na serwerze.
      if (rawOriginal) {
        formData.append('avatarOriginal', rawOriginal);
        console.log('📦 Wysyłam raw oryginał:', rawOriginal.name, rawOriginal.size, 'bytes');
      } else {
        console.log('🔄 Edit mode — oryginał zostaje na serwerze bez zmian');
      }
      const response = await fetch('/api/user/author-settings', {
        method: 'PUT',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        const authorSettings: AuthorSettings = data.authorSettings;
        // Cache busting: backend nadpisuje plik pod tym samym URL'em
        const cacheBust = (url: string | null): string | null => {
          if (!url) return url;
          const sep = url.includes('?') ? '&' : '?';
          return `${url}${sep}t=${Date.now()}`;
        };
        const newLogoUrl = cacheBust(authorSettings.authorLogoUrl);
        const newOrigUrl = cacheBust(authorSettings.authorLogoOriginalUrl);
        setSettings(prev => ({ ...prev, logo: newLogoUrl }));
        // Sync original URL — bez tego Edit później nie będzie miał skąd brać oryginału
        setBrandLogoOriginalUrl(newOrigUrl);
        // Auto-aktywacja: po wgraniu logo, ustaw headerStyle = 'logo'
        await handleHeaderStyleChange('logo');
        setMessage({ type: 'success', text: currentLang === 'pl' ? 'Logo brandu zaktualizowane' : 'Brand logo updated' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || (currentLang === 'pl' ? 'Nie udało się zapisać logo' : 'Failed to save logo') });
      }
    } catch (error) {
      console.error('❌ Network error uploading brand logo:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsSavingBrandLogo(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [currentLang, handleHeaderStyleChange, t, brandLogoOriginalFile]);

  // ─── Edycja istniejącego logo (otwiera modal z oryginałem RAW) ─────────
  // Pobiera oryginał (authorLogoOriginalUrl), konwertuje na dataUrl i otwiera modal.
  // Save w modalu wywołuje handleBrandLogoSave — nadpisze finalny crop bez psucia oryginału.
  const handleBrandLogoEdit = useCallback(async () => {
    if (!brandLogoOriginalUrl) {
      // Legacy user który ma logo z czasów PRZED feature'em zachowywania oryginału
      setMessage({
        type: 'error',
        text: currentLang === 'pl'
          ? 'Edycja niedostępna — wgraj logo ponownie aby aktywować edycję'
          : 'Edit unavailable — re-upload the logo to enable editing'
      });
      setTimeout(() => setMessage(null), 4000);
      return;
    }
    try {
      // Fetch original z usuniętym query string'iem cache-busting (żeby uniknąć potencjalnych issue z reqestem przez fetch)
      const cleanUrl = brandLogoOriginalUrl.split('?')[0];
      const response = await fetch(cleanUrl);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const blob = await response.blob();
      // Konwersja blob → dataUrl (modal oczekuje dataUrl jako imageSrc — taki sam format jak FileReader.readAsDataURL)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      });
      // Edit mode — oryginał JUŻ JEST na serwerze, NIE wysyłamy go ponownie przy save
      setBrandLogoOriginalFile(null);
      setBrandLogoImageSrc(dataUrl);
      setIsBrandLogoModalOpen(true);
    } catch (error) {
      console.error('❌ Error loading original brand logo for edit:', error);
      setMessage({
        type: 'error',
        text: currentLang === 'pl'
          ? 'Nie udało się załadować oryginału — spróbuj ponownie wgrać logo'
          : 'Failed to load original — try re-uploading the logo'
      });
      setTimeout(() => setMessage(null), 4000);
    }
  }, [brandLogoOriginalUrl, currentLang]);

  // ─── Usuń brand logo (powrót do default Inflee logo) ───────────────────
  const handleBrandLogoRemove = useCallback(async () => {
    if (isSavingBrandLogo) return;
    setIsSavingBrandLogo(true);
    try {
      const response = await fetch('/api/user/author-settings', {
        method: 'DELETE',
      });
      if (response.ok) {
        setSettings(prev => ({ ...prev, logo: defaultAppLogoUrl }));
        // Sync original URL — backend usunął _ORIG plik i wyzerował pole authorLogoOriginalUrl
        setBrandLogoOriginalUrl(null);
        // Wyłącz brand logo w headerze (jeśli był aktywny)
        if (profilePicSettings?.headerStyle === 'logo') {
          await handleHeaderStyleChange('none');
        }
        setMessage({ type: 'success', text: currentLang === 'pl' ? 'Logo brandu usunięte' : 'Brand logo removed' });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || (currentLang === 'pl' ? 'Nie udało się usunąć logo' : 'Failed to remove logo') });
      }
    } catch (error) {
      console.error('❌ Network error removing brand logo:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsSavingBrandLogo(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isSavingBrandLogo, currentLang, profilePicSettings, handleHeaderStyleChange, defaultAppLogoUrl, t]);

  // Handler dla toggle brand logo — flip między 'logo' a 'none'
  const handleBrandLogoToggle = useCallback(() => {
    if (!profilePicSettings || !hasBrandLogo) return;
    const newStyle = profilePicSettings.headerStyle === 'logo' ? 'none' : 'logo';
    handleHeaderStyleChange(newStyle);
  }, [profilePicSettings, hasBrandLogo, handleHeaderStyleChange]);

  // ─── Wybór pliku z dysku → otwórz modal cropu ──────────────────────────
  const handleProfilePicFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: t.headerPicUploadError });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setCropImageSrc(dataUrl);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
  }, [t]);

  // ─── Zapis zcropowanego zdjęcia (z modala) ─────────────────────────────
  // Cache busting: backend nadpisuje plik na dysku pod tym samym URL'em
  // (USER_xxx_PROFILE.png) → przeglądarka serwuje stary obraz z cache.
  // Po sukcesie dopisujemy `?t={timestamp}` do URL-i żeby wymusić re-fetch.
  const handleCroppedImageSave = useCallback(async (croppedFile: File) => {
    setIsCropModalOpen(false);
    setCropImageSrc(null);
    setIsSavingProfilePic(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', croppedFile);
      const response = await fetch('/api/user/profile-picture', {
        method: 'PUT',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        const settings = data.profilePictureSettings;
        const cacheBust = (url: string | null): string | null => {
          if (!url) return url;
          const sep = url.includes('?') ? '&' : '?';
          return `${url}${sep}t=${Date.now()}`;
        };
        // Dopisz timestamp tylko do customProfilePicture i resolvedUrl (Google URL nie wymaga — zewnętrzny CDN)
        setProfilePicSettings({
          ...settings,
          customProfilePicture: cacheBust(settings.customProfilePicture),
          resolvedUrl: cacheBust(settings.resolvedUrl),
        });
        setMessage({ type: 'success', text: t.headerPicUpdated });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || t.headerPicUploadError });
      }
    } catch (error) {
      console.error('❌ Network error uploading profile-picture:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsSavingProfilePic(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [t]);

  // ─── Usuń custom (wraca do Google jeśli istnieje) ──────────────────────
  const handleProfilePicRemove = useCallback(async () => {
    if (isSavingProfilePic) return;
    setIsSavingProfilePic(true);
    try {
      const response = await fetch('/api/user/profile-picture', {
        method: 'DELETE',
      });
      if (response.ok) {
        const data = await response.json();
        setProfilePicSettings(data.profilePictureSettings);
        setMessage({ type: 'success', text: t.headerPicRemoved });
      } else {
        const errorData = await response.json();
        setMessage({ type: 'error', text: errorData.error || t.headerPicRemoveError });
      }
    } catch (error) {
      console.error('❌ Network error removing profile-picture:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsSavingProfilePic(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isSavingProfilePic, t]);

  const handleSaveUsername = useCallback(async () => {
    if (isSavingUsername || settings.username.trim() === '' || settings.username === lastSavedUsername) return;

    setIsSavingUsername(true);

    try {
      const response = await fetch('/api/user/author-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorDisplayName: settings.username.trim()
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const authorSettings: AuthorSettings = data.authorSettings;

        setLastSavedUsername(settings.username);

        setMessage({ type: 'success', text: t.usernameUpdated });
        console.log('✅ Author name updated:', authorSettings.authorDisplayName);
      } else {
        const errorData = await response.json();
        console.error('❌ Error saving author name:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || t.usernameSaveError
        });
      }
    } catch (error) {
      console.error('❌ Network error while saving author name:', error);
      setMessage({ type: 'error', text: t.serverError });
    } finally {
      setIsSavingUsername(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isSavingUsername, settings.username, lastSavedUsername, t]);

  const closeConfirmModal = useCallback(() => {
    setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  }, []);



  const triggerFileInput = useCallback(() => {
    if (canCustomizeLogo) {
      fileInputRef.current?.click();
    }
  }, [canCustomizeLogo]);

  // Blokada renderowania: Dopóki ładujemy dane subskrypcji (start lub powrót ze Stripe),
  // pokazujemy tylko spinner. Dzięki temu Modal Właściciela pojawi się na czystym tle.
  if (isSubscriptionLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium">
            {isActivatingPlan
              ? (currentLang === 'pl' ? 'Aktywowanie planu...' : 'Activating plan...')
              : (t.processing || 'Ładowanie...')}
          </p>
        </div>
      );
  }

  return (
    <div className="space-y-8">
      {/* Landing Page Header Setup (zastępuje stary nagłówek "Author Profile") */}
      <div className="bg-white rounded-xl border border-gray-200 px-3 py-4 sm:p-6">

        {/* === ZMIANA (Task 1): Nowy układ pulpitu === */}
        {/* ZMIANA: Na desktopie (lg) zerujemy gap, bo odstępy zrobimy paddingiem przy linii */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0">

          {/* --- LEWA KOLUMNA (Nazwa + Logo) --- */}
          {/* ZMIANA: Dodano delikatną linię po prawej (border-r) i duży padding (pr-8 lub pr-12) dla oddechu */}
          <div className="space-y-6 lg:border-r lg:border-gray-200 lg:pr-12">

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* Landing Page Header Setup — preview na górze                */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div>
              {/* Header bar — label HEADER PREVIEW po lewej (analogiczny do AUTHOR NAME),
                  theme tabs po prawej (przylegające do prawej krawędzi ramki preview). */}
              <div className="flex items-end justify-between gap-3">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
                  {t.headerPreviewLabel}
                </label>

                {/* Theme tabs — aktywny ma czarne tło + brak dolnego bordera (przylega do ramki preview). */}
                <div className="flex items-end gap-0.5" role="group" aria-label={t.headerPreviewThemeLabel}>
                  <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-gray-400 mr-1.5 mb-2">
                    {t.headerPreviewThemeLabel}
                  </span>
                  {HEADER_PREVIEW_THEMES.map(th => {
                    const isActive = th.key === previewThemeKey;
                    return (
                      <button
                        key={th.key}
                        onClick={() => setPreviewThemeKey(th.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-all cursor-pointer border border-b-0 ${
                          isActive
                            ? 'bg-gray-900 text-white border-gray-900 shadow-sm relative -mb-px z-10'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                        title={th.label}
                      >
                        {th.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ──────────────────────────────────────────────────────── */}
              {/* LIVE PREVIEW — mini-header z demo.tsx (full width, no nav) */}
              {/* ──────────────────────────────────────────────────────── */}
              <div
                className="rounded-xl rounded-tr-none overflow-hidden border transition-colors"
                style={{
                  borderColor: previewTheme.headerBorder,
                  backgroundColor: previewTheme.pageBg,
                  boxShadow: previewTheme.headerShadow,
                }}
              >
                {/* Header bar — replikuje strukturę z demo.tsx (lewy CTA, prawy podpis/logo) */}
                <div
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{
                    backgroundColor: previewTheme.headerBg,
                    borderBottom: `1px solid ${previewTheme.headerBorder}`,
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                  }}
                >
                  {/* LEWA — CTA pill (hardcoded label jak navCta w demo.tsx) */}
                  <span
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{
                      background: previewTheme.ctaBg,
                      color: previewTheme.ctaText,
                      boxShadow: previewTheme.ctaShadow,
                    }}
                  >
                    {t.headerPreviewCta}
                  </span>

                  {/* PRAWA — brand logo jeśli aktywne ('logo'), inaczej podpis + avatar (dla 'profile' i 'none') */}
                  {profilePicSettings?.headerStyle === 'logo' && hasBrandLogo && settings.logo ? (
                    /* Brand logo — wyświetlamy realny <img>, max-h ograniczony do wysokości headera */
                    <div className="flex items-center justify-end flex-1 min-w-0">
                      <img
                        key={settings.logo}
                        src={settings.logo}
                        alt="Brand logo"
                        className="max-h-8 max-w-[60%] object-contain"
                      />
                    </div>
                  ) : (
                    /* Podpis + avatar — dla 'profile' i 'none' (avatar tylko gdy 'profile') */
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex flex-col items-end justify-center min-w-0">
                        <span className="text-xs leading-tight truncate" style={{ color: previewTheme.pageSubtext }}>
                          {t.headerPreviewMadeBy}{' '}
                          <span style={{ color: previewTheme.pageText, opacity: 0.85 }}>
                            {settings.username || '—'}
                          </span>
                        </span>
                        <span className="text-[0.65rem] leading-tight mt-0.5" style={{ color: previewTheme.pageSubtext }}>
                          {t.headerPreviewWith}{' '}
                          <span style={{ color: previewTheme.pageText, opacity: 0.85 }}>inflee.app</span>
                        </span>
                      </div>
                      {/* Avatar — tylko gdy headerStyle === 'profile' && resolvedUrl
                          key={resolvedUrl} → React re-mountuje <div> + <img> przy każdej zmianie URL. */}
                      {profilePicSettings?.headerStyle === 'profile' && profilePicSettings?.resolvedUrl && (
                        <div
                          key={profilePicSettings.resolvedUrl}
                          className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
                          style={{ border: `1.5px solid ${previewTheme.cardBorder}` }}
                        >
                          <img
                            src={profilePicSettings.resolvedUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Pasek strony pod headerem — sygnalizuje że to kontekst LP */}
                <div className="h-3" style={{ backgroundColor: previewTheme.pageBg }}></div>
              </div>

              {/* Stały monit informacyjny — tylko podgląd, nie wpływa na konfigurację LP.
                  Subtelny pasek w tonacji emerald (zgodny z innymi info-msgami w aplikacji).
                  inline-flex + max-w-fit — szerokość dopasowana do tekstu, nie rozciąga się na cały kontener. */}
              <div className="inline-flex items-start gap-2 mt-2 px-3 py-2 bg-emerald-50/60 border border-emerald-100 rounded-md max-w-fit">
                <Info className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-[0.7rem] text-emerald-800 leading-relaxed">
                  {t.headerPreviewThemeInfo}
                </p>
              </div>

              {/* ──────────────────────────────────────────────────────── */}
              {/* AUTHOR NAME — full width pod preview, ze stałym monitem    */}
              {/* ──────────────────────────────────────────────────────── */}
              <div className="mt-5 pt-5 border-t border-gray-200">
                <label className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide block">
                  {t.authorName}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={settings.username}
                    onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                    placeholder={t.usernamePlaceholder}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-500 pr-24 transition-colors"
                  />
                  {settings.username !== lastSavedUsername && settings.username.trim() !== '' && (
                    <button
                      onClick={handleSaveUsername}
                      disabled={isSavingUsername}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center px-2.5 py-1 bg-blue-600 text-white text-[0.7rem] font-bold rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                      {isSavingUsername ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-3 w-3 mr-1" />
                          {t.save}
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Stały monit pod inputem — emerald, ten sam styl co pod preview.
                    inline-flex + max-w-fit — szerokość dopasowana do tekstu. */}
                <div className="inline-flex items-start gap-2 mt-2 px-3 py-2 bg-emerald-50/60 border border-emerald-100 rounded-md max-w-fit">
                  <Info className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[0.7rem] text-emerald-800 leading-relaxed">
                    {t.headerAuthorNameInfo}
                  </p>
                </div>
              </div>

              {/* ──────────────────────────────────────────────────────── */}
              {/* SEPARATOR + IMAGE SETUP label nad 2 kolumnami              */}
              {/* ──────────────────────────────────────────────────────── */}
              <div className="mt-6 pt-5 border-t border-gray-200">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-3">
                  {t.headerImageSetupLabel}
                </label>

                {/* ──────────────────────────────────────────────────── */}
                {/* DWIE KOLUMNY: Profile picture / Brand logo            */}
                {/* ──────────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* ═══ KOLUMNA 1: Profile picture ═══════════════════════ */}
                <div
                  className={`rounded-xl border p-3 transition-all ${
                    profilePicSettings?.headerStyle === 'profile'
                      ? 'border-blue-200 bg-blue-50/40'
                      : 'border-gray-200 bg-gray-50/60'
                  }`}
                >
                  {/* Header rzędu — tytuł + toggle pill (ZAWSZE klikalny, NIE pokrywany blurem) */}
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Camera className={`w-3.5 h-3.5 flex-shrink-0 ${
                        profilePicSettings?.headerStyle === 'profile' ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {t.headerPicTitle}
                      </span>
                    </div>
                    {/* Toggle group — etykieta + pill.
                        Etykieta widoczna TYLKO gdy toggle aktywny (da się go kliknąć).
                        Disabled toggle (brak źródła) → bez etykiety, sam pill mówi "nic do robienia". */}
                    {(() => {
                      const isToggleActive = profilePicSettings?.headerStyle === 'profile';
                      const hasAnySource = profilePicSettings?.hasGoogleOriginal || profilePicSettings?.hasCustomPicture;
                      const isToggleDisabled = isSavingProfilePic || isLoadingProfilePic || !hasAnySource;
                      return (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {hasAnySource && (
                            <span className="text-[0.65rem] font-medium uppercase tracking-wider text-gray-400">
                              {isToggleActive ? t.headerToggleTurnOff : t.headerToggleTurnOn}
                            </span>
                          )}
                          <button
                            onClick={handleProfilePicToggle}
                            disabled={isToggleDisabled}
                            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                              isToggleActive ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                            aria-label={t.headerPicTitle}
                            title={isToggleActive ? t.headerPicEnabled : t.headerPicDisabled}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                isToggleActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            ></span>
                          </button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Wrapper blur — pokrywa hero thumbnail + przyciski gdy karta nieaktywna (toggle OFF).
                      pointer-events-none → klik nie reaguje, opacity + blur → wizualne wyciszenie. */}
                  <div className={`transition-all duration-200 ${
                    profilePicSettings?.headerStyle === 'profile'
                      ? ''
                      : 'blur-[2px] opacity-50 pointer-events-none select-none'
                  }`}>

                  {/* ──────────────────────────────────────────────────
                      Hero thumbnail block — pokazuje co user ma w bazie.
                      4 stany w zależności od źródeł zdjęcia:
                       1) Google + custom  → 2 thumbnaile side-by-side, klik = switch
                       2) Tylko Google     → 1 thumbnail (full-width centered)
                       3) Tylko custom     → 1 thumbnail (full-width centered)
                       4) Brak żadnego     → placeholder z ikoną Camera

                      Active state (gdy headerStyle === 'profile'):
                       - aktywne źródło: niebieski ring-2 ring-blue-500, opacity-100, label kolorowy
                       - drugie źródło: ring-1 ring-gray-200, opacity-60, label szary
                      Inactive state (headerStyle === 'logo' lub 'none'):
                       - oba thumbnaile: opacity-50 (sygnalizuje wyłączone)

                      Klik na nie-aktywny thumbnail → switch (analogicznie jak przyciski niżej).
                  ────────────────────────────────────────────────── */}
                  <div className="bg-white rounded-lg border border-gray-200 py-4 px-3 mb-3">
                    {(() => {
                      const hasGoogle = profilePicSettings?.hasGoogleOriginal;
                      const hasCustom = profilePicSettings?.hasCustomPicture;
                      const isHeaderActive = profilePicSettings?.headerStyle === 'profile';
                      const isActiveSource = (source: 'google' | 'custom') => {
                        if (!isHeaderActive) return false;
                        if (source === 'google') {
                          return (profilePicSettings?.activeProfileSource === 'google' || !hasCustom) && hasGoogle;
                        }
                        return profilePicSettings?.activeProfileSource === 'custom' && hasCustom;
                      };
                      const dimWhenInactive = !isHeaderActive ? 'opacity-50' : '';

                      // Reusable klasa ramki 50/50
                      const frameClass = (active: boolean) => `flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer disabled:cursor-default ${
                        active
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-gray-200 bg-gray-50/40 hover:border-gray-300 hover:bg-gray-50'
                      } ${dimWhenInactive}`;

                      // ──────────────────────────────────────────────────
                      // Brak Google'a → 1 ramka 100% (custom albo placeholder, bez labelu "Custom")
                      // ──────────────────────────────────────────────────
                      if (!hasGoogle) {
                        if (hasCustom) {
                          // Custom istnieje — pełnoszerokościowy thumbnail z X-em do usunięcia
                          const customActive = isActiveSource('custom');
                          return (
                            <div className="relative">
                              <div className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 ${
                                customActive
                                  ? 'border-blue-500 bg-blue-50/50'
                                  : 'border-gray-200 bg-gray-50/40'
                              } ${dimWhenInactive}`}>
                                <div
                                  key={profilePicSettings!.customProfilePicture!}
                                  className={`w-16 h-16 rounded-full overflow-hidden transition-all ${
                                    customActive
                                      ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-blue-50 opacity-100'
                                      : 'opacity-70'
                                  }`}
                                >
                                  <img
                                    src={profilePicSettings!.customProfilePicture!}
                                    alt="Custom"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                              {/* X w prawym górnym rogu */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmModal({
                                    isOpen: true,
                                    title: currentLang === 'pl' ? 'Usuń zdjęcie' : 'Remove picture',
                                    message: currentLang === 'pl'
                                      ? 'Czy na pewno chcesz usunąć wgrane zdjęcie?'
                                      : 'Are you sure you want to remove the uploaded picture?',
                                    confirmLabel: currentLang === 'pl' ? 'Usuń zdjęcie' : 'Remove picture',
                                    onConfirm: async () => {
                                      setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
                                      await handleProfilePicRemove();
                                    },
                                  });
                                }}
                                disabled={isSavingProfilePic}
                                className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-300 transition-all opacity-60 hover:opacity-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                                title={t.headerPicRemoveBtn}
                                aria-label={t.headerPicRemoveBtn}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        }
                        // Brak Google + brak custom → placeholder na 100% (bez labelu)
                        return (
                          <div className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/40">
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                              <Camera className="w-6 h-6 text-gray-300" />
                            </div>
                          </div>
                        );
                      }

                      // ──────────────────────────────────────────────────
                      // Mamy Google'a → ZAWSZE 2 sloty 50/50 (custom albo placeholder)
                      // ──────────────────────────────────────────────────
                      const googleActive = isActiveSource('google');
                      const customActive = isActiveSource('custom');

                      // Symetryczne wrappery: oba sloty są <div flex-1> — gwarantuje 50/50 niezależnie od zawartości.
                      // Zmiana frameClass dla wewnętrznych buttonów (usunięte flex-1, dodane w-full + h-full).
                      const innerFrameClass = (active: boolean) => `w-full h-full flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer disabled:cursor-default ${
                        active
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-gray-200 bg-gray-50/40 hover:border-gray-300 hover:bg-gray-50'
                      } ${dimWhenInactive}`;

                      return (
                        <div className="flex items-stretch justify-center gap-3">
                          {/* LEWA: Google — wrapper flex-1 dla symetrii */}
                          <div className="flex-1">
                            <button
                              onClick={() => handleSwitchProfileSource('google')}
                              disabled={isSavingProfilePic || isLoadingProfilePic || googleActive}
                              className={innerFrameClass(googleActive)}
                              title={googleActive ? t.headerPicSourceGoogle : t.headerPicGoogleBtn}
                            >
                              <div
                                key={profilePicSettings!.profilePicture!}
                                className={`w-14 h-14 rounded-full overflow-hidden transition-all ${
                                  googleActive
                                    ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-blue-50 opacity-100'
                                    : 'opacity-70'
                                }`}
                              >
                                <img
                                  src={profilePicSettings!.profilePicture!}
                                  alt="Google"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className={`text-[0.6rem] font-semibold uppercase tracking-wider ${
                                googleActive ? 'text-blue-600' : 'text-gray-500'
                              }`}>
                                Google
                              </span>
                            </button>
                          </div>

                          {/* PRAWA: Custom albo placeholder gdy brak custom */}
                          {hasCustom ? (
                            <div className="flex-1 relative">
                              <button
                                onClick={() => handleSwitchProfileSource('custom')}
                                disabled={isSavingProfilePic || isLoadingProfilePic || customActive}
                                className={innerFrameClass(customActive)}
                                title={customActive ? t.headerPicSourceCustom : t.headerPicUploadedBtn}
                              >
                                <div
                                  key={profilePicSettings!.customProfilePicture!}
                                  className={`w-14 h-14 rounded-full overflow-hidden transition-all ${
                                    customActive
                                      ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-blue-50 opacity-100'
                                      : 'opacity-70'
                                  }`}
                                >
                                  <img
                                    src={profilePicSettings!.customProfilePicture!}
                                    alt="Custom"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <span className={`text-[0.6rem] font-semibold uppercase tracking-wider ${
                                  customActive ? 'text-blue-600' : 'text-gray-500'
                                }`}>
                                  {t.headerPicSourceCustom}
                                </span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmModal({
                                    isOpen: true,
                                    title: currentLang === 'pl' ? 'Usuń zdjęcie' : 'Remove picture',
                                    message: currentLang === 'pl'
                                      ? 'Czy na pewno chcesz usunąć wgrane zdjęcie? Jeśli masz zdjęcie z Google, ono pozostanie aktywne.'
                                      : 'Are you sure you want to remove the uploaded picture? If you have a Google picture, it will remain active.',
                                    confirmLabel: currentLang === 'pl' ? 'Usuń zdjęcie' : 'Remove picture',
                                    onConfirm: async () => {
                                      setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
                                      await handleProfilePicRemove();
                                    },
                                  });
                                }}
                                disabled={isSavingProfilePic}
                                className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-300 transition-all opacity-60 hover:opacity-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                                title={t.headerPicRemoveBtn}
                                aria-label={t.headerPicRemoveBtn}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            /* Placeholder dla Custom — wrapper flex-1 dla symetrii z lewą ramką */
                            <div className="flex-1">
                              <button
                                onClick={() => profilePicFileInputRef.current?.click()}
                                disabled={isSavingProfilePic}
                                className={`w-full h-full flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-dashed transition-all cursor-pointer disabled:cursor-not-allowed ${dimWhenInactive} border-gray-300 bg-gray-50/40 hover:border-gray-400 hover:bg-gray-50`}
                                title={t.headerPicUploadBtn}
                              >
                                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                                  <Camera className="w-5 h-5 text-gray-300" />
                                </div>
                                <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-gray-500">
                                  {t.headerPicSourceCustom}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>



                  {/* Action buttons — równoważne (flex-1) gdy 2 przyciski:
                      • "Uploaded picture" (klik → upload nowego custom)
                      • "Google profile picture" (klik → restore z Google jeśli ma custom)
                      Conditional logic na 4 stany:
                       1) brak Google + brak custom → tylko "Add picture"
                       2) tylko Google → tylko "Google profile picture" (active) + "Upload yours" (gray)
                       3) tylko custom → "Uploaded picture" (active) + "Remove" (red)
                       4) Google + custom → "Uploaded picture" (active) + "Google profile picture" (gray)
                  */}
                  <div className="flex gap-1.5">
                    {/* STAN 1: Brak żadnego zdjęcia — pojedynczy "Add" full width */}
                    {!profilePicSettings?.hasGoogleOriginal && !profilePicSettings?.hasCustomPicture && (
                      <button
                        onClick={() => profilePicFileInputRef.current?.click()}
                        disabled={isSavingProfilePic}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[0.7rem] font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isSavingProfilePic ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        {t.headerPicAddBtn}
                      </button>
                    )}

                    {/* STAN 2/3/4: Mamy jakieś zdjęcie — 2 równoważne przyciski (50/50)
                        Kolejność: GOOGLE (lewy) | UPLOADED (prawy) — pasuje do thumbnaili nad nimi.
                        "Google profile picture" — switch przez activeProfileSource (custom zostaje w bazie).
                        "Twoje zdjęcie" — albo aktywne (custom), albo otwiera upload modal jeśli nie ma custom. */}
                    {(profilePicSettings?.hasGoogleOriginal || profilePicSettings?.hasCustomPicture) && (
                      <>
                        {/* Lewy: "Google profile picture" — primary gdy Google jest faktycznie wyświetlany.
                            Faktyczny stan = aktywny gdy:
                            • activeProfileSource === 'google' (świadomy switch), LUB
                            • custom nie istnieje (resolver i tak fallbackuje do Google) */}
                        {profilePicSettings?.hasGoogleOriginal && (() => {
                          const googleIsActive = profilePicSettings?.activeProfileSource === 'google'
                            || !profilePicSettings?.hasCustomPicture;
                          return (
                            <button
                              onClick={() => handleSwitchProfileSource('google')}
                              disabled={isSavingProfilePic || googleIsActive}
                              className={`flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[0.7rem] font-medium rounded-md transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${
                                googleIsActive
                                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                              }`}
                              title={t.headerPicGoogleBtn}
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span className="truncate">{t.headerPicGoogleBtn}</span>
                            </button>
                          );
                        })()}

                        {/* Prawy: "Change photo" / "Upload photo" — conditional label
                            • hasCustomPicture: button label = "Change photo" (zmień istniejące custom)
                            • !hasCustomPicture: label = "Upload photo" (wgraj pierwsze)
                            Klik:
                            • custom istnieje ale nieaktywny → switch na 'custom'
                            • custom aktywny LUB brak custom → upload nowego pliku */}
                        <button
                          onClick={() => {
                            if (profilePicSettings?.hasCustomPicture && profilePicSettings?.activeProfileSource !== 'custom') {
                              handleSwitchProfileSource('custom');
                            } else {
                              profilePicFileInputRef.current?.click();
                            }
                          }}
                          disabled={isSavingProfilePic}
                          className={`flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[0.7rem] font-medium rounded-md transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${
                            profilePicSettings?.activeProfileSource === 'custom' && profilePicSettings?.hasCustomPicture
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                          title={profilePicSettings?.hasCustomPicture ? t.headerPicChangeBtn : t.headerPicUploadBtn}
                        >
                          {isSavingProfilePic ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          <span className="truncate">
                            {profilePicSettings?.hasCustomPicture ? t.headerPicChangeBtn : t.headerPicUploadBtn}
                          </span>
                        </button>

                        {/* Remove — gdy ma TYLKO custom bez Google'a, drobny ikonowy button po prawej */}
                        {profilePicSettings?.hasCustomPicture && !profilePicSettings?.hasGoogleOriginal && (
                          <button
                            onClick={handleProfilePicRemove}
                            disabled={isSavingProfilePic}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white text-red-700 text-[0.7rem] font-medium border border-red-300 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                            title={t.headerPicRemoveBtn}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <input
                    ref={profilePicFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePicFileSelect}
                    className="hidden"
                    disabled={isSavingProfilePic}
                  />
                  </div>{/* /wrapper blur Profile picture */}
                </div>

                {/* ═══ KOLUMNA 2: Brand logo (locked dla niższych planów) ═ */}
                <div
                  className={`rounded-xl border p-3 transition-all relative ${
                    canCustomizeLogo
                      ? profilePicSettings?.headerStyle === 'logo' && hasBrandLogo
                        ? 'border-blue-200 bg-blue-50/40'
                        : 'border-gray-200 bg-gray-50/60'
                      : 'border-gray-200 bg-gradient-to-br from-amber-50/40 via-white to-gray-50/40'
                  }`}
                >
                  {/* Header rzędu — tytuł + toggle (lub PLUS badge) */}
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ImageIcon className={`w-3.5 h-3.5 flex-shrink-0 ${
                        canCustomizeLogo && profilePicSettings?.headerStyle === 'logo' && hasBrandLogo ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {t.headerBrandTitle}
                      </span>
                    </div>

                    {canCustomizeLogo ? (
                      /* Toggle group — etykieta + pill (analogiczne do Profile picture).
                          Etykieta widoczna TYLKO gdy hasBrandLogo (da się kliknąć toggle). */
                      (() => {
                        const isToggleActive = profilePicSettings?.headerStyle === 'logo' && hasBrandLogo;
                        const isToggleDisabled = !hasBrandLogo || isSavingProfilePic || isLoadingProfilePic;
                        return (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {hasBrandLogo && (
                              <span className="text-[0.65rem] font-medium uppercase tracking-wider text-gray-400">
                                {isToggleActive ? t.headerToggleTurnOff : t.headerToggleTurnOn}
                              </span>
                            )}
                            <button
                              onClick={handleBrandLogoToggle}
                              disabled={isToggleDisabled}
                              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
                                isToggleActive ? 'bg-blue-600' : 'bg-gray-300'
                              }`}
                              aria-label={t.headerBrandTitle}
                              title={isToggleActive ? t.headerBrandEnabled : t.headerBrandDisabled}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                  isToggleActive ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              ></span>
                            </button>
                          </div>
                        );
                      })()
                    ) : (
                      /* Plan locked — etykieta info w nagłówku (CTA "Upgrade plan" jest pod kartą poza blurem) */
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[0.6rem] font-semibold rounded flex-shrink-0 leading-tight">
                        <Lock className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{t.headerToggleLockedHint}</span>
                      </span>
                    )}
                  </div>

                  {/* Wrapper blur — analogiczny do Profile picture.
                      Aktywne (clear, bez blur) TYLKO gdy:
                      • headerStyle === 'logo' AND hasBrandLogo (toggle ON i logo wgrane)
                      Plan locked → BLUR + pointer-events-none → X w rogu też zablokowany. */}
                  <div className={`transition-all duration-200 ${
                    canCustomizeLogo && profilePicSettings?.headerStyle === 'logo' && hasBrandLogo
                      ? ''
                      : 'blur-[2px] opacity-50 pointer-events-none select-none'
                  }`}>

                  {/* Hero ramka — STRUKTURA 1:1 z Profile picture (outer wrapper + inner frame).
                      Inner frame ma flex-1 jak sloty Profile picture, dzięki czemu wysokości są identyczne. */}
                  <div className="bg-white rounded-lg border border-gray-200 py-4 px-3 mb-3">
                    <div className="flex items-stretch justify-center">
                      {hasBrandLogo ? (
                        /* Logo wgrane — slot z X-em w rogu.
                            Container: w-full + max-h-14 — logo skaluje się do pełnej szerokości ramki
                            zachowując proporcje (object-contain). */
                        <div className="flex-1 relative">
                          <div className={`w-full h-full flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                            profilePicSettings?.headerStyle === 'logo'
                              ? 'border-blue-500 bg-blue-50/50'
                              : 'border-gray-200 bg-gray-50/40 opacity-60'
                          }`}>
                            <div className="w-full h-14 flex items-center justify-center">
                              <img
                                key={settings.logo!}
                                src={settings.logo!}
                                alt="Brand logo"
                                className="max-w-full max-h-full object-contain"
                              />
                            </div>
                            <span className={`text-[0.6rem] font-semibold uppercase tracking-wider ${
                              profilePicSettings?.headerStyle === 'logo' ? 'text-blue-600' : 'text-gray-500'
                            }`}>
                              {t.headerBrandTitle}
                            </span>
                          </div>
                          {/* X w prawym górnym rogu — usuwa logo z bazy (DELETE /api/user/author-settings) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal({
                                isOpen: true,
                                title: currentLang === 'pl' ? 'Usuń logo brandu' : 'Remove brand logo',
                                message: currentLang === 'pl'
                                  ? 'Czy na pewno chcesz usunąć logo brandu? Ta akcja nie wpływa na zdjęcie profilowe.'
                                  : 'Are you sure you want to remove the brand logo? This action does not affect the profile picture.',
                                confirmLabel: currentLang === 'pl' ? 'Usuń logo' : 'Remove logo',
                                onConfirm: async () => {
                                  setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
                                  await handleBrandLogoRemove();
                                },
                              });
                            }}
                            disabled={isSavingBrandLogo}
                            className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white/80 hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-300 transition-all opacity-60 hover:opacity-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                            title={t.headerBrandRemoveBtn}
                            aria-label={t.headerBrandRemoveBtn}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        /* Brak logo — placeholder dashed (analogiczny do Custom placeholder w Profile picture) */
                        <div className="flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/40">
                          <div className="w-14 h-14 rounded-md bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-gray-300" />
                          </div>
                          <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-gray-500">
                            {t.headerBrandTitle}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hidden file input — trigger przez button niżej */}
                  <input
                    ref={brandLogoFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBrandLogoFileSelect}
                    className="hidden"
                    disabled={isSavingBrandLogo}
                  />
                  </div>{/* /wrapper blur Brand logo */}

                  {/* Action buttons — POZA wrapper blur (klikalne nawet gdy plan locked).
                      Układ:
                      • Brak logo:   [Upload (full)]
                      • Logo wgrane: [Change] [Edit]
                      • Plan locked: [Upgrade plan (full)] */}
                  <div className="flex gap-1.5">
                    {!canCustomizeLogo ? (
                      /* Locked — przycisk Upgrade plan pełna szerokość. Klikalny POZA blur'em.
                          Mode 'upgrade' → modal otwiera się BEZ przycisku cancel (user przyszedł upgradować, nie anulować). */
                      <button
                        onClick={() => (window as any).openUpgradeModal?.('upgrade')}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-amber-500 text-white text-[0.7rem] font-medium rounded-md hover:bg-amber-600 transition-colors cursor-pointer"
                      >
                        <Lock className="h-3 w-3" />
                        {t.headerBrandUnlockBtn}
                      </button>
                    ) : (
                      <>
                        {/* Upload (gdy brak) / Change (gdy wgrane) — klik otwiera picker plików.
                            LEWY — primary blue, prowadzi do wgrania nowego pliku z dysku. */}
                        <button
                          onClick={() => brandLogoFileInputRef.current?.click()}
                          disabled={isSavingBrandLogo}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[0.7rem] font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                          title={hasBrandLogo ? t.headerBrandChangeBtn : t.headerBrandUploadBtn}
                        >
                          {isSavingBrandLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                          <span className="truncate">
                            {hasBrandLogo ? t.headerBrandChangeBtn : t.headerBrandUploadBtn}
                          </span>
                        </button>

                        {/* Edit — tylko gdy logo istnieje. Otwiera modal z oryginałem RAW (handleBrandLogoEdit).
                            Disabled gdy brak brandLogoOriginalUrl (legacy user'y bez oryginału).
                            PRAWY — secondary white, modyfikuje istniejący oryginał (proporcje/zoom). */}
                        {hasBrandLogo && (
                          <button
                            onClick={handleBrandLogoEdit}
                            disabled={isSavingBrandLogo || !brandLogoOriginalUrl}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-white text-gray-700 text-[0.7rem] font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                            title={
                              !brandLogoOriginalUrl
                                ? (currentLang === 'pl'
                                    ? 'Edycja niedostępna — wgraj logo ponownie'
                                    : 'Edit unavailable — re-upload to enable')
                                : (currentLang === 'pl' ? 'Edytuj proporcje' : 'Edit proportions')
                            }
                          >
                            <Crop className="h-3 w-3" />
                            <span className="truncate">{t.headerBrandEditBtn}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

              </div>{/* /grid 2 kolumny Profile picture + Brand logo */}

              {/* Stały monit pod gridem — info że ustawienia obrazu wpływają na wszystkie LP.
                  Styl emerald + inline-flex + max-w-fit identyczny jak inne monity w tej sekcji
                  (pod theme preview i pod Author Name). Szerokość dopasowana do tekstu. */}
              <div className="inline-flex items-start gap-2 mt-3 px-3 py-2 bg-emerald-50/60 border border-emerald-100 rounded-md max-w-fit">
                <Info className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-[0.7rem] text-emerald-800 leading-relaxed">
                  {t.headerImageSetupInfo}
                </p>
              </div>

              </div>{/* /wrapper IMAGE SETUP (label + grid + info) */}
            </div>
          </div>

          {/* --- PRAWA KOLUMNA (Subskrypcja) --- */}
          <div>
            {/* Subskrypcja - zintegrowana z SubscriptionCard (Przeniesione) */}
            <div className="lg:pl-12">
              <SubscriptionCard
                lang={currentLang}
                t={t}
                compact={true}
                subscriptionData={subscriptionData}
                loading={isSubscriptionLoading}
                setConfirmModal={setConfirmModal}
                onOpenVerificationModal={() => setIsVerificationModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Configuration - tylko dla GOD */}
      {userRole?.toUpperCase() === 'GOD' && (
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-gray-900">{t.aiConfig}</h2>
            <p className="text-gray-600">{t.aiConfigDesc}</p>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Text Generation */}
          <div className="bg-white border border-gray-200 rounded-xl px-3 py-4 sm:p-6 relative">
            <div className="flex items-center space-x-2 mb-6">
              <Type className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                <span className="sm:hidden">{t.aiForText}</span>
                <span className="hidden sm:inline">{t.textGeneration}</span>
              </h3>
              {isLoadingApiKeys && (
                <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
              )}
            </div>

            {currentTextApiKey?.isSaved && (
              <div className="absolute top-4 right-4 flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">{t.apiActive}</span>
                <button
                  onClick={() => removeApiKey(settings.textProvider)}
                  className="ml-1 text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <ProviderSelector
              label={t.provider}
              providers={TEXT_PROVIDERS}
              currentProviderId={settings.textProvider}
              currentModelId={settings.textModel}
              onProviderChange={handleTextProviderChange}
              onModelChange={handleTextModelChange}
              apiKey={currentTextApiKey}
              type="text"
              dropdowns={dropdowns}
              toggleDropdown={toggleDropdown}
            />

            {needsTextApiKey && !currentTextApiKey?.isSaved && (
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  {textProvider?.name} {t.apiKey}
                </label>

                <div className="relative">
                  <input
                    type={currentTextApiKey?.showValue ? 'text' : 'password'}
                    value={currentTextApiKey?.value || ''}
                    onChange={(e) => updateApiKey(settings.textProvider, e.target.value)}
                    placeholder={getApiKeyPlaceholder(settings.textProvider)}
                    className="w-full pl-4 pr-32 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 placeholder-gray-500"
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility(settings.textProvider)}
                      className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {currentTextApiKey?.showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {currentTextApiKey?.value && currentTextApiKey.value.length > 10 && isValidTextKey && (
                      <button
                        onClick={() => saveApiKey(settings.textProvider)}
                        disabled={savingApiKey === settings.textProvider}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {savingApiKey === settings.textProvider ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <span>{t.save}</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {currentTextApiKey?.value && currentTextApiKey.value.length > 0 && currentTextApiKey.value.length <= 10 && (
                  <div className="flex items-center space-x-2 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>{t.keyIncomplete}</span>
                  </div>
                )}

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <Shield className="w-10 h-10 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-800">
                      <span className="font-medium">{t.keySecured}</span> {t.keySecuredDesc}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Image Generation */}
          <div className="bg-white border border-gray-200 rounded-xl px-3 py-4 sm:p-6 relative">
            <div className="flex items-center space-x-2 mb-6">
              <Palette className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                <span className="sm:hidden">{t.aiForImages}</span>
                <span className="hidden sm:inline">{t.imageGeneration}</span>
              </h3>
              {isLoadingApiKeys && (
                <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
              )}
            </div>

            {currentImageApiKey?.isSaved && (
              <div className="absolute top-4 right-4 flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">{t.apiActive}</span>
                <button
                  onClick={() => removeApiKey(settings.imageProvider)}
                  className="ml-1 text-emerald-600 hover:text-emerald-800 transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <ProviderSelector
              label={t.provider}
              providers={IMAGE_PROVIDERS}
              currentProviderId={settings.imageProvider}
              currentModelId={settings.imageModel}
              onProviderChange={handleImageProviderChange}
              onModelChange={handleImageModelChange}
              apiKey={currentImageApiKey}
              type="image"
              dropdowns={dropdowns}
              toggleDropdown={toggleDropdown}
            />

            {needsImageApiKey && !currentImageApiKey?.isSaved && (
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  {imageProvider?.name} {t.apiKey}
                </label>

                <div className="relative">
                  <input
                    type={currentImageApiKey?.showValue ? 'text' : 'password'}
                    value={currentImageApiKey?.value || ''}
                    onChange={(e) => updateApiKey(settings.imageProvider, e.target.value)}
                    placeholder={getApiKeyPlaceholder(settings.imageProvider)}
                    className="w-full pl-4 pr-32 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 placeholder-gray-500"
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility(settings.imageProvider)}
                      className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      {currentImageApiKey?.showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {currentImageApiKey?.value && currentImageApiKey.value.length > 10 && isValidImageKey && (
                      <button
                        onClick={() => saveApiKey(settings.imageProvider)}
                        disabled={savingApiKey === settings.imageProvider}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {savingApiKey === settings.imageProvider ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <span>{t.save}</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {currentImageApiKey?.value && currentImageApiKey.value.length > 0 && currentImageApiKey.value.length <= 10 && (
                  <div className="flex items-center space-x-2 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>{t.keyIncomplete}</span>
                  </div>
                )}

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <Shield className="w-10 h-10 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-800">
                      <span className="font-medium">{t.keySecured}</span> {t.keySecuredDesc}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* Grid for Subscription and System Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Subscription Section is now integrated in Author Profile */}

        {/* System Management - widoczny tylko dla GOD */}
        {userRole?.toUpperCase() === 'GOD' && (
          <div className="bg-white rounded-xl border border-gray-200 px-3 py-4 sm:p-6">
            <div className="flex items-center mb-6">
              <FolderOpen className="h-5 w-5 text-gray-600 mr-2" />
              <h2 className="text-xl font-bold text-gray-900">{t.systemManagement}</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.diskExplorer}
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  {t.diskExplorerDesc}
                </p>
                <button
                  onClick={() => setIsDiskExplorerOpen(true)}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {t.exploreDisk}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
        >
          {currentLang === 'pl' ? 'Usuń konto' : 'Delete account'}
        </button>
      </div>

      {/* Disk Explorer Modal */}
      {isDiskExplorerOpen && (
        <DiskExplorerModal
          isOpen={isDiskExplorerOpen}
          onClose={() => setIsDiskExplorerOpen(false)}
        />
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur cursor-pointer"
            onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }}
          />
          <div className="relative bg-gray-50 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {currentLang === 'pl' ? 'Usuń konto' : 'Delete account'}
              </h3>
              <p className="text-sm text-gray-500">
                {currentLang === 'pl'
                  ? 'Ta operacja jest nieodwracalna. Zostaną usunięte wszystkie Twoje dane, pliki i subskrypcja.'
                  : 'This action is irreversible. All your data, files and subscription will be permanently deleted.'}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2">
                {currentLang === 'pl' ? 'Wpisz aby potwierdzić:' : 'Type to confirm:'}
                <span className="block mt-1 font-mono font-medium text-gray-700 select-all">
                  delete my inflee.app account
                </span>
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete my inflee.app account"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {currentLang === 'pl' ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'delete my inflee.app account' || isDeletingAccount}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-50 bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeletingAccount
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{currentLang === 'pl' ? 'Usuwanie...' : 'Deleting...'}</>
                  : (currentLang === 'pl' ? 'Usuń konto' : 'Delete account')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm cursor-pointer" onClick={closeConfirmModal} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 cursor-default">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-gray-500 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={closeConfirmModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  {t.confirmCancel}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                >
                  {confirmModal.confirmLabel || t.confirmRemove}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zmiany Planu */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        t={t}
        currentLang={currentLang}
        currentPlanRole={subscriptionData?.role || ''}
        subscriptionData={subscriptionData}
        onManageBilling={handleManageBilling}
        mode={upgradeModalMode}
      />

      {/* Modal Wymuszenia Wyboru Właściciela (Blocking) */}
      <BillingChoiceModal
        isOpen={showBillingChoiceModal}
        subscriptionData={subscriptionData}
        onSave={handleBillingChoiceSave}
        t={t}
      />

      {/* NOWY Modal Wyboru Weryfikacji (tylko PL) */}
      <VerificationChoiceModal
        isOpen={isVerificationModalOpen}
        onClose={() => setIsVerificationModalOpen(false)}
        onSelectCard={handleCardVerification}
        onSelectBlik={handleBlikVerification}
        t={t}
        processingType={processingType}
        priceBlik={subscriptionData?.oneTimePrice}
      />

      {/* Toast Messages */}
      {message && (
        <div className="fixed top-4 right-4 z-50">
          <div className={`px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* Modal kadrowania zdjęcia profilowego */}
      <ProfilePictureCropModal
        isOpen={isCropModalOpen}
        imageSrc={cropImageSrc}
        onCancel={() => {
          setIsCropModalOpen(false);
          setCropImageSrc(null);
        }}
        onSave={handleCroppedImageSave}
        language={currentLang}
      />

      {/* Modal kadrowania logo brandu — proporcje 3:1 / 4:1 / 5:1, output PNG */}
      <BrandLogoModal
        isOpen={isBrandLogoModalOpen}
        imageSrc={brandLogoImageSrc}
        onCancel={() => {
          setIsBrandLogoModalOpen(false);
          setBrandLogoImageSrc(null);
        }}
        onSave={handleBrandLogoSave}
        language={currentLang}
      />
    </div>
  );
}