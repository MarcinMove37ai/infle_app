// src/components/layout/PersistentAdminLayout.tsx
"use client"

import React, { useState, ReactNode, useEffect, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// POPRAWIONE Custom Icon Components
interface CustomIconProps {
  size?: number;
  className?: string;
  isActive?: boolean;
}

const InstagramIcon: React.FC<CustomIconProps> = ({ size = 20, className = '', isActive = false }) => {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <img
        src="/ig.png"
        alt="Instagram"
        className={`transition-all duration-200 ${className}`}
        style={{
          width: size,
          height: size,
          opacity: isActive ? 1 : 0.7,
          transform: isActive ? 'scale(1.1)' : 'scale(1)',
        }}
        onError={(e) => {
          console.error('Instagram icon failed to load:', e);
        }}
        onLoad={() => {
          console.log('Instagram icon loaded successfully');
        }}
      />
    </div>
  );
};

const LinkedInIcon: React.FC<CustomIconProps> = ({ size = 20, className = '', isActive = false }) => {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <img
        src="/linkedin.png"
        alt="LinkedIn"
        className={`transition-all duration-200 ${className}`}
        style={{
          width: size,
          height: size,
          opacity: isActive ? 1 : 0.7,
          transform: isActive ? 'scale(1.1)' : 'scale(1)',
        }}
        onError={(e) => {
          console.error('LinkedIn icon failed to load:', e);
        }}
        onLoad={() => {
          console.log('LinkedIn icon loaded successfully');
        }}
      />
    </div>
  );
};

type UserStatus = 'pending' | 'active' | 'blocked';

interface MenuItem {
  IconComponent: LucideIcon | React.FC<CustomIconProps>;
  label: string;
  path: string;
  roles: UserRole[];
  requiredStatus?: UserStatus[];
  fullWidth?: boolean;
  iconType?: 'instagram' | 'linkedin'; // Dodana właściwość do identyfikacji
}

// CONTEXT PRO PERSISTENT STATE
interface LayoutContextType {
  hoveredSidebar: boolean;
  setHoveredSidebar: (value: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (value: boolean) => void;
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | null>(null);

// PROVIDER KOMPONENT - RENDEROWANY TYLKO RAZ
export const LayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [hoveredSidebar, setHoveredSidebar] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('sidebarExpanded') === 'true';
    } catch {
      return false;
    }
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Zapisz stan do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarExpanded', hoveredSidebar.toString());
    }
  }, [hoveredSidebar]);

  return (
    <LayoutContext.Provider value={{
      hoveredSidebar,
      setHoveredSidebar,
      isMobileMenuOpen,
      setIsMobileMenuOpen,
      isNavigating,
      setIsNavigating
    }}>
      {children}
    </LayoutContext.Provider>
  );
};

const useLayout = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within LayoutProvider');
  }
  return context;
};

// POPRAWIONA LISTA MENU ITEMS
const menuItems: MenuItem[] = [
  {
    IconComponent: Home,
    label: 'Dashboard',
    path: '/dashboard',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active'],
    fullWidth: true
  },
  {
    IconComponent: Users,
    label: 'Raport Twórcy',
    path: '/raport-tworcy',
    roles: ['ADMIN', 'GOD'],
    requiredStatus: ['active']
  },
  {
    IconComponent: InstagramIcon,
    label: 'Instagram App',
    path: '/instagram_app',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active'],
    iconType: 'instagram'
  },
  {
    IconComponent: LinkedInIcon,
    label: 'LinkedIn App',
    path: '/linkedin_app',
    roles: ['ADMIN', 'USER', 'GOD'],
    requiredStatus: ['active'],
    iconType: 'linkedin'
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

// FUNKCJA POMOCNICZA DO RENDEROWANIA IKON
const renderMenuIcon = (item: MenuItem, isActive: boolean, size: number = 20) => {
  const IconComponent = item.IconComponent;

  // Sprawdź czy to custom ikona
  if (item.iconType === 'instagram' || item.iconType === 'linkedin') {
    return <IconComponent size={size} isActive={isActive} />;
  } else {
    // Standardowa Lucide ikona
    return <IconComponent size={size} />;
  }
};

const getCurrentPageLabel = (path: string | null) => {
  if (!path) return 'Dashboard';
  const normalizedPath = path.endsWith('/') ? path.slice(0, -1) : path;
  const menuItem = menuItems.find(item => normalizedPath === item.path);
  return menuItem?.label || 'Dashboard';
};

// SIDEBAR KOMPONENT - PERSISTENT Z POPRAWKAMI
const Sidebar: React.FC = () => {
  const { hoveredSidebar, setHoveredSidebar, isMobileMenuOpen, setIsMobileMenuOpen, setIsNavigating } = useLayout();
  const pathname = usePathname();
  const { user, userRole, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isScreenSizeDetected, setIsScreenSizeDetected] = useState(false);

  const normalizedPathname = pathname?.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const userStatus = user?.status?.toLowerCase() as UserStatus | undefined;
  const userRoleFromAuth = (userRole || 'USER') as UserRole;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      setIsMobile(newIsMobile);
      setIsScreenSizeDetected(true);
      if (newIsMobile && hoveredSidebar) {
        setHoveredSidebar(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hoveredSidebar, setHoveredSidebar]);

  const filteredMenuItems = menuItems.filter(item => {
    const hasRequiredRole = item.roles.includes(userRoleFromAuth);
    const hasRequiredStatus = !item.requiredStatus ||
                             (userStatus && item.requiredStatus.includes(userStatus));
    return hasRequiredRole && hasRequiredStatus;
  });

  const handleMouseEnter = () => {
    if (!isMobile) {
      setHoveredSidebar(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setHoveredSidebar(false);
    }
  };

  const handleNavigation = () => {
    setIsNavigating(true);
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
    setTimeout(() => setIsNavigating(false), 500);
  };

  const handleMobileLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      setIsMobileMenuOpen(false);
      window.location.href = '/';
    } catch (error) {
      console.error("Błąd podczas wylogowywania:", error);
      setIsLoggingOut(false);
    }
  };

  if (!isScreenSizeDetected) {
    return null;
  }

  // Loading state for menu items - tylko dla desktop
  if (authLoading && !isMobile) {
    const sidebarWidth = hoveredSidebar ? 'w-64' : 'w-18.5';

    return (
      <div className={`fixed left-0 z-50 top-16 h-[calc(100vh-4rem)] ${sidebarWidth}
        bg-white shadow-xl rounded-r-3xl overflow-hidden backdrop-blur-sm
        transition-all duration-300 ease-out border-r border-gray-100`}>
        <div className="py-4">
          <div className="px-3 space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center h-12 px-3 space-x-3">
                  <div className="w-6 h-6 bg-gray-300 rounded"></div>
                  {hoveredSidebar && (
                    <div className="h-4 bg-gray-300 rounded w-24"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // MOBILE SIDEBAR
  if (isMobile) {
    if (!isClient || authLoading) {
      return null;
    }

    return (
      <div
        className={`fixed left-0 z-50 top-16 h-[calc(100vh-4rem)] w-64
          bg-white/95 backdrop-blur-xl backdrop-saturate-150 shadow-2xl rounded-r-3xl
          transition-all duration-300 ease-out overflow-y-auto border-r border-gray-100
          ${isMobileMenuOpen ? 'transform translate-x-0' : 'transform -translate-x-full'}`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div className="flex flex-col h-full">
          <nav className="flex-1 py-6">
            <ul className="space-y-2 px-4">
              {filteredMenuItems.map((item, index) => (
                <li key={item.path}
                    className={`transition-all duration-300 ${isMobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                    style={{ transitionDelay: `${index * 50}ms` }}>
                  <Link
                    href={item.path}
                    className={`
                      flex items-center h-14 px-4 rounded-xl transition-all duration-200
                      focus:outline-none focus:ring-2 focus:ring-blue-400
                      ${normalizedPathname === item.path
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-md border border-blue-200'
                        : 'border border-transparent hover:bg-white/80 text-gray-700 hover:shadow-md'
                      }
                    `}
                    onClick={handleNavigation}
                  >
                    <div className={`
                      flex-shrink-0 w-7 h-7 flex items-center justify-center
                      ${normalizedPathname === item.path ? 'text-blue-600' : 'text-gray-600'}
                    `}>
                      {renderMenuIcon(item, normalizedPathname === item.path, 22)}
                    </div>
                    <span className="ml-4 whitespace-nowrap font-medium text-base">
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="px-4 pb-6 pt-4 border-t border-gray-200/50 flex justify-center">
            <button
              onClick={handleMobileLogout}
              disabled={isLoggingOut}
              className={`p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
                isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-label="Wyloguj się"
              title="Wyloguj się"
            >
              {isLoggingOut ? (
                <div className="h-5 w-5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
              ) : (
                isClient && <Power className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DESKTOP SIDEBAR
  return (
    <div
      className={`fixed left-0 z-40 top-16 h-[calc(100vh-4rem)]
        bg-white shadow-xl rounded-r-3xl overflow-hidden backdrop-blur-sm
        transition-all duration-300 ease-out border-r border-gray-100 ${
          hoveredSidebar ? 'w-64' : 'w-18.5'
        }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: hoveredSidebar ? 'translateX(0)' : 'translateX(0)',
        boxShadow: hoveredSidebar
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 10px 20px -5px rgba(0, 0, 0, 0.1)'
          : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}
    >
      <nav className="py-4 h-full">
        <ul className="space-y-1 px-3">
          {filteredMenuItems.map((item) => (
            <li key={item.path}>
              <div className="relative group">
                <Link
                  href={item.path}
                  className={`
                    relative flex items-center h-12 px-3 group/link
                    rounded-xl transition-all duration-200 ease-out
                    focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
                    ${normalizedPathname === item.path
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm border border-blue-200'
                      : 'border border-transparent hover:bg-gray-50 text-gray-700 hover:shadow-sm hover:scale-[1.02]'
                    }
                  `}
                  onClick={handleNavigation}
                >
                  <div className={`
                    flex-shrink-0 w-6 h-6 flex items-center justify-center
                    transition-all duration-200
                    ${normalizedPathname === item.path ? 'text-blue-600 scale-110' : 'text-gray-600 group-hover/link:text-gray-700 group-hover/link:scale-105'}
                  `}>
                    {renderMenuIcon(item, normalizedPathname === item.path, 20)}
                  </div>
                  <span className={`
                    ml-4 whitespace-nowrap font-medium overflow-hidden
                    transition-all duration-300 ease-out
                    ${hoveredSidebar
                      ? 'opacity-100 translate-x-0 w-auto'
                      : 'opacity-0 translate-x-2 w-0'
                    }
                  `}>
                    {item.label}
                  </span>
                </Link>

                {/* TOOLTIP DLA ZWIJĘTEGO SIDEBARA */}
                {!hoveredSidebar && (
                  <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {item.label}
                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45"></div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

// HEADER KOMPONENT - bez zmian
const Header: React.FC = () => {
  const { isMobileMenuOpen, setIsMobileMenuOpen, hoveredSidebar } = useLayout();
  const { signOut, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isScreenSizeDetected, setIsScreenSizeDetected] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsScreenSizeDetected(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error("Błąd podczas wylogowywania:", error);
      setIsLoggingOut(false);
    }
  };

  const goToHome = () => {
    router.push('/dashboard');
  };

  const headerPaddingLeft = isMobile || !isScreenSizeDetected ? '1rem' : '1rem';
  const rightSideMarginLeft = !isMobile && hoveredSidebar && isScreenSizeDetected ? '176px' : '0';

  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm border-b border-gray-200 z-50 flex items-center pr-6"
      style={{
        paddingLeft: headerPaddingLeft,
        transition: 'padding-left 0.3s ease-out',
      }}
    >
      <div className="flex items-center flex-shrink-0">
        {isMobile && isScreenSizeDetected && (
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="mr-4 p-2.5 hover:bg-gray-100 rounded-xl transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
            aria-label={isMobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
          >
            <div className="relative w-6 h-6">
              {isMobileMenuOpen ? (
                isClient && <X className="h-6 w-6 text-gray-600 transition-transform duration-200 rotate-0 hover:rotate-90" />
              ) : (
                isClient && <Menu className="h-6 w-6 text-gray-600 transition-transform duration-200" />
              )}
            </div>
          </button>
        )}

        <div className="mr-4 cursor-pointer" onClick={goToHome}>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-xl shadow-lg border border-gray-200 flex items-center justify-center p-1">
                <img
                  src="/logo.png"
                  alt="inflee.app logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  inflee.app
                </span>
                <span className="hidden md:block text-xs text-gray-500 font-medium tracking-wide uppercase leading-tight max-w-xs">
                  Edukuj | Rośnij | Zarabiaj
                </span>
              </div>
            </div>
        </div>
      </div>

      <div
        className="flex items-center justify-end flex-grow"
        style={{
          marginLeft: rightSideMarginLeft,
          transition: 'margin-left 0.3s ease-out'
        }}
      >
        {authLoading ? (
          <div className="flex items-center gap-3 animate-pulse">
            <div className="h-4 bg-gray-300 rounded w-24"></div>
            <div className="h-6 bg-gray-300 rounded-full w-16"></div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-gray-700">
              {user?.first_name && user?.last_name ? (
                  <>
                      <span className="hidden md:block">
                          {`${user.first_name} ${user.last_name}`}
                      </span>
                      <div className="flex flex-col items-end md:hidden">
                          <span>{user.first_name}</span>
                          <span>{user.last_name}</span>
                      </div>
                  </>
              ) : (
                  <span>{user?.email || 'Użytkownik'}</span>
              )}
            </div>

            <div className="flex items-center">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt="Zdjęcie profilowe"
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}

              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs md:text-sm font-semibold shadow-sm hover:shadow-md transition-shadow duration-200 ${user?.profilePicture ? 'hidden' : ''}`}>
                {user?.first_name?.[0]?.toUpperCase()}{user?.last_name?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        )}

        {!isMobile && isScreenSizeDetected && (
          <>
            <div className="h-8 w-px bg-gray-200 mx-3"></div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={`p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md ${
                isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-label="Wyloguj się"
              title="Wyloguj się"
            >
              {isLoggingOut ? (
                <div className="h-5 w-5 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
              ) : (
                isClient && <Power className="h-5 w-5" />
              )}
            </button>
          </>
        )}
      </div>
    </header>
  );
};

// GŁÓWNY PERSISTENT LAYOUT - bez zmian
interface PersistentAdminLayoutProps {
  children: ReactNode;
  disableMenu?: boolean;
}

const PersistentAdminLayout: React.FC<PersistentAdminLayoutProps> = ({
  children,
  disableMenu = false
}) => {
  const { hoveredSidebar, isNavigating } = useLayout();
  const pathname = usePathname();
  const { isLoading: authLoading } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isScreenSizeDetected, setIsScreenSizeDetected] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsScreenSizeDetected(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentMenuItem = menuItems.find(item =>
    (pathname?.endsWith('/') ? pathname.slice(0, -1) : pathname) === item.path
  );
  const isFullWidthPage = currentMenuItem?.fullWidth || false;

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {!disableMenu && <Sidebar />}

      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-out ${
          isMobile || disableMenu || !isScreenSizeDetected
            ? 'ml-0'
            : hoveredSidebar
              ? 'ml-64'
              : 'ml-20'
        }`}
        style={{
          paddingTop: '64px',
          height: '100vh'
        }}
      >
        <Header />

        <main className="flex-1 px-4 pb-4 pt-1.5 overflow-auto bg-gray-100 relative">
          {isNavigating && (
            <div className="absolute inset-0 z-[100] bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
              <LoadingSpinner message="Przechodzę do strony" fullScreen={false} size="md" />
            </div>
          )}

          {authLoading && (
            <div className="absolute inset-0 z-[99] bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-xl">
              <LoadingSpinner message="Ładowanie aplikacji" fullScreen={false} size="lg" />
            </div>
          )}

          {!isFullWidthPage && !disableMenu && (
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 transition-all duration-300">
              <div className="flex flex-row items-center w-full md:w-auto gap-3">
                <div className="bg-white px-3 py-1.5 md:px-5 md:py-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
                  <h2 className="text-base md:text-xl font-semibold text-gray-700 whitespace-nowrap">
                    {getCurrentPageLabel(pathname)}
                  </h2>
                </div>
              </div>

              <div className="hidden md:flex w-full justify-end items-center mt-2:mt-0">
                {isClient && (
                  <div className="bg-white px-5 py-3 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
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

          <div className={`
            transition-all duration-300 ease-out
            ${isFullWidthPage || disableMenu
              ? 'bg-white rounded-xl shadow-sm p-0 min-h-full overflow-hidden border border-gray-200 hover:shadow-md'
              : 'bg-white rounded-xl shadow-sm p-6 md:p-8 min-h-full border border-gray-200 hover:shadow-md'
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const PersistentAdminLayoutWithProvider: React.FC<PersistentAdminLayoutProps> = (props) => {
  return (
    <LayoutProvider>
      <PersistentAdminLayout {...props} />
    </LayoutProvider>
  );
};

export default PersistentAdminLayoutWithProvider;