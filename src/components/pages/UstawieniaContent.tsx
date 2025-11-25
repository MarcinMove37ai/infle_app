// src/components/pages/SettingsContent.tsx
'use client';

import DiskExplorerModal from '@/components/ui/DiskExplorerModal';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  User, Key, Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle, Loader2,
  Palette, Type, ChevronDown, Check, Image as ImageIcon, X, AlertTriangle, FolderOpen,
  Shield, CreditCard
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

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
    planDescriptionFree: 'Darmowy plan startowy',
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
    renewsAt: 'Odnowienie:',
    manageSubscription: 'Zarządzaj subskrypcją',
    managePlan: 'Zarządzaj planem',
    verifyPayment: 'Weryfikacja tożsamości',
    billingAmount: 'Kwota:',
    nextPaymentAmount: 'Następna płatność:',

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

    // Modal anulowania subskrypcji
    confirmCancelSubTitle: 'Anuluj Subskrypcję',
    confirmCancelSubMsg: 'Czy na pewno chcesz anulować subskrypcję? Dostęp pozostanie aktywny do końca bieżącego okresu rozliczeniowego.',

    authorLogo: 'Logo Autora / Zdjęcie',
    processing: 'Przetwarzanie...',
    logoRestrictedTitle: 'Własne logo dostępne w płatnych planach',
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
    planDescriptionFree: 'Free starter plan',
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
    verifyPayment: 'Verify Payment Method',
    billingAmount: 'Amount:',
    nextPaymentAmount: 'Next payment:',

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

    // Cancel subscription modal
    confirmCancelSubTitle: 'Cancel Subscription',
    confirmCancelSubMsg: 'Are you sure you want to cancel? Your access will remain active until the end of your billing period.',

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

// Komponent Subscription Card
interface SubscriptionCardProps {
  lang: 'pl' | 'en';
  t: typeof translations['pl'];
  compact?: boolean;
  subscriptionData: SubscriptionData | null;
  loading: boolean;
  setConfirmModal: (modalData: { // <-- Nowy prop
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }) => void;
}

function SubscriptionCard({
  lang,
  t,
  compact = false,
  subscriptionData,
  loading,
  setConfirmModal // <-- Nowy prop
}: SubscriptionCardProps) {

  // ... (usunięto wewnętrzny stan i useEffect) ...



  // Helper function to translate plan names and descriptions
  const translatePlan = (key: string) => {
    return (t as any)[key] || key;
  };

  const handleCancelClick = () => {
    setConfirmModal({
      isOpen: true,
      title: t.confirmCancelSubTitle,
      message: t.confirmCancelSubMsg,
      onConfirm: () => {
        console.log("TODO: Wywołanie API do anulowania subskrypcji Stripe");
        // Po potwierdzeniu, zamknij modal
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        // TODO: Można dodać toast o sukcesie/błędzie i odświeżyć dane
      }
    });
  };

  if (loading) {
    return (
      <div className={compact ? "" : "bg-white rounded-xl border border-gray-200 p-6"}>
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (compact) {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t.subscription}</label>

        <div className="lg:grid lg:grid-cols-1 lg:gap-4"> {/* Zmieniono na 1 kolumnę (dla prawej strony) */}
          {/* Left Column - Plan Card */}
          <div className="space-y-4 lg:min-h-full lg:flex lg:flex-col">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 lg:flex-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide">{t.currentPlan}</p>
                  <p className="text-xl font-bold text-gray-900">{translatePlan(subscriptionData?.plan || 'planFree')}</p>
                </div>
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
              {subscriptionData?.planDescription && (
                <p className="text-sm text-gray-600">{translatePlan(subscriptionData.planDescription)}</p>
              )}
            </div>

          </div>

          {/* Right Column - Features & Limitation */}
          <div className="space-y-4 mt-4 lg:mt-0">
            {/* Trial/Billing Info (Przeniesione) */}
            {subscriptionData?.isTrialing && subscriptionData?.nextBillingDate && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-medium text-blue-900">
                      {t.trialEnds}: {formatDate(subscriptionData.nextBillingDate)}
                    </p>
                    <p className="text-blue-700 mt-0.5">
                      {t.nextPaymentAmount} {subscriptionData.nextBillingAmount}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Next Billing Info (Przeniesione i Zmienione) */}
            {!subscriptionData?.isTrialing && subscriptionData?.nextBillingDate && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-medium text-gray-700 mb-1">{t.nextBilling}</p>
                <div className="flex items-baseline justify-between">
                   <p className="text-sm text-gray-900">{formatDate(subscriptionData.nextBillingDate)}</p>
                   {subscriptionData?.nextBillingAmount && (
                     <p className="text-sm text-gray-600">{t.billingAmount} {subscriptionData.nextBillingAmount}</p>
                   )}
                </div>
              </div>
            )}

            {/* Features (USUNIĘTE) */}
            {/* {subscriptionData?.features && subscriptionData.features.length > 0 && (...)} */}

            {/* Payment Management (Tasks 3, 4, 5) */}
            {subscriptionData?.role !== 'free' && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">{t.managePaymentMethods}</p>
                <div className="space-y-3">
                  {/* Task 5: Payment Method (Zmienione) */}
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-700 mb-1">{t.currentPaymentMethod}</p>
                    {/* TODO: Ta dana (np. "Visa **** 4242") musi przyjść z API */}
                    <p className="text-sm text-gray-500 truncate">{t.paymentMethodPlaceholder}</p>
                  </div>
                  {/* Task 4: Billing History */}
                  <button
                    onClick={() => console.log('Redirect to Stripe Billing History')}
                    className="w-full text-left inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    {t.billingHistory}
                  </button>
                  {/* Task 3: Cancel Subscription */}
                  <button
                    onClick={handleCancelClick}
                    className="w-full text-left inline-flex items-center px-3 py-2 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    {t.cancelSubscription}
                  </button>
                </div>
              </div>
            )}

            {/* Limitation Warning */}
            {subscriptionData?.limitation && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">{t.limitationPublish}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {subscriptionData?.role === 'free' ? (
            <Link
              href="/pricing" // Link do weryfikacji/cen
              className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t.verifyPayment}
            </Link>
          ) : (
            // Dla free_ver, rookie, creator, unlimited
            <button
              onClick={() => {
                // Zawsze otwieraj modal zarządzania planem
                (window as any).openUpgradeModal();
              }}
              className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {t.managePlan}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Tryb pełny (standalone card)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center mb-6">
        <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
        <h2 className="text-xl font-bold text-gray-900">{t.subscription}</h2>
      </div>

      <div className="space-y-4">
        {/* Plan Name */}
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

        {/* Trial Information */}
        {subscriptionData?.isTrialing && subscriptionData?.nextBillingDate && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  {t.trialEnds}: {formatDate(subscriptionData.nextBillingDate)}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  {t.nextPaymentAmount} {subscriptionData.nextBillingAmount}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active Subscription Information */}
        {!subscriptionData?.isTrialing && subscriptionData?.nextBillingDate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.nextBilling}
            </label>
            <p className="text-sm text-gray-900">
              {formatDate(subscriptionData.nextBillingDate)}
            </p>
            {subscriptionData?.nextBillingAmount && (
              <p className="text-xs text-gray-500">
                {t.billingAmount} {subscriptionData.nextBillingAmount}
              </p>
            )}
          </div>
        )}

        {/* Features List (USUNIĘTE) */}
        {/* {subscriptionData?.features && subscriptionData.features.length > 0 && (...)} */}

        {/* Payment Management (Tasks 3, 4, 5) */}
        {subscriptionData?.role !== 'free' && (
          <div className="pt-4 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.managePaymentMethods}
            </label>
            <div className="space-y-3">
              {/* Task 5: Payment Method */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-medium text-gray-700">{t.currentPaymentMethod}</p>
                {/* TODO: Ta dana (np. "Visa **** 4242") musi przyjść z API */}
                <p className="text-sm text-gray-500 mt-1">{t.paymentMethodPlaceholder}</p>
              </div>
              {/* Task 4: Billing History */}
              <button
                onClick={() => console.log('Redirect to Stripe Billing History')}
                className="w-full text-left inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                {t.billingHistory}
              </button>
              {/* Task 3: Cancel Subscription */}
              <button
                onClick={handleCancelClick} // Ta sama funkcja
                className="w-full text-left inline-flex items-center px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
              >
                {t.cancelSubscription}
              </button>
            </div>
          </div>
        )}

        {/* Limitation Warning */}
        {subscriptionData?.limitation && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                {t.limitationPublish}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 border-t border-gray-200">
          {subscriptionData?.role === 'free' ? (
            <Link
              href="/pricing" // Link do weryfikacji/cen
              className="w-full inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t.verifyPayment}
            </Link>
          ) : (
            // Dla free_ver, rookie, creator, unlimited
            <button
              onClick={() => {
                // Zawsze otwieraj modal zarządzania planem
                (window as any).openUpgradeModal();
              }}
              className="w-full inline-flex justify-center items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {t.managePlan}
            </button>
          )}
        </div>
      </div>
    </div>
  ); // <-- ZAMKNIĘCIE `return ()`
} // <-- ZAMKNIĘCIE `function SubscriptionCard()`

  // --- Komponent Upgrade Modal ---
interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: typeof translations['pl'];
  currentLang: 'pl' | 'en';
  currentPlanRole: string; // np. 'rookie', 'creator'
}

function UpgradeModal({ isOpen, onClose, t, currentLang, currentPlanRole }: UpgradeModalProps) {
  // Definicja planów dla modala (inspirowane landing page)
  const modalPlans = [
    {
      roleName: 'rookie',
      planKey: 'planRookie',
      descriptionKey: 'planDescriptionRookie',
      price: '29 zł', // Cena miesięczna (jak 'card' na landingu)
      currencyKey: 'pricing.currencyPerMonth', // Klucz z landing page, musimy go dodać
      featuresKeys: ['featureRookie1', 'featureRookie2', 'featureRookie3'],
      planPath: '/free' // Ścieżka rejestracji z landing page
    },
    {
      roleName: 'creator',
      planKey: 'planCreator',
      descriptionKey: 'planDescriptionCreator',
      price: '87 zł', // Cena miesięczna
      currencyKey: 'pricing.currencyPerMonth',
      featuresKeys: ['featureCreator1', 'featureCreator2', 'featureCreator3'],
      planPath: '/crea', // Ścieżka rejestracji
      highlighted: true
    },
    {
      roleName: 'unlimited',
      planKey: 'planUnlimited',
      descriptionKey: 'planDescriptionUnlimited',
      price: '299 zł', // Cena miesięczna
      currencyKey: 'pricing.currencyPerMonth',
      featuresKeys: ['featureUnlimited1', 'featureUnlimited2', 'featureUnlimited3'],
      planPath: '/inf' // Ścieżka rejestracji
    }
  ];

  // Tłumaczenie zastępcze, gdyby klucza brakowało
  const translate = (key: string, fallback: string = '') => (t as any)[key] || fallback || key;

  // Dodajemy brakujące tłumaczenie waluty (z landing page)
  if (!(t as any)['pricing.currencyPerMonth']) {
    (t as any)['pricing.currencyPerMonth'] = currentLang === 'pl' ? '/ mies.' : '/ mo.';
  }

  const getButton = (plan: typeof modalPlans[0], isCurrent: boolean) => {
    const planName = translate(plan.planKey);
    const targetUrl = `https://app.inflee.app/register${plan.planPath}?lang=${currentLang}`;

    // --- ZUNIFIKOWANA LOGIKA (ZADANIE 1 i 3) ---
    // 1. Jeśli to jest aktualny plan, ZAWSZE pokaż zablokowany przycisk
    if (isCurrent) {
      // Wspólna klasa dla wszystkich zablokowanych przycisków
      // Definiujemy styl na podstawie tego, czy był podświetlony, czy nie
      const disabledClass = `w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all opacity-50 cursor-not-allowed text-center ${
        plan.highlighted
          ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
          // Sprawdzamy specjalny styl dla zablokowanego Unlimited
          : (plan.roleName === 'unlimited' ? 'bg-gray-600 text-white' : 'bg-white/10 border border-white/10 text-white')
      }`;

      return (
        <button disabled className={disabledClass}>
          {t.currentPlanBadge}
        </button>
      );
    }

    // --- ZUNIFIKOWANA LOGIKA (ZADANIE 2) ---
    // 2. Jeśli to NIE jest aktualny plan, pokaż klikalny link <a> stylizowany na przycisk

    let buttonClass = '';

    if (plan.roleName === 'unlimited') {
      // Przycisk "Unlimited" (Z wyśrodkowaniem `inline-flex justify-center`)
      buttonClass = `w-full inline-flex justify-center items-center py-3 px-4 rounded-lg font-semibold text-sm transition-all shadow-md bg-gray-600 text-white hover:bg-gray-700 cursor-pointer`;
    } else {
      // Przycisk "Rookie" lub "Creator"
      buttonClass = `w-full inline-flex justify-center items-center py-3 px-4 rounded-lg font-semibold text-sm transition-all shadow-md cursor-pointer ${
        plan.highlighted
          ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_10px_20px_rgba(139,92,246,0.20)] hover:shadow-[0_15px_25px_rgba(139,92,246,0.30)] hover:-translate-y-0.5'
          : 'bg-white/10 border border-white/10 hover:bg-white/20 text-white'
      }`;
    }

    return (
      <a
        href={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
      >
        {t.upgradeTo.replace('{planName}', planName)}
      </a>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 flex justify-center items-start">
      {/* Tło */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Kontener Modala (ZMIANA Task 5) */}
      <div className="relative bg-gray-900 bg-opacity-80 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl p-6 sm:p-8 max-w-6xl w-full my-8 text-white">

        {/* Przycisk zamknięcia */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Nagłówek (ZMIANA Task 5) */}
        <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            {t.upgradeModalTitle}
          </h2>
          <p className="mt-3 text-lg text-gray-400">
            {t.upgradeModalSubtitle}
          </p>
        </div>

        {/* Karty Planów */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {modalPlans.map((plan) => {
            const isCurrent = plan.roleName === currentPlanRole || (plan.roleName === 'rookie' && currentPlanRole === 'free_ver');
            return (
              <div
                key={plan.roleName}
                className={`relative rounded-2xl p-0.5 ${
                  plan.highlighted ? 'bg-gradient-to-b from-purple-500 to-indigo-500' : ''
                }`}
              >
                <div className={`relative bg-gray-950 backdrop-blur-sm rounded-[15px] h-full flex flex-col p-6 ${
                  !plan.highlighted ? 'border-2 border-purple-500/20' : ''
                }`}>

                  {isCurrent && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                        {t.currentPlanBadge}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col h-full">
                    <h3 className="text-2xl font-bold text-white mb-2">{translate(plan.planKey)}</h3>
                    {/* ZMIANA (Task 5): Poprawka wysokości opisu */}
                    <p className="text-sm text-gray-400 mb-6 min-h-[40px]">{translate(plan.descriptionKey)}</p>

                    <div className="mb-6 flex flex-col items-center justify-center">
                      <div className="border border-purple-500/30 rounded-xl px-6 py-3">
                        <div className="text-4xl font-bold text-white flex items-baseline">
                          <span>{plan.price}</span>
                          <span className="text-xl font-medium text-gray-400 ml-2">{translate(plan.currencyKey)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-8 mt-auto">
                      {getButton(plan, isCurrent)}
                    </div>

                    <div className="flex-grow">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t.features}:</div>
                      {plan.featuresKeys.map((featureKey, index) => (
                        <div key={index} className="flex items-start mb-3">
                          <Check className="w-5 h-5 text-indigo-400 mr-3 flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-gray-300 leading-relaxed">{translate(featureKey)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
      const restricted = new Set(['free', 'free_ver', 'rookie']);

      // Jeśli rola nie jest określona (np. ładowanie), blokuj
      if (!role) return false;

      // Zwróć 'true' (może edytować), jeśli rola NIE ZNAJDUJE SIĘ na liście zablokowanych
      return !restricted.has(role);

  }, [subscriptionData]); // Zależność od aktualnych danych subskrypcji

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const defaultAppLogoUrl = `${baseUrl}/api/assets/uploads/logo_inflee.webp`;
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

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isDiskExplorerOpen, setIsDiskExplorerOpen] = useState(false); // <--- Przeniesione z dołu
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

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

  // useEffect do ładowania danych subskrypcji (przeniesiony z SubscriptionCard)
  useEffect(() => {
    if (user?.id) {
      async function fetchSubscriptionStatus() {
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
      }

      fetchSubscriptionStatus();
    }
  }, [user?.id]); // Uruchom, gdy user.id jest dostępne

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
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
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
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const triggerFileInput = useCallback(() => {
    if (canCustomizeLogo) {
      fileInputRef.current?.click();
    }
  }, [canCustomizeLogo]);

  return (
    <div className="space-y-8">
      {/* Author Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <User className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-900">{t.authorProfile}</h2>
          {isLoadingAuthorSettings && (
            <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
          )}
        </div>

        {/* === ZMIANA (Task 1): Nowy układ pulpitu === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* --- LEWA KOLUMNA (Nazwa + Logo) --- */}
          <div className="space-y-6">
            {/* Nazwa Autora */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.authorName}</label>
              <div className="relative">
                <input
                  type="text"
                  value={settings.username}
                  onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                  placeholder={t.usernamePlaceholder}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 pr-28"
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

            {/* Logo Autora (Przeniesione) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.authorLogo}</label>
              <div className="relative group">
                {settings.logo || isUploadingAvatar ? (
                  <div
                    // === ZMIANA (Task 4): Poprawka kursora ===
                    className={`relative border-2 border-gray-200 rounded-lg overflow-hidden flex items-center justify-center bg-white ${canCustomizeLogo ? 'cursor-pointer hover:border-gray-300' : 'cursor-not-allowed'}`}
                    style={{
                      width: '100%',
                      height: '200px',
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
                    {!canCustomizeLogo && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-4">
                        <div className="text-center space-y-2">
                          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                          <p className="text-white text-sm font-medium">{t.logoRestrictedTitle}</p>
                          <button
                            onClick={() => (window as any).openUpgradeModal()}
                            className="inline-flex items-center px-3 py-1.5 bg-white text-gray-900 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3 mr-1.5" />
                            {t.logoRestrictedBtn}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label
                    onClick={triggerFileInput}
                    className={`w-full h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${canCustomizeLogo ? 'cursor-pointer hover:border-gray-400 hover:bg-gray-100' : 'cursor-not-allowed'} transition-colors flex flex-col items-center justify-center relative`}>
                    {isUploadingAvatar ? (
                      <>
                        <Loader2 className="h-8 w-8 text-gray-400 mb-2 animate-spin" />
                        <span className="text-sm font-medium text-gray-600">{t.uploading}</span>
                        <span className="text-xs text-gray-500">{t.processingAvatar}</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-600">{t.addLogo}</span>
                        <span className="text-xs text-gray-500">{t.logoFormats}</span>
                      </>
                    )}
                    {!canCustomizeLogo && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-4 rounded-lg">
                        <div className="text-center space-y-2">
                          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                          <p className="text-white text-sm font-medium">{t.logoRestrictedTitle}</p>
                          <button
                            onClick={() => (window as any).openUpgradeModal()}
                            className="inline-flex items-center px-3 py-1.5 bg-white text-gray-900 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3 mr-1.5" />
                            {t.logoRestrictedBtn}
                          </button>
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
            <div>
              <SubscriptionCard
                lang={currentLang}
                t={t}
                compact={true}
                subscriptionData={subscriptionData}
                loading={isSubscriptionLoading}
                setConfirmModal={setConfirmModal}
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
          <div className="bg-white border border-gray-200 rounded-xl p-6 relative">
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
          <div className="bg-white border border-gray-200 rounded-xl p-6 relative">
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
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