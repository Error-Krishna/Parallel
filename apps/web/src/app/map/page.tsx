'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Network, Sparkles, UserCircle, Users } from 'lucide-react';
import type {
  ParallelEvolutionDto,
  ParallelMapResponse,
  TwinMatchDto,
  UserParallelDto,
} from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { ParallelCard } from '@/features/parallels/parallel-card';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

export default function MapPage() {
  const router = useRouter();
  const [map, setMap] = useState<ParallelMapResponse | null>(null);
  const [evolution, setEvolution] = useState<ParallelEvolutionDto[]>([]);
  const [twins, setTwins] = useState<TwinMatchDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const twinsRequestIdRef = useRef(0);

  function refreshTwins() {
    const requestId = ++twinsRequestIdRef.current;

    void api.users
      .getTwins()
      .then((nextTwins) => {
        if (isMountedRef.current && requestId === twinsRequestIdRef.current) {
          setTwins(nextTwins);
        }
      })
      .catch(() => {
        // Twins refresh is best-effort; publication already succeeded.
      });
  }

  useEffect(() => {
    let cancelled = false;
    isMountedRef.current = true;

    async function loadMap() {
      const initialTwinsRequestId = ++twinsRequestIdRef.current;

      try {
        const [result, evolutionResult, twinsResult] = await Promise.all([
          api.parallels.getMap(),
          api.parallels.getEvolution(),
          // GET /v1/users/twins reads persisted Twin matches for the header button.
          api.users.getTwins(),
        ]);

        if (!cancelled && isMountedRef.current) {
          setMap(result);
          setEvolution(evolutionResult);
          if (initialTwinsRequestId === twinsRequestIdRef.current) {
            setTwins(twinsResult);
          }
        }
      } catch (err) {
        if (!cancelled && isMountedRef.current) {
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
      isMountedRef.current = false;
      twinsRequestIdRef.current += 1;
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/profile')}
              className="rounded-full border border-border p-2.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="View profile"
              title="View profile"
            >
              <UserCircle className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => router.push('/communities')}
              className="rounded-full border border-border p-2.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Discover communities"
              title="Discover communities"
            >
              <Network className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (twins[0]) router.push(`/twins/${twins[0].id}`);
              }}
            disabled={twins.length === 0}
            title={
              twins.length === 0
                ? "No Twin found yet — keep exploring to find one"
                : `View your Parallel Twin: @${twins[0].user.username}`
            }
            className="rounded-full border border-border p-2.5 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label={
              twins.length === 0 ? 'No Parallel Twin yet' : 'View your Parallel Twin'
              }
            >
              <Users className="h-5 w-5" />
            </button>
          </div>
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
                  onPublished={(updatedParallel) => {
                    setMap((current) =>
                      current
                        ? {
                            ...current,
                            parallels: current.parallels.map((item) =>
                              item.id === updatedParallel.id
                                ? updatedParallel
                                : item,
                            ),
                          }
                        : current,
                    );
                    refreshTwins();
                  }}
                  onHide={(parallelId) => {
                    setMap((current) =>
                      current
                        ? {
                            ...current,
                            parallels: current.parallels.filter(
                              (item) => item.id !== parallelId,
                            ),
                          }
                        : current,
                    );
                  }}
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

          {(() => {
            const biggestEvolution = evolution
              .filter((change) => change.deltaPct !== null)
              .reduce<ParallelEvolutionDto | null>(
                (best, change) =>
                  !best || change.deltaPct! > best.deltaPct!
                    ? change
                    : best,
                null,
              );

            const biggestParallel = biggestEvolution
              ? map.parallels.find(
                  (item) =>
                    item.parallelType.id === biggestEvolution.parallelTypeId,
                )
              : null;

            const newestParallel = map.parallels.reduce<UserParallelDto | null>(
              (newest, parallel) =>
                !newest ||
                new Date(parallel.discoveredAt).getTime() >
                  new Date(newest.discoveredAt).getTime()
                  ? parallel
                  : newest,
              null,
            );

            return (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {biggestEvolution &&
                  biggestEvolution.deltaPct !== null &&
                  biggestParallel ? (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Biggest evolution
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">
                          {biggestParallel.parallelType.name}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Your biggest change between snapshots.
                        </p>
                      </div>
                      <span className="font-mono text-lg font-semibold">
                        {biggestEvolution.deltaPct > 0 ? '↑ +' : '↓ '}
                        {Math.abs(biggestEvolution.deltaPct).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ) : null}

                {newestParallel ? (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Newest Parallel
                    </p>
                    <div className="mt-2">
                      <p className="font-semibold">
                        {newestParallel.parallelType.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The most recently discovered side of you.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()}

          <div className="grid gap-3 sm:grid-cols-2">
            {evolution.map((change) => {
              const parallel = map.parallels.find(
                (item) => item.parallelType.id === change.parallelTypeId,
              );

              if (!parallel) {
                return null;
              }

              const color = getParallelColor(parallel.parallelType.name);
              const history = change.history ?? [];
              const minStrength = Math.min(
                ...history.map((snapshot) => snapshot.strengthPct),
              );
              const maxStrength = Math.max(
                ...history.map((snapshot) => snapshot.strengthPct),
              );
              const strengthRange = Math.max(maxStrength - minStrength, 1);

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

                  {(change.history?.length ?? 0) > 1 ? (
                    <div className="mt-5">
                      <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {new Date(
                            change.history?.[0]?.capturedAt ?? '',
                          ).toLocaleDateString()}
                        </span>
                        <span>
                          {new Date(
                            change.history?.[change.history.length - 1]
                              ?.capturedAt ?? '',
                          ).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="relative h-20 w-full">
                        <svg
                          viewBox="0 0 100 40"
                          preserveAspectRatio="none"
                          className="h-full w-full overflow-visible"
                        >
                          <line
                            x1="0"
                            y1="36"
                            x2="100"
                            y2="36"
                            stroke="currentColor"
                            strokeOpacity="0.08"
                            strokeWidth="0.5"
                          />

                          <polyline
                            fill="none"
                            stroke={color}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={history
                              .map((snapshot, index, history) => {
                                const x =
                                  history.length === 1
                                    ? 50
                                    : (index / (history.length - 1)) * 100;
                                const y =
                                  34 -
                                  ((snapshot.strengthPct - minStrength) /
                                    strengthRange) *
                                    28;

                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />

                          {history.map((snapshot, index, history) => {
                            const x =
                              history.length === 1
                                ? 50
                                : (index / (history.length - 1)) * 100;
                            const y =
                                  34 -
                                  ((snapshot.strengthPct - minStrength) /
                                    strengthRange) *
                                    28;

                            return (
                              <g
                                key={`${snapshot.capturedAt}-${index}`}
                              >
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="2.2"
                                  fill={color}
                                  stroke="var(--background)"
                                  strokeWidth="1"
                                />

                                <text
                                  x={x}
                                  y={Math.max(y - 4, 4)}
                                  textAnchor="middle"
                                  fill="currentColor"
                                  className="fill-muted-foreground"
                                  fontSize="3"
                                  fontFamily="monospace"
                                >
                                  {Math.round(snapshot.strengthPct)}%
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between gap-4 text-xs">
                    {change.previousStrengthPct === null ? (
                      <span className="text-muted-foreground">
                        First snapshot
                      </span>
                    ) : (
                      <span className="font-mono text-muted-foreground">
                        {Math.round(change.previousStrengthPct)}% →{' '}
                        {Math.round(change.currentStrengthPct)}%
                      </span>
                    )}

                    <span
                      className={[
                        'font-mono font-medium',
                        change.deltaPct !== null && change.deltaPct > 0
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                      ].join(' ')}
                    >
                      {change.deltaPct === null
                        ? '—'
                        : change.deltaPct === 0
                          ? 'No change yet'
                          : `${change.deltaPct > 0 ? '↑ +' : '↓ '}${Math.abs(change.deltaPct).toFixed(1)}%`}
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
