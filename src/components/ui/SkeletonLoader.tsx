// src/components/ui/SkeletonLoader.tsx
'use client';

interface SkeletonLoaderProps {
  lines?: number;
  showAvatar?: boolean;
  showButtons?: boolean;
}

export default function SkeletonLoader({
  lines = 3,
  showAvatar = false,
  showButtons = false
}: SkeletonLoaderProps) {
  return (
    <div className="animate-pulse space-y-4 p-6">
      {showAvatar && (
        <div className="flex items-center space-x-4">
          <div className="rounded-full bg-gray-300 h-12 w-12"></div>
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-300 rounded w-1/4"></div>
            <div className="h-3 bg-gray-300 rounded w-1/6"></div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-5/6"></div>
          </div>
        ))}
      </div>

      {showButtons && (
        <div className="flex space-x-3 pt-4">
          <div className="h-10 bg-gray-300 rounded-xl w-24"></div>
          <div className="h-10 bg-gray-300 rounded-xl w-32"></div>
        </div>
      )}
    </div>
  );
}