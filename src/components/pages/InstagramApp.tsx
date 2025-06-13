'use client';

import InstagramProfileBar from '@/components/profile/InstagramProfileBar';

export default function DashboardContent() {
  return (
    // Ten zewnętrzny div jest w porządku, może zostać
    <div className="sm:p-6 lg:p-8">
      {/* Z TEGO DIVA USUWAMY KLASY OGRANICZAJĄCE SZEROKOŚĆ
        Było: <div className="max-w-4xl mx-auto space-y-8">
        Jest: <div className="space-y-8">
      */}
      <div className="space-y-4">
        <InstagramProfileBar />

        {/* Linia podziału po InstagramProfileBar - tylko na mobile */}
        <div className="border-b border-gray-200 mx-2 md:hidden"></div>

        {/* Tutaj możesz dodać kolejne komponenty, które również będą miały pełną szerokość */}
      </div>
    </div>
  );
}