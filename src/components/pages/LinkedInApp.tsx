'use client';

import LinkedInProfileBar from '@/components/profile/LinkedInProfileBar';

export default function LinkedInApp() {
  return (
    // Ten zewnętrzny div jest w porządku, może zostać
    <div className="m:p-6 lg:p-8">
      {/* Z TEGO DIVA USUWAMY KLASY OGRANICZAJĄCE SZEROKOŚĆ
        Było: <div className="max-w-4xl mx-auto space-y-8">
        Jest: <div className="space-y-8">
      */}
      <div className="space-y-8">
        <LinkedInProfileBar />

        {/* Linia podziału po InstagramProfileBar - tylko na mobile */}
        <div className="border-b border-gray-200 mx-2 md:hidden"></div>

        {/* Tutaj możesz dodać kolejne komponenty LinkedIn, które również będą miały pełną szerokość */}
      </div>
    </div>
  );
}