// src/components/ui/LoadingSpinner.tsx
'use client';

import { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ 
  message = "Ładowanie...", 
  fullScreen = true,
  size = 'md' 
}: LoadingSpinnerProps) {
  const [dots, setDots] = useState('');

  // Animowane kropki
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  const containerClasses = fullScreen 
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-gray-100'
    : 'flex items-center justify-center p-8';

  return (
    <div className={containerClasses}>
      <div className="relative flex flex-col items-center space-y-4">
        {/* Main spinner container */}
        <div className="relative">
          {/* Outer ring */}
          <div className={`${sizeClasses[size]} rounded-full border-4 border-gray-200`}></div>

          {/* Animated ring with gradient colors */}
          <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full border-4 border-transparent border-t-purple-600 border-r-blue-600 animate-spin`}></div>

          {/* Inner pulsing dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Loading text */}
        <div className="text-center">
          <p className={`font-medium text-gray-700 ${textSizeClasses[size]}`}>
            {message}
            <span className="inline-block w-8 text-left">{dots}</span>
          </p>
        </div>

        {/* Decorative elements */}
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}