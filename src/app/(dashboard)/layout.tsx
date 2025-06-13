// src/app/dashboard/layout.tsx
"use client"

// POPRAWNY IMPORT - importujemy komponent, który zawiera w sobie Provider
import PersistentAdminLayoutWithProvider from '@/components/layout/PersistentAdminLayout'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Używamy komponentu z Providerem
  return (
    <PersistentAdminLayoutWithProvider>
      {children}
    </PersistentAdminLayoutWithProvider>
  )
}