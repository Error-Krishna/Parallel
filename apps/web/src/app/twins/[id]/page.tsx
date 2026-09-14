'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type {
  TwinMatchDto,
  UserVisibleParallelDto,
} from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

export default function TwinComparisonPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const twinId = params.id;
  const currentUser = useAuthStore((state) => state.user);

  const [twin, setTwin] = useState<TwinMatchDto | null>(null);
  const [myParallels, setMyParallels] = useState<UserVisibleParallelDto[]>([]);
  const [theirParallels, setTheirParallels] = useState<UserVisibleParallelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const currentUserId = currentUser.id;
    let cancelled = false;

    async function load() {
      try {
        const twins = await api.users.getTwins();
        const match = twins.find((item) => item.id === twinId);

        if (!match) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const [mine, theirs] = await Promise.all([
          api.users.getUserParallels(currentUserId),
          api.users.getUserParallels(match.user.id),
        ]);

        if (cancelled) return;

        setTwin(match);
        setMyParallels(mine);
        setTheirParallels(theirs);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentUser, twinId]);

  const sharedIds = useMemo(
    () => new Set(twin?.sharedParallelTypeIds ?? []),
    [twin],
  );

  const sharedParallels = myParallels.filter((parallel) =>
    sharedIds.has(parallel.parallelType.id),
  );

  const myDifferences = myParallels.filter(
    (parallel) => !sharedIds.has(parallel.parallelType.id),
  );

  const theirDifferences = theirParallels.filter(
    (parallel) => !sharedIds.has(parallel.parallelType.id),
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <motion.p
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="font-mono text-sm text-muted-foreground"
        >
          Comparing Parallels...
        </motion.p>
      </main>
    );
  }

  if (notFound || !twin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="text-2xl font-bold">Twin match not found.</h1>
          <button
            type="button"
            onClick={() => router.push('/map')}
            className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to your map
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10"
        >
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Parallel Twin
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            @{twin.user.username}
          </h1>

          {twin.user.bio && (
            <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
              {twin.user.bio}
            </p>
          )}

          <div className="mt-6 inline-flex items-center rounded-full border border-border px-4 py-2 font-mono text-sm">
            {Math.round(twin.similarityScore)}% similar
          </div>
        </motion.header>

        <section className="mt-12">
          <SectionTitle>Shared Parallels</SectionTitle>

          {sharedParallels.length === 0 ? (
            <EmptyState>No shared Parallels found.</EmptyState>
          ) : (
            <div className="mt-4 space-y-3">
              {sharedParallels.map((parallel) => (
                <ParallelRow
                  key={parallel.id}
                  parallel={parallel}
                  otherParallel={theirParallels.find(
                    (item) =>
                      item.parallelType.id === parallel.parallelType.id,
                  )}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <SectionTitle>Where You Differ</SectionTitle>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <DifferenceColumn title="You" parallels={myDifferences} />
            <DifferenceColumn
              title={`@${twin.user.username}`}
              parallels={theirDifferences}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold">{children}</h2>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ParallelRow({
  parallel,
  otherParallel,
}: {
  parallel: UserVisibleParallelDto;
  otherParallel?: UserVisibleParallelDto;
}) {
  const color = getParallelColor(parallel.parallelType.name);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"
          style={{ color }}
        >
          <ParallelIcon
            iconName={parallel.parallelType.icon ?? ''}
            className="h-5 w-5"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-medium">{parallel.parallelType.name}</p>

          {otherParallel ? (
            <>
              <div className="mt-2 flex gap-6 font-mono text-xs">
                <div>
                  <p className="text-muted-foreground">You</p>
                  <p className="mt-0.5 text-sm text-foreground">
                    {Math.round(parallel.strengthPct)}%
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">Them</p>
                  <p className="mt-0.5 text-sm text-foreground">
                    {Math.round(otherParallel.strengthPct)}%
                  </p>
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {Math.abs(
                  Math.round(parallel.strengthPct) -
                    Math.round(otherParallel.strengthPct),
                ) === 0
                  ? 'You are equally strong here'
                  : parallel.strengthPct > otherParallel.strengthPct
                    ? `${Math.round(
                        parallel.strengthPct - otherParallel.strengthPct,
                      )}% stronger for you here`
                    : `${Math.round(
                        otherParallel.strengthPct - parallel.strengthPct,
                      )}% stronger for them here`}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Shared Parallel
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function DifferenceColumn({
  title,
  parallels,
}: {
  title: string;
  parallels: UserVisibleParallelDto[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-medium">{title}</h3>

      {parallels.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No other visible Parallels.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {parallels.map((parallel) => {
            const color = getParallelColor(parallel.parallelType.name);

            return (
              <div key={parallel.id} className="flex items-center gap-3">
                <div style={{ color }}>
                  <ParallelIcon
                    iconName={parallel.parallelType.icon ?? ''}
                    className="h-4 w-4"
                  />
                </div>

                <div>
                  <p className="text-sm font-medium">
                    {parallel.parallelType.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {Math.round(parallel.strengthPct)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
