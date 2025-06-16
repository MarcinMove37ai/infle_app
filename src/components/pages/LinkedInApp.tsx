'use client';

import { useState } from 'react';
import LinkedInProfileBar from '@/components/profile/LinkedInProfileBar';
import CreatorAnalysisLI from '@/components/profile/CreatorAnalysisLI';

// Interface dla przyszłych danych AI Analysis LinkedIn
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

export default function LinkedInApp() {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [aiAnalysisData, setAiAnalysisData] = useState<LinkedInAIAnalysisData | null>(null);

  // Obsługa rozpoczęcia nowej analizy (gdy nie ma AI w bazie)
  const handleStartAnalysis = () => {
    console.log('🚀 Uruchamiam nową analizę biznesową...');
    setAiAnalysisData(null); // Reset danych AI - będą wygenerowane na nowo
    setShowAnalysis(true);
  };

  // Obsługa pokazania istniejącej analizy AI (z bazy) - przyszłość
  const handleShowAIAnalysis = (aiData: LinkedInAIAnalysisData) => {
    console.log('🎯 Pokazuję istniejącą analizę AI z bazy:', aiData.username);
    setAiAnalysisData(aiData); // Ustaw dane AI z bazy
    setShowAnalysis(true);
  };

  const handleCloseAnalysis = () => {
    console.log('🔒 Zamykam analizę biznesową...');
    setShowAnalysis(false);
    setAiAnalysisData(null); // Wyczyść dane AI
  };

  return (
    <div className="sm:p-6 lg:p-8">
      <div className="space-y-4">
        {/* DODANE: Przekazywanie callback'ów do LinkedInProfileBar */}
        <LinkedInProfileBar
          onStartAnalysis={handleStartAnalysis}        // Dla nowej analizy
          onShowAIAnalysis={handleShowAIAnalysis}      // Dla istniejącej analizy z bazy
        />

        {/* Linia podziału po LinkedInProfileBar - tylko na mobile */}
        <div className="border-b border-gray-200 mx-2 md:hidden"></div>

        {/* DODANE: Warunkowo renderowany CreatorAnalysisLI */}
        {showAnalysis && (
          <CreatorAnalysisLI
            onClose={handleCloseAnalysis}
            aiAnalysisData={aiAnalysisData}             // Przekaż dane AI jeśli istnieją
            skipInitialFetch={!!aiAnalysisData}        // Pomiń fetch jeśli mamy dane
          />
        )}

        {/* Linia podziału po komponencie analitycznym - tylko na mobile */}
        {showAnalysis && (
          <div className="border-b border-gray-200 mx-2 md:hidden"></div>
        )}

        {/* Tutaj mogą być kolejne komponenty LinkedIn w przyszłości */}
      </div>
    </div>
  );
}