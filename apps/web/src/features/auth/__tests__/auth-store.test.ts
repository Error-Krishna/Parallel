import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../auth-store';

const user = {
  id: 'user-1',
  username: 'alex',
  avatarUrl: null,
  bio: null,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('stores authenticated user and token', () => {
    useAuthStore.getState().setAuth(user, 'test-token');

    const state = useAuthStore.getState();

    expect(state.user).toEqual(user);
    expect(state.accessToken).toBe('test-token');
    expect(state.isAuthenticated).toBe(true);
  });

  it('clears authentication state', () => {
    useAuthStore.getState().setAuth(user, 'test-token');
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
