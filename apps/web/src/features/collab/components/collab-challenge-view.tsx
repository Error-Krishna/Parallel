'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, Loader2, Target } from 'lucide-react';
import type { CollabSessionDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';

interface CollabChallengeViewProps {
  session: CollabSessionDto;
  onUpdate: (updated: CollabSessionDto) => void;
}

export function CollabChallengeView({
  session,
  onUpdate,
}: CollabChallengeViewProps) {
  const currentUser = useAuthStore((state) => state.user);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUserA = currentUser?.id === session.userAId;
  const isUserB = currentUser?.id === session.userBId;
  const myCompleted = isUserA
    ? session.userACompleted
    : isUserB
      ? session.userBCompleted
      : false;
  const partnerUsername = isUserA
    ? session.userB.username
    : session.userA.username;

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.collab.complete(session.id);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete challenge');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeave() {
    if (!window.confirm('Leave this collab session? You can always start a new one later.')) {
      return;
    }

    setCancelling(true);
    setError(null);
    try {
      const updated = await api.collab.cancel(session.id);
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave collab');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <Target className="h-4 w-4 text-primary" />
          <span>Shared Challenge</span>
        </div>
        {session.challengeContext?.theme && (
          <span className="rounded-full border border-border bg-muted/60 px-3 py-1 font-mono text-xs text-muted-foreground">
            {session.challengeContext.theme as string}
          </span>
        )}
      </div>

      <h2 className="mt-4 text-2xl font-bold tracking-tight">
        {session.challengeTitle ?? 'Shared Discovery Challenge'}
      </h2>

      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {session.challengeDescription ??
          'Explore this shared intersection together and discover something new.'}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Participant Progress Checklist */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {/* User A progress */}
        <div
          className={[
            'flex items-center gap-3 rounded-xl border p-4 transition',
            session.userACompleted
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-border bg-background/50',
          ].join(' ')}
        >
          {session.userACompleted ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium text-sm">@{session.userA.username}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {session.userACompleted ? 'Challenge completed' : 'In progress'}
            </p>
          </div>
        </div>

        {/* User B progress */}
        <div
          className={[
            'flex items-center gap-3 rounded-xl border p-4 transition',
            session.userBCompleted
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-border bg-background/50',
          ].join(' ')}
        >
          {session.userBCompleted ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          ) : (
            <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium text-sm">@{session.userB.username}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {session.userBCompleted ? 'Challenge completed' : 'In progress'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <div>
          {myCompleted ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ You marked this complete! Waiting for @{partnerUsername} to finish.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void handleComplete()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'I Completed My Part'
              )}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleLeave()}
          disabled={cancelling}
          className="text-xs font-medium text-muted-foreground transition hover:text-destructive"
        >
          {cancelling ? 'Leaving...' : 'Leave Collab'}
        </button>
      </div>
    </div>
  );
}
