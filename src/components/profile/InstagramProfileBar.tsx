// src/components/profile/InstagramProfileBar.tsx
'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { Verified, Lock, Building2, Grid3X3, Users, UserCheck, Plus, Loader2, ExternalLink, User } from 'lucide-react';

// --- INTERFEJS DANYCH ---
interface InstagramProfile {
    username: string;
    fullName: string | null;
    biography: string | null;
    followersCount: number;
    followsCount: number;
    postsCount: number;
    highlightReelCount?: number;
    profilePicUrlHD: string | null;
    isBusinessAccount: boolean;
    isPrivate: boolean;
    isVerified: boolean;
    businessCategory: string | null;
}

// --- CUSTOM HOOK DO ZARZĄDZANIA PROFILEM INSTAGRAM ---
function useInstagramProfile() {
    const { data: session, status } = useSession();
    const [state, setState] = useState({
        profile: null as InstagramProfile | null,
        loading: true,
        error: null as string | null,
        initialized: false
    });

    const fetchProfile = useCallback(async () => {
        if (!session?.user?.id || state.initialized) return;

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            console.log('📱 Fetching Instagram profile for user:', session.user.id);

            const response = await fetch('/api/user/instagram-profile');

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
            console.log('✅ Instagram profile loaded successfully');

            setState({
                profile: data.profile,
                loading: false,
                error: null,
                initialized: true
            });
        } catch (err) {
            console.error('❌ Error fetching Instagram profile:', err);
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
        console.log('🔄 Refreshing Instagram profile...');
        setState(prev => ({ ...prev, initialized: false }));
    }, []);

    return {
        ...state,
        refreshProfile
    };
}

// --- FUNKCJA POMOCNICZA DO FORMATOWANIA LICZB ---
const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`.replace('.0', 'M');
    if (num >= 10000) return `${(num / 1000).toFixed(1)}K`.replace('.0', 'K');
    return num.toString();
};

// --- KONFIGURACJA IKON I KOLORÓW ---
const statConfig = {
    posts: { icon: Grid3X3, gradient: 'from-purple-500 to-purple-600' },
    followers: { icon: Users, gradient: 'from-pink-500 to-pink-600' },
    following: { icon: UserCheck, gradient: 'from-blue-500 to-blue-600' },
    privacy: { icon: Lock, gradient: 'from-gray-500 to-gray-600' },
    highlights: { icon: Building2, gradient: 'from-indigo-500 to-indigo-600' },
    verified: { icon: Verified, gradient: 'from-emerald-500 to-emerald-600' }
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

// --- KOMPONENT DODAWANIA PROFILU ---
const AddInstagramProfile = memo(({ onProfileAdded }: { onProfileAdded: () => void }) => {
    const [instagramUrl, setInstagramUrl] = useState('');
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
        return url.includes('instagram.com') && url.includes('/');
    }, []);

    const checkInstagramProfile = useCallback(async (url: string): Promise<any> => {
        try {
            console.log('🔍 Checking Instagram profile:', url);

            const response = await fetch('/api/instagram-profile', {
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

            if (data.profilepic_url && data.followers_count !== null && data.posts_count !== null) {
                console.log('✅ Profile data is complete:', {
                    username: data.username,
                    followers: data.followers_count,
                    posts: data.posts_count,
                    savedProfileId: data.savedProfileId
                });
                return data;
            } else {
                console.log('⚠️ Profile exists but data incomplete:', {
                    has_profilepic: !!data.profilepic_url,
                    has_followers: data.followers_count !== null,
                    has_posts: data.posts_count !== null
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
            console.log('🔍 URL does not match Instagram pattern');
            setProfileData(null);
            setError(null);
            return;
        }

        console.log('🚀 Starting profile check for:', url);
        setCheckingProfile(true);
        setError(null);
        simulateProgress();

        const result = await checkInstagramProfile(url);

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
    }, [detectPlatform, checkInstagramProfile, simulateProgress]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (instagramUrl.trim()) {
                checkSocialProfile(instagramUrl.trim());
            } else {
                setProfileData(null);
                setError(null);
                setLoadingProgress(0);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [instagramUrl, checkSocialProfile]);

    const handleResetProfile = useCallback(() => {
        console.log('🔄 Resetting profile to initial state');
        setInstagramUrl('');
        setProfileData(null);
        setError(null);
        setCheckingProfile(false);
        setLoadingProgress(0);
        setImageError(false);
    }, []);

    const handleSaveProfile = useCallback(async () => {
        if (!profileData?.savedProfileId) {
            setError('Najpierw sprawdź poprawność profilu Instagram');
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

            const linkResponse = await fetch('/api/user/instagram-profile', {
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
            value: profileData ? formatNumberWithFallback(profileData.posts_count) : '---',
            label: "Posty:",
            type: "posts" as StatType
        },
        {
            value: profileData ? (profileData.is_public === false ? "Nie" : "Tak") : '---',
            label: "Publiczne:",
            type: "privacy" as StatType
        },
        {
            value: profileData ? formatNumberWithFallback(profileData.followers_count) : '---',
            label: "Obserwujący:",
            type: "followers" as StatType
        },
        {
            value: profileData ? formatNumberWithFallback(profileData.highlight_reel_count || 0) : '---',
            label: "Highlights:",
            type: "highlights" as StatType
        },
        {
            value: profileData ? formatNumberWithFallback(profileData.following_count) : '---',
            label: "Obserwuje:",
            type: "following" as StatType
        },
        {
            value: profileData ? (profileData.is_verified ? "Tak" : "Nie") : '---',
            label: "Weryfikacja:",
            type: "verified" as StatType
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
                                isInactive ? 'bg-gray-300' : 'bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-500'
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
                            {profileData?.businessCategory && (
                                <p className="text-xs text-gray-500 font-medium mb-1">{profileData.businessCategory}</p>
                            )}

                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <Image
                                    src="/ig.png"
                                    alt="Instagram"
                                    width={20}
                                    height={20}
                                    className="flex-shrink-0 opacity-70"
                                />
                                <h2 className={`text-xl md:text-2xl font-bold truncate transition-colors duration-300 ${
                                    isInactive ? 'text-gray-800' : 'text-gray-800'
                                }`}>
                                    {profileData?.username || 'Dodaj swój profil Instagram'}
                                </h2>
                            </div>

                            {profileData?.full_name && (
                                <p className={`text-sm font-medium mb-2 transition-colors duration-300 ${
                                    isInactive ? 'text-gray-400' : 'text-gray-700'
                                }`}>{profileData.full_name}</p>
                            )}

                            <div className={`hidden md:block border-t my-3 transition-colors duration-300 ${
                                isInactive ? 'border-gray-300' : 'border-gray-200'
                            }`}></div>

                            {profileData?.bio && (
                                <div className={`hidden md:block text-sm leading-relaxed mb-3 transition-colors duration-300 ${
                                    isInactive ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                    <p>{profileData.bio}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Input URL */}
                    <div className="text-sm w-full mt-4">
                        <div className="relative">
                            <input
                                type="url"
                                value={instagramUrl}
                                onChange={(e) => {
                                    setInstagramUrl(e.target.value);
                                    setError(null);
                                }}
                                placeholder="https://instagram.com/twoja_nazwa"
                                className={`w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-gray-400 focus:bg-gray-50 transition-colors ${
                                    checkingProfile ? 'text-gray-400 bg-gray-50' : 'text-gray-900 bg-white'
                                }`}
                                disabled={isLoading}
                            />
                            {checkingProfile && (
                                <>
                                    <div
                                        className="absolute inset-0 border-purple-400 border rounded-md transition-all duration-300 ease-out pointer-events-none"
                                        style={{
                                            clipPath: `inset(0 ${100 - loadingProgress}% 0 0)`,
                                            background: 'rgba(168, 85, 247, 0.1)'
                                        }}
                                    ></div>
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                        <div className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                            {loadingProgress}%
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {checkingProfile && (
                            <div className="flex justify-center mt-6">
                                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                                    <p className="text-purple-700 text-base font-medium animate-pulse">Wait for it...</p>
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
                                    className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-semibold py-2.5 px-3 rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm"
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
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 mb-4">
                                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Potwierdź przypisanie profilu
                            </h3>

                            <div className="border-t border-gray-200 mb-4"></div>

                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                Czy na pewno chcesz przypisać profil <strong>@{profileData?.username}</strong> do twojego konta inflee.app?
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
                                    className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white font-semibold py-2.5 px-4 rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
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
function InstagramProfileBar() {
    // WSZYSTKIE HOOKS MUSZĄ BYĆ NA POCZĄTKU - PRZED JAKIMIKOLWIEK WARUNKAMI
    const { status } = useSession();
    const { profile, loading, error, refreshProfile } = useInstagramProfile();
    const [imageError, setImageError] = useState(false);

    // Reset image error when profile changes
    useEffect(() => {
        if (profile) {
            setImageError(false);
        }
    }, [profile]);

    // Loading state z early return
    if (status === 'loading' || loading) {
        return <div className="w-full h-48 md:bg-gradient-to-r md:from-gray-100 md:to-gray-50 md:rounded-xl md:animate-pulse bg-gray-100 animate-pulse"></div>;
    }

    // Error state z early return
    if (error) {
        return <div className="md:bg-red-50 md:border md:border-red-200 text-red-700 p-2 md:p-4 md:rounded-xl bg-red-50 border-l-4 border-red-400">{error}</div>;
    }

    // Brak profilu - pokaż formularz dodawania
    if (!profile) {
        return <AddInstagramProfile onProfileAdded={refreshProfile} />;
    }

    // Istniejący profil
    const statsData = [
        { value: formatNumber(profile.postsCount), label: "Posty:", type: "posts" as StatType },
        { value: profile.isPrivate ? "Nie" : "Tak", label: "Publiczne:", type: "privacy" as StatType },
        { value: formatNumber(profile.followersCount), label: "Obserwujący:", type: "followers" as StatType },
        { value: formatNumber(profile.highlightReelCount || 0), label: "Highlights:", type: "highlights" as StatType },
        { value: formatNumber(profile.followsCount), label: "Obserwuje:", type: "following" as StatType },
        { value: profile.isVerified ? "Tak" : "Nie", label: "Weryfikacja:", type: "verified" as StatType },
    ];

    return (
        <div className="w-full md:bg-white md:rounded-xl md:border md:border-gray-200 md:shadow-sm p-2 md:p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row gap-4 md:gap-6">

                {/* === LEWA STRONA: PROFIL === */}
                <div className="flex-1 lg:w-1/2 lg:border-r lg:border-gray-200 lg:pr-6">
                    <div className="flex flex-col items-center gap-4 md:flex-row md:items-center">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-500 p-[2px]">
                                <div className="w-full h-full bg-white rounded-full p-0.5">
                                    {profile.profilePicUrlHD && !imageError ? (
                                        <Image
                                            src={profile.profilePicUrlHD?.startsWith('/api/proxy-image')
                                                ? profile.profilePicUrlHD
                                                : `/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrlHD || '')}`
                                            }
                                            alt={`Zdjęcie profilowe ${profile.username}`}
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
                            {profile.businessCategory && (
                                <p className="text-xs text-gray-500 font-medium mb-1">{profile.businessCategory}</p>
                            )}

                            <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                <Image
                                    src="/ig.png"
                                    alt="Instagram"
                                    width={20}
                                    height={20}
                                    className="flex-shrink-0"
                                />
                                <h2 className="text-xl md:text-2xl font-bold text-gray-800 truncate">
                                    {profile.username}
                                </h2>
                            </div>

                            {profile.fullName && (
                                <p className="text-sm text-gray-700 font-medium mb-2">{profile.fullName}</p>
                            )}

                            {profile.biography && (
                                <div className="hidden md:block border-t border-gray-200 my-3"></div>
                            )}

                            {profile.biography && (
                                <div className="hidden md:block text-sm text-gray-600 leading-relaxed">
                                    <p>{profile.biography}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* === PRAWA STRONA: STATYSTYKI === */}
                <div className="flex-1 lg:w-1/2 border-t md:border-t lg:border-t-0 border-gray-200 pt-4 md:pt-6 lg:pt-0">
                    <div className="grid grid-cols-2 gap-3">
                        {statsData.map(stat => (
                            <StatCard key={stat.type} {...stat} />
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default memo(InstagramProfileBar);