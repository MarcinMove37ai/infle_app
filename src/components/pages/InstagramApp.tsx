'use client';

import { useState } from 'react';
import InstagramProfileBar from '@/components/profile/InstagramProfileBar';
import CreatorAnalysisIG from '@/components/profile/CreatorAnalysisIG';

// 🆕 NOWY INTERFACE - AI Analysis Data
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

export default function DashboardContent() {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [aiAnalysisData, setAiAnalysisData] = useState<AIAnalysisData | null>(null); // 🆕 NOWY STATE

  // 🆕 NOWA FUNKCJA - Obsługa rozpoczęcia nowej analizy (gdy nie ma AI w bazie)
  const handleStartAnalysis = () => {
    console.log('🚀 Uruchamiam nową analizę twórcy...');
    setAiAnalysisData(null); // Reset danych AI - będą wygenerowane na nowo
    setShowAnalysis(true);
  };

  // 🆕 NOWA FUNKCJA - Obsługa pokazania istniejącej analizy AI (z bazy)
  const handleShowAIAnalysis = (aiData: AIAnalysisData) => {
    console.log('🎯 Pokazuję istniejącą analizę AI z bazy:', aiData.username);
    setAiAnalysisData(aiData); // Ustaw dane AI z bazy
    setShowAnalysis(true);
  };

  const handleCloseAnalysis = () => {
    console.log('🔒 Zamykam analizę twórcy...');
    setShowAnalysis(false);
    setAiAnalysisData(null); // Wyczyść dane AI
  };

  return (
    <div className="sm:p-6 lg:p-8">
      <div className="space-y-4">
        {/* 🆕 ZAKTUALIZOWANY InstagramProfileBar z nowymi callback'ami */}
        <InstagramProfileBar
          onStartAnalysis={handleStartAnalysis}        // Dla nowej analizy
          onShowAIAnalysis={handleShowAIAnalysis}      // Dla istniejącej analizy z bazy
        />

        {/* Linia podziału po InstagramProfileBar - tylko na mobile */}
        <div className="border-b border-gray-200 mx-2 md:hidden"></div>

        {/* 🆕 ZAKTUALIZOWANY CreatorAnalysisIG z możliwością przekazania danych AI */}
        {showAnalysis && (
          <CreatorAnalysisIG
            onClose={handleCloseAnalysis}
            aiAnalysisData={aiAnalysisData}             // 🆕 Przekaż dane AI jeśli istnieją
            skipInitialFetch={!!aiAnalysisData}        // 🆕 Pomiń fetch jeśli mamy dane
          />
        )}

        {/* Linia podziału po komponencie analitycznym - tylko na mobile */}
        {showAnalysis && (
          <div className="border-b border-gray-200 mx-2 md:hidden"></div>
        )}

        {/* Tutaj mogą być kolejne komponenty w przyszłości */}
      </div>
    </div>
  );
}