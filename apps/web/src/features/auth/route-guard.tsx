'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from './auth-store';

const PUBLIC_EXACT_ROUTES = new Set(['/', '/login', '/signup']);
const PUBLIC_PREFIX_ROUTES = ['/card/', '/wrapped/'];

export function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return true;
  if (PUBLIC_EXACT_ROUTES.has(pathname)) return true;
  return PUBLIC_PREFIX_ROUTES.some((prefix) => pathname.startsWith(prefix));
}

function subscribeHydration(onStoreChange: () => void) {
  return useAuthStore.persist.onFinishHydration(onStoreChange);
}

function getClientHydratedSnapshot() {
  return useAuthStore.persist.hasHydrated();
}

function getServerHydratedSnapshot() {
  return false;
}

/**
 * Protects authenticated app routes after Zustand persist rehydration.
 * Redirects unauthenticated or expired sessions silently to /login (USER_FLOW.md §1)
 * while leaving landing, login, signup, and public share routes (/card/*, /wrapped/*) open.
 */
export function AuthRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydratedSnapshot,
    getServerHydratedSnapshot,
  );

  const isPublic = isPublicRoute(pathname);
  const hasSession = isAuthenticated && Boolean(accessToken);

  useEffect(() => {
    if (!hydrated || isPublic) {
      return;
    }

    if (!hasSession) {
      router.replace('/login');
    }
  }, [hydrated, isPublic, hasSession, router]);

  if (isPublic) {
    return <>{children}</>;
  }

  if (!hydrated || !hasSession) {
    return null;
  }

  return <>{children}</>;
}
