'use client';

import { motion } from 'framer-motion';
import { Check, Users } from 'lucide-react';
import type { CommunityDto } from '@parallel/shared-types';
import { Button } from '@/components/ui/button';
import { getParallelColor } from '@/features/parallels/parallel-visuals';

export type CommunityAction = 'join' | 'skip';

interface CommunityCardProps {
  community: CommunityDto;
  index: number;
  // The action currently in flight for this community, if any. While set, both
  // buttons are disabled so Join/Skip can't be double-submitted.
  pendingAction: CommunityAction | null;
  error: string | null;
  onJoin: (communityId: string) => void;
  onSkip: (communityId: string) => void;
}

export function CommunityCard({
  community,
  index,
  pendingAction,
  error,
  onJoin,
  onSkip,
}: CommunityCardProps) {
  const busy = pendingAction !== null;
  const memberLabel =
    community.memberCount === 1
      ? '1 member'
      : `${community.memberCount} members`;

  // originatingParallelNames only ever contains Parallels the backend already
  // verified are visible (non-ghost, non-hidden, non-dismissed) for this user —
  // see CommunitiesService.getCommunities — so it is safe to render as-is.
  const sharedNames = community.originatingParallelNames;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6"
    >
      {sharedNames.length > 0 ? (
        <ul
          className="flex flex-wrap gap-2"
          aria-label="Parallels this community is built on"
        >
          {sharedNames.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: getParallelColor(name) }}
              />
              {name}
            </li>
          ))}
        </ul>
      ) : null}

      <h2 className="mt-6 text-2xl font-semibold">{community.name}</h2>

      <p className="mt-2 leading-7 text-muted-foreground">
        {community.description}
      </p>

      <p className="mt-4 text-xs text-muted-foreground">
        {sharedNames.length > 0
          ? `Recommended because you share ${sharedNames.join(' + ')}.`
          : 'Recommended based on your visible Parallels.'}
      </p>

      <div className="mt-6 flex flex-1 flex-wrap items-end justify-between gap-4">
        <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden="true" />
          {memberLabel}
        </span>

        {community.isMember ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4" aria-hidden="true" />
            Joined
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => onSkip(community.id)}
              aria-label={`Skip ${community.name}`}
            >
              {pendingAction === 'skip' ? 'Skipping...' : 'Skip'}
            </Button>

            <Button
              disabled={busy}
              onClick={() => onJoin(community.id)}
              aria-label={`Join ${community.name}`}
            >
              {pendingAction === 'join' ? 'Joining...' : 'Join'}
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </motion.article>
  );
}
