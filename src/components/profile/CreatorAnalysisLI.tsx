'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Award, TrendingUp, Sparkles, BrainCircuit, MessageSquareQuote, AlertCircle, User, Lightbulb, Target, Users, BookOpen, Zap, Heart, Shield, ArrowDownToLine, CheckCircle, Database } from 'lucide-react';

interface CreatorAnalysisProps {
  onAnalysisComplete?: (success: boolean, data?: LinkedInCreatorAnalysisResponse) => void;
  initialData?: LinkedInCreatorAnalysisResponse | null;
  skipInitialFetch?: boolean;
  forceRefresh?: boolean;
  onClose?: () => void;
  aiAnalysisData?: LinkedInAIAnalysisData | null;
}

// Interfejsy dla LinkedIn API
interface LinkedInPostRecord {
  userId: string;
  username: string;
  postUrn: string;
  postDate: string;
  postText: string;
  totalReactions: number;
  commentsCount: number;
  commenterHeadlines: string; // JSON string z {"username": "headline"}
}

interface LinkedInCreatorAnalysisResponse {
  success: boolean;
  username: string;
  totalPosts: number;
  posts: LinkedInPostRecord[];
  fetchedAt: number;
}

// Interface dla analizy AI LinkedIn
interface LinkedInAIAnalysisData {
  username: string;
  profileDescription: string;
  businessCompetencies: Array<{
    name: string;
    iconType: string;
    description: string;
    evidence: string[];
  }>;
  expertiseNiche: {
    name: string;
    description: string;
    marketValue: string;
    evidence: string[];
  };
}

// 🆕 DODANE: Helper function do ekstrakcji username z LinkedIn URL
const extractUsernameFromLinkedInUrl = (input: string | undefined): string | null => {
    if (!input) return null;

    // Jeśli to już jest krótka forma (bez http/https)
    if (!input.includes('linkedin.com')) {
        return input;
    }

    // Extract username z pełnego LinkedIn URL
    // https://www.linkedin.com/in/charlie-hills/ -> charlie-hills
    const match = input.match(/linkedin\.com\/in\/([^\/\?]+)/);
    if (match && match[1]) {
        console.log(`🔄 Extracted LinkedIn username: ${input} -> ${match[1]}`);
        return match[1];
    }

    console.log(`⚠️ Could not extract username from: ${input}`);
    return null;
};

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
const isDataFresh = (data: LinkedInCreatorAnalysisResponse | null): boolean => {
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
                <p className={`text-sm font-semibold ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>{Math.round(progress)}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
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
                    return prev + 100 / 90; // Trochę wolniej niż Instagram
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [phase]);

    useEffect(() => {
        if (phase === 'analyzing') {
            setApiProgress(100);
            const loadingStates = [
                "Analizuję semantycznie Twoje treści biznesowe...",
                "Mapuję Twoje kompetencje zawodowe...",
                "Identyfikuję Twoją ekspercką niszę...",
                "Odkrywam Twój unikalny positioning...",
                "Finalizuję raport Twojej przewagi konkurencyjnej..."
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
                    <Sparkles className="text-blue-500 animate-pulse" size={36} />
                )}
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                    {phase === 'fetching' ? 'Pobieranie i analiza Twoich danych LinkedIn...' : 'Analiza semantyczna AI...'}
                </h2>
            </div>
            <div className="w-full max-w-lg mx-auto">
                <ProgressBar
                    label="Etap 1: Pobieranie postów i analizy komentujących"
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
            <p className="text-sm text-gray-500 mt-8">Analizujemy Twoje posty i mapujemy Twoją sieć zawodową. Proces może potrwać do 3 minut.</p>
        </div>
    );
};

const ErrorView = ({ error, onRetry }: { error: string; onRetry: () => void }) => {
    return (
        <div className="text-center p-4 md:p-8">
            <div className="flex justify-center items-center mb-4">
                <AlertCircle className="text-red-500" size={48} />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-red-700 mb-4">Błąd podczas analizy LinkedIn</h2>
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


// === KOMPONENTY WYNIKÓW AI ===

const LinkedInProfileDescription = ({ username, description, isMinimized }: {
    username: string,
    description: string,
    isMinimized: boolean
}) => {
    if (isMinimized) {
        return (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-200 rounded-xl p-3 mb-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-blue-600 p-[2px]">
                            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                                <User className="text-blue-600" size={18} />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-blue-800 mb-1">
                            Analiza biznesowa {username}
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
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-200 rounded-2xl p-6 md:p-8 mb-8 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-blue-600 p-[2px]">
                    <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                        <User className="text-blue-600 w-6 h-6 md:w-7 md:h-7" />
                    </div>
                </div>
                <div>
                    <h3 className="text-lg md:text-xl font-bold text-blue-800">
                        Przeanalizowałem Twój profil LinkedIn {username}
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

const BusinessCompetencyCard = ({ competency }: { competency: LinkedInAIAnalysisData['businessCompetencies'][0] }) => {
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

const ExpertiseNicheCard = ({ expertiseNiche }: { expertiseNiche: LinkedInAIAnalysisData['expertiseNiche'] }) => (
     <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-6 md:p-8 shadow-lg">
         <div className="text-center mb-6">
             <div className="flex justify-center items-center gap-3 mb-3">
                <span className="text-3xl">🎯</span>
                <h3 className="text-xl md:text-2xl font-bold text-amber-800">
                    Odkryłem Twoją Ekspercką Niszę
                </h3>
             </div>
             <p className="text-amber-700 font-medium">
                 Analizując Twoje posty LinkedIn, znalazłem unikalny obszar eksperckości, który Cię wyróżnia.
             </p>
         </div>

         <div className="bg-white/80 rounded-xl p-6 mb-6">
             <div className="text-center mb-4">
                 <h4 className="text-lg md:text-xl font-bold text-gray-800 mb-3">
                     {expertiseNiche.name}
                 </h4>
                 <p className="text-gray-700 leading-relaxed mb-4">
                     {expertiseNiche.description}
                 </p>
                 {expertiseNiche.evidence && expertiseNiche.evidence.length > 0 && (
                     <div className="border-t border-gray-200 pt-4">
                         <p className="text-sm text-gray-600 mb-2 font-medium">🎯 Dowody z Twoich postów:</p>
                         <ul className="text-sm text-gray-700 space-y-1">
                             {expertiseNiche.evidence.map((evidence, index) => (
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
                 💰 <strong>Wartość rynkowa:</strong> {expertiseNiche.marketValue}
             </p>
         </div>
    </div>
);

// === GŁÓWNY KOMPONENT WYNIKÓW AI ===

const LinkedInAIResultsView = ({ aiData, isMinimized, onNext, loadedFromDatabase = false, realUsername }: {
    aiData: LinkedInAIAnalysisData,
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
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-blue-600 p-[2px]">
                            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                                <Award className="text-blue-600" size={20} />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-gray-800">
                            Analiza Biznesowa AI
                        </h2>
                        <p className="text-sm text-gray-600 truncate hidden md:block">
                            {aiData.businessCompetencies.map(comp => comp.name).join(' • ')} • 🎯 <strong>{aiData.expertiseNiche.name}</strong>
                        </p>
                        <div className="text-sm text-gray-600 md:hidden">
                            {aiData.businessCompetencies.map((comp, index) => {
                                const icons = ['①', '②', '③'];
                                return <div key={index}>{icons[index]} {comp.name}</div>
                            })}
                            <div>🎯 <strong>{aiData.expertiseNiche.name}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="text-center mb-6 md:mb-10">
                <div className="flex items-center justify-center gap-3 text-blue-600 mb-2">
                    <Award className="w-7 h-7 md:w-8 md:h-8" />
                    <h2 className="text-2xl md:text-4xl font-bold">Analiza Biznesowa AI</h2>
                </div>
            </div>


            <div className="mb-6 md:mb-10">
                <LinkedInProfileDescription
                    username={realUsername}
                    description={aiData.profileDescription}
                    isMinimized={false}
                />
            </div>

            <div className="text-center mb-6 md:mb-10">
                <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-2">
                    Odkryłem kluczowe kompetencje biznesowe, które definiują Cię jako eksperta i stanowią największą wartość dla Twojej sieci zawodowej.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-10">
                {aiData.businessCompetencies.map((comp, index) => (
                    <BusinessCompetencyCard key={index} competency={comp} />
                ))}
            </div>

            <ExpertiseNicheCard expertiseNiche={aiData.expertiseNiche} />

            <div className="text-center mt-8 md:mt-12">
                 <button
                    onClick={onNext}
                    className="bg-blue-600 text-white font-bold py-3 px-6 md:px-8 rounded-lg hover:bg-blue-700 transition-transform hover:scale-105 shadow-lg text-sm md:text-base"
                 >
                    OK, rozumiem swoją przewagę konkurencyjną. Co dalej? →
                </button>
            </div>
        </div>
    );
};

// === KOMPONENT WYNIKÓW - Data Fetched (bez AI) ===

const DataFetchedSuccessView = ({ data, isMinimized, onNext }: {
    data: LinkedInCreatorAnalysisResponse,
    isMinimized: boolean,
    onNext: () => void
}) => {
    if (isMinimized) {
        return (
            <div className="flex items-center">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-blue-600 p-[2px]">
                            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                                <Database className="text-blue-600" size={20} />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold text-gray-800">
                            Analiza LinkedIn
                        </h2>
                        <p className="text-sm text-gray-600 truncate">
                            {data.totalPosts} postów • {data.posts.reduce((sum, post) => sum + post.totalReactions, 0)} reakcji • Dane pobrane
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const totalReactions = data.posts.reduce((sum, post) => sum + post.totalReactions, 0);
    const totalComments = data.posts.reduce((sum, post) => sum + post.commentsCount, 0);

    // Analiza komentujących
    const allCommenters = new Set<string>();
    const commenterTitles: Record<string, string> = {};

    data.posts.forEach(post => {
        if (post.commenterHeadlines) {
            try {
                const commenters = JSON.parse(post.commenterHeadlines);
                Object.entries(commenters).forEach(([name, title]) => {
                    allCommenters.add(name);
                    commenterTitles[name] = title as string;
                });
            } catch (e) {
                // Ignoruj błędy parsowania JSON
            }
        }
    });

    return (
        <div className="w-full">
            <div className="text-center mb-6 md:mb-8">
                <div className="flex items-center justify-center gap-3 text-blue-600 mb-2">
                    <CheckCircle className="w-7 h-7 md:w-8 md:h-8" />
                    <h2 className="text-2xl md:text-3xl font-bold">Dane LinkedIn Pobrane</h2>
                </div>
                <p className="text-gray-600">Twoje dane zostały pomyślnie pobrane i zapisane w bazie danych</p>
            </div>

            {/* Statystyki */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{data.totalPosts}</div>
                    <div className="text-sm text-blue-700">Przeanalizowanych postów</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{totalReactions}</div>
                    <div className="text-sm text-green-700">Łączne reakcje</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{totalComments}</div>
                    <div className="text-sm text-purple-700">Łączne komentarze</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{allCommenters.size}</div>
                    <div className="text-sm text-orange-700">Unikalnych komentujących</div>
                </div>
            </div>

            <div className="text-center">
                <button
                    onClick={onNext}
                    className="bg-blue-600 text-white font-bold py-3 px-6 md:px-8 rounded-lg hover:bg-blue-700 transition-transform hover:scale-105 shadow-lg text-sm md:text-base"
                >
                    OK, rozumiem. Dane zostały zapisane ✓
                </button>
            </div>
        </div>
    );
};

// === GŁÓWNY KOMPONENT ===

export default function CreatorAnalysisLI({
  onAnalysisComplete,
  initialData = null,
  skipInitialFetch = false,
  forceRefresh = false,
  onClose,
  aiAnalysisData = null
}: CreatorAnalysisProps) {
    const { data: session } = useSession();

    // 🆕 ZMIANA: Wyodrębnienie i konwersja linkedinUsername do krótkiej formy
    const rawLinkedinUsername = (session?.user as any)?.linkedinUsername || session?.user?.name;
    const linkedinUsername = extractUsernameFromLinkedInUrl(rawLinkedinUsername);
    const isAuthenticated = !!session?.user;

    const hasFetchedRef = useRef(false);
    const currentUsernameRef = useRef<string | null>(null);
    const aiAnalysisInProgressRef = useRef(false);
    const componentRef = useRef<HTMLDivElement>(null);

    const [phase, setPhase] = useState<'fetching' | 'analyzing' | 'ready' | 'error'>('ready');
    const [apiStatus, setApiStatus] = useState('Łączenie z LinkedIn API...');
    const [error, setError] = useState<string | null>(null);
    const [analysisData, setAnalysisData] = useState<LinkedInCreatorAnalysisResponse | null>(initialData);
    const [aiData, setAiData] = useState<LinkedInAIAnalysisData | null>(aiAnalysisData);
    const [isMinimized, setIsMinimized] = useState(false);
    const [loadedFromDatabase, setLoadedFromDatabase] = useState(!!aiAnalysisData);

    const shouldFetch = (username: string | undefined): boolean => {
        if (aiAnalysisData) return false;
        if (skipInitialFetch && !forceRefresh) return false;
        if (!isAuthenticated || !username) return false;

        if (currentUsernameRef.current && currentUsernameRef.current !== username) {
            hasFetchedRef.current = false;
        }
        currentUsernameRef.current = username;

        if (hasFetchedRef.current && !forceRefresh) return false;
        if (isDataFresh(analysisData) && !forceRefresh) return false;

        return true;
    };

    const checkExistingData = async (username: string): Promise<LinkedInCreatorAnalysisResponse | null> => {
        try {
            const response = await fetch(`/api/social/linkedin/creator-analysis/check?username=${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.exists && data.data) {
                    return {
                        success: true,
                        username: username,
                        totalPosts: data.data.length,
                        posts: data.data,
                        fetchedAt: Date.now()
                    };
                }
            }
        } catch (err) {
            console.log('Nie udało się sprawdzić istniejących danych LinkedIn:', err);
        }
        return null;
    };

    // 🆕 NOWA FUNKCJA - Sprawdź istniejącą AI analysis
    const checkExistingAIAnalysis = async (username: string): Promise<LinkedInAIAnalysisData | null> => {
        try {
            const response = await fetch(`/api/social/linkedin/creator-analysis/ai/check?username=${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.exists && data.analysis) {
                    console.log('✅ Found existing LinkedIn AI analysis');
                    return data.analysis;
                }
            }
        } catch (err) {
            console.log('Nie udało się sprawdzić istniejącej AI analysis LinkedIn:', err);
        }
        return null;
    };

    const fetchLinkedInCreatorAnalysis = async (username: string, forceNewFetch = false) => {
        try {
            setPhase('fetching');
            setApiStatus('Przygotowywanie żądania LinkedIn...');
            setError(null);

            if (!isAuthenticated) {
                throw new Error('Brak aktywnej sesji użytkownika');
            }

            if (!forceNewFetch) {
                setApiStatus(`Sprawdzanie istniejących danych LinkedIn dla ${username}...`);
                const existingData = await checkExistingData(username);

                if (existingData) {
                    setAnalysisData(existingData);
                    setApiStatus('Dane LinkedIn gotowe, sprawdzam analizę AI...');
                    hasFetchedRef.current = true;

                    // 🆕 SPRAWDŹ AI ANALYSIS
                    setTimeout(() => {
                        performAIAnalysisWithData(username);
                    }, 500);
                    return;
                }
            }

            setApiStatus(`Pobieranie nowych danych LinkedIn dla ${username}...`);

            const response = await fetch('/api/social/linkedin/creator-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username
                })
            });

            setApiStatus('Przetwarzanie odpowiedzi LinkedIn...');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // LinkedIn endpoint zwraca bezpośrednio tablicę rekordów
            const posts: LinkedInPostRecord[] = await response.json();

            if (!Array.isArray(posts) || posts.length === 0) {
                throw new Error('Brak danych LinkedIn dla tego użytkownika');
            }

            setApiStatus('Dane LinkedIn pobrane, rozpoczynam analizę AI...');

            const wrappedData: LinkedInCreatorAnalysisResponse = {
                success: true,
                username: username,
                totalPosts: posts.length,
                posts: posts,
                fetchedAt: Date.now()
            };

            setAnalysisData(wrappedData);
            hasFetchedRef.current = true;

            if (componentRef.current) {
                const rect = componentRef.current.getBoundingClientRect();
                if (rect.top < 0) {
                    componentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }

            // 🆕 URUCHOM AI ANALYSIS
            setTimeout(() => {
                performAIAnalysisWithData(username);
            }, 1000);

        } catch (err) {
            console.error('Błąd podczas pobierania analizy LinkedIn:', err);
            setError(err instanceof Error ? err.message : 'Nieznany błąd');
            setPhase('error');
        }
    };

    // 🆕 NOWA FUNKCJA - Wykonaj AI Analysis
    const performAIAnalysisWithData = async (username: string) => {
        if (aiAnalysisInProgressRef.current) {
            console.log('🔄 LinkedIn AI Analysis already in progress, skipping...');
            return;
        }

        try {
            aiAnalysisInProgressRef.current = true;
            setPhase('analyzing');
            setError(null);
            setLoadedFromDatabase(false);

            // Sprawdź czy już istnieje AI analysis
            const existingAI = await checkExistingAIAnalysis(username);
            if (existingAI) {
                console.log('✅ Found existing LinkedIn AI analysis, using it');
                setAiData(existingAI);
                setLoadedFromDatabase(true);
                setPhase('ready');

                setTimeout(() => {
                    if (componentRef.current) {
                        componentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);

                if (onAnalysisComplete) {
                    onAnalysisComplete(true, analysisData || undefined);
                }
                return;
            }

            // Generuj nową AI analysis
            const response = await fetch('/api/social/linkedin/creator-analysis/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || `AI API error: ${response.status}`);
            }

            const aiResponse = await response.json();

            if (!aiResponse.success) {
                throw new Error('LinkedIn AI API zwróciło błąd: ' + JSON.stringify(aiResponse));
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
            console.error('❌ LinkedIn AI Analysis error:', err);
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
        if (linkedinUsername) {
            hasFetchedRef.current = false;
            aiAnalysisInProgressRef.current = false;
            setAiData(null);
            setLoadedFromDatabase(false);
            fetchLinkedInCreatorAnalysis(linkedinUsername, true);
        }
    };

    const handleNext = () => {
        if (onClose) {
            onClose();
        }
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

        if (shouldFetch(linkedinUsername || undefined)) {
            fetchLinkedInCreatorAnalysis(linkedinUsername!);
        } else if (analysisData) {
            setPhase('ready');
        }
    }, [isAuthenticated, linkedinUsername, forceRefresh, aiAnalysisData]);

    useEffect(() => {
        if (forceRefresh && linkedinUsername) {
            hasFetchedRef.current = false;
            aiAnalysisInProgressRef.current = false;
            setAiData(null);
            setLoadedFromDatabase(false);
            fetchLinkedInCreatorAnalysis(linkedinUsername, true);
        }
    }, [forceRefresh, linkedinUsername]);

    // === RENDEROWANIE ===

    return (
        <div
            ref={componentRef}
            className={`w-full md:bg-white md:rounded-xl md:border md:border-gray-200 md:shadow-sm p-2 md:p-4 lg:p-6 mt-4 transition-all duration-500 relative ${phase === 'ready' ? 'lg:pr-16' : ''}`}
        >
            {phase === 'ready' && (aiData || analysisData) && (
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
                <LinkedInAIResultsView
                    aiData={aiData}
                    isMinimized={isMinimized}
                    onNext={handleNext}
                    loadedFromDatabase={loadedFromDatabase}
                    realUsername={linkedinUsername || rawLinkedinUsername || 'user'}
                />
            )}

            {phase === 'ready' && !aiData && analysisData && (
                <DataFetchedSuccessView
                    data={analysisData}
                    isMinimized={isMinimized}
                    onNext={handleNext}
                />
            )}
        </div>
    );
}