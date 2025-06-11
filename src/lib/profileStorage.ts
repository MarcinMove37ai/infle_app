// src/lib/profileStorage.ts
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Typ dla danych Instagram z Apify (na podstawie istniejącego kodu)
interface ApifyInstagramData {
  inputUrl: string;
  id: string;
  username: string;
  url: string;
  fullName: string | null;
  biography: string | null;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  profilePicUrl: string;
  profilePicUrlHD: string;
  isBusinessAccount: boolean;
  private: boolean;
  verified: boolean;
  businessCategoryName: string;
}

// Typ dla danych LinkedIn z Apify (na podstawie istniejącego kodu) - ROZSZERZONY
interface ApifyLinkedInData {
  linkedinUrl: string;
  firstName: string;
  lastName: string;
  fullName: string;
  headline: string;
  connections: number;
  followers: number;
  jobTitle: string;
  companyName: string | null;
  companyIndustry?: string | null;
  profilePic: string;
  profilePicHighQuality: string;
  about: string;
  publicIdentifier: string;
  skills: any[];
  // POLA LOKALIZACJI
  addressWithCountry?: string;
  addressWithoutCountry?: string;
  addressCountryOnly?: string;
}

// Funkcja do wyciągania metadanych z request
export function extractRequestMetadata(request: NextRequest) {
  const userIp = request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { userIp, userAgent };
}

// ===== FUNKCJE DEDUPLIKACJI =====

// Funkcja sprawdzająca czy profil Instagram już istnieje
async function checkExistingInstagramProfile(apifyData: ApifyInstagramData): Promise<string | null> {
  try {
    console.log('🔍 Checking for existing Instagram profile...');

    // Główny klucz: instagramId
    if (apifyData.id) {
      const existingById = await prisma.instagramProfileCheck.findFirst({
        where: { instagramId: apifyData.id }
      });
      if (existingById) {
        console.log('🔄 Instagram profile found by instagramId:', existingById.id);
        return existingById.id;
      }
    }

    // Fallback: sprawdź po username + URL (w przypadku braku ID)
    if (apifyData.username && apifyData.inputUrl) {
      const existingByUsernameUrl = await prisma.instagramProfileCheck.findFirst({
        where: {
          AND: [
            { username: apifyData.username },
            { instagramUrl: apifyData.inputUrl }
          ]
        }
      });
      if (existingByUsernameUrl) {
        console.log('🔄 Instagram profile found by username+URL:', existingByUsernameUrl.id);
        return existingByUsernameUrl.id;
      }
    }

    console.log('✨ No existing Instagram profile found, will create new one');
    return null;
  } catch (error) {
    console.error('❌ Error checking existing Instagram profile:', error);
    return null;
  }
}

// Funkcja sprawdzająca czy profil LinkedIn już istnieje
async function checkExistingLinkedInProfile(apifyData: ApifyLinkedInData): Promise<string | null> {
  try {
    console.log('🔍 Checking for existing LinkedIn profile...');

    // Główny klucz: publicIdentifier
    if (apifyData.publicIdentifier) {
      const existingByIdentifier = await prisma.linkedInProfileCheck.findFirst({
        where: {
          OR: [
            { linkedinUrl: apifyData.linkedinUrl },
            {
              AND: [
                { firstName: apifyData.firstName },
                { lastName: apifyData.lastName },
                { headline: apifyData.headline }
              ]
            }
          ]
        }
      });
      if (existingByIdentifier) {
        console.log('🔄 LinkedIn profile found by identifier/URL/details:', existingByIdentifier.id);
        return existingByIdentifier.id;
      }
    }

    // Fallback: sprawdź po LinkedIn URL
    if (apifyData.linkedinUrl) {
      const existingByUrl = await prisma.linkedInProfileCheck.findFirst({
        where: { linkedinUrl: apifyData.linkedinUrl }
      });
      if (existingByUrl) {
        console.log('🔄 LinkedIn profile found by URL:', existingByUrl.id);
        return existingByUrl.id;
      }
    }

    console.log('✨ No existing LinkedIn profile found, will create new one');
    return null;
  } catch (error) {
    console.error('❌ Error checking existing LinkedIn profile:', error);
    return null;
  }
}

// ===== FUNKCJE INSTAGRAM =====

// Funkcja do walidacji danych Instagram przed zapisem
export function validateInstagramData(data: ApifyInstagramData): boolean {
  if (!data.username || !data.inputUrl) {
    console.log('❌ Instagram validation failed: missing username or URL');
    return false;
  }

  if (typeof data.followersCount !== 'number' || data.followersCount < 0) {
    console.log('❌ Instagram validation failed: invalid followersCount');
    return false;
  }

  return true;
}

// Główna funkcja do zapisu profilu Instagram - Z DEDUPLIKACJĄ
export async function saveInstagramProfile(
  apifyData: ApifyInstagramData,
  request: NextRequest
): Promise<string | null> {
  try {
    console.log('💾 Saving Instagram profile to database...');
    console.log('📊 Profile data:', {
      username: apifyData.username,
      fullName: apifyData.fullName,
      followersCount: apifyData.followersCount,
      private: apifyData.private
    });

    // DEDUPLIKACJA - sprawdź czy profil już istnieje
    const existingProfileId = await checkExistingInstagramProfile(apifyData);
    if (existingProfileId) {
      console.log('🔄 Instagram profile already exists, returning existing ID:', existingProfileId);
      return existingProfileId;
    }

    // Walidacja danych
    if (!validateInstagramData(apifyData)) {
      console.log('❌ Instagram data validation failed');
      return null;
    }

    // Wyciągnij metadane z request
    const { userIp, userAgent } = extractRequestMetadata(request);

    // Sanityzacja i przygotowanie danych
    const profileData = {
      instagramUrl: apifyData.inputUrl,
      instagramId: apifyData.id || null,
      username: apifyData.username,
      fullName: apifyData.fullName || null,
      biography: apifyData.biography ? apifyData.biography.substring(0, 1000) : null,
      followersCount: apifyData.followersCount || 0,
      followsCount: apifyData.followsCount || 0,
      postsCount: apifyData.postsCount || 0,
      profilePicUrl: apifyData.profilePicUrl || null,
      profilePicUrlHD: apifyData.profilePicUrlHD || null,
      isBusinessAccount: apifyData.isBusinessAccount || false,
      isPrivate: apifyData.private || false,
      isVerified: apifyData.verified || false,
      businessCategory: apifyData.businessCategoryName || null,
      userIp,
      userAgent
    };

    // Zapis do bazy danych
    const savedProfile = await prisma.instagramProfileCheck.create({
      data: profileData
    });

    console.log('✅ NEW Instagram profile saved successfully with ID:', savedProfile.id);
    return savedProfile.id;

  } catch (error) {
    console.error('❌ Error saving Instagram profile:', error);
    return null;
  }
}

// Funkcja do sprawdzenia czy profil Instagram istnieje w bazie
export async function verifyInstagramProfileExists(profileId: string): Promise<boolean> {
  try {
    const profile = await prisma.instagramProfileCheck.findUnique({
      where: { id: profileId }
    });
    return !!profile;
  } catch (error) {
    console.error('❌ Error verifying Instagram profile:', error);
    return false;
  }
}

// Funkcja pomocnicza do powiązania użytkownika z profilem Instagram
export async function linkUserToInstagramProfile(userId: string, profileId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        instagramProfileId: profileId,
        socialProfileType: 'INSTAGRAM_ONLY'
      }
    });

    console.log('✅ User linked to Instagram profile successfully');
    return true;
  } catch (error) {
    console.error('❌ Error linking user to Instagram profile:', error);
    return false;
  }
}

// ===== FUNKCJE LINKEDIN =====

// Funkcja do walidacji danych LinkedIn przed zapisem
export function validateLinkedInData(data: ApifyLinkedInData): boolean {
  if (!data.publicIdentifier || !data.linkedinUrl) {
    console.log('❌ LinkedIn validation failed: missing publicIdentifier or URL');
    return false;
  }

  if (typeof data.followers !== 'number' || data.followers < 0) {
    console.log('❌ LinkedIn validation failed: invalid followers count');
    return false;
  }

  return true;
}

// Funkcja do normalizacji danych LinkedIn
export function normalizeLinkedInData(data: ApifyLinkedInData) {
  // PRZETWARZANIE SKILLS
  let topSkills = null;
  if (data.skills && Array.isArray(data.skills) && data.skills.length > 0) {
    try {
      const skillNames = data.skills
        .slice(0, 5)
        .map(skill => {
          if (typeof skill === 'string') {
            return skill;
          } else if (skill && typeof skill === 'object') {
            return skill.title || skill.name || skill.skillName || String(skill);
          }
          return String(skill);
        })
        .filter(skill => skill && skill !== '[object Object]' && skill !== 'undefined')
        .join(', ');

      topSkills = skillNames || null;
      console.log('✅ Processed LinkedIn skills:', skillNames.substring(0, 100));
    } catch (error) {
      console.error('❌ Error processing LinkedIn skills:', error);
      topSkills = null;
    }
  }

  // MAPOWANIE LOKALIZACJI
  let location = null;
  if (data.addressWithCountry) {
    location = data.addressWithCountry;
  } else if (data.addressWithoutCountry) {
    location = data.addressWithoutCountry;
  } else if (data.addressCountryOnly) {
    location = data.addressCountryOnly;
  }

  return {
    linkedinUrl: data.linkedinUrl,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    fullName: data.fullName || null,
    headline: data.headline ? data.headline.substring(0, 500) : null,
    aboutExcerpt: data.about ? data.about.substring(0, 500) : null,
    connectionsCount: data.connections || 0,
    followersCount: data.followers || 0,
    profilePicUrl: data.profilePicHighQuality || data.profilePic || null,
    jobTitle: data.jobTitle || null,
    companyName: data.companyName || null,
    companyIndustry: data.companyIndustry || null,
    location: location,
    publicIdentifier: data.publicIdentifier,
    topSkills: topSkills
  };
}

// Główna funkcja do zapisu profilu LinkedIn - Z DEDUPLIKACJĄ
export async function saveLinkedInProfile(
  apifyData: ApifyLinkedInData,
  request: NextRequest
): Promise<string | null> {
  try {
    console.log('💾 Saving LinkedIn profile to database...');
    console.log('📊 Profile data:', {
      publicIdentifier: apifyData.publicIdentifier,
      fullName: apifyData.fullName,
      followersCount: apifyData.followers,
      connectionsCount: apifyData.connections
    });

    // DEDUPLIKACJA - sprawdź czy profil już istnieje
    const existingProfileId = await checkExistingLinkedInProfile(apifyData);
    if (existingProfileId) {
      console.log('🔄 LinkedIn profile already exists, returning existing ID:', existingProfileId);
      return existingProfileId;
    }

    // Walidacja danych
    if (!validateLinkedInData(apifyData)) {
      console.log('❌ LinkedIn data validation failed');
      return null;
    }

    // Wyciągnij metadane z request
    const { userIp, userAgent } = extractRequestMetadata(request);

    // Normalizacja i przygotowanie danych
    const normalizedData = normalizeLinkedInData(apifyData);

    const profileData = {
      linkedinUrl: normalizedData.linkedinUrl,
      firstName: normalizedData.firstName,
      lastName: normalizedData.lastName,
      fullName: normalizedData.fullName,
      headline: normalizedData.headline,
      aboutExcerpt: normalizedData.aboutExcerpt,
      connectionsCount: normalizedData.connectionsCount,
      followersCount: normalizedData.followersCount,
      profilePicUrl: normalizedData.profilePicUrl,
      jobTitle: normalizedData.jobTitle,
      companyName: normalizedData.companyName,
      companyIndustry: normalizedData.companyIndustry,
      location: normalizedData.location,
      topSkills: normalizedData.topSkills,
      userIp,
      userAgent
    };

    // Zapis do bazy danych
    const savedProfile = await prisma.linkedInProfileCheck.create({
      data: profileData
    });

    console.log('✅ NEW LinkedIn profile saved successfully with ID:', savedProfile.id);
    return savedProfile.id;

  } catch (error) {
    console.error('❌ Error saving LinkedIn profile:', error);
    return null;
  }
}

// Funkcja do sprawdzenia czy profil LinkedIn istnieje w bazie
export async function verifyLinkedInProfileExists(profileId: string): Promise<boolean> {
  try {
    const profile = await prisma.linkedInProfileCheck.findUnique({
      where: { id: profileId }
    });
    return !!profile;
  } catch (error) {
    console.error('❌ Error verifying LinkedIn profile:', error);
    return false;
  }
}

// Funkcja pomocnicza do powiązania użytkownika z profilem LinkedIn
export async function linkUserToLinkedInProfile(userId: string, profileId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        linkedinProfileId: profileId,
        socialProfileType: 'LINKEDIN_ONLY'
      }
    });

    console.log('✅ User linked to LinkedIn profile successfully');
    return true;
  } catch (error) {
    console.error('❌ Error linking user to LinkedIn profile:', error);
    return false;
  }
}

// ===== FUNKCJE OGÓLNE =====

// Funkcja do określenia typu profilu na podstawie ID
export async function getProfileType(profileId: string): Promise<'instagram' | 'linkedin' | null> {
  try {
    // Sprawdź czy to profil Instagram
    const instagramProfile = await prisma.instagramProfileCheck.findUnique({
      where: { id: profileId }
    });
    if (instagramProfile) return 'instagram';

    // Sprawdź czy to profil LinkedIn
    const linkedinProfile = await prisma.linkedInProfileCheck.findUnique({
      where: { id: profileId }
    });
    if (linkedinProfile) return 'linkedin';

    return null;
  } catch (error) {
    console.error('❌ Error determining profile type:', error);
    return null;
  }
}

// Funkcja do sprawdzenia czy profil istnieje (niezależnie od typu)
export async function verifyProfileExists(profileId: string): Promise<boolean> {
  const profileType = await getProfileType(profileId);
  return profileType !== null;
}