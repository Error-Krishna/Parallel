'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type {
  PublicUser,
  UserVisibleParallelDto,
} from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = params.username;
  const currentUser = useAuthStore((state) => state.user);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [parallels, setParallels] = useState<UserVisibleParallelDto[]>([]);
  const [myParallels, setMyParallels] = useState<UserVisibleParallelDto[]>([]);
  const [following, setFollowing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.users
      .getByUsername(username)
      .then(async (result) => {
        if (cancelled) return;

        setUser(result);

        const [visibleParallels, followingIds, currentUserParallels] =
          await Promise.all([
            api.users.getUserParallels(result.id),
            api.users.getFollowing(),
            currentUser
              ? api.users.getUserParallels(currentUser.id)
              : Promise.resolve([]),
          ]);

        if (!cancelled) {
          setParallels(visibleParallels);
          setMyParallels(currentUserParallels);
          setFollowing(followingIds.includes(result.id));
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });

    return () => {
      cancelled = true;
    };
  }, [username, currentUser]);

  const sharedParallels = useMemo(() => {
    const myParallelIds = new Set(
      myParallels.map((parallel) => parallel.parallelType.id),
    );

    return parallels.filter((parallel) =>
      myParallelIds.has(parallel.parallelType.id),
    );
  }, [myParallels, parallels]);

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="text-3xl font-bold">User not found.</h1>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
        </div>
      </main>
    );
  }

  async function handleFollow(userId: string) {
    const wasFollowing = following;
    setFollowing(!wasFollowing);

    try {
      if (wasFollowing) {
        await api.users.unfollow(userId);
      } else {
        await api.users.follow(userId);
      }
    } catch {
      setFollowing(wasFollowing);
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-mono text-sm text-muted-foreground">
          Loading profile...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Profile
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight">
              @{user.username}
            </h1>

            {currentUser?.id !== user.id ? (
              <button
                type="button"
                onClick={() => void handleFollow(user.id)}
              className={[
                'rounded-full border px-4 py-2 text-sm font-medium transition',
                following
                  ? 'border-border bg-muted text-foreground'
                  : 'border-foreground/20 hover:bg-accent',
              ].join(' ')}
            >
                {following ? 'Following' : 'Follow'}
              </button>
            ) : null}
          </div>

          {user.bio && (
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              {user.bio}
            </p>
          )}
        </section>

        {sharedParallels.length > 0 && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              You both explore
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {sharedParallels.map((parallel) => {
                const color = getParallelColor(parallel.parallelType.name);

                return (
                  <span
                    key={parallel.id}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm font-medium"
                  >
                    <span style={{ color }}>
                      <ParallelIcon
                        iconName={parallel.parallelType.icon ?? ''}
                        className="h-4 w-4"
                      />
                    </span>
                    {parallel.parallelType.name}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-8">
          <div className="mb-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Their parallels
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Different sides of them.
            </h2>
          </div>

          {parallels.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No public Parallels yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {parallels.map((parallel) => {
                const color = getParallelColor(parallel.parallelType.name);

                return (
                  <article
                    key={parallel.id}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"
                          style={{ color }}
                        >
                          <ParallelIcon
                            iconName={parallel.parallelType.icon ?? ''}
                            className="h-4 w-4"
                          />
                        </div>

                        <div>
                          <p className="font-medium">
                            {parallel.parallelType.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {parallel.parallelType.description}
                          </p>
                        </div>
                      </div>

                      <span
                        className="font-mono text-lg font-semibold"
                        style={{ color }}
                      >
                        {Math.round(parallel.strengthPct)}%
                      </span>
                    </div>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${parallel.strengthPct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
