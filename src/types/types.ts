export type UserRole = 'ADMIN' | 'USER' | 'GOD';

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  cognito_sub?: string;
  profilePicture?: string;
  // 🆕 DODANE pola social media
  instagramProfileId?: string | null;
  instagramUsername?: string | null;
  linkedinProfileId?: string | null;
  socialProfileType?: string | null;
}

// Interface dla profilu Instagram (używany w InstagramProfileBar)
export interface InstagramProfile {
  username: string;
  fullName: string | null;
  biography: string | null;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  highlightReelCount?: number;
  profilePicUrlHD: string | null;
  isBusinessAccount: boolean;
  isPrivate: boolean;
  isVerified: boolean;
  businessCategory: string | null;
}