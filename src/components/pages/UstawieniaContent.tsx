// src/components/pages/SettingsContent.tsx
'use client';

import DiskExplorerModal from '@/components/ui/DiskExplorerModal';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  User, Key, Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle, Loader2,
  Palette, Type, ChevronDown, Check, Image as ImageIcon, X, AlertTriangle, FolderOpen,
  Shield, CreditCard, ShieldCheck, Smartphone, RotateCcw // <--- DODANO RotateCcw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import UpgradeModal from '@/components/ui/UpgradeModal';

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
    modelDescGptImage1: 'Premium ($0.19) - wymaga klucza'
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
    modelDescGptImage1: 'Premium ($0.19) - key required'
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
                (window as any).openUpgradeModal();
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
            onClick={() => { (window as any).openUpgradeModal(); }}
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

  // Globalna funkcja do otwierania modala (Krok 37)
  useEffect(() => {
    const openModal = () => setIsUpgradeModalOpen(true);
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
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isActivatingPlan, setIsActivatingPlan] = useState(false);
  // Stan dla modala weryfikacji (PL)
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  // Zmiana: null oznacza brak akcji, 'card' lub 'blik' oznacza przetwarzanie konkretnej opcji
  const [processingType, setProcessingType] = useState<'card' | 'blik' | null>(null);
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
      {/* Author Profile */}
      <div className="bg-white rounded-xl border border-gray-200 px-3 py-4 sm:p-6">
        <div className="flex items-center mb-6">
          <User className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-900">{t.authorProfile}</h2>
          {isLoadingAuthorSettings && (
            <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
          )}
        </div>

        {/* === ZMIANA (Task 1): Nowy układ pulpitu === */}
        {/* ZMIANA: Na desktopie (lg) zerujemy gap, bo odstępy zrobimy paddingiem przy linii */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0">

          {/* --- LEWA KOLUMNA (Nazwa + Logo) --- */}
          {/* ZMIANA: Dodano delikatną linię po prawej (border-r) i duży padding (pr-8 lub pr-12) dla oddechu */}
          <div className="space-y-6 lg:border-r lg:border-gray-200 lg:pr-12">
            {/* Nazwa Autora */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.authorName}</label>
              <div className="relative">
                <input
                  type="text"
                  value={settings.username}
                  onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                  placeholder={t.usernamePlaceholder}
                  // ZMIANA: bg-gray-50 (kolor Ownera), border-gray-200 i rounded-xl (styl ramki Current Plan)
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 pr-28 transition-colors"
                />
                {settings.username !== lastSavedUsername && settings.username.trim() !== '' && (
                  <button
                    onClick={handleSaveUsername}
                    disabled={isSavingUsername}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {isSavingUsername ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1.5" />
                        {t.save}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Logo Autora */}
            {/* Logo Autora */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.authorLogo}</label>
              <div className="relative group">
                {settings.logo || isUploadingAvatar ? (
                  <div
                    className={`relative border border-gray-200 rounded-xl overflow-hidden flex items-center justify-center bg-white shadow-sm h-auto min-h-[120px] sm:h-[200px] ${canCustomizeLogo ? 'cursor-pointer hover:border-gray-300' : 'cursor-not-allowed'}`}
                    style={{
                      width: '100%',
                      padding: '16px'
                    }}
                    onClick={triggerFileInput}
                  >
                    {isUploadingAvatar ? (
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <span className="text-sm font-medium">{t.processing}</span>
                      </div>
                    ) : (
                      <img
                        src={settings.logo!}
                        alt="Logo"
                        className="max-w-full max-h-full"
                        style={{
                          objectFit: 'contain',
                          width: 'auto',
                          height: 'auto',
                          maxWidth: '100%',
                          maxHeight: '100%'
                        }}
                        key={settings.logo}
                        onLoad={handleImageLoad}
                        onError={(e) => {
                          console.error('❌ Error loading image:', settings.logo);
                          resetImageAspectRatio();
                        }}
                      />
                    )}
                    {isDeletingAvatar && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      </div>
                    )}

                    {/* OVERLAY BLOKADY - BEZ PRZYCISKU */}
                    {!canCustomizeLogo && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-4">
                        <div className="text-center space-y-2">
                          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                          <p className="text-white text-sm font-medium">{t.logoRestrictedTitle}</p>
                          {/* Przycisk został całkowicie usunięty */}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label
                    onClick={triggerFileInput}
                    className={`w-full h-40 sm:h-48 bg-white border-2 border-dashed border-gray-200 rounded-xl ${canCustomizeLogo ? 'cursor-pointer hover:border-gray-400 hover:bg-gray-100' : 'cursor-not-allowed'} transition-colors flex flex-col items-center justify-center relative`}>
                    {isUploadingAvatar ? (
                      <>
                        <Loader2 className="h-8 w-8 text-gray-400 mb-2 animate-spin" />
                        <span className="text-sm font-medium text-gray-600">{t.uploading}</span>
                        <span className="text-xs text-gray-500">{t.processingAvatar}</span>
                      </>
                    ) : (
                      <>
                        <div className="p-3 bg-gray-50 rounded-full mb-3">
                           <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{t.addLogo}</span>
                        <span className="text-xs text-gray-500 mt-1">{t.logoFormats}</span>
                      </>
                    )}

                    {/* OVERLAY BLOKADY (Stan pusty) - BEZ PRZYCISKU */}
                    {!canCustomizeLogo && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-4 rounded-xl">
                        <div className="text-center space-y-2">
                          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                          <p className="text-white text-sm font-medium">{t.logoRestrictedTitle}</p>
                          {/* Przycisk został całkowicie usunięty */}
                        </div>
                      </div>
                    )}
                  </label>
                )}
              </div>
              {canCustomizeLogo && (
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploadingAvatar || isDeletingAvatar}
                  ref={fileInputRef}
                />
              )}
              {canCustomizeLogo && settings.logo !== defaultAppLogoUrl && !isUploadingAvatar && (
                <button
                  onClick={removeLogo}
                  disabled={isDeletingAvatar}
                  className="mt-2 w-full flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ImageIcon className="h-4 w-4 mr-2" />
                  )}
                  {t.restoreDefaultLogo}
                </button>
              )}
              <p className="text-xs text-gray-500 mt-1">{t.logoHint}</p>
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

      {/* Disk Explorer Modal */}
      {isDiskExplorerOpen && (
        <DiskExplorerModal
          isOpen={isDiskExplorerOpen}
          onClose={() => setIsDiskExplorerOpen(false)}
        />
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur cursor-pointer" onClick={closeConfirmModal} />
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
                  {t.confirmRemove}
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
    </div>
  );
}