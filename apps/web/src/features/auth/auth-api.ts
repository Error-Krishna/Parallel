import type {
  AuthResult,
  LoginDto,
  SignupDto,
} from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from './auth-store';

export async function signup(dto: SignupDto): Promise<AuthResult> {
  const result = await api.auth.signup(dto);

  useAuthStore.getState().setAuth(result.user, result.accessToken);

  return result;
}

export async function login(dto: LoginDto): Promise<AuthResult> {
  const result = await api.auth.login(dto);

  useAuthStore.getState().setAuth(result.user, result.accessToken);

  return result;
}

export async function logout(): Promise<void> {
  try {
    await api.auth.logout();
  } finally {
    useAuthStore.getState().clearAuth();
  }
}
