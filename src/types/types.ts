export type UserRole = 'ADMIN' | 'USER' | 'GOD';

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  status?: string;
  cognito_sub?: string;
  profilePicture?: string;  // ← DODAJ TĘ LINIĘ
}