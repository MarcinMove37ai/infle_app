// src/hooks/useAIAnalysisCheck.ts
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// Interface dla danych AI Analysis
interface AIAnalysisData {
  username: string;
  profileDescription: string;
  competencies: Array<{
    name: string;
    iconType: string;
    description: string;
    evidence: string[];
  }>;
  uniqueTalent: {
    name: string;
    description: string;
    marketValue: string;
    evidence: string[];
  };
}

interface UseAIAnalysisCheckResult {
  hasAIAnalysis: boolean;
  aiAnalysisData: AIAnalysisData | null;
  loading: boolean;
  error: string | null;
  checkForUser: (userId: string, username: string) => Promise<void>;
}

export function useAIAnalysisCheck(): UseAIAnalysisCheckResult {
  const { data: session } = useSession();
  const [hasAIAnalysis, setHasAIAnalysis] = useState(false);
  const [aiAnalysisData, setAiAnalysisData] = useState<AIAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkForUser = async (userId: string, username: string) => {
    if (!userId || !username) {
      setHasAIAnalysis(false);
      setAiAnalysisData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`🔍 Checking AI analysis for userId: ${userId}, username: ${username}`);

      const response = await fetch(`/api/social/instagram/creator-analysis/ai/check?username=${encodeURIComponent(username)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Nie jesteś zalogowany');
        }
        console.log('❌ Error checking AI analysis:', response.status);
        setHasAIAnalysis(false);
        setAiAnalysisData(null);
        return;
      }

      const data = await response.json();

      if (data.exists && data.analysis) {
        console.log('✅ Found existing AI analysis!');
        setHasAIAnalysis(true);
        setAiAnalysisData(data.analysis);
      } else {
        console.log('📭 No AI analysis found');
        setHasAIAnalysis(false);
        setAiAnalysisData(null);
      }

    } catch (err) {
      console.error('❌ Error checking AI analysis:', err);
      setError(err instanceof Error ? err.message : 'Błąd sprawdzania analizy AI');
      setHasAIAnalysis(false);
      setAiAnalysisData(null);
    } finally {
      setLoading(false);
    }
  };

  // Auto-check when session is ready
  useEffect(() => {
    if (session?.user?.id) {
      const username = session.user.instagramUsername;
      if (username) {
        checkForUser(session.user.id, username);
      }
    }
  }, [session?.user?.id, session?.user?.instagramUsername]);

  return {
    hasAIAnalysis,
    aiAnalysisData,
    loading,
    error,
    checkForUser
  };
}