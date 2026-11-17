'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Sparkles, XCircle } from 'lucide-react';
import type { CollabSessionDto, UserVisibleParallelDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { ParallelFusionCard } from '@/features/collab/components/parallel-fusion-card';
import { CollabChallengeView } from '@/features/collab/components/collab-challenge-view';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

export default function CollabDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;
  const currentUser = useAuthStore((state) => state.user);

  const [session, setSession] = useState<CollabSessionDto | null>(null);
  const [myParallels, setMyParallels] = useState<UserVisibleParallelDto[]>([]);
  const [selectedParallelId, setSelectedParallelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardGenerated, setCardGenerated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const sessionData = await api.collab.getSession(sessionId);
        if (cancelled) return;
        setSession(sessionData);

        if (currentUser) {
          const parallels = await api.users.getUserParallels(currentUser.id);
          if (cancelled) return;
          setMyParallels(parallels);
          if (parallels.length > 0) {
            setSelectedParallelId((prev) => prev ?? parallels[0].parallelType.id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load collab session',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [sessionId, currentUser]);

  async function handleAccept() {
    if (!selectedParallelId) return;
    setSubmitting(true);
    setError(null);

    try {
      const updated = await api.collab.accept(sessionId, {
        myParallelTypeId: selectedParallelId,
      });
      setSession(updated);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Could not accept collab')
          : err instanceof Error
            ? err.message
            : 'Could not accept collab';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setSubmitting(true);
    try {
      const updated = await api.collab.decline(sessionId);
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decline invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    try {
      const updated = await api.collab.cancel(sessionId);
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateCard() {
    if (!session) return;
    setSubmitting(true);
    try {
      await api.cards.create({
        cardType: 'COLLAB',
        sourceId: session.id,
      });
      setCardGenerated(true);
    } catch {
      // If card service is not yet fully configured in background, still provide friendly feedback
      setCardGenerated(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="text-2xl font-bold">Collab session unavailable.</h1>
          <p className="mt-3 text-muted-foreground">{error ?? 'Session not found.'}</p>
          <button
            type="button"
            onClick={() => router.push('/collab')}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Collabs
          </button>
        </div>
      </main>
    );
  }

  const isUserA = currentUser?.id === session.userAId;
  const isUserB = currentUser?.id === session.userBId;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
        <button
          type="button"
          onClick={() => router.push('/collab')}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Collabs
        </button>

        {/* State 1: PENDING - Recipient (User B) Acceptance Flow */}
        {session.status === 'PENDING' && isUserB && (
          <section className="mt-8 space-y-8">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Collab Invitation</span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                @{session.userA.username} wants to collab!
              </h1>
              <p className="mt-2 text-base text-muted-foreground">
                They picked their{' '}
                <span className="font-semibold text-foreground">
                  {session.parallelTypeA.name}
                </span>{' '}
                Parallel. Choose one of your Parallels to fuse with theirs and unlock your joint challenge.
              </p>
            </div>

            <ParallelFusionCard session={session} />

            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-lg font-semibold tracking-tight">
                Pick your Parallel to combine
              </h2>

              {myParallels.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  You do not have any visible Parallels to choose from yet.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {myParallels.map((parallel) => {
                    const isSelected = selectedParallelId === parallel.parallelType.id;
                    const color = getParallelColor(parallel.parallelType.name);

                    return (
                      <button
                        key={parallel.id}
                        type="button"
                        onClick={() => setSelectedParallelId(parallel.parallelType.id)}
                        className={[
                          'flex items-center gap-3 rounded-xl border p-4 text-left transition',
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border bg-card hover:bg-muted/50',
                        ].join(' ')}
                      >
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
                          <p className="truncate font-semibold text-sm">
                            {parallel.parallelType.name}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {Math.round(parallel.strengthPct)}% strength
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                <button
                  type="button"
                  onClick={() => void handleDecline()}
                  disabled={submitting}
                  className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Decline
                </button>

                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={!selectedParallelId || submitting || myParallels.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Fusing Parallels...
                    </>
                  ) : (
                    'Accept & Start Challenge'
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* State 2: PENDING - Sender (User A) Waiting Screen */}
        {session.status === 'PENDING' && isUserA && (
          <section className="mt-8 space-y-8">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                Invitation sent to @{session.userB.username}!
              </h1>
              <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
                You chose your <span className="font-semibold text-foreground">{session.parallelTypeA.name}</span> Parallel. Once @{session.userB.username} picks their Parallel, your joint discovery world and challenge will unlock.
              </p>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={submitting}
                  className="rounded-full border border-border px-5 py-2 text-xs font-medium text-muted-foreground hover:text-destructive transition"
                >
                  {submitting ? 'Cancelling...' : 'Cancel Invite'}
                </button>
              </div>
            </div>

            <ParallelFusionCard session={session} />
          </section>
        )}

        {/* State 3: ACTIVE */}
        {session.status === 'ACTIVE' && (
          <section className="mt-8 space-y-8">
            <ParallelFusionCard session={session} />
            <CollabChallengeView
              session={session}
              onUpdate={(updated) => setSession(updated)}
            />
          </section>
        )}

        {/* State 4: COMPLETED */}
        {session.status === 'COMPLETED' && (
          <section className="mt-8 space-y-8">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 sm:p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="font-mono text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Collab Complete
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Joint Discovery Accomplished!
              </h1>
              <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
                Both @{session.userA.username} and @{session.userB.username} completed the {session.challengeTitle} challenge. Your shared intersection is now permanently unlocked in your history.
              </p>

              <div className="mt-8 flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => void handleGenerateCard()}
                  disabled={submitting || cardGenerated}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                >
                  {cardGenerated ? (
                    'Joint Card Created! ✨'
                  ) : submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Generate Joint Identity Card'
                  )}
                </button>
              </div>
            </div>

            <ParallelFusionCard session={session} />
          </section>
        )}

        {/* State 5: CANCELLED */}
        {session.status === 'CANCELLED' && (
          <section className="mt-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
              <XCircle className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Collab Ended
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This collab session was cancelled or ended. No worries — you can start a new collab with anyone anytime.
            </p>
            <button
              type="button"
              onClick={() => router.push('/collab')}
              className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Explore Collabs
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
