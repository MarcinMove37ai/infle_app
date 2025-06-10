// src/components/ui/CardLoader.tsx
'use client';

export default function CardLoader() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="animate-pulse">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-10 h-10 bg-gray-300 rounded-xl"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="h-3 bg-gray-300 rounded"></div>
          <div className="h-3 bg-gray-300 rounded w-5/6"></div>
          <div className="h-3 bg-gray-300 rounded w-4/6"></div>
        </div>

        <div className="flex justify-between items-center mt-6">
          <div className="h-8 bg-gray-300 rounded-xl w-20"></div>
          <div className="h-6 bg-gray-300 rounded w-16"></div>
        </div>
      </div>
    </div>
  );
}