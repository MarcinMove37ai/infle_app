// src/components/pages/DashboardContent.tsx
'use client';

import {
  Users,
  UserPlus,
  Instagram,
  Briefcase,
  CheckCircle,
  Eye,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardContent() {
  // Pobieranie danych użytkownika z hooka useAuth
  const { user } = useAuth();

  // Dane profilu z JSON (jako fallback)
  const profileData = {
    username: "move37th.ai",
    fullName: "Marcin Lisiak",
    biography: "Projektuję, buduję i wdrażam systemy AI małych i srednich firmach. Specjalizuje się w systemach RAG, czyli BOTach bez halucynacji opartych na danych🦾",
    followersCount: 45,
    followsCount: 57,
    isBusinessAccount: true,
    businessCategoryName: "Software Company",
    verified: false,
    private: false,
    postsCount: 0,
    profilePicUrl: "https://instagram.fkul8-3.fna.fbcdn.net/v/t51.2885-19/490701147_984539997161777_7444308159241771146_n.jpg?stp=dst-jpg_s320x320_tt6&_nc_ht=instagram.fkul8-3.fna.fbcdn.net&_nc_cat=105&_nc_oc=Q6cZ2QEwoxrxterSx-xw-04xYV5SCUIJ1X6XAGnu5mVW6fwO8qyRNQi8b0S2HiW5GBd10CDJPVMPrhoHCRJEQmx4u2Wd&_nc_ohc=xYuD_CE8IfkQ7kNvwG8cEZa&_nc_gid=M8b1-niJ4MjXXw4rTLibBg&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AfOmW9YZ_etMSf98e-Dcs0usJkGNgh5S-IlKo00XCUwV2Q&oe=684F0402&_nc_sid=8b3546"
  };

  // Użyj danych z useAuth jako główne źródło, fallback na profileData
  const displayName = user?.first_name && user?.last_name
    ? `${user.first_name} ${user.last_name}`
    : profileData.fullName;

  const profileImageUrl = user?.profilePicture || profileData.profilePicUrl;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ======================================================================= */}
        {/* =================== SEKCJA NAGŁÓWKA PROFILU (ZAKTUALIZOWANA) =================== */}
        {/* ======================================================================= */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100/50 overflow-hidden">
          {/* Tło z gradientem i przyciskiem "Zarządzaj" */}
          <div className="h-32 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 relative flex justify-end items-center p-6">
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent"></div>
            {/* Przycisk "Zarządzaj" dla widoku desktopowego */}
            <div className="hidden md:block z-10">
              <button className="bg-white/20 text-white backdrop-blur-sm border border-white/30 px-5 py-2.5 rounded-lg font-semibold hover:bg-white/30 transition-colors flex items-center justify-center">
                <Instagram className="mr-2" size={18} />
                Zarządzaj
              </button>
            </div>
          </div>

          {/* Kontener na treść profilu (awatar + tekst) */}
          <div className="px-6 md:px-8 pb-8">
            <div className="flex flex-col md:flex-row md:space-x-8 items-start">
              {/* Awatar - wypozycjonowany z ujemnym marginesem, aby nachodził na baner */}
              <div className="relative flex-shrink-0 group/avatar mx-auto md:mx-0 -mt-20">
                <div className="relative">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 rounded-full blur opacity-75 group-hover/avatar:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                  <div className="relative flex items-center">
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt={displayName}
                        className="w-32 h-32 rounded-full border-4 border-white shadow-2xl object-cover"
                      />
                    ) : null}
                    <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-2xl border-4 border-white ${profileImageUrl ? 'hidden' : ''}`}>
                      {displayName.split(' ').map(name => name[0]).join('').toUpperCase()}
                    </div>
                  </div>
                </div>
                {profileData.verified && (
                  <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-lg">
                    <CheckCircle className="text-blue-500" size={24} />
                  </div>
                )}
              </div>

              {/* Cała treść tekstowa teraz w białym obszarze */}
              <div className="flex-1 text-center md:text-left mt-4 md:pt-4 w-full">
                {/* Imię i Nazwisko - ZAKTUALIZOWANY STYL */}
                <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
                  {displayName}
                </h1>

                {/* Nazwa użytkownika i kategoria */}
                <div className="mt-2 flex items-center justify-center md:justify-start space-x-3 text-gray-500">
                  <div className="flex items-center space-x-1.5">
                    <Instagram size={16} className="text-pink-500" />
                    <span className="font-semibold text-gray-700">@{profileData.username}</span>
                  </div>
                  <span>•</span>
                  <span className="text-gray-600 font-medium">
                    {profileData.businessCategoryName}
                  </span>
                </div>

                {/* Biografia */}
                <div className="mt-4">
                  <p className="text-gray-600 leading-relaxed text-base max-w-full">
                    {profileData.biography}
                  </p>
                </div>
              </div>
            </div>
             {/* Przycisk "Zarządzaj" dla widoku mobilnego */}
            <div className="md:hidden mt-6">
                <button className="bg-blue-600 text-white w-full px-5 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center shadow-md">
                    <Instagram className="mr-2" size={18} />
                    Zarządzaj
                </button>
            </div>
          </div>
        </div>
        {/* ======================================================================= */}
        {/* ================= KONIEC SEKCJI NAGŁÓWKA PROFILU ====================== */}
        {/* ======================================================================= */}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Obserwujący</p>
                <p className="text-3xl font-bold text-blue-600">{profileData.followersCount.toLocaleString()}</p>
                <p className="text-gray-500 text-xs mt-1">Followers</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Obserwowani</p>
                <p className="text-3xl font-bold text-green-600">{profileData.followsCount.toLocaleString()}</p>
                <p className="text-gray-500 text-xs mt-1">Following</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <UserPlus className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Posty</p>
                <p className="text-3xl font-bold text-purple-600">{profileData.postsCount.toLocaleString()}</p>
                <p className="text-gray-500 text-xs mt-1">Opublikowane</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <Activity className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Engagement Overview */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <TrendingUp className="mr-3 text-blue-600" size={28} />
              Przegląd Profilu
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Status Konta</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Typ konta</span>
                  <span className="font-medium text-blue-600">
                    {profileData.isBusinessAccount ? 'Biznesowe' : 'Osobiste'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Prywatność</span>
                  <span className="font-medium text-green-600">
                    {profileData.private ? 'Prywatne' : 'Publiczne'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">Weryfikacja</span>
                  <span className="font-medium text-gray-600">
                    {profileData.verified ? 'Zweryfikowane' : 'Niezweryfikowane'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Wskaźniki Zaangażowania</h3>
              <div className="space-y-3">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-800 font-medium">Stosunek Following/Followers</span>
                    <span className="text-blue-900 font-bold">
                      {(profileData.followsCount / profileData.followersCount).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-blue-600 text-sm mt-1">
                    {profileData.followsCount / profileData.followersCount > 1 ?
                      'Obserwujesz więcej niż Cię obserwuje' :
                      'Masz więcej obserwujących niż obserwujesz'
                    }
                  </p>
                </div>

                <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-800 font-medium">Aktywność</span>
                    <span className="text-purple-900 font-bold">
                      {profileData.postsCount === 0 ? 'Nowy profil' : 'Aktywny'}
                    </span>
                  </div>
                  <p className="text-purple-600 text-sm mt-1">
                    {profileData.postsCount === 0 ?
                      'Brak postów - świeży start!' :
                      `${profileData.postsCount} opublikowanych postów`
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}