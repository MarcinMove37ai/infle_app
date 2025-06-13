export type UserRole = 'ADMIN' | 'USER' | 'GOD';

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  cognito_sub?: string;
  profilePicture?: string;
}

// Interface dla profilu Instagram (używany w InstagramProfileBar)
export interface InstagramProfile {
  username: string;
  fullName: string | null;
  biography: string | null;
  followersCount: number;
  followsCount: number;
  postsCount: number;
  highlightReelCount?: number;      // NOWE POLE - liczba highlight reels
  profilePicUrlHD: string | null;
  isBusinessAccount: boolean;       // TYMCZASOWO - zastąpimy przez highlightReelCount
  isPrivate: boolean;
  isVerified: boolean;
  businessCategory: string | null;
}