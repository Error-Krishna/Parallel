'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

export default function OnboardingRevealPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generateMap() {
      try {
        await api.onboarding.complete();

        if (!cancelled) {
          router.replace('/map');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'We could not build your map yet.',
          );
        }
      }
    }

    void generateMap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl flex-col items-center justify-center text-center">
        {error ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight">
              Something got in the way.
            </h1>
            <p className="mt-4 text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-8 rounded-lg border border-border px-5 py-3 text-sm font-medium transition hover:bg-accent"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <motion.div
              animate={{ scale: [1, 1.08, 1], rotate: [0, 4, -4, 0] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card"
            >
              <Sparkles className="h-8 w-8 text-[var(--parallel-builder)]" />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground"
            >
              Reading your signals
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl"
            >
              Building your map.
            </motion.h1>

            <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
              Four answers. A few possible versions of you. Let&apos;s see
              where they lead.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
