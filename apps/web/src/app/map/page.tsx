'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Compass,
  Gamepad2,
  Music2,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import type { ParallelMapResponse, UserParallelDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';

const colorMap = {
  Builder: 'var(--parallel-builder)',
  'Music Head': 'var(--parallel-music-head)',
  Gamer: 'var(--parallel-gamer)',
  Explorer: 'var(--parallel-explorer)',
} as const;

function getColor(name: string) {
  return (
    colorMap[name as keyof typeof colorMap] ??
    'var(--parallel-urbanist)'
  );
}

export default function MapPage() {
  const [map, setMap] = useState<ParallelMapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      try {
        const result = await api.parallels.getMap();

        if (!cancelled) {
          setMap(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load your Parallel map.',
          );
        }
      }
    }

    void loadMap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="text-3xl font-bold">Your map is unavailable.</h1>
          <p className="mt-3 text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!map) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="font-mono text-sm text-muted-foreground"
        >
          Loading your map...
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Parallel
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              @{map.user.username}&apos;s map
            </h1>
          </div>

          <button
            type="button"
            className="rounded-full border border-border p-2.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
            aria-label="Discover people"
          >
            <Users className="h-5 w-5" />
          </button>
        </header>

        <section className="py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles
                className="h-4 w-4"
                style={{ color: 'var(--parallel-builder)' }}
              />
              <span>Your starting point</span>
            </div>

            <h2 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
              You&apos;re not just one thing.
            </h2>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              These are signals from your choices, turned into different
              directions you can explore.
            </p>
          </motion.div>
        </section>

        <section>
          <div className="mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Your parallels
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              Different sides. Same you.
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {map.parallels.map((parallel, index) => (
              <ParallelCard
                key={parallel.id}
                parallel={parallel}
                index={index}
              />
            ))}
          </div>
        </section>

        <section className="py-16">
          <div className="rounded-2xl border border-dashed border-border p-8 text-center sm:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              The map changes
            </p>

            <h3 className="mx-auto mt-3 max-w-lg text-2xl font-semibold tracking-tight">
              This is only the beginning.
            </h3>

            <p className="mx-auto mt-3 max-w-lg leading-7 text-muted-foreground">
              As you explore and interact, your map can evolve with you.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function ParallelIcon({
  iconName,
  className,
}: {
  iconName: string;
  className?: string;
}) {
  switch (iconName) {
    case 'compass':
      return <Compass className={className} />;
    case 'gamepad':
      return <Gamepad2 className={className} />;
    case 'music':
      return <Music2 className={className} />;
    case 'plus':
      return <Plus className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'users':
      return <Users className={className} />;
    default:
      return <Compass className={className} />;
  }
}

function ParallelCard({
  parallel,
  index,
}: {
  parallel: UserParallelDto;
  index: number;
}) {
  const color = getColor(parallel.parallelType.name);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-foreground/20"
    >
      <div
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-10 blur-3xl"
        style={{ backgrounColor: color }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border"
            style={{ color }}
          >
            <ParallelIcon iconName={parallel.parallelType.icon} className="h-5 w-5" />
          </div>

          <span className="font-mono text-2xl font-semibold" style={{ color }}>
            {Math.round(parallel.strengthPct)}%
          </span>
        </div>

        <h4 className="mt-8 text-2xl font-semibold">
          {parallel.parallelType.name}
        </h4>

        <p className="mt-2 max-w-md leading-7 text-muted-foreground">
          {parallel.parallelType.description}
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          {parallel.suggestionReason ?? 'A direction worth exploring.'}
        </p>

        <button
          type="button"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium transition group-hover:gap-3"
        >
          Enter Parallel
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  );
}
