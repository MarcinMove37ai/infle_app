// src/components/profile/LinkedInProfileBar.tsx
'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Users, UserCheck, MapPin, Briefcase, Award, Building2, Plus, Loader2, User } from 'lucide-react';

// --- INTERFEJS DANYCH ---
interface LinkedInProfile {
    id: string;
    linkedinUrl: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    headline: string | null;
    aboutExcerpt: string | null;
    connectionsCount: number;
    followersCount: number;
    profilePicUrl: string | null;
    jobTitle: string | null;
    companyName: string | null;
    companyIndustry: string | null;
    location: string | null;
    topSkills: string | null;
    checkedAt: string;
}

// --- CUSTOM HOOK DO ZARZĄDZANIA PROFILEM LINKEDIN ---
function useLinkedInProfile() {
    const { data: session, status } = useSession();
    const [state, setState] = useState({
        profile: null as LinkedInProfile | null,
        loading: true,
        error: null as string | null,
        initialized: false
    });

    const fetchProfile = useCallback(async () => {
        if (!session?.user?.id || state.initialized) return;

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            console.log('💼 Fetching LinkedIn profile for user:', session.user.id);

            const response = await fetch('/api/user/linkedin-profile');

            if (response.status === 404) {
                setState({
                    profile: null,
                    loading: false,
                    error: null,
                    initialized: true
                });
                return;
            }

            if (!response.ok) {
                throw new Error('Nie udało się pobrać profilu.');
            }

            const data = await response.json();
            console.log('✅ LinkedIn profile loaded successfully');

            setState({
                profile: data.profile,
                loading: false,
                error: null,
                initialized: true
            });
        } catch (err) {
            console.error('❌ Error fetching LinkedIn profile:', err);
            setState(prev => ({
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Wystąpił błąd.',
                initialized: true
            }));
        }
    }, [session?.user?.id, state.initialized]);

    useEffect(() => {
        if (status === 'authenticated' && !state.initialized) {
            fetchProfile();
        }
    }, [status, fetchProfile]);

    const refreshProfile = useCallback(() => {
        console.log('🔄 Refreshing LinkedIn profile...');
        setState(prev => ({ ...prev, initialized: false }));
    }, []);

    return {
        ...state,
        refreshProfile
    };
}

// --- FUNKCJA POMOCNICZA DO CZYSZCZENIA DANYCH LINKEDIN ---
const cleanLinkedInField = (field: string | null): string | null => {
    if (!field) return null;

    // Usuń typowe błędne prefiksy z LinkedIn data
    const cleaned = field.replace(/^(None|null|undefined),?\s*/i, '').trim();

    // Jeśli po wyczyszczeniu nic nie zostało, zwróć null
    return cleaned.length > 0 ? cleaned : null;
};

// --- FUNKCJA POMOCNICZA DO FORMATOWANIA LICZB ---
const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`.replace('.0', 'M');
    if (num >= 10000) return `${(num / 1000).toFixed(1)}K`.replace('.0', 'K');
    return num.toString();
};

// --- FUNKCJA POMOCNICZA DO OBCINANIA LOKALIZACJI ---
const truncateLocation = (location: string | null): string => {
    if (!location) return "Brak";
    return location.split(',')[0].trim();
};

// --- KONFIGURACJA IKON I KOLORÓW (LINKEDIN THEME) ---
const statConfig = {
    followers: { icon: Users, gradient: 'from-blue-500 to-blue-600' },
    connections: { icon: UserCheck, gradient: 'from-indigo-500 to-indigo-600' },
    location: { icon: MapPin, gradient: 'from-green-500 to-green-600' },
    jobTitle: { icon: Briefcase, gradient: 'from-purple-500 to-purple-600' },
    skills: { icon: Award, gradient: 'from-orange-500 to-orange-600' },
    company: { icon: Building2, gradient: 'from-gray-500 to-gray-600' }
};
type StatType = keyof typeof statConfig;

// --- PODKOMPONENT KARTY STATYSTYK ---
const StatCard = memo(({ value, label, type, inactive = false }: { value: string; label: string; type: StatType; inactive?: boolean }) => {
    const config = statConfig[type];
    const Icon = config.icon;
    const isWaiting = value === '---';

    return (
        <div className={`relative overflow-hidden rounded-xl p-2.5 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-lg ${
            inactive ? 'bg-gradient-to-br from-gray-400 to-gray-500' : `bg-gradient-to-br ${config.gradient}`
        }`}>
            <div className="absolute top-0 right-0 w-12 h-12 bg-white/10 rounded-full -mr-6 -mt-6"></div>
            <div className="relative z-10 flex items-center gap-2.5">
                <Icon size={18} className="opacity-90 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className={`font-bold leading-tight ${isWaiting ? 'italic opacity-70 text-sm' : 'text-lg'}`}>
                        {value}
                    </div>
                    <div className="text-xs opacity-80 leading-tight">{label}</div>
                </div>
            </div>
        </div>
    );
});

// --- KOMPONENT DODAWANIA PROFILU LINKEDIN ---
const AddLinkedInProfile = memo(({ onProfileAdded }: { onProfileAdded: () => void }) => {
    const [linkedinUrl, setLinkedinUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkingProfile, setCheckingProfile] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [profileData, setProfileData] = useState<any>(null);
    const [showConfirmPopup, setShowConfirmPopup] = useState(false);
    const [imageError, setImageError] = useState(false);

    const isInactive = !profileData;

    const simulateProgress = useCallback(() => {
        setLoadingProgress(0);
        const intervals = [
            { time: 500, progress: 10 },
            { time: 1000, progress: 20 },
            { time: 1500, progress: 35 },
            { time: 2500, progress: 50 },
            { time: 4000, progress: 65 },
            { time: 5500, progress: 80 },
            { time: 7000, progress: 95 },
            { time: 8000, progress: 100 }
        ];

        intervals.forEach(({ time, progress }) => {
            setTimeout(() => {
                setLoadingProgress(progress);
            }, time);
        });
    }, []);

    const detectPlatform = useCallback((url: string): boolean => {
        return url.includes('linkedin.com') && url.includes('/in/');
    }, []);

    const checkLinkedInProfile = useCallback(async (url: string): Promise<any> => {
        try {
            console.log('🔍 Checking LinkedIn profile:', url);

            const response = await fetch('/api/linkedin-profile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            console.log('📡 API Response status:', response.status, response.statusText);

            if (!response.ok) {
                console.error('❌ API returned error status:', response.status);
                const errorData = await response.json();
                console.error('❌ Error details:', errorData);
                return null;
            }

            const data = await response.json();
            console.log('📦 API Response data:', data);

            if (!data.exist) {
                console.log('ℹ️ Profile does not exist (exist: false)');
                return null;
            }

            if (data.profilepic_url && data.followers !== null && data.connections !== null) {
                console.log('✅ Profile data is complete:', {
                    username: data.username,
                    followers: data.followers,
                    connections: data.connections,
                    savedProfileId: data.savedProfileId
                });
                return data;
            } else {
                console.log('⚠️ Profile exists but data incomplete:', {
                    has_profilepic: !!data.profilepic_url,
                    has_followers: data.followers !== null,
                    has_connections: data.connections !== null
                });
                return null;
            }
        } catch (error) {
            console.error('❌ Network error during profile check:', error);
            return null;
        }
    }, []);

    const checkSocialProfile = useCallback(async (url: string) => {
        if (!detectPlatform(url)) {
            console.log('🔍 URL does not match LinkedIn pattern');
            setProfileData(null);
            setError(null);
            return;
        }

        console.log('🚀 Starting profile check for:', url);
        setCheckingProfile(true);
        setError(null);
        simulateProgress();

        const result = await checkLinkedInProfile(url);

        if (result) {
            console.log('✅ Profile check successful');
            setProfileData(result);
            setError(null);
            setImageError(false); // Reset image error dla nowego profilu
        } else {
            console.log('❌ Profile check failed');
            setProfileData(null);
            setError('Profil nie został znaleziony lub nie zawiera wymaganych danych');
        }

        setTimeout(() => {
            setCheckingProfile(false);
            setLoadingProgress(0);
        }, 200);
    }, [detectPlatform, checkLinkedInProfile, simulateProgress]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (linkedinUrl.trim()) {
                checkSocialProfile(linkedinUrl.trim());
            } else {
                setProfileData(null);
                setError(null);
                setLoadingProgress(0);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [linkedinUrl, checkSocialProfile]);

    const handleResetProfile = useCallback(() => {
        console.log('🔄 Resetting profile to initial state');
        setLinkedinUrl('');
        setProfileData(null);
        setError(null);
        setCheckingProfile(false);
        setLoadingProgress(0);
        setImageError(false);
    }, []);

    const handleSaveProfile = useCallback(async () => {
        if (!profileData?.savedProfileId) {
            setError('Najpierw sprawdź poprawność profilu LinkedIn');
            return;
        }
        setShowConfirmPopup(true);
    }, [profileData?.savedProfileId]);

    const handleConfirmSave = useCallback(async () => {
        console.log('💾 Starting profile save process...');
        setIsLoading(true);
        setError(null);
        setShowConfirmPopup(false);

        try {
            console.log('🔗 Linking user to profile ID:', profileData.savedProfileId);

            const linkResponse = await fetch('/api/user/linkedin-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId: profileData.savedProfileId })
            });

            console.log('📡 Link API Response status:', linkResponse.status, linkResponse.statusText);

            if (!linkResponse.ok) {
                const linkErrorData = await linkResponse.json();
                console.error('❌ Link API error:', linkErrorData);
                setError(linkErrorData.error || `Błąd ${linkResponse.status}: Nie udało się powiązać profilu z kontem`);
                return;
            }

            const linkData = await linkResponse.json();
            console.log('✅ Link API success:', linkData);
            console.log('🎉 Profile successfully linked to account');

            onProfileAdded();

        } catch (err) {
            console.error('❌ Network error during profile save:', err);
            setError('Błąd połączenia: Nie udało się zapisać profilu');
        } finally {
            setIsLoading(false);
        }
    }, [profileData?.savedProfileId, onProfileAdded]);

    const formatNumberWithFallback = useCallback((num: number | null): string => {
        if (num === null) return '---';
        return formatNumber(num);
    }, []);

    const statsData = [
        {
            value: profileData ? formatNumberWithFallback(profileData.followers) : '---',
            label: "Obserwujący:",
            type: "followers" as StatType
        },
        {
            value: profileData ? (profileData.jobTitle || "Brak") : '---',
            label: "Stanowisko:",
            type: "jobTitle" as StatType
        },
        {
            value: profileData ? formatNumberWithFallback(profileData.connections) : '---',
            label: "Kontakty:",
            type: "connections" as StatType
        },
        {
            value: profileData ? truncateLocation(profileData.location) : '---',
            label: "Lokalizacja:",
            type: "location" as StatType
        },
        {
            value: profileData ? (profileData.topSkills ? profileData.topSkills.split(',').length.toString() : "0") : '---',
            label: "Umiejętności:",
            type: "skills" as StatType
        },
        {
            value: profileData ? (profileData.companyName || "Brak") : '---',
            label: "Firma:",
            type: "company" as StatType
        },
    ];

    return (
        <div className="w-full md:bg-white md:rounded-xl md:border md:border-gray-200 md:shadow-sm p-2 md:p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6">

                {/* === LEWA STRONA: PROFIL (50%) === */}
                <div className="flex-1 lg:w-1/2 lg:border-r lg:border-gray-200 lg:pr-6">
                    <div className="flex flex-col items-center gap-4 md:flex-row md:items-center">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full p-[2px] transition-all duration-300 ${
                                isInactive ? 'bg-gray-300' : 'bg-gradient-to-tr from-blue-500 to-blue-600'
                            }`}>
                                <div className="w-full h-full bg-white rounded-full p-0.5">
                                    {checkingProfile ? (
                                        <div className="w-full h-full rounded-full bg-gray-50 flex items-center justify-center">
                                            <Loader2 size={32} className="text-gray-400 animate-spin" />
                                        </div>
                                    ) : profileData?.profilepic_url && !imageError ? (
                                        <Image
                                            src={profileData.profilepic_url}
                                            alt={`Zdjęcie profilowe ${profileData.username || 'użytkownika'}`}
                                            width={96}
                                            height={96}
                                            className="rounded-full object-cover w-full h-full"
                                            onError={() => {
                                                console.log('❌ Error loading profile image, showing fallback');
                                                setImageError(true);
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-gray-50 flex items-center justify-center">
                                            <User size={32} className="text-gray-400" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Informacje tekstowe */}
                        <div className="flex-1 min-w-0 text-center md:text-left">
                            {profileData?.jobTitle && (
                                <p className="text-xs text-blue-600 font-medium mb-1">{profileData.jobTitle}</p>
                            )}

                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <Image
                                    src="/linkedin.png"
                                    alt="LinkedIn"
                                    width={20}
                                    height={20}
                                    className="flex-shrink-0 opacity-70"
                                />
                                <h2 className={`text-xl md:text-2xl font-bold truncate transition-colors duration-300 ${
                                    isInactive ? 'text-gray-800' : 'text-gray-800'
                                }`}>
                                    {profileData?.full_name || 'Dodaj swój profil LinkedIn'}
                                </h2>
                            </div>

                            {profileData?.companyName && (
                                <p className={`text-sm font-medium mb-2 transition-colors duration-300 ${
                                    isInactive ? 'text-gray-400' : 'text-gray-700'
                                }`}>{profileData.companyName}</p>
                            )}

                            <div className={`hidden md:block border-t my-3 transition-colors duration-300 ${
                                isInactive ? 'border-gray-300' : 'border-gray-200'
                            }`}></div>

                            {profileData?.headline && (
                                <div className={`hidden md:block text-sm leading-relaxed mb-3 transition-colors duration-300 ${
                                    isInactive ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                    <p>{profileData.headline}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Input URL */}
                    <div className="text-sm w-full mt-4">
                        <div className="relative">
                            <input
                                type="url"
                                value={linkedinUrl}
                                onChange={(e) => {
                                    setLinkedinUrl(e.target.value);
                                    setError(null);
                                }}
                                placeholder="https://linkedin.com/in/twoja-nazwa"
                                className={`w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-gray-400 focus:bg-gray-50 transition-colors ${
                                    checkingProfile ? 'text-gray-400 bg-gray-50' : 'text-gray-900 bg-white'
                                }`}
                                disabled={isLoading}
                            />
                            {checkingProfile && (
                                <>
                                    <div
                                        className="absolute inset-0 border-blue-400 border rounded-md transition-all duration-300 ease-out pointer-events-none"
                                        style={{
                                            clipPath: `inset(0 ${100 - loadingProgress}% 0 0)`,
                                            background: 'rgba(59, 130, 246, 0.1)'
                                        }}
                                    ></div>
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                        <div className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                            {loadingProgress}%
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {checkingProfile && (
                            <div className="flex justify-center mt-6">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                                    <p className="text-blue-700 text-base font-medium animate-pulse">Wait for it...</p>
                                </div>
                            </div>
                        )}

                        {error && (
                            <p className="text-red-600 text-xs mt-1">{error}</p>
                        )}

                        {profileData && (
                            <div className="flex gap-2 mt-3">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={isLoading}
                                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-2.5 px-3 rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Zapisywanie...
                                        </>
                                    ) : (
                                    <>
                                        <Plus size={16} className="inline mr-1" />
                                        Przypisz do konta
                                    </>
                                    )}
                                </button>

                                <button
                                    onClick={handleResetProfile}
                                    disabled={isLoading}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm border border-gray-300"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6L6 18"></path>
                                        <path d="M6 6l12 12"></path>
                                    </svg>
                                    Anuluj
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* === PRAWA STRONA: STATYSTYKI === */}
                <div className="flex-1 lg:w-1/2 border-t md:border-t lg:border-t-0 border-gray-200 pt-4 md:pt-6 lg:pt-0 flex items-center">
                    <div className="grid grid-cols-2 gap-3 w-full">
                        {statsData.map(stat => (
                            <StatCard key={stat.type} {...stat} inactive={isInactive} />
                        ))}
                    </div>
                </div>

            </div>

            {/* Popup potwierdzenia */}
            {showConfirmPopup && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 transform transition-all duration-300 scale-100">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Potwierdź przypisanie profilu
                            </h3>

                            <div className="border-t border-gray-200 mb-4"></div>

                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                Czy na pewno chcesz przypisać profil <strong>{profileData?.full_name}</strong> do twojego konta inflee.app?
                            </p>

                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                                <p className="text-sm text-red-700 font-medium">
                                    Ta operacja jest nieodwracalna i trwale połączy konto z profilem.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmPopup(false)}
                                    disabled={isLoading}
                                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    Anuluj
                                </button>
                                <button
                                    onClick={handleConfirmSave}
                                    disabled={isLoading}
                                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Zapisywanie...
                                        </>
                                    ) : (
                                        'Tak, przypisz'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

// --- GŁÓWNY KOMPONENT ---
function LinkedInProfileBar() {
    // WSZYSTKIE HOOKS NA POCZĄTKU - PRZED JAKIMIKOLWIEK WARUNKAMI
    const { status } = useSession();
    const { profile, loading, error, refreshProfile } = useLinkedInProfile();
    const [imageError, setImageError] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [analysisStarted, setAnalysisStarted] = useState(false);

    // Reset image error when profile changes
    useEffect(() => {
        if (profile) {
            setImageError(false);
        }
    }, [profile]);

    const handleStartAnalysis = () => {
        if (!profile?.fullName) {
            console.log('❌ Cannot start analysis: profile is null or fullName is missing');
            return;
        }
        console.log('🚀 Rozpoczynam analizę biznesową dla:', profile.fullName);
        setAnalysisStarted(true);
        setIsMinimized(true);
        // TODO: Tutaj uruchomimy proces analizy i pokażemy kolejny komponent
    };

    const toggleMinimized = () => {
        setIsMinimized(!isMinimized);
    };

    // Loading state z early return
    if (status === 'loading' || loading) {
        return <div className="w-full h-48 md:bg-gradient-to-r md:from-blue-100 md:to-indigo-50 md:rounded-xl md:animate-pulse bg-blue-100 animate-pulse"></div>;
    }

    // Error state z early return
    if (error) {
        return <div className="md:bg-red-50 md:border md:border-red-200 text-red-700 p-2 md:p-4 md:rounded-xl bg-red-50 border-l-4 border-red-400">{error}</div>;
    }

    // Brak profilu - pokaż formularz dodawania
    if (!profile) {
        return <AddLinkedInProfile onProfileAdded={refreshProfile} />;
    }

    // Istniejący profil
    const statsData = [
        { value: formatNumber(profile.followersCount), label: "Obserwujący:", type: "followers" as StatType },
        { value: profile.jobTitle || "Brak", label: "Stanowisko:", type: "jobTitle" as StatType },
        { value: formatNumber(profile.connectionsCount), label: "Kontakty:", type: "connections" as StatType },
        { value: truncateLocation(profile.location), label: "Lokalizacja:", type: "location" as StatType },
        { value: profile.topSkills ? profile.topSkills.split(',').length.toString() : "0", label: "Umiejętności:", type: "skills" as StatType },
        { value: profile.companyName || "Brak", label: "Firma:", type: "company" as StatType },
    ];

    return (
        <div className="w-full md:bg-white md:rounded-xl md:border md:border-gray-200 md:shadow-sm p-2 md:p-4 lg:p-6 transition-all duration-500">

            {/* === WERSJA ZMINIMALIZOWANA === */}
            {isMinimized ? (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* Avatar - mniejszy w wersji zminimalizowanej */}
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-blue-600 p-[2px]">
                                <div className="w-full h-full bg-white rounded-full p-0.5">
                                    {profile.profilePicUrl && !imageError ? (
                                        <Image
                                            src={profile.profilePicUrl?.startsWith('/api/proxy-image')
                                                ? profile.profilePicUrl
                                                : `/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl || '')}`
                                            }
                                            alt={`Zdjęcie profilowe ${profile.fullName}`}
                                            width={48}
                                            height={48}
                                            className="rounded-full object-cover w-full h-full"
                                            onError={() => setImageError(true)}
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-gray-50 flex items-center justify-center">
                                            <User size={20} className="text-gray-400" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Informacje podstawowe */}
                        <div className="flex-1 min-w-0">
                            {cleanLinkedInField(profile.jobTitle) && (
                                <p className="text-xs text-blue-600 font-medium">{cleanLinkedInField(profile.jobTitle)}</p>
                            )}
                            <div className="flex items-center gap-2">
                                <Image
                                    src="/linkedin.png"
                                    alt="LinkedIn"
                                    width={16}
                                    height={16}
                                    className="flex-shrink-0"
                                />
                                <h2 className="text-base font-bold text-gray-800 truncate">
                                    {profile.fullName}
                                </h2>
                            </div>
                            {profile.companyName && (
                                <p className="text-sm text-gray-600 truncate">{profile.companyName}</p>
                            )}
                        </div>
                    </div>

                    {/* Przycisk toggle */}
                    <button
                        onClick={toggleMinimized}
                        className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
                        title="Rozwiń profil"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-gray-600 group-hover:text-gray-800 transition-colors duration-200"
                        >
                            <path d="M6 9l6 6 6-6"/>
                        </svg>
                    </button>
                </div>
            ) : (
                /* === WERSJA PEŁNA === */
                <>
                    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">

                        {/* === LEWA STRONA: PROFIL === */}
                        <div className="flex-1 lg:w-1/2 lg:border-r lg:border-gray-200 lg:pr-6">
                            <div className="flex flex-col items-center gap-4 md:flex-row md:items-center">
                                {/* Avatar */}
                                <div className="flex-shrink-0">
                                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-blue-500 to-blue-600 p-[2px]">
                                        <div className="w-full h-full bg-white rounded-full p-0.5">
                                            {profile.profilePicUrl && !imageError ? (
                                                <Image
                                                    src={profile.profilePicUrl?.startsWith('/api/proxy-image')
                                                        ? profile.profilePicUrl
                                                        : `/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl || '')}`
                                                    }
                                                    alt={`Zdjęcie profilowe ${profile.fullName}`}
                                                    width={96}
                                                    height={96}
                                                    className="rounded-full object-cover w-full h-full"
                                                    onError={() => {
                                                        console.log('❌ Error loading profile image, showing fallback');
                                                        setImageError(true);
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full rounded-full bg-gray-50 flex items-center justify-center">
                                                    <User size={32} className="text-gray-400" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Informacje tekstowe */}
                                <div className="flex-1 min-w-0 text-center md:text-left">
                                    {cleanLinkedInField(profile.jobTitle) && (
                                        <p className="text-xs text-blue-600 font-medium mb-1">{cleanLinkedInField(profile.jobTitle)}</p>
                                    )}

                                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                        <Image
                                            src="/linkedin.png"
                                            alt="LinkedIn"
                                            width={20}
                                            height={20}
                                            className="flex-shrink-0"
                                        />
                                        <h2 className="text-xl md:text-2xl font-bold text-gray-800 truncate">
                                            {profile.fullName}
                                        </h2>
                                    </div>

                                    {profile.companyName && (
                                        <p className="text-sm text-gray-700 font-medium mb-2">{profile.companyName}</p>
                                    )}

                                    {profile.headline && (
                                        <div className="hidden md:block border-t border-gray-200 my-3"></div>
                                    )}

                                    {profile.headline && (
                                        <div className="hidden md:block text-sm text-gray-600 leading-relaxed">
                                            <p>{profile.headline}</p>
                                        </div>
                                    )}

                                    {/* Przycisk zwijania - w lewej kolumnie po rozpoczęciu analizy */}
                                    {analysisStarted && (
                                        <div className="mt-4 flex justify-center">
                                            <button
                                                onClick={toggleMinimized}
                                                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                                title="Zwiń profil"
                                            >
                                                <span>Zwiń profil</span>
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                >
                                                    <path d="M18 15l-6-6-6 6"/>
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* === PRAWA STRONA: STATYSTYKI === */}
                        <div className="flex-1 lg:w-1/2 border-t md:border-t lg:border-t-0 border-gray-200 pt-4 md:pt-6 lg:pt-0">
                            <div className="grid grid-cols-2 gap-3">
                                {statsData.map((stat, index) => (
                                    <StatCard key={`${stat.type}-${index}`} {...stat} />
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* === SEKCJA CTA - ROZPOCZNIJ ANALIZĘ BIZNESOWĄ === */}
                    {!analysisStarted && (
                        <div className="mt-6 md:mt-8 pt-6 border-t border-gray-200">
                            <div className="text-center">
                                <h3 className="text-lg md:text-xl font-semibold text-gray-800 mb-4">
                                    Przekształć swoją sieć kontaktów w przewagę konkurencyjną.
                                </h3>

                                <div className="text-left max-w-2xl mx-auto mb-6">
                                    <p className="text-sm md:text-base text-gray-600 mb-3 font-medium">
                                        Nasza analiza pomoże Ci:
                                    </p>

                                    <ul className="space-y-2 text-sm md:text-base text-gray-600">
                                        <li className="flex items-start gap-3">
                                            <span className="text-blue-600 font-bold mt-0.5 flex-shrink-0">•</span>
                                            <span className="flex-1">
                                                <strong className="text-gray-800">Zdefiniować Twoją Ekspercką Niszę</strong> – obszary, w których Twoja wiedza i doświadczenie mają największą wartość rynkową.
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-indigo-600 font-bold mt-0.5 flex-shrink-0">•</span>
                                            <span className="flex-1">
                                                <strong className="text-gray-800">Zmapować Twój Ekosystem Biznesowy</strong> – kluczowych decydentów, influencerów i potencjalnych partnerów w Twojej sieci.
                                            </span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <span className="text-cyan-600 font-bold mt-0.5 flex-shrink-0">•</span>
                                            <span className="flex-1">
                                                <strong className="text-gray-800">Opracować Strategię Monetyzacji</strong> – konkretne pomysły na produkty knowledge-based, które skalujesz z Twoją reputacją.
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                <button
                                    onClick={handleStartAnalysis}
                                    className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600
                                               text-white font-semibold px-8 py-4 rounded-2xl hover:shadow-lg hover:scale-105
                                               transition-all duration-300 cursor-pointer group"
                                >
                                    <span className="text-2xl group-hover:animate-bounce">📊</span>
                                    <span className="text-base md:text-lg">Rozpocznij Analizę Biznesową</span>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default memo(LinkedInProfileBar);