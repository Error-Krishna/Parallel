import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

const getState = vi.fn();

vi.mock('@/features/auth/auth-store', () => ({
  useAuthStore: {
    getState,
  },
}));

describe('apiClient', () => {
  beforeEach(() => {
    getState.mockReset();
  });

  it('adds the access token as a Bearer authorization header', async () => {
    getState.mockReturnValue({
      accessToken: 'test-token',
    });

    const { apiClient } = await import('@/lib/api-client');

    const interceptor = apiClient.interceptors.request.handlers?.[0]?.fulfilled;

    expect(interceptor).toBeDefined();

    const config = await interceptor!(
      {
        headers: new AxiosHeaders(),
      } as InternalAxiosRequestConfig,
    );

    expect(config.headers.Authorization).toBe('Bearer test-token');
  });

  it('does not add an authorization header without a token', async () => {
    getState.mockReturnValue({
      accessToken: null,
    });

    const { apiClient } = await import('@/lib/api-client');

    const interceptor = apiClient.interceptors.request.handlers?.[0]?.fulfilled;

    expect(interceptor).toBeDefined();

    const config = await interceptor!(
      {
        headers: new AxiosHeaders(),
      } as InternalAxiosRequestConfig,
    );

    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('apiClient response interceptor', () => {
  beforeEach(() => {
    getState.mockReturnValue({ accessToken: null });
  });

  it('extracts the backend message so callers see the real error, not axios generic text', async () => {
    const { apiClient } = await import('@/lib/api-client');
    const rejected = apiClient.interceptors.response.handlers?.[0]?.rejected;

    expect(rejected).toBeDefined();

    const axiosError = {
      isAxiosError: true,
      response: { data: { message: 'Invalid email or password' } },
    };

    await expect(rejected!(axiosError)).rejects.toThrow('Invalid email or password');
  });

  it('joins an array of validation messages into one readable string', async () => {
    const { apiClient } = await import('@/lib/api-client');
    const rejected = apiClient.interceptors.response.handlers?.[0]?.rejected;

    const axiosError = {
      isAxiosError: true,
      response: { data: { message: ['email must be an email', 'password is too short'] } },
    };

    await expect(rejected!(axiosError)).rejects.toThrow(
      'email must be an email password is too short',
    );
  });
});
