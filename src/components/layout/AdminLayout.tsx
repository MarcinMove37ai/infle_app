// src/components/layout/TwinAdminLayout.tsx
"use client"

import React, { useState, ReactNode, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Users,
  Menu,
  X,
  Power,
  AlertTriangle,
  Lock,
  BookOpen,
  TrendingUp,
  UserCheck,
  BarChart3,
  FileSignature
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/types';

type UserStatus = 'pending' | 'active' | 'blocked';

interface MenuItem {
  IconComponent: LucideIcon;
  label: string;
  path: string;
  roles: UserRole[];
  requiredStatus?: UserStatus[];
  fullWidth?: boolean;
}

const menuItems: MenuItem[] = [
  {
    IconComponent: Home,
    label: 'Dashboard',
    path: '/dashboard',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active']
  },
  {
    IconComponent: Users,
    label: 'Raport Twórcy',
    path: '/raport-tworcy',
    roles: ['ADMIN', 'GOD'],
    requiredStatus: ['active']
  },
  {
    IconComponent: UserCheck,
    label: 'Raport Odbiorców',
    path: '/raport-odbiorcow',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active']
  },
  {
    IconComponent: TrendingUp,
    label: 'Trendy',
    path: '/trendy',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active']
  },
  {
    IconComponent: BookOpen,
    label: 'Ebooki',
    path: '/ebooki',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active']
  },
  {
    IconComponent: FileSignature,
    label: 'Strony Zapisu',
    path: '/strony-zapisu',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active']
  },
  {
    IconComponent: BarChart3,
    label: 'Statystyki',
    path: '/statystyki',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active']
  }
];

const getCurrentPageLabel = (path: string | null) => {
  if (!path) return 'Dashboard';
  const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
  const menuItem = menuItems.find(item => normalizedPath === item.path);
  return menuItem?.label || 'Dashboard';
};

interface TwinAdminLayoutProps {
  children: ReactNode;
  disableMenu?: boolean;
}

const TwinAdminLayout: React.FC<TwinAdminLayoutProps> = ({ children, disableMenu = false }) => {
  const pathname = usePathname();
  const { signOut, user, userRole } = useAuth();

  // PROSTE ROZWIĄZANIE: localStorage jest synchroniczny i eliminuje flashing
  const getInitialSidebarState = () => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('sidebarExpanded') === 'true';
    } catch {
      return false;
    }
  };

  const [hoveredSidebar, setHoveredSidebar] = useState(getInitialSidebarState);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const firstRenderRef = useRef(true);

  const normalizedPathname = pathname?.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const userStatus = user?.status?.toLowerCase() as UserStatus | undefined;
  const userRoleFromAuth = (userRole || 'USER') as UserRole;

  const currentMenuItem = menuItems.find(item => normalizedPathname === item.path);
  const isFullWidthPage = currentMenuItem?.fullWidth || false;

  useEffect(() => {
    setIsClient(true);
    // Po pierwszym renderze pozwól na animacje
    setTimeout(() => {
      firstRenderRef.current = false;
    }, 100);
  }, []);

  const filteredMenuItems = disableMenu ? [] : menuItems.filter(item => {
    const hasRequiredRole = item.roles.includes(userRoleFromAuth);
    const hasRequiredStatus = !item.requiredStatus ||
                             (userStatus && item.requiredStatus.includes(userStatus));
    return hasRequiredRole && hasRequiredStatus;
  });

  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);

      if (newIsMobile && hoveredSidebar) {
        setHoveredSidebar(false);
        localStorage.setItem('sidebarExpanded', 'false');
      }

      if (!isInitialized) {
        setIsInitialized(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hoveredSidebar, isInitialized]);

  const handleMouseEnter = () => {
    if (!isMobile) {
      setHoveredSidebar(true);
      localStorage.setItem('sidebarExpanded', 'true');
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setHoveredSidebar(false);
      localStorage.setItem('sidebarExpanded', 'false');
    }
  };

  const handleLogout = async () => {
    console.log("Wylogowywanie użytkownika...");
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error("Błąd podczas wylogowywania:", error);
    }
  };

  const goToHome = () => {
    window.location.href = '/dashboard';
  };

  const getStatusLabel = (status: string | undefined) => {
    if (!status) return '';
    switch(status.toLowerCase()) {
      case 'pending':
        return 'Oczekujący';
      case 'active':
        return 'Aktywny';
      case 'blocked':
        return 'Zablokowany';
      default:
        return status;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">

      {/* MOBILE SIDEBAR */}
      {!disableMenu && isInitialized && isMobile && (
        <div
          className={`fixed left-0 z-50 top-[calc(4rem)] h-[calc(90vh)] w-64
            bg-white/60 backdrop-blur-lg backdrop-saturate-150 shadow-xl rounded-r-3xl
            transition-transform duration-300 overflow-y-auto ${
              isMobileMenuOpen ? 'transform translate-x-0' : 'transform -translate-x-full'
            }`}
        >
          <nav className="py-4">
            <ul className="space-y-2 px-3">
              {filteredMenuItems.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`
                      flex items-center h-11 px-3
                      rounded-lg transition-colors
                      ${normalizedPathname === item.path ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                    `}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className={`
                      flex-shrink-0 w-6 text-center
                      ${normalizedPathname === item.path ? 'text-blue-600' : 'text-gray-600'}
                    `}>
                      {isClient && <item.IconComponent size={22} />}
                    </div>
                    <span className="ml-3 whitespace-nowrap font-medium">
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}

              {userStatus === 'pending' && (
                <li className="mt-6">
                  <div className="flex items-center px-3 py-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex-shrink-0 w-6 text-center text-amber-600">
                      {isClient && <AlertTriangle size={18} />}
                    </div>
                    <span className="ml-3 text-amber-700 text-xs leading-tight">
                      Twoje konto oczekuje na zatwierdzenie przez administratora
                    </span>
                  </div>
                </li>
              )}

              {userStatus === 'blocked' && !disableMenu && (
                <li className="mt-6">
                  <div className="flex items-center px-3 py-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex-shrink-0 w-6 text-center text-red-600">
                      {isClient && <Lock size={18} />}
                    </div>
                    <span className="ml-3 text-red-700 text-xs leading-tight">
                      Twoje konto zostało zablokowane. Skontaktuj się z administratorem.
                    </span>
                  </div>
                </li>
              )}

              <li className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  className="flex items-center h-11 px-3 w-full rounded-lg transition-colors hover:bg-red-50 cursor-pointer text-red-600"
                >
                  <div className="flex-shrink-0 w-6 text-center">
                    {isClient && <Power size={22} />}
                  </div>
                  <span className="ml-3 whitespace-nowrap font-medium">
                    Wyloguj się
                  </span>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* DESKTOP SIDEBAR - BEZ FLASHINGU */}
      {!disableMenu && isInitialized && !isMobile && (
        <div
          className={`fixed left-0 z-50 top-[calc(4rem)] h-[calc(90vh)]
            bg-white shadow-lg rounded-r-2xl overflow-y-auto
            ${firstRenderRef.current ? '' : 'transition-[width] duration-300 ease-in-out'} ${
              hoveredSidebar ? 'w-64' : 'w-20'
            }`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <nav className="py-4">
            <ul className="space-y-2 px-3">
              {filteredMenuItems.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`
                      flex items-center h-11 px-3
                      rounded-lg transition-colors
                      ${normalizedPathname === item.path ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                    `}
                  >
                    <div className={`
                      flex-shrink-0 w-6 text-center
                      ${normalizedPathname === item.path ? 'text-blue-600' : 'text-gray-600'}
                    `}>
                      {isClient && <item.IconComponent size={22} />}
                    </div>
                    <span className={`
                      ml-3 whitespace-nowrap font-medium overflow-hidden
                      ${firstRenderRef.current ? '' : 'transition-all duration-300 ease-in-out'}
                      ${hoveredSidebar ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
                    `}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}

              {userStatus === 'pending' && (
                <li className="mt-6">
                  <div className={`
                    flex items-center px-3 py-3
                    rounded-lg bg-amber-50 border border-amber-200
                    ${hoveredSidebar ? 'opacity-100' : 'opacity-0'}
                    ${firstRenderRef.current ? '' : 'transition-opacity duration-300'}
                  `}>
                    <div className="flex-shrink-0 w-6 text-center text-amber-600">
                      {isClient && <AlertTriangle size={18} />}
                    </div>
                    <span className={`
                      ml-3 text-amber-700 text-xs leading-tight overflow-hidden
                      ${firstRenderRef.current ? '' : 'transition-all duration-300 ease-in-out'}
                      ${hoveredSidebar ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
                    `}>
                      Twoje konto oczekuje na zatwierdzenie przez administratora
                    </span>
                  </div>
                </li>
              )}

              {userStatus === 'blocked' && !disableMenu && (
                <li className="mt-6">
                  <div className={`
                    flex items-center px-3 py-3
                    rounded-lg bg-red-50 border border-red-200
                    ${hoveredSidebar ? 'opacity-100' : 'opacity-0'}
                    ${firstRenderRef.current ? '' : 'transition-opacity duration-300'}
                  `}>
                    <div className="flex-shrink-0 w-6 text-center text-red-600">
                      {isClient && <Lock size={18} />}
                    </div>
                    <span className={`
                      ml-3 text-red-700 text-xs leading-tight overflow-hidden
                      ${firstRenderRef.current ? '' : 'transition-all duration-300 ease-in-out'}
                      ${hoveredSidebar ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
                    `}>
                      Twoje konto zostało zablokowane. Skontaktuj się z administratorem.
                    </span>
                  </div>
                </li>
              )}
            </ul>
          </nav>
        </div>
      )}

      {/* GŁÓWNY KONTENER */}
      <div
        className={`flex-1 overflow-auto mt-16 ${
          !isInitialized || isMobile || disableMenu
            ? 'ml-0'
            : `${firstRenderRef.current ? '' : 'transition-[margin-left] duration-300 ease-in-out'} ${
                hoveredSidebar ? 'ml-64' : 'ml-20'
              }`
        }`}
      >
        {/* Header */}
        <header className={`fixed top-0 left-0 w-full h-16 bg-white shadow-sm border-b border-gray-200 z-50 flex items-center justify-between ${isMobile ? 'px-4' : 'px-6'}`}>
          <div className="flex items-center">
            {isInitialized && isMobile && !disableMenu && (
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                aria-label={isMobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
              >
                {isMobileMenuOpen ? (
                  isClient && <X className="h-6 w-6 text-gray-600" />
                ) : (
                  isClient && <Menu className="h-6 w-6 text-gray-600" />
                )}
              </button>
            )}
            <div
              className={`h-8 md:h-10 w-auto mr-4 ${!disableMenu ? 'cursor-pointer' : ''} flex items-center`}
              onClick={!disableMenu ? goToHome : undefined}
            >
              <div className="h-8 w-36 bg-gradient-to-r from-green-600 to-green-700 rounded-md flex items-center justify-center text-white font-bold text-sm shadow-sm">
                TWIN LAYOUT
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.email || 'Użytkownik'}
              </span>

              {userRoleFromAuth === 'GOD' && (
                <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-800 font-medium">
                  Super Admin
                </span>
              )}

              {userRoleFromAuth === 'ADMIN' && (
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 font-medium">
                  Administrator
                </span>
              )}

              {userRoleFromAuth === 'USER' && userStatus && (
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                  userStatus === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : userStatus === 'blocked'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-green-100 text-green-800'
                }`}>
                  {getStatusLabel(user?.status)}
                </span>
              )}
            </div>

            {isInitialized && !isMobile && !disableMenu && (
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                aria-label="Wyloguj się"
                title="Wyloguj się"
              >
                {isClient && <Power className="h-5 w-5" />}
              </button>
            )}

            {(disableMenu || userStatus === 'blocked') && (
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                aria-label="Wyloguj się"
                title="Wyloguj się"
              >
                {isClient && <Power className="h-5 w-5" />}
              </button>
            )}
          </div>
        </header>

        <main className="pt-2 pb-6">
          {/* Breadcrumb */}
          {!isFullWidthPage && !disableMenu && (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 mx-4 md:mx-6">
              <div className="flex flex-row items-center w-full md:w-auto gap-2">
                <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-700 whitespace-nowrap">
                    {getCurrentPageLabel(pathname)}
                  </h2>
                </div>
              </div>

              <div className="hidden md:flex w-full justify-end items-center mt-2 md:mt-0">
                {isClient && (
                  <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
                    <span className="text-sm font-medium text-gray-600">
                      {new Date().toLocaleDateString('pl-PL', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content */}
          <div className={`
            ${isFullWidthPage || disableMenu
              ? 'bg-white rounded-lg shadow-sm p-0 min-h-[calc(100vh-6rem)] overflow-hidden mx-4 md:mx-6 border border-gray-200'
              : 'bg-white rounded-lg shadow-sm p-4 md:p-6 min-h-[calc(100vh-180px)] mx-4 md:mx-6 border border-gray-200'
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TwinAdminLayout;