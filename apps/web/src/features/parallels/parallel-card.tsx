'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, EyeOff, Globe } from 'lucide-react';
import type { UserParallelDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import {
  getParallelColor,
  ParallelIcon,
} from '@/features/parallels/parallel-visuals';

export interface ParallelCardProps {
  parallel: UserParallelDto;
  index: number;
  onEnter: (parallelId: string) => void;
  onHide: (parallelId: string) => void;
  onPublished: (updatedParallel: UserParallelDto) => void;
}

export function ParallelCard({
  parallel,
  index,
  onEnter,
  onHide,
  onPublished,
}: ParallelCardProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const publishInFlightRef = useRef(false);

  async function handleEnter() {
    try {
      const enteredParallel = await api.parallels.enter(
        parallel.parallelType.id,
      );
      onEnter(enteredParallel.id);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Could not open this Parallel right now.',
      );
    }
  }

  async function handleMakePublic() {
    if (publishInFlightRef.current || isPublishing || !parallel.isGhost) {
      return;
    }

    publishInFlightRef.current = true;
    setIsPublishing(true);
    setActionError(null);

    try {
      const updated = await api.parallels.makePublic(parallel.id);
      setJustPublished(true);
      onPublished(updated);
    } catch (err) {
      setJustPublished(false);
      setActionError(
        err instanceof Error
          ? err.message
          : 'Could not publish this Parallel right now.',
      );
    } finally {
      publishInFlightRef.current = false;
      setIsPublishing(false);
    }
  }

  async function handleHide() {
    if (isHiding || isPublishing) {
      return;
    }

    setIsHiding(true);
    setActionError(null);

    try {
      await api.parallels.hide(parallel.id);
      onHide(parallel.id);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Could not hide this Parallel right now.',
      );
    } finally {
      setIsHiding(false);
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
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border"
              style={{ color }}
            >
              <ParallelIcon
                iconName={parallel.parallelType.icon ?? ''}
                className="h-5 w-5"
              />
            </div>

            {parallel.isGhost && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                title="Only visible to you until you make it public"
              >
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                Ghost · Private
              </span>
            )}
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

        {justPublished && !parallel.isGhost && (
          <p
            role="status"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Published — now visible on your profile and in discovery.
          </p>
        )}

        {actionError && (
          <p role="alert" className="mt-4 text-xs text-destructive">
            {actionError}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void handleEnter()}
            className="inline-flex items-center gap-2 text-sm font-medium transition group-hover:gap-3"
          >
            Enter Parallel
            <ArrowRight className="h-4 w-4" />
          </button>

          {parallel.isGhost && (
            <>
              <button
                type="button"
                onClick={() => void handleMakePublic()}
                disabled={isPublishing || isHiding}
                aria-busy={isPublishing}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                {isPublishing ? 'Publishing...' : 'Make public'}
              </button>

              <button
                type="button"
                onClick={() => void handleHide()}
                disabled={isPublishing || isHiding}
                aria-busy={isHiding}
                className="text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isHiding ? 'Hiding...' : 'Hide'}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}
