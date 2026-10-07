'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { CommunityDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  CommunityCard,
  type CommunityAction,
} from '@/features/communities/community-card';

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

// The API client turns server error bodies into plain Errors with a readable message
// (e.g. "Already a member of this community"). An error that is still an AxiosError
// has no usable server message (network failure, timeout), so show a generic message
// rather than axios's technical text.
function getActionErrorMessage(err: unknown, action: CommunityAction): string {
  if (err instanceof Error && !axios.isAxiosError(err)) {
    return err.message;
  }

  return `Could not ${action} this community. Please try again.`;
}

export default function CommunitiesPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<CommunityDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped to re-run the load effect for "Try again" without a full page reload.
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [pendingActions, setPendingActions] = useState<
    Record<string, CommunityAction>
  >({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  // State updates are async, so a ref is what actually guarantees a rapid
  // double-click can't fire two requests for the same community.
  const inFlight = useRef(new Set<string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCommunities() {
      try {
        const result = await api.communities.getRecommended();

        if (!cancelled) {
          setCommunities(result);
        }
      } catch {
        if (!cancelled) {
          setLoadError('Could not load your communities. Please try again.');
        }
      }
    }

    void loadCommunities();

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  async function runAction(communityId: string, action: CommunityAction) {
    if (inFlight.current.has(communityId)) return;

    inFlight.current.add(communityId);
    setPendingActions((current) => ({ ...current, [communityId]: action }));
    setActionErrors((current) => withoutKey(current, communityId));

    try {
      if (action === 'join') {
        await api.communities.join(communityId);
      } else {
        await api.communities.skip(communityId);
      }

      if (!mounted.current) return;

      setCommunities((current) => {
        if (!current) return current;

        // Skipped communities leave the list (the backend now excludes them from
        // recommendations too); joined ones stay, flipped to their member state.
        if (action === 'skip') {
          return current.filter((item) => item.id !== communityId);
        }

        return current.map((item) =>
          item.id === communityId
            ? { ...item, isMember: true }
            : item,
        );
      });
    } catch (err) {
      if (!mounted.current) return;

      setActionErrors((current) => ({
        ...current,
        [communityId]: getActionErrorMessage(err, action),
      }));
    } finally {
      inFlight.current.delete(communityId);

      if (mounted.current) {
        setPendingActions((current) => withoutKey(current, communityId));
      }
    }
  }

  function retryLoad() {
    setLoadError(null);
    setCommunities(null);
    setLoadAttempt((attempt) => attempt + 1);
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div role="alert">
          <h1 className="text-3xl font-bold">Communities are unavailable.</h1>
          <p className="mt-3 text-muted-foreground">{loadError}</p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="outline" onClick={retryLoad}>
              Try again
            </Button>
            <Button variant="ghost" onClick={() => router.push('/map')}>
              Back to map
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!communities) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <motion.div
          role="status"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="font-mono text-sm text-muted-foreground"
        >
          Finding your communities...
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8 lg:px-10">
        <button
          type="button"
          onClick={() => router.push('/map')}
          className="mb-10 flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to map
        </button>

        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Communities
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Find your people.
          </h1>

          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Communities form around the Parallels you share with others. Join
            the ones that fit, skip the ones that don&apos;t.
          </p>
        </motion.header>

        <section className="mt-12">
          {communities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center sm:p-12">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Nothing yet
              </p>

              <h2 className="mx-auto mt-3 max-w-lg text-2xl font-semibold tracking-tight">
                No communities match you right now.
              </h2>

              <p className="mx-auto mt-3 max-w-lg leading-7 text-muted-foreground">
                Communities appear when enough people share the same strong
                Parallels. Keep exploring — new ones may show up as your map
                evolves.
              </p>

              <Button
                variant="outline"
                className="mt-6"
                onClick={() => router.push('/map')}
              >
                Back to your map
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {communities.map((community, index) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  index={index}
                  pendingAction={pendingActions[community.id] ?? null}
                  error={actionErrors[community.id] ?? null}
                  onJoin={(communityId) => void runAction(communityId, 'join')}
                  onSkip={(communityId) => void runAction(communityId, 'skip')}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
