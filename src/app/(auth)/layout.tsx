// src/app/(auth)/layout.tsx
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
      {children}
    </div>
  );
}