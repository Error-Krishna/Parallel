import axios from 'axios';
import { createParallelApi } from '@parallel/api-client';
import { useAuthStore } from '@/features/auth/auth-store';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // AllExceptionsFilter (apps/api/src/common/filters/all-exceptions.filter.ts)
    // always returns { statusCode, path, timestamp, message, error? } — message is
    // either a plain string or a string[] (class-validator's ValidationPipe errors).
    // Without this, every caller sees axios's generic "Request failed with status
    // code 401" instead of "Invalid email or password" etc. — pull the real message
    // out here once, so every page (signup, login, everything after) gets it for free
    // instead of each one re-parsing error.response.data itself.
    if (axios.isAxiosError(error)) {
      const requestUrl = error.config?.url ?? '';
      const isPublicAuthAttempt =
        requestUrl.includes('/v1/auth/login') ||
        requestUrl.includes('/v1/auth/signup');

      // When an authenticated session receives 401 (expired/revoked JWT), clear local
      // auth state so AuthRouteGuard silently redirects to /login (USER_FLOW.md §1).
      if (error.response?.status === 401 && !isPublicAuthAttempt) {
        const authState = useAuthStore.getState();
        if (authState.accessToken && typeof authState.clearAuth === 'function') {
          authState.clearAuth();
        }
      }

      const body = error.response?.data as { message?: string | string[] } | undefined;
      if (body?.message) {
        const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        return Promise.reject(new Error(message));
      }
    }

    return Promise.reject(error);
  },
);

export const api = createParallelApi(apiClient);
