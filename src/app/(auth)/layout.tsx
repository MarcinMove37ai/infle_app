// src/app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="h-screen bg-[#0A0A0A] text-white antialiased overflow-hidden fixed w-full top-0 left-0 font-sans"
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}