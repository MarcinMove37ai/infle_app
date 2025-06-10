"use client"

import PersistentAdminLayout from '@/components/layout/PersistentAdminLayout'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PersistentAdminLayout>
      {children}
    </PersistentAdminLayout>
  )
}
