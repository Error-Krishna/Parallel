import type { PublicUser } from '@parallel/shared-types';

export interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: PublicUser, accessToken: string) => void;
  clearAuth: () => void;
}
