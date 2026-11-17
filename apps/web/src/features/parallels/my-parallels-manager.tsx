'use client';

import { useState } from 'react';
import { Eye, EyeOff, Globe, Trash2 } from 'lucide-react';
import type { UserParallelDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  getParallelColor,
  ParallelIcon,
} from '@/features/parallels/parallel-visuals';

export interface MyParallelsManagerProps {
  parallels: UserParallelDto[];
  onChange: (nextParallels: UserParallelDto[]) => void;
}

export function MyParallelsManager({
  parallels,
  onChange,
}: MyParallelsManagerProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDismissId, setConfirmDismissId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMakePublic(item: UserParallelDto) {
    if (busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await api.parallels.makePublic(item.id);
      onChange(parallels.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not publish this Parallel.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleHide(item: UserParallelDto) {
    if (busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      await api.parallels.hide(item.id);
      onChange(
        parallels.map((p) => (p.id === item.id ? { ...p, isHidden: true } : p)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not hide this Parallel.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnhide(item: UserParallelDto) {
    if (busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await api.parallels.unhide(item.id);
      onChange(parallels.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not unhide this Parallel.',
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(item: UserParallelDto) {
    if (busyId) return;
    setBusyId(item.id);
    setError(null);
    try {
      await api.parallels.dismiss(item.id);
      setConfirmDismissId(null);
      onChange(parallels.filter((p) => p.id !== item.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not remove this Parallel.',
      );
    } finally {
      setBusyId(null);
    }
  }

  if (parallels.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No active Parallels yet.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {parallels.map((item) => {
        const color = getParallelColor(item.parallelType.name);
        const isBusy = busyId === item.id;
        const isConfirming = confirmDismissId === item.id;

        return (
          <article
            key={item.id}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"
                  style={{ color }}
                >
                  <ParallelIcon
                    iconName={item.parallelType.icon ?? ''}
                    className="h-5 w-5"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">
                      {item.parallelType.name}
                    </h3>
                    <span className="font-mono text-xs text-muted-foreground">
                      {Math.round(item.strengthPct)}%
                    </span>
                    {item.isGhost ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        <EyeOff className="h-3 w-3" aria-hidden="true" />
                        Ghost · Private
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
                        <Globe className="h-3 w-3" aria-hidden="true" />
                        Public
                      </span>
                    )}
                    {item.isHidden && (
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">
                        Hidden from map
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Why you have this:{' '}
                    {item.suggestionReason ?? 'Based on your activity.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {item.isGhost && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => void handleMakePublic(item)}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Make public
                  </Button>
                )}

                {item.isHidden ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => void handleUnhide(item)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Unhide
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => void handleHide(item)}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    Hide
                  </Button>
                )}

                {!isConfirming ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => setConfirmDismissId(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs">
                    <span>Remove permanently? We won&apos;t suggest this again.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isBusy}
                      onClick={() => void handleDismiss(item)}
                    >
                      Confirm remove
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isBusy}
                      onClick={() => setConfirmDismissId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
