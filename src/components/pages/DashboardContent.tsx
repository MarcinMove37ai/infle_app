import React from 'react';

export default function DashboardPlaceholder() {
  return (
    <div className="flex items-center justify-center pt-20 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-12 max-w-2xl w-full">
        <div className="text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Inflee.app
          </h1>

          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent text-xl font-semibold mb-6">
            Tu będzie dashboard aplikacji Inflee.app
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-center space-x-2 text-gray-500">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Wkrótce dostępne</span>
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse delay-75"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}