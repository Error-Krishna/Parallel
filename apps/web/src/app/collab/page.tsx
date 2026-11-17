'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react';
import type { CollabSessionDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

export default function CollabDashboardPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);

  const [sessions, setSessions] = useState<CollabSessionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api.collab
      .getSessions()
      .then((data) => {
        if (!cancelled) {
          setSessions(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load collab sessions',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const pendingReceived = sessions.filter(
    (s) => s.status === 'PENDING' && s.userBId === currentUser?.id,
  );
  const pendingSent = sessions.filter(
    (s) => s.status === 'PENDING' && s.userAId === currentUser?.id,
  );
  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE');
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');

  async function handleDecline(sessionId: string) {
    try {
      await api.collab.decline(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'CANCELLED' } : s)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline invite');
    }
  }

  async function handleCancel(sessionId: string) {
    try {
      await api.collab.cancel(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: 'CANCELLED' } : s)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel invite');
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
        <button
          type="button"
          onClick={() => router.push('/map')}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Map
        </button>

        <section className="mt-8">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Identity Experiments</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Collab Parallels
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Temporarily combine one of your Parallels with a friend&apos;s. Explore a joint discovery world and complete a shared challenge together.
          </p>
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-16 flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {/* 1. Pending Invitations Received */}
            {pendingReceived.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex h-2 w-2 rounded-full bg-primary" />
                  <h2 className="text-lg font-semibold tracking-tight">
                    Invitations Received ({pendingReceived.length})
                  </h2>
                </div>

                <div className="grid gap-4">
                  {pendingReceived.map((session) => {
                    const color = getParallelColor(session.parallelTypeA.name);

                    return (
                      <article
                        key={session.id}
                        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border"
                            style={{ color }}
                          >
                            <ParallelIcon
                              iconName={session.parallelTypeA.icon ?? ''}
                              className="h-5 w-5"
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              <span className="font-bold">@{session.userA.username}</span> invited you to collab!
                            </p>
                            <p className="text-xs text-muted-foreground">
                              They picked their <span className="font-medium text-foreground">{session.parallelTypeA.name}</span> Parallel.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/collab/${session.id}`)}
                            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                          >
                            Pick Parallel & Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDecline(session.id)}
                            className="rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            Decline
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 2. Pending Invitations Sent */}
            {pendingSent.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold tracking-tight mb-4 text-muted-foreground">
                  Invitations Sent ({pendingSent.length})
                </h2>

                <div className="grid gap-3">
                  {pendingSent.map((session) => (
                    <article
                      key={session.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            Waiting for @{session.userB.username}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            You chose your {session.parallelTypeA.name} Parallel.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/collab/${session.id}`)}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCancel(session.id)}
                          className="text-xs font-medium text-muted-foreground hover:text-destructive"
                        >
                          Cancel
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Active Collabs */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold tracking-tight">
                  Active Collabs ({activeSessions.length})
                </h2>
              </div>

              {activeSessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium">No active collabs yet.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Visit any profile and tap &ldquo;Start a Collab&rdquo; to begin a joint discovery.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {activeSessions.map((session) => {
                    const colorA = getParallelColor(session.parallelTypeA.name);
                    const colorB = session.parallelTypeB
                      ? getParallelColor(session.parallelTypeB.name)
                      : '#888888';
                    const completedCount =
                      (session.userACompleted ? 1 : 0) + (session.userBCompleted ? 1 : 0);

                    return (
                      <article
                        key={session.id}
                        onClick={() => router.push(`/collab/${session.id}`)}
                        className="group cursor-pointer rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center -space-x-2">
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background"
                              style={{ color: colorA }}
                            >
                              <ParallelIcon
                                iconName={session.parallelTypeA.icon ?? ''}
                                className="h-4 w-4"
                              />
                            </div>
                            {session.parallelTypeB && (
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background"
                                style={{ color: colorB }}
                              >
                                <ParallelIcon
                                  iconName={session.parallelTypeB.icon ?? ''}
                                  className="h-4 w-4"
                                />
                              </div>
                            )}
                          </div>

                          <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                            {completedCount}/2 Completed
                          </span>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-mono text-muted-foreground">
                            @{session.userA.username} × @{session.userB.username}
                          </p>
                          <h3 className="mt-1 text-base font-bold tracking-tight group-hover:text-primary transition">
                            {session.challengeTitle ?? 'Shared Challenge'}
                          </h3>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                          <span>
                            {session.parallelTypeA.name} + {session.parallelTypeB?.name}
                          </span>
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            Open <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 4. Past Completed Collabs */}
            {completedSessions.length > 0 && (
              <section>
                <h2 className="text-xl font-bold tracking-tight mb-4">
                  Completed Discoveries ({completedSessions.length})
                </h2>

                <div className="grid gap-3 sm:grid-cols-2">
                  {completedSessions.map((session) => (
                    <article
                      key={session.id}
                      onClick={() => router.push(`/collab/${session.id}`)}
                      className="cursor-pointer rounded-2xl border border-border/80 bg-card/60 p-5 transition hover:bg-card"
                    >
                      <div className="flex items-center gap-2 text-emerald-500 font-mono text-xs">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Challenge Completed</span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold">
                        {session.challengeTitle}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        @{session.userA.username} ({session.parallelTypeA.name}) × @
                        {session.userB.username} ({session.parallelTypeB?.name})
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
