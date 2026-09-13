'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Users } from 'lucide-react';
import type {
  ParallelEvolutionDto,
  ParallelMapResponse,
  UserParallelDto,
} from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

export default function MapPage() {
  const router = useRouter();
  const [map, setMap] = useState<ParallelMapResponse | null>(null);
  const [evolution, setEvolution] = useState<ParallelEvolutionDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMap() {
      try {
        const [result, evolutionResult] = await Promise.all([
          api.parallels.getMap(),
          api.parallels.getEvolution(),
        ]);

        if (!cancelled) {
          setMap(result);
          setEvolution(evolutionResult); 
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
            {map.parallels.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                Nothing here yet — your map should populate right after onboarding.
                If you just finished onboarding and still see this, something went
                wrong generating your map.
              </div>
            ) : (
              map.parallels.map((parallel, index) => (
                <ParallelCard
                  key={parallel.id}
                  parallel={parallel}
                  index={index}
                  onEnter={(parallelId) => router.push(`/parallel/${parallelId}`)}
                />
              ))
            )}
          </div>
        </section>

        <section className="py-16">
          <div className="mb-6">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Identity evolution
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              See how your sides are changing.
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {evolution.map((change) => {
              const parallel = map.parallels.find(
                (item) => item.parallelType.id === change.parallelTypeId,
              );

              if (!parallel) {
                return null;
              }

              const color = getParallelColor(parallel.parallelType.name);

              return (
                <motion.article
                  key={change.parallelTypeId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"
                        style={{ color }}
                      >
                        <ParallelIcon
                          iconName={parallel.parallelType.icon ?? ""}
                          className="h-4 w-4"
                        />
                      </div>

                      <div>
                        <p className="font-medium">
                          {parallel.parallelType.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Current strength
                        </p>
                      </div>
                    </div>

                    <span className="font-mono text-lg font-semibold" style={{ color }}>
                      {Math.round(change.currentStrengthPct)}%
                    </span>
                  </div>

                  <div className="mt-5">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${change.currentStrengthPct}%` }}
                        transition={{ duration: 0.8, delay: 0.15 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {change.previousStrengthPct === null
                        ? 'First snapshot'
                        : 'Since last snapshot'}
                    </span>

                    <span className="font-mono">
                      {change.deltaPct === null
                        ? '—'
                        : change.deltaPct === 0
                          ? 'No change yet'
                          : `${change.deltaPct > 0 ? '+' : ''}${change.deltaPct.toFixed(1)}%`}
                    </span>
                  </div>
                </motion.article>
              );
            })}
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

function ParallelCard({
  parallel,
  index,
  onEnter,
}: {
  parallel: UserParallelDto;
  index: number;
  onEnter: (parallelId: string) => void;
}) {
  async function handleEnter() {
    try {
      const enteredParallel = await api.parallels.enter(
        parallel.parallelType.id,
      );
      onEnter(enteredParallel.id);
    } catch (err) {
      console.error('Could not enter Parallel:', err);
    }
  }
  const color = getParallelColor(parallel.parallelType.name);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-foreground/20"
    >
      <div
        className="absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-10 blur-3xl"
        style={{ backgroundColor: color }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border"
            style={{ color }}
          >
            <ParallelIcon iconName={parallel.parallelType.icon ?? ""} className="h-5 w-5" />
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
          onClick={() => void handleEnter()}
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium transition group-hover:gap-3"
        >
          Enter Parallel
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  );
}
