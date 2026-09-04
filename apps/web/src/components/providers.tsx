'use client';

// Client-side providers, mounted once from the root layout. Kept separate from
// layout.tsx (a Server Component) so the server/client boundary is explicit —
// see apps/web/CLAUDE.md for the Server vs. Client Component convention.
import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function Providers({ children }: { children: ReactNode }) {
  // Created once per component instance (not per render) via useState, and scoped
  // to the client so server-rendered and client-rendered trees never share a cache
  // instance — the standard TanStack Query + Next.js App Router pattern.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
