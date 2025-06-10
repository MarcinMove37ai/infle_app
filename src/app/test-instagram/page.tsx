// src/app/test-instagram/page.tsx
'use client';

import { useState } from 'react';

interface InstagramProfileResponse {
  profilepic_url: string | null;
  username: string;
  followers_count: number | null;
  posts_count: number | null;
}

interface InstagramApiError {
  error: string;
  details?: string;
}

export default function TestInstagramPage() {
  const [url, setUrl] = useState<string>('');
  const [result, setResult] = useState<InstagramProfileResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const formatNumber = (num: number | null): string => {
    if (num === null) return 'N/A';
    if (num < 1000) return num.toString();
    if (num >= 1000000) {
      const millions = num / 1000000;
      return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
    }
    if (num >= 1000) {
      const thousands = num / 1000;
      return `${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const testProfile = async () => {
    if (!url) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/instagram-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as InstagramApiError;
        setError(errorData.error || 'Unknown error');
        return;
      }

      setResult(data as InstagramProfileResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8 text-center text-gray-900">Instagram Profile Analyzer</h1>

      {/* Input */}
      <div className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/username/"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            disabled={loading}
          />
          <button
            onClick={testProfile}
            disabled={loading || !url}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors font-medium"
          >
            {loading ? '⏳' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-8 p-4 bg-red-100 border border-red-300 rounded-lg text-center">
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8">
          <div className="grid grid-cols-3 gap-8 items-center">

            {/* Column 1: Profile & Name */}
            <div className="text-center">
              {result.profilepic_url ? (
                <img
                  src={result.profilepic_url}
                  alt="Profile"
                  className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-2 border-gray-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-2xl">👤</span>
                </div>
              )}
              <h3 className="text-xl font-bold text-gray-900">@{result.username}</h3>
            </div>

            {/* Column 2: Followers */}
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">
                {formatNumber(result.followers_count)}
              </div>
              <div className="text-gray-600 font-medium">Followers</div>
            </div>

            {/* Column 3: Posts */}
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {formatNumber(result.posts_count)}
              </div>
              <div className="text-gray-600 font-medium">Posts</div>
            </div>

          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Analyzing profile...</p>
        </div>
      )}
    </div>
  );
}