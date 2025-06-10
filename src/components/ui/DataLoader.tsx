// src/components/ui/DataLoader.tsx
'use client';

import { Loader2, Database, Wifi } from 'lucide-react';

interface DataLoaderProps {
  message?: string;
  type?: 'data' | 'api' | 'processing';
  size?: 'sm' | 'md' | 'lg';
}

export default function DataLoader({
  message = "Pobieranie danych",
  type = 'data',
  size = 'md'
}: DataLoaderProps) {
  const icons = {
    data: Database,
    api: Wifi,
    processing: Loader2
  };

  const Icon = icons[type];

  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative">
        <div className={`${sizeClasses[size]} text-purple-600 animate-spin`}>
          <Icon className="w-full h-full" />
        </div>
        {/* Pulse ring */}
        <div className={`absolute inset-0 ${sizeClasses[size]} border-2 border-purple-200 rounded-full animate-ping opacity-20`}></div>
      </div>

      <div className="text-center">
        <p className="text-gray-700 font-medium">{message}</p>
        <div className="flex justify-center mt-2 space-x-1">
          <div className="w-1 h-1 bg-purple-600 rounded-full animate-pulse"></div>
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-1 h-1 bg-purple-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}