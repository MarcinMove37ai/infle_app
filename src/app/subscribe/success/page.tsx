// src/app/subscribe/success/page.tsx

import React, { Suspense } from 'react';
import SuccessContent from './SuccessContent'; // Importujemy nasz nowy komponent kliencki

// To jest teraz czysty Komponent Serwerowy
export default function SubscribeSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center px-4">
      <Suspense fallback={
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-gray-500 border-r-transparent mb-4"></div>
          <p className="text-gray-600">Ładowanie...</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}