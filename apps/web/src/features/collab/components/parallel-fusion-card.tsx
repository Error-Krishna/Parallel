'use client';

import { Sparkles } from 'lucide-react';
import type { CollabSessionDto } from '@parallel/shared-types';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

interface ParallelFusionCardProps {
  session: CollabSessionDto;
}

export function ParallelFusionCard({ session }: ParallelFusionCardProps) {
  const colorA = getParallelColor(session.parallelTypeA.name);
  const colorB = session.parallelTypeB
    ? getParallelColor(session.parallelTypeB.name)
    : '#888888';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
      {/* Background radial aura combining both colors */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: colorA }}
      />
      {session.parallelTypeB && (
        <div
          className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: colorB }}
        />
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Fused Discovery World
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 font-mono text-xs font-medium backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            {session.status}
          </span>
        </div>

        <div className="mt-8 grid items-center gap-6 md:grid-cols-7">
          {/* Participant A */}
          <div className="rounded-xl border border-border/80 bg-background/50 p-5 md:col-span-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-border"
                style={{ color: colorA, borderColor: `${colorA}40` }}
              >
                <ParallelIcon
                  iconName={session.parallelTypeA.icon ?? ''}
                  className="h-6 w-6"
                />
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">
                  @{session.userA.username}
                </p>
                <h3 className="truncate text-xl font-bold tracking-tight">
                  {session.parallelTypeA.name}
                </h3>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {session.parallelTypeA.description}
            </p>
          </div>

          {/* Fusion Symbol */}
          <div className="flex flex-col items-center justify-center md:col-span-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card font-mono text-base font-bold shadow-sm">
              ×
            </div>
          </div>

          {/* Participant B */}
          <div className="rounded-xl border border-border/80 bg-background/50 p-5 md:col-span-3">
            {session.parallelTypeB ? (
              <>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-border"
                    style={{ color: colorB, borderColor: `${colorB}40` }}
                  >
                    <ParallelIcon
                      iconName={session.parallelTypeB.icon ?? ''}
                      className="h-6 w-6"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">
                      @{session.userB.username}
                    </p>
                    <h3 className="truncate text-xl font-bold tracking-tight">
                      {session.parallelTypeB.name}
                    </h3>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {session.parallelTypeB.description}
                </p>
              </>
            ) : (
              <div className="flex h-full flex-col justify-center py-4 text-center">
                <p className="font-mono text-xs text-muted-foreground">
                  @{session.userB.username}
                </p>
                <p className="mt-2 text-sm italic text-muted-foreground">
                  Choosing their Parallel...
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
