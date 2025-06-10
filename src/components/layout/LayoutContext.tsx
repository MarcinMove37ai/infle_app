"use client"

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'

interface LayoutContextType {
  hoveredSidebar: boolean
  setHoveredSidebar: (value: boolean) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (value: boolean) => void
}

const LayoutContext = createContext<LayoutContextType | null>(null)

export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hoveredSidebar, setHoveredSidebar] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem('sidebarExpanded') === 'true'
    } catch {
      return false
    }
  })

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarExpanded', hoveredSidebar.toString())
    }
  }, [hoveredSidebar])

  return (
    <LayoutContext.Provider value={{
      hoveredSidebar,
      setHoveredSidebar,
      isMobileMenuOpen,
      setIsMobileMenuOpen
    }}>
      {children}
    </LayoutContext.Provider>
  )
}

export const useLayout = () => {
  const context = useContext(LayoutContext)
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider')
  }
  return context
}
