// src/app/(auth)/layout.tsx
import Analytics from '@/components/Analytics';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen bg-[#0A0A0A] text-white antialiased w-full font-sans"
      suppressHydrationWarning
    >
      {/* 👇 Tutaj dodajemy komponent, aby Pixel ładował się na stronach Auth */}
      <Analytics />

      {children}
    </div>
  );
}