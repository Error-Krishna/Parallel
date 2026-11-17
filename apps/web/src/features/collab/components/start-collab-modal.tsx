'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, X } from 'lucide-react';
import type { UserVisibleParallelDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

interface StartCollabModalProps {
  targetUserId: string;
  targetUsername: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StartCollabModal({
  targetUserId,
  targetUsername,
  isOpen,
  onClose,
}: StartCollabModalProps) {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);

  const [myParallels, setMyParallels] = useState<UserVisibleParallelDto[]>([]);
  const [selectedParallelId, setSelectedParallelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!isOpen || !currentUser) return;

    async function loadParallels() {
      try {
        const data = await api.users.getUserParallels(currentUser!.id);
        if (cancelled) return;
        setMyParallels(data);
        if (data.length > 0) {
          setSelectedParallelId((prev) => prev ?? data[0].parallelType.id);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load your Parallels',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadParallels();

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  async function handleSendInvite() {
    if (!selectedParallelId) return;

    setSubmitting(true);
    setError(null);

    try {
      const session = await api.collab.invite({
        targetUserId,
        myParallelTypeId: selectedParallelId,
      });
      onClose();
      router.push(`/collab/${session.id}`);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Could not start collab')
          : err instanceof Error
            ? err.message
            : 'Could not start collab';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Collab Parallels</span>
        </div>

        <h2 className="mt-2 text-2xl font-bold tracking-tight">
          Fuse identities with @{targetUsername}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick one of your Parallels to combine with one of theirs. Together, you will explore a joint discovery world and tackle a shared challenge.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Select your Parallel
          </p>

          {loading ? (
            <div className="mt-4 flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : myParallels.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You do not have any visible Parallels yet. Explore more on your map to unlock one!
            </p>
          ) : (
            <div className="mt-3 grid max-h-60 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {myParallels.map((parallel) => {
                const isSelected = selectedParallelId === parallel.parallelType.id;
                const color = getParallelColor(parallel.parallelType.name);

                return (
                  <button
                    key={parallel.id}
                    type="button"
                    onClick={() => setSelectedParallelId(parallel.parallelType.id)}
                    className={[
                      'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-card/50 hover:bg-muted/50',
                    ].join(' ')}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border"
                      style={{ color }}
                    >
                      <ParallelIcon
                        iconName={parallel.parallelType.icon ?? ''}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
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
        </div>

        <div className="mt-8 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSendInvite()}
            disabled={!selectedParallelId || submitting || myParallels.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Collab Invite'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
