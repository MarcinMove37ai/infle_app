// src/components/pages/UstawieniaContent.tsx
'use client';

import DiskExplorerModal from '@/components/ui/DiskExplorerModal';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User, Key, Eye, EyeOff, Save, Trash2, CheckCircle, AlertCircle, Loader2,
  Palette, Type, ChevronDown, Check, Image as ImageIcon, X, AlertTriangle, FolderOpen
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
  // ✅ DODANE: Pola AI z endpointu
  textAiProvider: string | null;
  textAiModel: string | null;
  imageAiProvider: string | null;
  imageAiModel: string | null;
}

// Konfiguracja providerów tekstu
const TEXT_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    available: true,
    models: [
      { id: 'claude-3-haiku', name: 'Claude Haiku 3.5', description: 'Dostępny bezpłatnie przez 30 dni', tier: 'basic' },
      { id: 'claude-3-sonnet', name: 'Claude Sonnet 4', description: 'Input $3 / MTo | Output $15 / MTok', tier: 'premium', cost: '$0.025' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    available: false,
    models: [{ id: 'gpt-4o', name: 'GPT-4o', description: 'Najnowszy model ($0.030)', tier: 'premium', cost: '$0.030' }]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    available: false,
    models: [{ id: 'gemini-pro', name: 'Gemini Pro', description: 'Model Google ($0.020)', tier: 'premium', cost: '$0.020' }]
  },
  {
    id: 'grok',
    name: 'Grok (X.AI)',
    icon: '⚡',
    available: false,
    models: [{ id: 'grok-2', name: 'Grok 2', description: 'Model X.AI ($0.040)', tier: 'premium', cost: '$0.040' }]
  },
  {
    id: 'bielik',
    name: 'Bielik',
    icon: '🦅',
    available: false,
    models: [{ id: 'bielik-11b', name: 'Bielik 11B', description: 'Polski model ($0.015)', tier: 'premium', cost: '$0.015' }]
  }
];

// 🆕 ZAKTUALIZOWANA Konfiguracja providerów obrazów z Google
const IMAGE_PROVIDERS = [
  {
    id: 'google',
    name: 'Google AI',
    icon: '✨',
    available: true, // 🆕 ODBLOKOWANY
    models: [
      {
        id: 'imagen-3',
        name: 'Imagen 3',
        description: 'Dostępny bezpłatnie przez 30 dni',
        tier: 'basic'
      },
      {
        id: 'imagen-4',
        name: 'Imagen 4',
        description: 'Wysoka jakość ($0.04) - wymaga własnego klucza API',
        tier: 'premium',
        cost: '$0.04'
      },
      {
        id: 'imagen-4-ultra',
        name: 'Imagen 4 Ultra',
        description: 'Najwyższa jakość ($0.06) - wymaga własnego klucza API',
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
        description: 'Standardowy - bez klucza',
        tier: 'basic'
      },
      {
        id: 'gpt-image-1',
        name: 'GPT-Image-1',
        description: 'Premium ($0.19) - wymaga klucza',
        tier: 'premium',
        cost: '$0.19'
      },
    ]
  }
];

export default function UstawieniaContent() {
  const { user } = useAuth();

  // 🆕 ZMIANA: Domyślny provider na Google i model na Imagen 3
  const [settings, setSettings] = useState<UserSettings>({
    username: '',
    logo: null,
    textProvider: 'anthropic',
    textModel: 'claude-3-haiku',
    imageProvider: 'google', // 🆕 ZMIANA: Google domyślny
    imageModel: 'imagen-3'   // 🆕 ZMIANA: Imagen 3 domyślny
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
    google: { value: '', showValue: false, isSaved: false } // 🆕 ZMIANA: 'google' zamiast 'gemini'
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
  const [isDiskExplorerOpen, setIsDiskExplorerOpen] = useState(false);
  // ✅ NOWE: Funkcje do zarządzania kluczami API
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
        console.log('✅ Pobrano status kluczy API:', data);

        // Aktualizuj stan kluczy na podstawie odpowiedzi z serwera
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
        console.error('❌ Błąd pobierania statusu kluczy API:', response.status);
        setMessage({ type: 'error', text: 'Nie udało się pobrać statusu kluczy API' });
      }
    } catch (error) {
      console.error('❌ Błąd sieci przy pobieraniu statusu kluczy API:', error);
      setMessage({ type: 'error', text: 'Błąd połączenia z serwerem' });
    } finally {
      setIsLoadingApiKeys(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [user?.id]);

  // ✅ NOWE: Aktualizacja ustawień AI w tabeli users
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
        console.log('✅ Zaktualizowano ustawienia AI:', updateData);
      } else {
        console.error('❌ Błąd zapisu ustawień AI:', response.status);
      }
    } catch (error) {
      console.error('❌ Błąd sieci przy zapisie ustawień AI:', error);
    } finally {
      setIsSavingAiSettings(false);
    }
  }, [user?.id, isSavingAiSettings]);

  // ✅ NOWE: Funkcje helper dla aspect ratio - MUSZĄ BYĆ PRZED useEffect
  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    setImageAspectRatio(aspectRatio);
    console.log(`🔍 Proporcje obrazu: ${img.naturalWidth}x${img.naturalHeight}, ratio: ${aspectRatio.toFixed(2)}`);
  }, []);

  const resetImageAspectRatio = useCallback(() => {
    setImageAspectRatio(null);
  }, []);

  // Inicjalizacja username tylko raz gdy user się zmieni
  useEffect(() => {
    if (user) {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
      if (fullName && fullName !== initialUsername) {
        setSettings(prev => ({ ...prev, username: fullName }));
        setInitialUsername(fullName);
        setLastSavedUsername(fullName);
      }
    }
  }, [user]); // ✅ USUNIĘTO initialUsername z zależności - zapobiega zapętleniu

  // ✅ Pobierz ustawienia autora tylko raz przy załadowaniu
  useEffect(() => {
    let isMounted = true; // Zapobiega aktualizacji po unmount

    if (user?.id) {
      // ✅ Inline async function aby uniknąć dependency na fetchAuthorSettings
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

            // ✅ Dodaj cache busting do istniejącego avatara
            let logoUrl = authorSettings.authorLogoUrl;
            if (logoUrl) {
              const separator = logoUrl.includes('?') ? '&' : '?';
              logoUrl = `${logoUrl}${separator}t=${Date.now()}`;
            }

            // Aktualizuj settings z danymi z serwera
            setSettings(prev => ({
              ...prev,
              username: authorSettings.authorDisplayName || authorSettings.fallbackName,
              logo: logoUrl,
              // ✅ DODANE: Aktualizuj ustawienia AI z serwera - Z GOOGLE DOMYŚLNYM
              textProvider: authorSettings.textAiProvider || 'anthropic',
              textModel: authorSettings.textAiModel || 'claude-3-haiku',
              imageProvider: authorSettings.imageAiProvider || 'google', // 🆕 ZMIANA
              imageModel: authorSettings.imageAiModel || 'imagen-3' // 🆕 ZMIANA
            }));

            // Ustaw jako zapisane
            setLastSavedUsername(authorSettings.authorDisplayName || authorSettings.fallbackName);

            console.log('✅ Pobrano ustawienia autora:', authorSettings);
            console.log('🔧 Załadowane ustawienia AI z serwera:', {
              textProvider: authorSettings.textAiProvider || 'anthropic (default)',
              textModel: authorSettings.textAiModel || 'claude-3-haiku (default)',
              imageProvider: authorSettings.imageAiProvider || 'google (default)', // 🆕 ZMIANA
              imageModel: authorSettings.imageAiModel || 'imagen-3 (default)' // 🆕 ZMIANA
            });
          } else if (isMounted) {
            console.error('❌ Błąd pobierania ustawień autora:', response.status);
            setMessage({ type: 'error', text: 'Nie udało się pobrać ustawień autora' });
          }
        } catch (error) {
          if (isMounted) {
            console.error('❌ Błąd sieci przy pobieraniu ustawień autora:', error);
            setMessage({ type: 'error', text: 'Błąd połączenia z serwerem' });
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
  }, [user?.id]); // ✅ Tylko user?.id w zależnościach

  // ✅ NOWE: Ładowanie statusu kluczy API przy inicjalizacji
  useEffect(() => {
    if (user?.id) {
      loadApiKeysStatus();
    }
  }, [user?.id, loadApiKeysStatus]);

  // ✅ Reset aspect ratio gdy logo zostanie usunięte
  useEffect(() => {
    if (!settings.logo) {
      resetImageAspectRatio();
    }
  }, [settings.logo, resetImageAspectRatio]);

  // ✅ Cleanup blob URLs przy unmount
  useEffect(() => {
    return () => {
      if (settings.logo && settings.logo.startsWith('blob:')) {
        URL.revokeObjectURL(settings.logo);
      }
    };
  }, [settings.logo]);

  // Memoizowane funkcje pomocnicze
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

  // Memoizowane klucze API
  const currentTextApiKey = useMemo(() =>
    apiKeys[settings.textProvider],
    [apiKeys, settings.textProvider]
  );

  const currentImageApiKey = useMemo(() => {
    // 🆕 ZMIANA: Mapowanie provider ID na klucz API
    const providerKeyMap: Record<string, string> = {
      'google': 'google',
      'openai': 'openai'
    };
    const keyName = providerKeyMap[settings.imageProvider] || settings.imageProvider;
    return apiKeys[keyName];
  }, [apiKeys, settings.imageProvider]);

  // 🆕 ROZSZERZONA Walidacja API key - obsługuje Google
  const isValidApiKey = useCallback((provider: string, key: string): boolean => {
    if (!key || key.length < 20) return false;
    switch (provider) {
      case 'anthropic': return key.startsWith('sk-ant-');
      case 'openai': return key.startsWith('sk-');
      case 'google': return key.startsWith('AIza'); // 🆕 DODANE: Google API key validation
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

  // 🆕 ROZSZERZONA funkcja placeholder - obsługuje Google
  const getApiKeyPlaceholder = useCallback((provider: string) => {
    switch (provider) {
      case 'anthropic': return 'sk-ant-... lub sk-ant-api03-...';
      case 'openai': return 'sk-...';
      case 'google': return 'AIza... (z Google AI Studio)'; // 🆕 DODANE
      default: return 'Wklej klucz API';
    }
  }, []);

  // Obsługa dropdown
  const toggleDropdown = useCallback((dropdown: keyof typeof dropdowns) => {
    setDropdowns(prev => ({
      textProvider: false,
      textModel: false,
      imageProvider: false,
      imageModel: false,
      [dropdown]: !prev[dropdown]
    }));
  }, []);

  // 🆕 POPRAWIONA Obsługa kluczy API - bezpieczna aktualizacja
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
        showValue: prev[keyName]?.showValue || false, // Bezpieczny dostęp do poprzedniej wartości
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
      // ✅ Warunek zabezpieczający przed operacją na undefined
      if (!currentKey) {
        return prev; // Nie rób nic, jeśli klucz nie istnieje
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
          provider: keyName, // Używaj zmapowanego keyName
          apiKey: keyInfo.value
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Klucz API zapisany:', data);

        // Wyczyść wprowadzony klucz i oznacz jako zapisany
        setApiKeys(prev => ({
          ...prev,
          [keyName]: { ...prev[keyName], value: '', showValue: false, isSaved: true }
        }));

        setMessage({ type: 'success', text: `Klucz API dla ${providerName} został zapisany.` });
      } else {
        const errorData = await response.json();
        console.error('❌ Błąd zapisywania klucza API:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || `Nie udało się zapisać klucza API dla ${providerName}`
        });
      }
    } catch (error) {
      console.error('❌ Błąd sieci przy zapisywaniu klucza API:', error);
      setMessage({ type: 'error', text: 'Błąd połączenia z serwerem' });
    } finally {
      setSavingApiKey(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [apiKeys, isValidApiKey, savingApiKey]);

  const removeApiKey = useCallback((provider: string) => {
    const providerName = TEXT_PROVIDERS.find(p=>p.id === provider)?.name || IMAGE_PROVIDERS.find(p=>p.id === provider)?.name || provider;
    setConfirmModal({
      isOpen: true,
      title: 'Usuń klucz API',
      message: `Czy na pewno chcesz usunąć klucz API ${providerName}?`,
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
            console.log('✅ Klucz API usunięty:', data);

            // Zaktualizuj stan lokalny
            setApiKeys(prev => ({
              ...prev,
              [keyName]: { value: '', showValue: false, isSaved: false }
            }));

            // ✅ NOWE: Automatyczne przełączenie na model basic po usunięciu klucza
            const settingsToUpdate: Partial<UserSettings> = {};

            // Sprawdź czy usunięty klucz dotyczył text providera
            if (settings.textProvider === provider) {
              const currentTextProvider = TEXT_PROVIDERS.find(p => p.id === provider);
              const currentTextModel = currentTextProvider?.models.find(m => m.id === settings.textModel);

              if (currentTextModel?.tier === 'premium') {
                // Znajdź pierwszy dostępny model basic w tym providerze
                const basicModel = currentTextProvider?.models.find(m => m.tier === 'basic');
                if (basicModel) {
                  settingsToUpdate.textModel = basicModel.id;
                  setSettings(prev => ({ ...prev, textModel: basicModel.id }));
                  console.log(`🔄 Przełączono na model basic: ${basicModel.name}`);
                } else {
                  // Jeśli provider nie ma modelu basic, przełącz na anthropic (który ma haiku basic)
                  const anthropicProvider = TEXT_PROVIDERS.find(p => p.id === 'anthropic');
                  const anthropicBasic = anthropicProvider?.models.find(m => m.tier === 'basic');
                  if (anthropicBasic) {
                    settingsToUpdate.textProvider = 'anthropic';
                    settingsToUpdate.textModel = anthropicBasic.id;
                    setSettings(prev => ({ ...prev, textProvider: 'anthropic', textModel: anthropicBasic.id }));
                    console.log(`🔄 Przełączono na Anthropic: ${anthropicBasic.name}`);
                  }
                }
              }
            }

            // Sprawdź czy usunięty klucz dotyczył image providera
            if (settings.imageProvider === provider) {
              const currentImageProvider = IMAGE_PROVIDERS.find(p => p.id === provider);
              const currentImageModel = currentImageProvider?.models.find(m => m.id === settings.imageModel);

              if (currentImageModel?.tier === 'premium') {
                // Znajdź pierwszy dostępny model basic w tym providerze
                const basicModel = currentImageProvider?.models.find(m => m.tier === 'basic');
                if (basicModel) {
                  settingsToUpdate.imageModel = basicModel.id;
                  setSettings(prev => ({ ...prev, imageModel: basicModel.id }));
                  console.log(`🔄 Przełączono na model basic obrazów: ${basicModel.name}`);
                } else {
                  // 🆕 ZMIANA: Fallback na Google Imagen 3 (najtańszy)
                  const googleProvider = IMAGE_PROVIDERS.find(p => p.id === 'google');
                  const googleBasic = googleProvider?.models.find(m => m.tier === 'basic');
                  if (googleBasic) {
                    settingsToUpdate.imageProvider = 'google';
                    settingsToUpdate.imageModel = googleBasic.id;
                    setSettings(prev => ({ ...prev, imageProvider: 'google', imageModel: googleBasic.id }));
                    console.log(`🔄 Przełączono na Google: ${googleBasic.name}`);
                  }
                }
              }
            }

            // Zapisz zmiany ustawień AI w bazie jeśli były jakieś przełączenia
            if (Object.keys(settingsToUpdate).length > 0) {
              await updateUserAiSettings(settingsToUpdate);
            }

            setMessage({ type: 'success', text: `Klucz API dla ${providerName} został usunięty` });
          } else {
            const errorData = await response.json();
            console.error('❌ Błąd usuwania klucza API:', errorData);
            setMessage({
              type: 'error',
              text: errorData.error || `Nie udało się usunąć klucza API dla ${providerName}`
            });
          }
        } catch (error) {
          console.error('❌ Błąd sieci przy usuwaniu klucza API:', error);
          setMessage({ type: 'error', text: 'Błąd połączenia z serwerem' });
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(null), 3000);
        }
      }
    });
  }, [settings.textProvider, settings.textModel, settings.imageProvider, settings.imageModel, updateUserAiSettings]);

  // ✅ NOWE: Obsługa logo/avatara - upload z FormData
  const handleLogoUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isUploadingAvatar) return;

    console.log('🖼️ Rozpoczęcie uploadu avatara:', file.name, file.type, file.size);

    // ✅ Wyczyść stary blob URL jeśli istnieje
    if (settings.logo && settings.logo.startsWith('blob:')) {
      URL.revokeObjectURL(settings.logo);
    }

    // ✅ Reset aspect ratio przed nowym uploadem
    resetImageAspectRatio();

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/user/author-settings', {
        method: 'PUT',
        body: formData, // FormData automatycznie ustawia Content-Type
      });

      if (response.ok) {
        const data = await response.json();
        const authorSettings: AuthorSettings = data.authorSettings;

        // ✅ Cache busting - dodaj timestamp do URL aby wymusić odświeżenie
        let newAvatarUrl = authorSettings.authorLogoUrl;
        if (newAvatarUrl) {
          const separator = newAvatarUrl.includes('?') ? '&' : '?';
          newAvatarUrl = `${newAvatarUrl}${separator}t=${Date.now()}`;
        }

        // Aktualizuj settings z nowym avatarem (z cache busting)
        setSettings(prev => ({
          ...prev,
          logo: newAvatarUrl
        }));

        setMessage({ type: 'success', text: 'Avatar został zaktualizowany' });
        console.log('✅ Avatar zaktualizowany:', newAvatarUrl);
      } else {
        const errorData = await response.json();
        console.error('❌ Błąd uploadu avatara:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || 'Nie udało się przesłać avatara'
        });
      }
    } catch (error) {
      console.error('❌ Błąd sieci przy uploadzie avatara:', error);
      setMessage({ type: 'error', text: 'Błąd połączenia z serwerem' });
    } finally {
      setIsUploadingAvatar(false);
      setTimeout(() => setMessage(null), 3000);

      // Reset input file
      if (event.target) {
        event.target.value = '';
      }
    }
  }, [isUploadingAvatar, settings.logo, resetImageAspectRatio]);

  // ✅ NOWE: Usuwanie avatara przez DELETE API
  const removeLogo = useCallback(async () => {
    if (isDeletingAvatar) return;

    // ✅ Wyczyść blob URL jeśli istnieje
    if (settings.logo && settings.logo.startsWith('blob:')) {
      URL.revokeObjectURL(settings.logo);
    }

    // ✅ Reset aspect ratio
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
        const authorSettings: AuthorSettings = data.authorSettings;

        // Usuń avatar z settings
        setSettings(prev => ({ ...prev, logo: null }));

        setMessage({ type: 'success', text: 'Avatar został usunięty' });
        console.log('✅ Avatar usunięty');
      } else {
        const errorData = await response.json();
        console.error('❌ Błąd usuwania avatara:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || 'Nie udało się usunąć avatara'
        });
      }
    } catch (error) {
      console.error('❌ Błąd sieci przy usuwaniu avatara:', error);
      setMessage({ type: 'error', text: 'Błąd połączenia z serwerem' });
    } finally {
      setIsDeletingAvatar(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isDeletingAvatar, settings.logo, resetImageAspectRatio]);

  // ✅ NOWE: Zapis nazwy autora przez PUT API (JSON)
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

        // Ustaw jako zapisane
        setLastSavedUsername(settings.username);

        setMessage({ type: 'success', text: 'Nazwa autora została zaktualizowana' });
        console.log('✅ Nazwa autora zaktualizowana:', authorSettings.authorDisplayName);
      } else {
        const errorData = await response.json();
        console.error('❌ Błąd zapisu nazwy autora:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || 'Nie udało się zapisać nazwy autora'
        });
      }
    } catch (error) {
      console.error('❌ Błąd sieci przy zapisie nazwy autora:', error);
      setMessage({ type: 'error', text: 'Błąd połączenia z serwerem' });
    } finally {
      setIsSavingUsername(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isSavingUsername, settings.username, lastSavedUsername]);

  const closeConfirmModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Ustawienia AI</h1>
        <p className="text-gray-600 text-lg">Skonfiguruj modele AI i personalizuj swoje ebooki</p>
      </div>

      {/* Messages */}
      {message && (
        <div className={`rounded-xl p-4 flex items-center ${ message.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200' }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600 mr-3" /> : <AlertCircle className="h-5 w-5 text-red-600 mr-3" />}
          <span className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>{message.text}</span>
        </div>
      )}

      {/* Profil autora */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <User className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-900">Profil autora</h2>
          {isLoadingAuthorSettings && (
            <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nazwa autora</label>
            <div className="relative">
              <input
                type="text"
                value={settings.username}
                onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Wprowadź swoją nazwę"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 pr-28"
              />
              {settings.username !== lastSavedUsername && settings.username.trim() !== '' && (
                <button
                  onClick={handleSaveUsername}
                  disabled={isSavingUsername}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSavingUsername ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1.5" />
                      Zapisz
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Widoczna na okładkach ebooków</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo / Zdjęcie autora</label>
            {settings.logo || isUploadingAvatar ? (
              <div
                className="relative group border-2 border-gray-200 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50"
                style={{
                  width: '100%',
                  // ✅ Zwiększona wysokość kontenera - minimum 200px, można więcej dla wysokich obrazów
                  height: imageAspectRatio
                    ? imageAspectRatio >= 1
                      ? '200px' // Landscape/Square - stała wysokość
                      : `${Math.min(400 / imageAspectRatio, 400)}px` // Portrait - oblicz na podstawie szerokości 400px
                    : '200px',
                  minHeight: '200px',
                  maxHeight: '400px'
                }}
              >
                {isUploadingAvatar ? (
                  // ✅ Loading state podczas uploadu
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <span className="text-sm font-medium">Przetwarzanie...</span>
                  </div>
                ) : (
                  // ✅ Normalny podgląd grafiki - zawsze w pełnych proporcjach
                  <img
                    src={settings.logo!}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      objectFit: 'contain',
                      width: '100%',
                      height: '100%'
                    }}
                    key={settings.logo} // ✅ Force re-render przy zmianie URL
                    onLoad={handleImageLoad} // ✅ Oblicz proporcje po załadowaniu
                    onError={(e) => {
                      console.error('❌ Błąd ładowania obrazu:', settings.logo);
                      resetImageAspectRatio();
                    }}
                  />
                )}
                {/* Loading overlay podczas usuwania */}
                {isDeletingAvatar && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
                <button
                  onClick={removeLogo}
                  disabled={isDeletingAvatar || isUploadingAvatar}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeletingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
              </div>
            ) : (
              <label className="w-full h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-100 transition-colors flex flex-col items-center justify-center relative">
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="h-8 w-8 text-gray-400 mb-2 animate-spin" />
                    <span className="text-sm font-medium text-gray-600">Przesyłanie...</span>
                    <span className="text-xs text-gray-500">Przetwarzanie avatara</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-600">Dodaj logo</span>
                    <span className="text-xs text-gray-500">PNG, JPG do 5MB</span>
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isUploadingAvatar || isDeletingAvatar}
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1">Widoczne na okładce obok nazwy</p>
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Text Generation */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <Type className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Generowanie tekstu</h2>
            {isLoadingApiKeys && (
              <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
            )}
          </div>

          <div className="space-y-4">
            {/* Text Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider AI</label>
              <div className="relative">
                <button onClick={() => toggleDropdown('textProvider')} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-blue-500 bg-white">
                  <div className="flex items-center"><span className="text-lg mr-3">{textProvider?.icon}</span><span className="font-medium text-gray-900">{textProvider?.name}</span></div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${dropdowns.textProvider ? 'rotate-180' : ''}`} />
                </button>
                {dropdowns.textProvider && (
                  <div className="absolute z-10 w-full bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    {TEXT_PROVIDERS.map((provider) => (
                      <button key={provider.id} onClick={() => {
                        if (provider.available) {
                          const newSettings = {
                            textProvider: provider.id,
                            textModel: provider.models[0].id
                          };
                          setSettings(prev => ({ ...prev, ...newSettings }));
                          toggleDropdown('textProvider');
                          // ✅ Zapisz ustawienia AI w tabeli users
                          updateUserAiSettings(newSettings);
                        }
                      }} disabled={!provider.available} className={`w-full px-4 py-3 text-left flex items-center justify-between first:rounded-t-lg last:rounded-b-lg transition-colors ${!provider.available ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50'} ${settings.textProvider === provider.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}`}>
                        <div className="flex items-center"><span className="text-lg mr-3">{provider.icon}</span><span className="font-medium">{provider.name}</span></div>
                        <div className="flex items-center">{!provider.available && (<span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mr-2">wkrótce</span>)}{settings.textProvider === provider.id && provider.available && (<Check className="h-4 w-4 text-blue-600" />)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Text Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
              <div className="relative">
                <button onClick={() => toggleDropdown('textModel')} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-blue-500 bg-white">
                  <div>
                    <div className="font-medium text-gray-900 flex items-center">{textModel?.name}{textModel?.tier === 'premium' && (<span className="ml-2 px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">Wymagany własny klucz API</span>)}</div>
                    <div className="text-sm text-gray-500">{textModel?.description}</div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${dropdowns.textModel ? 'rotate-180' : ''}`} />
                </button>
                {dropdowns.textModel && textProvider && (
                  <div className="absolute z-10 w-full bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    {textProvider.models.map((model) => (
                      <button key={model.id} onClick={() => {
                        const newSettings = { textModel: model.id };
                        setSettings(prev => ({ ...prev, ...newSettings }));
                        toggleDropdown('textModel');
                        // ✅ Zapisz ustawienia AI w tabeli users
                        updateUserAiSettings(newSettings);
                      }} className={`w-full px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${settings.textModel === model.id ? 'bg-blue-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 flex items-center">{model.name}{model.tier === 'premium' && (<span className="ml-2 px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">Wymagany własny klucz API</span>)}</div>
                            <div className="text-sm text-gray-500">{model.description}</div>
                          </div>
                          {settings.textModel === model.id && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Text API Key Section */}
          {needsTextApiKey && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              {!currentTextApiKey?.isSaved && (<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4"><p className="text-sm text-blue-800">Model <strong>{textModel?.name}</strong> wymaga własnego klucza API.</p></div>)}
              {currentTextApiKey?.isSaved ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center"><span className="text-lg mr-3">{textProvider?.icon}</span><div><span className="font-medium text-green-900">{textProvider?.name} API Key</span><p className="text-sm text-green-700">✓ Klucz jest aktywny</p></div></div>
                    <button onClick={() => removeApiKey(settings.textProvider)} className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Usuń klucz</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700"><div className="flex items-center"><span className="text-lg mr-2">{textProvider?.icon}</span>{textProvider?.name} API Key</div></label>
                  <div className="relative">
                    <input type={currentTextApiKey?.showValue ? 'text' : 'password'} value={currentTextApiKey?.value || ''} onChange={(e) => updateApiKey(settings.textProvider, e.target.value)} placeholder={getApiKeyPlaceholder(settings.textProvider)} autoComplete="new-password" className={`w-full px-4 py-3 ${currentTextApiKey?.value && isValidTextKey ? 'pr-32' : 'pr-12'} border rounded-lg focus:ring-2 focus:border-transparent transition-all text-gray-900 placeholder-gray-500 ${currentTextApiKey?.value && isValidTextKey ? 'border-green-300 focus:ring-green-500 bg-green-50' : currentTextApiKey?.value && !isValidTextKey ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`} />
                    <button type="button" onClick={() => toggleApiKeyVisibility(settings.textProvider)} className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10 ${currentTextApiKey?.value && isValidTextKey ? 'right-24' : 'right-3'}`}>{currentTextApiKey?.showValue ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                    {currentTextApiKey?.value && isValidTextKey && (
                      <button onClick={() => saveApiKey(settings.textProvider)} disabled={savingApiKey === settings.textProvider} className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center px-2 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all z-10">
                        {savingApiKey === settings.textProvider ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<><Save className="h-4 w-4 mr-1" />Zapisz</>)}
                      </button>
                    )}
                  </div>
                  {currentTextApiKey?.value && !isValidTextKey && (<div className="mt-2"><p className="text-xs text-red-600 font-medium flex items-center"><AlertCircle className="h-3 w-3 mr-1" />Nieprawidłowy format klucza API</p><p className="text-xs text-gray-500 mt-1">Oczekiwany format: {getApiKeyPlaceholder(settings.textProvider)}</p></div>)}
                  <div className="mt-3 pt-3 border-t border-gray-100"><p className="text-xs text-gray-500 flex items-center"><span className="mr-1">🔒</span>Klucz będzie szyfrowany AES-256 i przechowywany bezpiecznie</p></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Image Generation */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <Palette className="h-5 w-5 text-purple-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Generowanie obrazów</h2>
            {isLoadingApiKeys && (
              <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
            )}
          </div>

          <div className="space-y-4">
            {/* Image Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider AI</label>
              <div className="relative">
                <button onClick={() => toggleDropdown('imageProvider')} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-purple-500 bg-white">
                  <div className="flex items-center"><span className="text-lg mr-3">{imageProvider?.icon}</span><span className="font-medium text-gray-900">{imageProvider?.name}</span></div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${dropdowns.imageProvider ? 'rotate-180' : ''}`} />
                </button>
                {dropdowns.imageProvider && (
                  <div className="absolute z-10 w-full bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    {IMAGE_PROVIDERS.map((provider) => (
                      <button key={provider.id} onClick={() => {
                        if (provider.available) {
                          const newSettings = {
                            imageProvider: provider.id,
                            imageModel: provider.models[0].id
                          };
                          setSettings(prev => ({ ...prev, ...newSettings }));
                          toggleDropdown('imageProvider');
                          // ✅ Zapisz ustawienia AI w tabeli users
                          updateUserAiSettings(newSettings);
                        }
                      }} disabled={!provider.available} className={`w-full px-4 py-3 text-left flex items-center justify-between first:rounded-t-lg last:rounded-b-lg transition-colors ${!provider.available ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50'} ${settings.imageProvider === provider.id ? 'bg-purple-50 text-purple-700' : 'text-gray-900'}`}>
                        <div className="flex items-center"><span className="text-lg mr-3">{provider.icon}</span><span className="font-medium">{provider.name}</span></div>
                        <div className="flex items-center">{!provider.available && (<span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mr-2">wkrótce</span>)}{settings.imageProvider === provider.id && provider.available && (<Check className="h-4 w-4 text-purple-600" />)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Image Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
              <div className="relative">
                <button onClick={() => toggleDropdown('imageModel')} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 focus:ring-2 focus:ring-purple-500 bg-white">
                  <div>
                    <div className="font-medium text-gray-900 flex items-center">
                      {imageModel?.name}
                      {imageModel?.tier === 'premium' && (
                        <span className="ml-2 px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">Wymagany własny klucz API</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{imageModel?.description}</div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${dropdowns.imageModel ? 'rotate-180' : ''}`} />
                </button>
                {dropdowns.imageModel && imageProvider && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {imageProvider.models.map((model) => (
                      <button key={model.id} onClick={() => {
                        const newSettings = { imageModel: model.id };
                        setSettings(prev => ({ ...prev, ...newSettings }));
                        toggleDropdown('imageModel');
                        // ✅ Zapisz ustawienia AI w tabeli users
                        updateUserAiSettings(newSettings);
                      }} className={`w-full px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${settings.imageModel === model.id ? 'bg-purple-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900 flex items-center">
                              {model.name}
                              {model.tier === 'premium' && (
                                <span className="ml-2 px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">Wymagany własny klucz API</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{model.description}</div>
                          </div>
                          {settings.imageModel === model.id && <Check className="h-4 w-4 text-purple-600" />}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
           {/* Image API Key Section */}
           {needsImageApiKey && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              {!currentImageApiKey?.isSaved && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800">
                    Model <strong>{imageModel?.name}</strong> wymaga własnego klucza API.
                    {settings.imageProvider === 'google' && (
                      <span className="block mt-1">
                        Uzyskaj darmowy klucz z <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">Google AI Studio</a>.
                      </span>
                    )}
                  </p>
                </div>
              )}
              {currentImageApiKey?.isSaved ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center"><span className="text-lg mr-3">{imageProvider?.icon}</span><div><span className="font-medium text-green-900">{imageProvider?.name} API Key</span><p className="text-sm text-green-700">✓ Klucz jest aktywny</p></div></div>
                    <button onClick={() => removeApiKey(settings.imageProvider)} className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">Usuń klucz</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{imageProvider?.icon}</span>
                      {imageProvider?.name} API Key
                      {settings.imageProvider === 'google' && (
                        <span className="ml-2 text-xs text-green-600 font-medium">(Darmowy)</span>
                      )}
                    </div>
                  </label>
                  <div className="relative">
                    <input type={currentImageApiKey?.showValue ? 'text' : 'password'} value={currentImageApiKey?.value || ''} onChange={(e) => updateApiKey(settings.imageProvider, e.target.value)} placeholder={getApiKeyPlaceholder(settings.imageProvider)} autoComplete="new-password" className={`w-full px-4 py-3 ${currentImageApiKey?.value && isValidImageKey ? 'pr-32' : 'pr-12'} border rounded-lg focus:ring-2 focus:border-transparent transition-all text-gray-900 placeholder-gray-500 ${currentImageApiKey?.value && isValidImageKey ? 'border-green-300 focus:ring-green-500 bg-green-50' : currentImageApiKey?.value && !isValidImageKey ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-blue-500 bg-white'}`} />
                    <button type="button" onClick={() => toggleApiKeyVisibility(settings.imageProvider)} className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10 ${currentImageApiKey?.value && isValidImageKey ? 'right-24' : 'right-3'}`}>{currentImageApiKey?.showValue ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                    {currentImageApiKey?.value && isValidImageKey && (
                       <button onClick={() => saveApiKey(settings.imageProvider)} disabled={savingApiKey === settings.imageProvider} className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center px-2 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all z-10">
                         {savingApiKey === settings.imageProvider ? (<Loader2 className="h-4 w-4 animate-spin" />) : (<><Save className="h-4 w-4 mr-1" />Zapisz</>)}
                       </button>
                    )}
                  </div>
                  {currentImageApiKey?.value && !isValidImageKey && (<div className="mt-2"><p className="text-xs text-red-600 font-medium flex items-center"><AlertCircle className="h-3 w-3 mr-1" />Nieprawidłowy format klucza API</p><p className="text-xs text-gray-500 mt-1">Oczekiwany format: {getApiKeyPlaceholder(settings.imageProvider)}</p></div>)}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 flex items-center">
                      <span className="mr-1">🔒</span>Klucz będzie szyfrowany AES-256 i przechowywany bezpiecznie
                    </p>
                    {settings.imageProvider === 'google' && (
                      <p className="text-xs text-green-600 mt-1 flex items-center">
                        <span className="mr-1">💰</span>Imagen 3 dostępny bez klucza API (najtańszy - $0.03/obraz)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur" onClick={closeConfirmModal} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"><AlertTriangle className="h-6 w-6 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-gray-500 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 justify-center">
                <button onClick={closeConfirmModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Anuluj</button>
                <button onClick={confirmModal.onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">Usuń klucz</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Zarządzanie systemem */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <FolderOpen className="h-5 w-5 text-gray-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Zarządzanie systemem</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eksploracja dysku
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Przeglądaj i zarządzaj plikami przechowywanymi na serwerze Railway
              </p>
              <button
                onClick={() => setIsDiskExplorerOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Eksploruj dysk
              </button>
            </div>
          </div>
        </div>
        {/* Disk Explorer Modal */}
        {isDiskExplorerOpen && (
          <DiskExplorerModal
            isOpen={isDiskExplorerOpen}
            onClose={() => setIsDiskExplorerOpen(false)}
          />
        )}
    </div>
  );
}