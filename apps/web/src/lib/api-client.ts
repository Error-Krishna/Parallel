// Shared axios instance for talking to the NestJS API (apps/api). Feature code should
// import this rather than creating its own axios/fetch calls — keeps auth headers,
// base URL, and error handling in one place. See packages/api-client for typed,
// query-hook wrappers built on top of this once that package has real endpoints to wrap.
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Centralize auth-expiry / network-error handling here as auth (Phase 4/5) lands.
    return Promise.reject(error);
  },
);
