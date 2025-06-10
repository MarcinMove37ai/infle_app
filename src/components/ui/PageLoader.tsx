// src/components/ui/PageLoader.tsx
'use client';

import LoadingSpinner from './LoadingSpinner';

interface PageLoaderProps {
  pageName?: string;
}

export default function PageLoader({ pageName = "strony" }: PageLoaderProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="relative">
        {/* Background blur circles */}
        <div className="absolute -top-10 -left-10 w-20 h-20 bg-purple-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 w-16 h-16 bg-blue-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-100">
          <LoadingSpinner 
            message={`Ładowanie ${pageName}`}
            fullScreen={false}
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}