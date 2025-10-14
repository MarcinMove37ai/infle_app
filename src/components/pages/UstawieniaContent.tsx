// src/components/pages/SettingsContent.tsx
'use client';

import DiskExplorerModal from '@/components/ui/DiskExplorerModal';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  description: string;
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

// Text provider configuration
const TEXT_PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    available: true,
    models: [
      { id: 'claude-3-haiku', name: 'Claude Haiku 3.5', description: 'Available for free for 30 days', tier: 'basic' },
      { id: 'claude-3-sonnet', name: 'Claude Sonnet 4', description: 'Input $3 / MTo | Output $15 / MTok', tier: 'premium', cost: '$0.025' },
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    available: false,
    models: [{ id: 'gpt-4o', name: 'GPT-4o', description: 'The latest model ($0.030)', tier: 'premium', cost: '$0.030' }]
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    available: false,
    models: [{ id: 'gemini-pro', name: 'Gemini Pro', description: 'Google\'s model ($0.020)', tier: 'premium', cost: '$0.020' }]
  },
  {
    id: 'grok',
    name: 'Grok (X.AI)',
    icon: '⚡',
    available: false,
    models: [{ id: 'grok-2', name: 'Grok 2', description: 'X.AI\'s model ($0.040)', tier: 'premium', cost: '$0.040' }]
  },
  {
    id: 'bielik',
    name: 'Bielik',
    icon: '🦅',
    available: false,
    models: [{ id: 'bielik-11b', name: 'Bielik 11B', description: 'Polish model ($0.015)', tier: 'premium', cost: '$0.015' }]
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
        description: 'Available for free for 30 days',
        tier: 'basic'
      },
      {
        id: 'imagen-4',
        name: 'Imagen 4',
        description: 'High quality ($0.04) - requires your own API key',
        tier: 'premium',
        cost: '$0.04'
      },
      {
        id: 'imagen-4-ultra',
        name: 'Imagen 4 Ultra',
        description: 'Highest quality ($0.06) - requires your own API key',
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
        description: 'Standard - no key needed',
        tier: 'basic'
      },
      {
        id: 'gpt-image-1',
        name: 'GPT-Image-1',
        description: 'Premium ($0.19) - key required',
        tier: 'premium',
        cost: '$0.19'
      },
    ]
  }
];


// Status helpers
const getModelDisplayInfo = (model: any, apiKey: any, isSelected: boolean) => {
  if (!model) {
    return { text: 'Select a model', indicator: 'default' };
  }

  if (model.tier === 'basic') {
    if (isSelected) {
      return { text: 'Active Model', indicator: 'active' };
    }
    return { text: 'Model available', indicator: 'active' };
  }

  const hasApiKey = apiKey?.isSaved;

  if (hasApiKey) {
    if (isSelected) {
      return { text: 'Active Model', indicator: 'active' };
    }
    return { text: 'Model available', indicator: 'active' };
  } else {
    return { text: 'API key required', indicator: 'key-needed' };
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
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-left flex items-center justify-between hover:border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                    : 'hover:bg-gray-50'
                } ${currentProviderId === provider.id ? 'bg-blue-50' : ''}`}
              >
                <span className="font-medium text-gray-900">{provider.name}</span>
                {provider.available === false && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">soon</span>
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
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-left flex items-center justify-between hover:border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <StatusIndicator status={modelInfo.indicator} />
                        <div>
                          <div className="font-medium text-gray-900">{model.name}</div>
                          <div className="text-xs text-gray-500">
                            {modelInfo.text}
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

export default function SettingsContent() {
  const { user } = useAuth();

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

  const [subscriptionBasics, setSubscriptionBasics] = useState<{
    status: string;
    planName: string;
    isActive: boolean;
    renewsAt: string | null;
    loading: boolean;
  } | null>(null);

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
  const [isDiskExplorerOpen, setIsDiskExplorerOpen] = useState(false);

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
        setMessage({ type: 'error', text: 'Failed to fetch API key status' });
      }
    } catch (error) {
      console.error('❌ Network error fetching API key status:', error);
      setMessage({ type: 'error', text: 'Server connection error' });
    } finally {
      setIsLoadingApiKeys(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [user?.id]);

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
  }, [user]);

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
              logo: logoUrl,
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
            setMessage({ type: 'error', text: 'Failed to fetch author settings' });
          }
        } catch (error) {
          if (isMounted) {
            console.error('❌ Network error fetching author settings:', error);
            setMessage({ type: 'error', text: 'Server connection error' });
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
  }, [user?.id]);

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
            planName: 'Free',
            isActive: false,
            renewsAt: null,
            loading: true
          });

          const response = await fetch('/api/subscription/details');

          if (response.ok) {
            const data = await response.json();

            const planNames: Record<string, string> = {
              'free': 'Free',
              'standard': 'Standard',
              'premium': 'Premium'
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
            planName: 'Free',
            isActive: false,
            renewsAt: null,
            loading: false
          });
        }
      };

      loadSubscriptionBasics();
    }
  }, [user?.id]);

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

  const getApiKeyPlaceholder = useCallback((provider: string) => {
    switch (provider) {
      case 'anthropic': return 'sk-ant-... or sk-ant-api03-...';
      case 'openai': return 'sk-...';
      case 'google': return 'AIza... (from Google AI Studio)';
      default: return 'Paste your API key';
    }
  }, []);

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

        setMessage({ type: 'success', text: `API key for ${providerName} has been saved.` });

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
          text: errorData.error || `Failed to save API key for ${providerName}`
        });
      }
    } catch (error) {
      console.error('❌ Network error while saving API key:', error);
      setMessage({ type: 'error', text: 'Server connection error' });
    } finally {
      setSavingApiKey(null);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [apiKeys, isValidApiKey, savingApiKey, settings.textModel, settings.imageModel, updateUserAiSettings]);

  const removeApiKey = useCallback((provider: string) => {
    const providerName = TEXT_PROVIDERS.find(p=>p.id === provider)?.name || IMAGE_PROVIDERS.find(p=>p.id === provider)?.name || provider;
    setConfirmModal({
      isOpen: true,
      title: 'Remove API Key',
      message: `Are you sure you want to remove the API key for ${providerName}?`,
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

            setMessage({ type: 'success', text: `API key for ${providerName} has been removed` });
          } else {
            const errorData = await response.json();
            console.error('❌ Error removing API key:', errorData);
            setMessage({
              type: 'error',
              text: errorData.error || `Failed to remove API key for ${providerName}`
            });
          }
        } catch (error) {
          console.error('❌ Network error while removing API key:', error);
          setMessage({ type: 'error', text: 'Server connection error' });
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(null), 3000);
        }
      }
    });
  }, [settings.textProvider, settings.textModel, settings.imageProvider, settings.imageModel, updateUserAiSettings]);

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

        setMessage({ type: 'success', text: 'Avatar has been updated' });
        console.log('✅ Avatar updated:', newAvatarUrl);
      } else {
        const errorData = await response.json();
        console.error('❌ Error uploading avatar:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || 'Failed to upload avatar'
        });
      }
    } catch (error) {
      console.error('❌ Network error while uploading avatar:', error);
      setMessage({ type: 'error', text: 'Server connection error' });
    } finally {
      setIsUploadingAvatar(false);
      setTimeout(() => setMessage(null), 3000);

      if (event.target) {
        event.target.value = '';
      }
    }
  }, [isUploadingAvatar, settings.logo, resetImageAspectRatio]);

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
        const authorSettings: AuthorSettings = data.authorSettings;

        setSettings(prev => ({ ...prev, logo: null }));

        setMessage({ type: 'success', text: 'Avatar has been removed' });
        console.log('✅ Avatar removed');
      } else {
        const errorData = await response.json();
        console.error('❌ Error removing avatar:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || 'Failed to remove avatar'
        });
      }
    } catch (error) {
      console.error('❌ Network error while removing avatar:', error);
      setMessage({ type: 'error', text: 'Server connection error' });
    } finally {
      setIsDeletingAvatar(false);
      setTimeout(() => setMessage(null), 3000);
    }
  }, [isDeletingAvatar, settings.logo, resetImageAspectRatio]);

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

        setMessage({ type: 'success', text: 'Author name has been updated' });
        console.log('✅ Author name updated:', authorSettings.authorDisplayName);
      } else {
        const errorData = await response.json();
        console.error('❌ Error saving author name:', errorData);
        setMessage({
          type: 'error',
          text: errorData.error || 'Failed to save author name'
        });
      }
    } catch (error) {
      console.error('❌ Network error while saving author name:', error);
      setMessage({ type: 'error', text: 'Server connection error' });
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
      {/* Author Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <User className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-xl font-bold text-gray-900">Author Profile</h2>
          {isLoadingAuthorSettings && (
            <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Author Name</label>
            <div className="relative">
              <input
                type="text"
                value={settings.username}
                onChange={(e) => setSettings(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Enter your name"
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
                      Save
                    </>
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Visible in the ebook footer and on landing pages</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Author Logo / Photo</label>
            {settings.logo || isUploadingAvatar ? (
              <div
                className="relative group border-2 border-gray-200 rounded-lg overflow-hidden flex items-center justify-center bg-gray-50"
                style={{
                  width: '100%',
                  height: imageAspectRatio
                    ? imageAspectRatio >= 1
                      ? '200px'
                      : `${Math.min(400 / imageAspectRatio, 400)}px`
                    : '200px',
                  minHeight: '200px',
                  maxHeight: '400px'
                }}
              >
                {isUploadingAvatar ? (
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <span className="text-sm font-medium">Processing...</span>
                  </div>
                ) : (
                  <img
                    src={settings.logo!}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      objectFit: 'contain',
                      width: '100%',
                      height: '100%'
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
                    <span className="text-sm font-medium text-gray-600">Uploading...</span>
                    <span className="text-xs text-gray-500">Processing avatar</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-600">Add logo</span>
                    <span className="text-xs text-gray-500">PNG, JPG up to 5MB</span>
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
            <p className="text-xs text-gray-500 mt-1">Visible in the cover header and on landing pages</p>
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900">AI Configuration</h2>
          <p className="text-gray-600">Choose models and configure API keys</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Text Generation */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 relative">
            <div className="flex items-center space-x-2 mb-6">
              <Type className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                <span className="sm:hidden">AI for Text</span>
                <span className="hidden sm:inline">Text Generation</span>
              </h3>
              {isLoadingApiKeys && (
                <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
              )}
            </div>

            {currentTextApiKey?.isSaved && (
              <div className="absolute top-4 right-4 flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">API Active</span>
                <button
                  onClick={() => removeApiKey(settings.textProvider)}
                  className="ml-1 text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <ProviderSelector
              label="Provider"
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
                  {textProvider?.name} API Key
                </label>

                <div className="relative">
                  <input
                    type={currentTextApiKey?.showValue ? 'text' : 'password'}
                    value={currentTextApiKey?.value || ''}
                    onChange={(e) => updateApiKey(settings.textProvider, e.target.value)}
                    placeholder="Paste your API key..."
                    className="w-full pl-4 pr-32 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 placeholder-gray-500"
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility(settings.textProvider)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {currentTextApiKey?.showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {currentTextApiKey?.value && currentTextApiKey.value.length > 10 && isValidTextKey && (
                      <button
                        onClick={() => saveApiKey(settings.textProvider)}
                        disabled={savingApiKey === settings.textProvider}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {savingApiKey === settings.textProvider ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <span>Save</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {currentTextApiKey?.value && currentTextApiKey.value.length > 0 && currentTextApiKey.value.length <= 10 && (
                  <div className="flex items-center space-x-2 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>The key seems incomplete</span>
                  </div>
                )}

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <Shield className="w-10 h-10 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-800">
                      <span className="font-medium">Cryptographically secured:</span> Your key will be safe here!
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
                <span className="sm:hidden">AI for Images</span>
                <span className="hidden sm:inline">Image Generation</span>
              </h3>
              {isLoadingApiKeys && (
                <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
              )}
            </div>

            {currentImageApiKey?.isSaved && (
              <div className="absolute top-4 right-4 flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-900">API Active</span>
                <button
                  onClick={() => removeApiKey(settings.imageProvider)}
                  className="ml-1 text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <ProviderSelector
              label="Provider"
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
                  {imageProvider?.name} API Key
                </label>

                <div className="relative">
                  <input
                    type={currentImageApiKey?.showValue ? 'text' : 'password'}
                    value={currentImageApiKey?.value || ''}
                    onChange={(e) => updateApiKey(settings.imageProvider, e.target.value)}
                    placeholder="Paste your API key..."
                    className="w-full pl-4 pr-32 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 placeholder-gray-500"
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => toggleApiKeyVisibility(settings.imageProvider)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {currentImageApiKey?.showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {currentImageApiKey?.value && currentImageApiKey.value.length > 10 && isValidImageKey && (
                      <button
                        onClick={() => saveApiKey(settings.imageProvider)}
                        disabled={savingApiKey === settings.imageProvider}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {savingApiKey === settings.imageProvider ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <span>Save</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {currentImageApiKey?.value && currentImageApiKey.value.length > 0 && currentImageApiKey.value.length <= 10 && (
                  <div className="flex items-center space-x-2 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    <span>The key seems incomplete</span>
                  </div>
                )}

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center justify-center space-x-2">
                    <Shield className="w-10 h-10 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-800">
                      <span className="font-medium">Cryptographically secured:</span> Your key will be safe here!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid for Subscription and System Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Subscription Management */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <CreditCard className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Subskrypcja</h2>
            {subscriptionBasics?.loading && (
              <Loader2 className="h-4 w-4 text-gray-400 ml-2 animate-spin" />
            )}
          </div>

          {subscriptionBasics && !subscriptionBasics.loading ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Aktualny plan</p>
                  <p className="text-lg font-semibold text-gray-900">{subscriptionBasics.planName}</p>
                </div>
                <div>
                  {subscriptionBasics.isActive ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      Aktywna
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                      Nieaktywna
                    </span>
                  )}
                </div>
              </div>

              {subscriptionBasics.renewsAt && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <span className="font-medium">Odnowienie:</span>{' '}
                    {new Date(subscriptionBasics.renewsAt).toLocaleDateString('pl-PL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              )}

              <Link
                href="/subscription"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors w-full justify-center"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Zarządzaj subskrypcją
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
            </div>
          )}
        </div>

        {/* System Management */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <FolderOpen className="h-5 w-5 text-gray-600 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">System Management</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disk Explorer
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Browse and manage files stored on the Railway server
              </p>
              <button
                onClick={() => setIsDiskExplorerOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Explore Disk
              </button>
            </div>
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

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur" onClick={closeConfirmModal} />
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{confirmModal.title}</h3>
              <p className="text-sm text-gray-500 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={closeConfirmModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Remove Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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