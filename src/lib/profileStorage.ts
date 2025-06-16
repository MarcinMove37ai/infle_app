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
  highlightReelCount: number;
  profilePicUrl: string;
  profilePicUrlHD: string;
  isBusinessAccount: boolean;
  is_private: boolean;
  verified: boolean;
  businessCategoryName: string;
}

// Typ dla danych LinkedIn z Apify
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
  addressWithCountry?: string;
  addressWithoutCountry?: string;
  addressCountryOnly?: string;
}

// dane analizy twórcy
interface CreatorAnalysisData {
  userId: string;
  username: string;
  postId: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  videoPlayCount: number | null;
  videoDuration: number | null;
  commenterUsernames: Record<string, number>;
}

// 🆕 NOWE INTERFEJSY AI ANALYSIS
interface AIAnalysisData {
  username: string;
  profileDescription: string;
  competencies: AICompetency[];
  uniqueTalent: AIUniqueTalent;
}

interface AICompetency {
  name: string;
  iconType: string;
  description: string;
  evidence: string[];
}

interface AIUniqueTalent {
  name: string;
  description: string;
  marketValue: string;
  evidence: string[];
}

interface AIAnalysisMetadata {
  generatedAt: string;
  aiModel: string;
  postsCount: number;
  version?: string;
}

interface SaveAIAnalysisData {
  userId: string;
  username: string;
  analysisData: AIAnalysisData;
  metadata: AIAnalysisMetadata;
  postsAnalyzed: number;
}

// wynik sprawdzenia istniejącego profilu
interface ExistingProfileResult {
  exists: boolean;
  profileId: string | null;
}

// Funkcja do wyciągania metadanych z request
export function extractRequestMetadata(request: NextRequest) {
  const userIp = request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { userIp, userAgent };
}

// ===== 🆕 NOWE FUNKCJE AI ANALYSIS =====

// Funkcja do zapisywania AI analysis do bazy danych
export async function saveAIAnalysis(data: SaveAIAnalysisData): Promise<{ success: boolean; analysisId?: string; error?: string }> {
  try {
    console.log('💾 Saving AI analysis to database...');
    console.log('🧠 Analysis data:', {
      userId: data.userId,
      username: data.username,
      competenciesCount: data.analysisData.competencies.length,
      uniqueTalent: data.analysisData.uniqueTalent.name,
      postsAnalyzed: data.postsAnalyzed
    });

    // Przygotuj dane do zapisu
    const saveData = {
      userId: data.userId,
      username: data.username,
      profileDescription: data.analysisData.profileDescription,
      competencies: data.analysisData.competencies,
      uniqueTalent: data.analysisData.uniqueTalent,
      metadata: data.metadata,
      postsAnalyzed: data.postsAnalyzed,
      aiModel: data.metadata.aiModel,
      version: data.metadata.version || '2.0'
    };

    // Upsert - zaktualizuj jeśli istnieje, utwórz jeśli nie
    const savedAnalysis = await prisma.instagramCreatorAIAnalysis.upsert({
      where: {
        userId_username: {
          userId: data.userId,
          username: data.username
        }
      },
      update: {
        profileDescription: saveData.profileDescription,
        competencies: saveData.competencies as any,
        uniqueTalent: saveData.uniqueTalent as any,
        metadata: saveData.metadata as any,
        postsAnalyzed: saveData.postsAnalyzed,
        aiModel: saveData.aiModel,
        version: saveData.version,
        updatedAt: new Date()
      },
      create: {
        userId: saveData.userId,
        username: saveData.username,
        profileDescription: saveData.profileDescription,
        competencies: saveData.competencies as any,
        uniqueTalent: saveData.uniqueTalent as any,
        metadata: saveData.metadata as any,
        postsAnalyzed: saveData.postsAnalyzed,
        aiModel: saveData.aiModel,
        version: saveData.version
      }
    });

    console.log('✅ AI analysis saved successfully:', savedAnalysis.id);
    return { success: true, analysisId: savedAnalysis.id };

  } catch (error) {
    console.error('❌ Error saving AI analysis:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Funkcja do pobierania AI analysis z bazy danych
export async function getAIAnalysis(userId: string, username: string): Promise<AIAnalysisData | null> {
  try {
    console.log(`🔍 Fetching AI analysis for userId: ${userId}, username: ${username}`);

    const analysis = await prisma.instagramCreatorAIAnalysis.findUnique({
      where: {
        userId_username: {
          userId: userId,
          username: username
        }
      }
    });

    if (!analysis) {
      console.log('📭 No AI analysis found');
      return null;
    }

    console.log('✅ AI analysis found:', {
      id: analysis.id,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt,
      competenciesCount: Array.isArray(analysis.competencies) ? analysis.competencies.length : 0,
      uniqueTalent: typeof analysis.uniqueTalent === 'object' && analysis.uniqueTalent !== null
        ? (analysis.uniqueTalent as any).name
        : 'Unknown'
    });

    return {
      username: analysis.username,
      profileDescription: analysis.profileDescription,
      competencies: analysis.competencies as unknown as AICompetency[],
      uniqueTalent: analysis.uniqueTalent as unknown as AIUniqueTalent
    };

  } catch (error) {
    console.error('❌ Error fetching AI analysis:', error);
    return null;
  }
}

// Funkcja do sprawdzenia czy AI analysis istnieje
export async function checkAIAnalysisExists(userId: string, username: string): Promise<boolean> {
  try {
    const count = await prisma.instagramCreatorAIAnalysis.count({
      where: {
        userId: userId,
        username: username
      }
    });

    return count > 0;
  } catch (error) {
    console.error('❌ Error checking AI analysis existence:', error);
    return false;
  }
}

// Funkcja do pobierania wszystkich AI analiz użytkownika
export async function getUserAIAnalyses(userId: string): Promise<Array<{
  id: string;
  username: string;
  profileDescription: string;
  competencies: AICompetency[];
  uniqueTalent: AIUniqueTalent;
  createdAt: Date;
  updatedAt: Date;
}>> {
  try {
    const analyses = await prisma.instagramCreatorAIAnalysis.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 10 // Limit dla wydajności
    });

    return analyses.map(analysis => ({
      id: analysis.id,
      username: analysis.username,
      profileDescription: analysis.profileDescription,
      competencies: analysis.competencies as unknown as AICompetency[],
      uniqueTalent: analysis.uniqueTalent as unknown as AIUniqueTalent,
      createdAt: analysis.createdAt,
      updatedAt: analysis.updatedAt
    }));

  } catch (error) {
    console.error('❌ Error fetching user AI analyses:', error);
    return [];
  }
}

// ===== FUNKCJE CREATOR ANALYSIS =====

// Funkcja do zapisu analizy twórcy
export async function saveCreatorAnalysis(
  analysisData: CreatorAnalysisData[]
): Promise<{ success: boolean; saved: number; errors: number }> {
  try {
    console.log('💾 Saving creator analysis data...');
    console.log(`📊 Processing ${analysisData.length} posts`);

    let savedCount = 0;
    let errorCount = 0;

    // Użyj transakcji dla spójności danych
    await prisma.$transaction(async (tx) => {
      for (const data of analysisData) {
        try {
          // Upsert - zaktualizuj jeśli istnieje, utwórz jeśli nie
          await tx.instagramCreatorAnalysis.upsert({
            where: {
              userId_postId: {
                userId: data.userId,
                postId: data.postId
              }
            },
            update: {
              username: data.username,
              caption: data.caption,
              likesCount: data.likesCount,
              commentsCount: data.commentsCount,
              videoPlayCount: data.videoPlayCount,
              videoDuration: data.videoDuration,
              commenterUsernames: data.commenterUsernames as any,
              updatedAt: new Date()
            },
            create: {
              userId: data.userId,
              username: data.username,
              postId: data.postId,
              caption: data.caption,
              likesCount: data.likesCount,
              commentsCount: data.commentsCount,
              videoPlayCount: data.videoPlayCount,
              videoDuration: data.videoDuration,
              commenterUsernames: data.commenterUsernames as any
            }
          });

          savedCount++;
          console.log(`✅ Saved post ${data.postId}`);

        } catch (error) {
          console.error(`❌ Error saving post ${data.postId}:`, error);
          errorCount++;
        }
      }
    });

    console.log(`✅ Creator analysis saved: ${savedCount} success, ${errorCount} errors`);
    return { success: true, saved: savedCount, errors: errorCount };

  } catch (error) {
    console.error('❌ Error in saveCreatorAnalysis:', error);
    return { success: false, saved: 0, errors: analysisData.length };
  }
}

// Funkcja do pobierania analiz użytkownika
export async function getUserCreatorAnalyses(userId: string, username?: string) {
  try {
    const where: any = { userId };
    if (username) {
      where.username = username;
    }

    const analyses = await prisma.instagramCreatorAnalysis.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit dla wydajności
    });

    return analyses;
  } catch (error) {
    console.error('❌ Error fetching user creator analyses:', error);
    return [];
  }
}

// ===== FUNKCJE DEDUPLIKACJI =====

// Funkcja sprawdzająca czy profil Instagram już istnieje
async function checkExistingInstagramProfile(apifyData: ApifyInstagramData): Promise<ExistingProfileResult> {
  try {
    console.log('🔍 Checking for existing Instagram profile...');

    // Główny klucz: instagramId
    if (apifyData.id) {
      const existingById = await prisma.instagramProfileCheck.findFirst({
        where: { instagramId: apifyData.id }
      });
      if (existingById) {
        console.log('🔄 Instagram profile found by instagramId:', existingById.id);
        return { exists: true, profileId: existingById.id };
      }
    }

    // Fallback: sprawdź po username + URL
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
        return { exists: true, profileId: existingByUsernameUrl.id };
      }
    }

    console.log('✨ No existing Instagram profile found');
    return { exists: false, profileId: null };
  } catch (error) {
    console.error('❌ Error checking existing Instagram profile:', error);
    return { exists: false, profileId: null };
  }
}

// Funkcja sprawdzająca czy profil LinkedIn już istnieje
async function checkExistingLinkedInProfile(apifyData: ApifyLinkedInData): Promise<ExistingProfileResult> {
  try {
    console.log('🔍 Checking for existing LinkedIn profile...');

    // Główny klucz: publicIdentifier lub kombinacja danych
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
        return { exists: true, profileId: existingByIdentifier.id };
      }
    }

    // Fallback: sprawdź po LinkedIn URL
    if (apifyData.linkedinUrl) {
      const existingByUrl = await prisma.linkedInProfileCheck.findFirst({
        where: { linkedinUrl: apifyData.linkedinUrl }
      });
      if (existingByUrl) {
        console.log('🔄 LinkedIn profile found by URL:', existingByUrl.id);
        return { exists: true, profileId: existingByUrl.id };
      }
    }

    console.log('✨ No existing LinkedIn profile found');
    return { exists: false, profileId: null };
  } catch (error) {
    console.error('❌ Error checking existing LinkedIn profile:', error);
    return { exists: false, profileId: null };
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

// Główna funkcja do zapisu profilu Instagram - Z AKTUALIZACJĄ
export async function saveInstagramProfile(
  apifyData: ApifyInstagramData,
  request: NextRequest
): Promise<string | null> {
  try {
    console.log('💾 Saving/updating Instagram profile...');
    console.log('📊 Profile data:', {
      username: apifyData.username,
      fullName: apifyData.fullName,
      followersCount: apifyData.followersCount,
      is_private: apifyData.is_private
    });

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
      highlightReelCount: apifyData.highlightReelCount || 0,
      profilePicUrl: apifyData.profilePicUrl || null,
      profilePicUrlHD: apifyData.profilePicUrlHD || null,
      isBusinessAccount: apifyData.isBusinessAccount || false,
      isPrivate: apifyData.is_private || false,
      isVerified: apifyData.verified || false,
      businessCategory: apifyData.businessCategoryName || null,
      userIp,
      userAgent,
      checkedAt: new Date()
    };

    // SPRAWDŹ CZY PROFIL ISTNIEJE
    const existingProfile = await checkExistingInstagramProfile(apifyData);

    if (existingProfile.exists && existingProfile.profileId) {
      // AKTUALIZUJ ISTNIEJĄCY PROFIL
      console.log('🔄 Updating existing Instagram profile:', existingProfile.profileId);

      const updatedProfile = await prisma.instagramProfileCheck.update({
        where: { id: existingProfile.profileId },
        data: profileData
      });

      console.log('✅ Instagram profile UPDATED successfully:', updatedProfile.id);
      return updatedProfile.id;
    } else {
      // UTWÓRZ NOWY PROFIL
      console.log('✨ Creating new Instagram profile');

      const savedProfile = await prisma.instagramProfileCheck.create({
        data: profileData
      });

      console.log('✅ NEW Instagram profile created successfully:', savedProfile.id);
      return savedProfile.id;
    }

  } catch (error) {
    console.error('❌ Error saving/updating Instagram profile:', error);
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

// Główna funkcja do zapisu profilu LinkedIn - Z AKTUALIZACJĄ
export async function saveLinkedInProfile(
  apifyData: ApifyLinkedInData,
  request: NextRequest
): Promise<string | null> {
  try {
    console.log('💾 Saving/updating LinkedIn profile...');
    console.log('📊 Profile data:', {
      publicIdentifier: apifyData.publicIdentifier,
      fullName: apifyData.fullName,
      followersCount: apifyData.followers,
      connectionsCount: apifyData.connections
    });

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
      userAgent,
      checkedAt: new Date()
    };

    // SPRAWDŹ CZY PROFIL ISTNIEJE
    const existingProfile = await checkExistingLinkedInProfile(apifyData);

    if (existingProfile.exists && existingProfile.profileId) {
      // AKTUALIZUJ ISTNIEJĄCY PROFIL
      console.log('🔄 Updating existing LinkedIn profile:', existingProfile.profileId);

      const updatedProfile = await prisma.linkedInProfileCheck.update({
        where: { id: existingProfile.profileId },
        data: profileData
      });

      console.log('✅ LinkedIn profile UPDATED successfully:', updatedProfile.id);
      return updatedProfile.id;
    } else {
      // UTWÓRZ NOWY PROFIL
      console.log('✨ Creating new LinkedIn profile');

      const savedProfile = await prisma.linkedInProfileCheck.create({
        data: profileData
      });

      console.log('✅ NEW LinkedIn profile created successfully:', savedProfile.id);
      return savedProfile.id;
    }

  } catch (error) {
    console.error('❌ Error saving/updating LinkedIn profile:', error);
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