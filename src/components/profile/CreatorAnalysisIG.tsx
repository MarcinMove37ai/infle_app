'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Award, TrendingUp, Sparkles, BrainCircuit, MessageSquareQuote, AlertCircle, User, Lightbulb, Target, Users, BookOpen, Zap, Heart, Shield, ArrowDownToLine } from 'lucide-react';

interface CreatorAnalysisProps {
  onAnalysisComplete?: (success: boolean, data?: CreatorAnalysisResponse) => void;
  initialData?: CreatorAnalysisResponse | null;
  skipInitialFetch?: boolean;
  forceRefresh?: boolean;
  onClose?: () => void;
  aiAnalysisData?: AIAnalysisData | null;
}

// Interfejsy dla Apify API
interface CreatorAnalysisResponse {
  success: boolean;
  username: string;
  userId: string;
  totalPosts: number;
  posts: PostAnalysisData[];
  requestDurationMs: number;
  savedToDatabase: boolean;
  savedCount: number;
  errorCount: number;
  fetchedAt?: number;
}

interface PostAnalysisData {
  userId: string;
  username:string;
  postId: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  videoPlayCount: number | null;
  videoDuration: number | null;
  commenterUsernames: Record<string, number>;
}

// ZAKTUALIZOWANE interfejsy dla AI Analysis z uniqueTalent
interface AIAnalysisResponse {
  success: boolean;
  username: string;
  postsAnalyzed: number;
  analysis: AIAnalysisData;
  metadata: {
    generatedAt: string;
    aiModel: string;
    postsCount: number;
    version?: string;
  };
}

interface AIAnalysisData {
  username: string;
  profileDescription: string;
  competencies: AICompetency[];
  uniqueTalent: AIUniqueTalent;
}

interface AICompetency {
  name: string;
  iconType: string;
  description: string;
  evidence: string[];
}

interface AIUniqueTalent {
  name: string;
  description: string;
  marketValue: string;
  evidence: string[];
}

// Mapowanie ikon
const iconMap = {
  BrainCircuit: BrainCircuit,
  TrendingUp: TrendingUp,
  MessageSquareQuote: MessageSquareQuote,
  Lightbulb: Lightbulb,
  Target: Target,
  Users: Users,
  BookOpen: BookOpen,
  Zap: Zap,
  Heart: Heart,
  Shield: Shield,
};

// Pomocnicza funkcja do sprawdzania świeżości danych
const isDataFresh = (data: CreatorAnalysisResponse | null): boolean => {
  if (!data || !data.fetchedAt) return false;
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  return data.fetchedAt > fiveMinutesAgo;
};

// === KOMPONENT ŁADOWANIA ===

const ProgressBar = ({ progress, label, status, isActive }: { progress: number; label: string; status: string; isActive: boolean }) => {
    return (
        <div className="mb-6 transition-opacity duration-300" style={{ opacity: isActive || progress === 100 ? 1 : 0.5 }}>
            <div className="flex justify-between items-center mb-2">
                <p className={`text-base font-medium ${isActive ? 'text-gray-800' : 'text-gray-500'}`}>{label}</p>
                <p className={`text-sm font-semibold ${isActive ? 'text-purple-600' : 'text-gray-500'}`}>{Math.round(progress)}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
            <p className="text-center text-gray-600 text-sm mt-2 h-5">
                {isActive && status}
            </p>
        </div>
    );
};

const LoadingView = ({ phase, apiStatus }: { phase: 'fetching' | 'analyzing', apiStatus: string }) => {
    const [apiProgress, setApiProgress] = useState(0);
    const [aiProgress, setAiProgress] = useState(0);
    const [currentAiStatus, setCurrentAiStatus] = useState("Oczekiwanie na dane...");

    useEffect(() => {
        if (phase === 'fetching') {
            setApiProgress(0);
            const interval = setInterval(() => {
                setApiProgress(prev => {
                    if (prev >= 99) {
                        clearInterval(interval);
                        return 99;
                    }
                    return prev + 100 / 60;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [phase]);

    useEffect(() => {
        if (phase === 'analyzing') {
            setApiProgress(100);
            const loadingStates = [
                "Analizuję semantycznie Twoje treści...",
                "Grupuję wątki tematyczne...",
                "Identyfikuję Twoje główne filary wiedzy...",
                "Odkrywam Twój ukryty talent...",
                "Finalizuję raport Twoich supermocy..."
            ];
            let stateIndex = 0;
            const interval = setInterval(() => {
                if (stateIndex < loadingStates.length) {
                    setCurrentAiStatus(loadingStates[stateIndex]);
                    setAiProgress(((stateIndex + 1) / loadingStates.length) * 100);
                    stateIndex++;
                } else {
                    clearInterval(interval);
                }
            }, 3125);
            return () => clearInterval(interval);
        }
    }, [phase]);

    return (
        <div className="text-center p-4 md:p-8">
            <div className="flex justify-center items-center gap-4 mb-8">
                {phase === 'fetching' ? (
                    <ArrowDownToLine className="text-blue-500 animate-bounce" size={32} />
                ) : (
                    <Sparkles className="text-purple-500 animate-pulse" size={36} />
                )}
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                    Pobieranie i analiza Twoich danych...
                </h2>
            </div>
            <div className="w-full max-w-lg mx-auto">
                <ProgressBar
                    label="Etap 1: Pobieranie danych z profilu"
                    progress={apiProgress}
                    status={phase === 'fetching' ? apiStatus : 'Dane pobrane pomyślnie!'}
                    isActive={phase === 'fetching'}
                />
                <ProgressBar
                    label="Etap 2: Analiza semantyczna AI"
                    progress={aiProgress}
                    status={currentAiStatus}
                    isActive={phase === 'analyzing'}
                />
            </div>
            <p className="text-sm text-gray-500 mt-8">Proces może potrwać do 2 minut. Dziękujemy za cierpliwość.</p>
        </div>
    );
};

const ErrorView = ({ error, onRetry }: { error: string; onRetry: () => void }) => {
    return (
        <div className="text-center p-4 md:p-8">
            <div className="flex justify-center items-center mb-4">
                <AlertCircle className="text-red-500" size={48} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-red-700 mb-4">Błąd podczas analizy</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
                onClick={onRetry}
                className="bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors"
            >
                Spróbuj ponownie
            </button>
        </div>
    );
};

const LoadedFromDatabaseInfo = ({ username }: { username: string }) => {
    return (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600">✓</span>
                </div>
                <div>
                    <p className="text-green-800 font-medium">Analiza załadowana z bazy danych</p>
                    <p className="text-green-600 text-sm">Twoja analiza dla @{username} została wcześniej wygenerowana i zapisana.</p>
                </div>
            </div>
        </div>
    );
};

// === KOMPONENTY WYNIKÓW AI ===

const CreatorProfileDescription = ({ username, description, isMinimized }: {
    username: string,
    description: string,
    isMinimized: boolean
}) => {
    if (isMinimized) {
        return (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-xl p-3 mb-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 p-[2px]">
                            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                                <User className="text-blue-600" size={18} />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-blue-800 mb-1">
                            Analiza profilu @{username}
                        </h3>
                        <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                            {description}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-2xl p-6 md:p-8 mb-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 p-[2px]">
                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                        <User className="text-blue-600 w-6 h-6 md:w-7 md:h-7" />
                    </div>
                </div>
                <div>
                    <h3 className="text-lg md:text-xl font-bold text-blue-800">
                        Przeanalizowałem Twój profil @{username}
                    </h3>
                </div>
            </div>

            <div className="bg-white/70 rounded-xl p-4 md:p-6 border border-blue-100">
                <p className="text-gray-600 text-sm md:text-sm leading-relaxed font-medium">
                    {description}
                </p>
            </div>
        </div>
    );
};

const CompetencyCard = ({ competency }: { competency: AICompetency }) => {
    const IconComponent = iconMap[competency.iconType as keyof typeof iconMap] || BrainCircuit;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col">
            <div className="flex items-center gap-3 mb-3">
                <IconComponent size={24} className="text-blue-500" />
                <h3 className="text-lg md:text-xl font-bold text-gray-800">{competency.name}</h3>
            </div>
            <p className="text-gray-600 text-sm md:text-sm leading-relaxed flex-grow mb-3">
                {competency.description}
            </p>
            {competency.evidence && competency.evidence.length > 0 && (
                <div className="border-t border-gray-100 pt-3 mt-auto">
                    <p className="text-xs text-gray-500 mb-2">Dowody z Twoich postów:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                        {competency.evidence.slice(0, 3).map((evidence, index) => (
                            <li key={index} className="flex items-start">
                                <span className="text-blue-500 mr-2">•</span>
                                <span>{evidence}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const UniqueTalentCard = ({ talent }: { talent: AIUniqueTalent }) => (
     <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 md:p-8 shadow-lg">
         <div className="text-center mb-6">
             <div className="flex justify-center items-center gap-3 mb-3">
                <span className="text-3xl">🔍</span>
                <h3 className="text-xl md:text-2xl font-bold text-amber-800">
                    Odkryłem Twój Ukryty Talent
                </h3>
             </div>
             <p className="text-amber-700 font-medium">
                 Analizując Twoje posty, znalazłem nieoczywisty talent, który Cię wyróżnia.
             </p>
         </div>

         <div className="bg-white/80 rounded-xl p-6 mb-6">
             <div className="text-center mb-4">
                 <h4 className="text-lg md:text-xl font-bold text-gray-800 mb-3">
                     {talent.name}
                 </h4>
                 <p className="text-gray-700 leading-relaxed mb-4">
                     {talent.description}
                 </p>
                 {talent.evidence && talent.evidence.length > 0 && (
                     <div className="border-t border-gray-200 pt-4">
                         <p className="text-sm text-gray-600 mb-2 font-medium">🎯 Dowody z Twoich postów:</p>
                         <ul className="text-sm text-gray-700 space-y-1">
                             {talent.evidence.map((evidence, index) => (
                                 <li key={index} className="flex items-start justify-center">
                                     <span className="text-amber-500 mr-2">•</span>
                                     <span className="text-left">{evidence}</span>
                                 </li>
                             ))}
                         </ul>
                     </div>
                 )}
             </div>
         </div>

         <div className="text-center">
             <p className="text-sm md:text-base text-amber-700 font-medium">
                 💰 <strong>Wartość rynkowa:</strong> {talent.marketValue}
             </p>
         </div>
    </div>
);

// === GŁÓWNY KOMPONENT WYNIKÓW ===

const AIResultsView = ({ aiData, isMinimized, onNext, loadedFromDatabase = false, realUsername }: {
    aiData: AIAnalysisData,
    isMinimized: boolean,
    onNext: () => void,
    loadedFromDatabase?: boolean,
    realUsername: string
}) => {
    if (isMinimized) {
        return (
            <div className="flex items-center">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-500 p-[2px]">
                            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                                <Award className="text-purple-600" size={20} />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-gray-800">
                            Analiza Twórcy AI
                        </h2>
                        <p className="text-sm text-gray-600 truncate hidden md:block">
                            {aiData.competencies.map(comp => comp.name).join(' • ')} • 🔍 <strong>{aiData.uniqueTalent.name}</strong>
                        </p>
                        <div className="text-sm text-gray-600 md:hidden">
                            {aiData.competencies.map((comp, index) => {
                                const icons = ['①', '②', '③'];
                                return <div key={index}>{icons[index]} {comp.name}</div>
                            })}
                            <div>🔍 <strong>{aiData.uniqueTalent.name}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="text-center mb-6 md:mb-10">
                <div className="flex items-center justify-center gap-3 text-purple-600 mb-2">
                    <Award className="w-7 h-7 md:w-8 md:h-8" />
                    <h2 className="text-2xl md:text-4xl font-bold">Analiza Twórcy AI</h2>
                </div>
            </div>

            <div className="mb-6 md:mb-10">
                <CreatorProfileDescription
                    username={realUsername}
                    description={aiData.profileDescription}
                    isMinimized={false}
                />
            </div>

            <div className="text-center mb-6 md:mb-10">
                <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                    Odkryłem kluczowe cechy, które definiują Cię jako eksperta i stanowią największą wartość dla Twoich odbiorców.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-10">
                {aiData.competencies.map((comp, index) => (
                    <CompetencyCard key={index} competency={comp} />
                ))}
            </div>

            <UniqueTalentCard talent={aiData.uniqueTalent} />

            <div className="text-center mt-8 md:mt-12">
                 <button
                    onClick={onNext}
                    className="bg-purple-600 text-white font-bold py-3 px-6 md:px-8 rounded-lg hover:bg-purple-700 transition-transform hover:scale-105 shadow-lg text-sm md:text-base"
                 >
                    OK, rozumiem swoje atuty. Zobaczmy, dla kogo tworzę →
                </button>
            </div>
        </div>
    );
};

// === GŁÓWNY KOMPONENT ===

export default function CreatorAnalysis({
  onAnalysisComplete,
  initialData = null,
  skipInitialFetch = false,
  forceRefresh = false,
  onClose,
  aiAnalysisData = null
}: CreatorAnalysisProps) {
    const { data: session } = useSession();

    // ZMIANA: Wyodrębnienie stabilnych, prymitywnych zależności z obiektu sesji.
    const instagramUsername = session?.user?.instagramUsername;
    const isAuthenticated = !!session?.user;

    const hasFetchedRef = useRef(false);
    const currentUsernameRef = useRef<string | null>(null);
    const aiAnalysisInProgressRef = useRef(false);
    const componentRef = useRef<HTMLDivElement>(null);

    const [phase, setPhase] = useState<'fetching' | 'analyzing' | 'ready' | 'error'>('ready');
    const [apiStatus, setApiStatus] = useState('Łączenie z API...');
    const [error, setError] = useState<string | null>(null);
    const [analysisData, setAnalysisData] = useState<CreatorAnalysisResponse | null>(initialData);
    const [aiData, setAiData] = useState<AIAnalysisData | null>(aiAnalysisData);
    const [isMinimized, setIsMinimized] = useState(false);
    const [loadedFromDatabase, setLoadedFromDatabase] = useState(!!aiAnalysisData);

    // ZMIANA: Funkcja przyjmuje teraz `username` jako argument, aby uniknąć zależności od `session` wewnątrz.
    const shouldFetch = (username: string | undefined): boolean => {
        if (aiAnalysisData) return false;
        if (skipInitialFetch && !forceRefresh) return false;
        if (!isAuthenticated || !username) return false; // ZMIANA: Użycie stabilnej flagi

        if (currentUsernameRef.current && currentUsernameRef.current !== username) {
            hasFetchedRef.current = false;
        }
        currentUsernameRef.current = username;

        if (hasFetchedRef.current && !forceRefresh) return false;
        if (isDataFresh(analysisData) && !forceRefresh) return false;

        return true;
    };

    const checkExistingData = async (username: string): Promise<CreatorAnalysisResponse | null> => {
        try {
            const response = await fetch(`/api/social/instagram/creator-analysis/check?username=${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.exists && data.data) {
                    return { ...data.data, fetchedAt: Date.now() };
                }
            }
        } catch (err) {
            console.log('Nie udało się sprawdzić istniejących danych:', err);
        }
        return null;
    };

    // ZMIANA: Funkcja przyjmuje `username` jako argument.
    const fetchCreatorAnalysis = async (username: string, forceNewFetch = false) => {
        try {
            setPhase('fetching');
            setApiStatus('Przygotowywanie żądania...');
            setError(null);

            if (!isAuthenticated) { // ZMIANA: Użycie stabilnej flagi
                throw new Error('Brak aktywnej sesji użytkownika');
            }

            if (!forceNewFetch) {
                setApiStatus(`Sprawdzanie istniejących danych dla @${username}...`);
                const existingData = await checkExistingData(username);

                if (existingData) {
                    setAnalysisData(existingData);
                    setApiStatus('Dane gotowe, rozpoczynam analizę AI...');
                    hasFetchedRef.current = true;
                    setTimeout(() => {
                        performAIAnalysisWithData(username);
                    }, 500);
                    return;
                }
            }

            setApiStatus(`Pobieranie nowych danych dla @${username}...`);

            const response = await fetch('/api/social/instagram/creator-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username,
                    postsLimit: 3
                })
            });

            setApiStatus('Przetwarzanie odpowiedzi...');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || `HTTP ${response.status}`);
            }

            const data: CreatorAnalysisResponse = await response.json();

            if (!data.success) {
                throw new Error('API zwróciło błąd: ' + JSON.stringify(data));
            }

            setApiStatus('Dane pobrane, rozpoczynam analizę AI...');
            data.fetchedAt = Date.now();
            setAnalysisData(data);
            hasFetchedRef.current = true;

            if (componentRef.current) {
                const rect = componentRef.current.getBoundingClientRect();
                if (rect.top < 0) {
                    componentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }

            setTimeout(() => {
                performAIAnalysisWithData(username);
            }, 1000);

        } catch (err) {
            console.error('Błąd podczas pobierania analizy:', err);
            setError(err instanceof Error ? err.message : 'Nieznany błąd');
            setPhase('error');
        }
    };

    const performAIAnalysisWithData = async (username: string) => {
        if (aiAnalysisInProgressRef.current) {
            console.log('🔄 AI Analysis already in progress, skipping...');
            return;
        }

        try {
            aiAnalysisInProgressRef.current = true;
            setPhase('analyzing');
            setError(null);
            setLoadedFromDatabase(false);

            const response = await fetch('/api/social/instagram/creator-analysis/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || `AI API error: ${response.status}`);
            }

            const aiResponse: AIAnalysisResponse = await response.json();

            if (!aiResponse.success) {
                throw new Error('AI API zwróciło błąd: ' + JSON.stringify(aiResponse));
            }

            setAiData(aiResponse.analysis);
            setPhase('ready');

            setTimeout(() => {
                if (componentRef.current) {
                    componentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 100);

            if (onAnalysisComplete) {
                onAnalysisComplete(true, analysisData || undefined);
            }

        } catch (err) {
            console.error('❌ AI Analysis error:', err);
            setError(`Błąd analizy AI: ${err instanceof Error ? err.message : 'Nieznany błąd'}`);
            setPhase('error');

            if (onAnalysisComplete) {
                onAnalysisComplete(false);
            }
        } finally {
            aiAnalysisInProgressRef.current = false;
        }
    };

    const handleRetry = () => {
        if (instagramUsername) { // ZMIANA: Sprawdzenie czy jest nazwa użytkownika
            hasFetchedRef.current = false;
            aiAnalysisInProgressRef.current = false;
            setAiData(null);
            setLoadedFromDatabase(false);
            fetchCreatorAnalysis(instagramUsername, true);
        }
    };

    const handleNext = () => {
        alert("Przechodzenie do Kroku 2 - Analiza odbiorców!");
    };

    const toggleMinimized = () => {
        setIsMinimized(!isMinimized);
    };

    // === EFEKTY ===

    useEffect(() => {
        if (aiAnalysisData) {
            setAiData(aiAnalysisData);
            setLoadedFromDatabase(true);
            setPhase('ready');
            hasFetchedRef.current = true;
            return;
        }

        if (initialData && !forceRefresh) {
            setAnalysisData(initialData);
            setPhase('ready');
            hasFetchedRef.current = true;
            return;
        }

        if (shouldFetch(instagramUsername || undefined)) {
            fetchCreatorAnalysis(instagramUsername!); // ZMIANA: Przekazanie nazwy użytkownika
        } else if (analysisData) {
            setPhase('ready');
        }
    // ZMIANA: Zaktualizowana, stabilna tablica zależności.
    }, [isAuthenticated, instagramUsername, forceRefresh, aiAnalysisData]);

    useEffect(() => {
        if (forceRefresh && instagramUsername) { // ZMIANA: Sprawdzenie czy jest nazwa użytkownika
            hasFetchedRef.current = false;
            aiAnalysisInProgressRef.current = false;
            setAiData(null);
            setLoadedFromDatabase(false);
            fetchCreatorAnalysis(instagramUsername, true);
        }
    }, [forceRefresh, instagramUsername]); // ZMIANA: Dodano `instagramUsername` dla spójności

    // === RENDEROWANIE ===

    return (
        <div
            ref={componentRef}
            className={`w-full md:bg-white md:rounded-xl md:border md:border-gray-200 md:shadow-sm p-2 md:p-4 lg:p-6 mt-4 transition-all duration-500 relative ${phase === 'ready' ? 'lg:pr-16' : ''}`}
        >
            {phase === 'ready' && aiData && (
                <>
                    <div className="md:hidden flex justify-center mb-4">
                        <button
                            onClick={toggleMinimized}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
                            title={isMinimized ? "Rozwiń analizę" : "Zwiń analizę"}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-gray-800 transition-colors duration-200">
                                {isMinimized ? <path d="M6 9l6 6 6-6"/> : <path d="M18 15l-6-6-6 6"/>}
                            </svg>
                        </button>
                    </div>

                    <button
                        onClick={toggleMinimized}
                        className="hidden md:block absolute top-2 right-2 md:top-4 md:right-4 lg:top-8 lg:right-6 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group z-10"
                        title={isMinimized ? "Rozwiń analizę" : "Zwiń analizę"}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-gray-800 transition-colors duration-200">
                            {isMinimized ? <path d="M6 9l6 6 6-6"/> : <path d="M18 15l-6-6-6 6"/>}
                        </svg>
                    </button>
                </>
            )}

            {(phase === 'fetching' || phase === 'analyzing') && (
                <LoadingView phase={phase} apiStatus={apiStatus} />
            )}

            {phase === 'error' && error && (
                <ErrorView error={error} onRetry={handleRetry} />
            )}

            {phase === 'ready' && aiData && (
                <AIResultsView
                    aiData={aiData}
                    isMinimized={isMinimized}
                    onNext={handleNext}
                    loadedFromDatabase={loadedFromDatabase}
                    realUsername={instagramUsername || 'user'} // ZMIANA: Użycie stabilnej nazwy
                />
            )}
        </div>
    );
}