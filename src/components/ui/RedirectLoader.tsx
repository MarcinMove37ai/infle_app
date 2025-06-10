// src/components/ui/RedirectLoader.tsx
'use client';

interface RedirectLoaderProps {
  message?: string;
}

export default function RedirectLoader({
  message = "Ładowanie aplikacji..."
}: RedirectLoaderProps) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center space-y-4">
        {/* Spinner */}
        <div className="relative mx-auto w-8 h-8">
          <div className="absolute inset-0 w-8 h-8 border-2 border-gray-200 rounded-full"></div>
          <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-gray-600 rounded-full animate-spin"></div>
        </div>

        {/* Loading message */}
        <p className="text-gray-600 text-sm font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}