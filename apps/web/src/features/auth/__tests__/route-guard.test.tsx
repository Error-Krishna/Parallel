import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AuthRouteGuard, isPublicRoute } from '../route-guard';
import { useAuthStore } from '../auth-store';

const { mockReplace, mockPathname } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockPathname: { current: '/map' },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname.current,
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

describe('AuthRouteGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
    mockPathname.current = '/map';
  });

  afterEach(() => {
    cleanup();
  });

  it('classifies public and protected routes accurately', () => {
    expect(isPublicRoute('/')).toBe(true);
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/signup')).toBe(true);
    expect(isPublicRoute('/card/abc')).toBe(true);
    expect(isPublicRoute('/wrapped/xyz')).toBe(true);

    expect(isPublicRoute('/map')).toBe(false);
    expect(isPublicRoute('/profile')).toBe(false);
    expect(isPublicRoute('/parallel/123')).toBe(false);
    expect(isPublicRoute('/collab')).toBe(false);
  });

  it('renders public routes immediately without requiring authentication', () => {
    mockPathname.current = '/login';

    render(
      <AuthRouteGuard>
        <div>Login screen</div>
      </AuthRouteGuard>,
    );

    expect(screen.getByText('Login screen')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('blocks protected routes and redirects unauthenticated users to /login', async () => {
    mockPathname.current = '/map';

    render(
      <AuthRouteGuard>
        <div>Protected Map</div>
      </AuthRouteGuard>,
    );

    expect(screen.queryByText('Protected Map')).toBeNull();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
  });

  it('renders protected routes for authenticated users', () => {
    mockPathname.current = '/map';
    useAuthStore.getState().setAuth(
      { id: 'u-1', username: 'maya', avatarUrl: null, bio: null },
      'valid-jwt-token',
    );

    render(
      <AuthRouteGuard>
        <div>Protected Map</div>
      </AuthRouteGuard>,
    );

    expect(screen.getByText('Protected Map')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
