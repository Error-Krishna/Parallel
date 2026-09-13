'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, UserPlus } from 'lucide-react';
import type {
  ContentItemDto,
  ParallelTypeDto,
  PublicUser,
  QuestDto,
} from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { getParallelColor, ParallelIcon } from '@/features/parallels/parallel-visuals';

type Tab = 'feed' | 'quests' | 'people';

// ContentItem.payload varies by ContentType (POST/ARTICLE/EVENT/CHALLENGE_PROMPT —
// see DATABASE.md §2.5) and is deliberately untyped (`unknown`) at the API boundary.
// Best-effort, safe read of a couple of common fields rather than assuming a shape.
function readPayload(payload: unknown): { title: string; body: string | null } {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const title = typeof record.title === 'string' ? record.title : null;
    const body =
      typeof record.body === 'string'
        ? record.body
        : typeof record.description === 'string'
          ? record.description
          : null;

    if (title) {
      return { title, body };
    }
  }

  return { title: 'Untitled', body: null };
}

export default function ParallelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const parallelId = params.id;

  const [parallel, setParallel] = useState<ParallelTypeDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('feed');
  const [quests, setQuests] = useState<QuestDto[] | null>(null);

  const [feedItems, setFeedItems] = useState<ContentItemDto[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [people, setPeople] = useState<PublicUser[] | null>(null);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  // Header + first page of the feed, on mount.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [parallelResult, feedResult] = await Promise.all([
          api.parallels.get(parallelId),
          api.parallels.getFeed(parallelId),
        ]);

        if (cancelled) return;

        setParallel(parallelResult);
        setFeedItems(feedResult.items);
        setFeedCursor(feedResult.nextCursor);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [parallelId]);

  // Quests, fetched lazily the first time that tab is opened.
  useEffect(() => {
    if (tab !== 'quests' || quests !== null) return;

    let cancelled = false;

    api.parallels
      .getQuests(parallelId)
      .then((result) => {
        if (!cancelled) setQuests(result);
      })
      .catch(() => {
        if (!cancelled) setQuests([]);
      })
      .finally(() => {

      });

    return () => {
      cancelled = true;
    };
  }, [tab, quests, parallelId]);

  // People, fetched lazily the first time that tab is opened.
  useEffect(() => {
    if (tab !== 'people' || people !== null) return;

    let cancelled = false;
    api.parallels
      .getPeople(parallelId)
      .then((result) => {
        if (!cancelled) setPeople(result);
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      })
      .finally(() => {
        if (!cancelled) setPeopleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tab, people, parallelId]);

  async function loadMoreFeed() {
    if (!feedCursor || feedLoadingMore) return;

    setFeedLoadingMore(true);
    try {
      const result = await api.parallels.getFeed(parallelId, feedCursor);
      setFeedItems((prev) => [...prev, ...result.items]);
      setFeedCursor(result.nextCursor);
    } finally {
      setFeedLoadingMore(false);
    }
  }

  async function handleLike(itemId: string) {
    if (likedIds.has(itemId)) return;

    // Optimistic — the interaction endpoint has no meaningful failure mode worth
    // rolling back for (it just logs an InterestSignal), so don't block the UI on it.
    setLikedIds((prev) => new Set(prev).add(itemId));
    try {
      await api.content.interact(itemId, 'LIKE');
    } catch {
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  async function handleStartQuest(questId: string) {
    try {
      const progress = await api.parallels.startQuest(questId);

      setQuests((prev) =>
        prev?.map((quest) =>
          quest.id === questId
            ? { ...quest, progress }
            : quest,
        ) ?? null,
      );
    } catch {
      // Keep the current quest state if starting fails.
    }
  }

  async function handleCompleteQuestStep(questId: string) {
    try {
      const progress = await api.parallels.completeStep(questId);

      setQuests((prev) =>
        prev?.map((quest) =>
          quest.id === questId
            ? { ...quest, progress }
            : quest,
        ) ?? null,
      );
    } catch {
      // Keep the current quest state if completing the step fails.
    }
  }

  async function handleFollow(userId: string) {
    if (followedIds.has(userId)) return;

    setFollowedIds((prev) => new Set(prev).add(userId));
    try {
      await api.users.follow(userId);
    } catch {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="text-3xl font-bold">This Parallel doesn&apos;t exist.</h1>
          <button
            type="button"
            onClick={() => router.push('/map')}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to your map
          </button>
        </div>
      </main>
    );
  }

  if (!parallel) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="font-mono text-sm text-muted-foreground"
        >
          Loading...
        </motion.div>
      </main>
    );
  }

  const color = getParallelColor(parallel.name);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">
        <button
          type="button"
          onClick={() => router.push('/map')}
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Your map
        </button>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4"
        >
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border"
            style={{ color }}
          >
            <ParallelIcon iconName={parallel.icon ?? ''} className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">{parallel.name}</h1>
            <p className="mt-2 max-w-lg leading-7 text-muted-foreground">
              {parallel.description}
            </p>
          </div>
        </motion.header>

        <nav className="mt-10 flex gap-1 border-b border-border">
          {(['feed', 'quests', 'people'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={[
                'border-b-2 px-4 py-3 text-sm font-medium transition',
                tab === value
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {value === 'feed'
                ? 'Feed'
                : value === 'quests'
                  ? 'Quests'
                  : 'People'}
            </button>
          ))}
        </nav>

        <section className="py-8">
          {tab === 'feed' ? (
            <FeedTab
              loading={feedLoading}
              items={feedItems}
              hasMore={Boolean(feedCursor)}
              loadingMore={feedLoadingMore}
              likedIds={likedIds}
              onLoadMore={() => void loadMoreFeed()}
              onLike={(id) => void handleLike(id)}
              color={color}
            />
          ) : tab === 'quests' ? (
            <QuestsTab
              quests={quests}
              onStartQuest={(id) => void handleStartQuest(id)}
              onCompleteStep={(id) => void handleCompleteQuestStep(id)}
            />
          ) : (
            <PeopleTab
              loading={peopleLoading}
              people={people}
              followedIds={followedIds}
              onFollow={(id) => void handleFollow(id)}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function FeedTab({
  loading,
  items,
  hasMore,
  loadingMore,
  likedIds,
  onLoadMore,
  onLike,
  color,
}: {
  loading: boolean;
  items: ContentItemDto[];
  hasMore: boolean;
  loadingMore: boolean;
  likedIds: Set<string>;
  onLoadMore: () => void;
  onLike: (id: string) => void;
  color: string;
}) {
  if (loading) {
    return (
      <p className="font-mono text-sm text-muted-foreground">Loading the feed...</p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        We&apos;re still finding your people here — check back soon, or explore
        another Parallel in the meantime.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const { title, body } = readPayload(item.payload);
        const liked = likedIds.has(item.id);

        return (
          <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <span
              className="font-mono text-xs uppercase tracking-[0.15em]"
              style={{ color }}
            >
              {item.type.replace('_', ' ').toLowerCase()}
            </span>
            <h3 className="mt-2 text-lg font-semibold">{title}</h3>
            {body && <p className="mt-1 leading-6 text-muted-foreground">{body}</p>}

            <button
              type="button"
              onClick={() => onLike(item.id)}
              disabled={liked}
              className={[
                'mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition',
                liked ? 'text-destructive' : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
              {liked ? 'Liked' : 'Like'}
            </button>
          </motion.article>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}


function QuestsTab({
  quests,
  onStartQuest,
  onCompleteStep,
}: {
  quests: QuestDto[] | null;
  onStartQuest: (id: string) => void;
  onCompleteStep: (id: string) => void;
}) {
  if (quests === null) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        Loading quests...
      </p>
    );
  }

  if (quests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        No quests are available for this Parallel yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quests.map((quest) => (
        <article
          key={quest.id}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">{quest.title}</h3>
              <p className="mt-1 leading-6 text-muted-foreground">
                {quest.description}
              </p>
            </div>

            <span className="shrink-0 font-mono text-xs uppercase text-muted-foreground">
              {quest.progress.status.replace('_', ' ')}
            </span>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            {quest.progress.status === 'COMPLETED'
              ? `${quest.steps.length} of ${quest.steps.length} steps`
              : quest.progress.status === 'IN_PROGRESS'
                ? `Step ${quest.progress.currentStep + 1} of ${quest.steps.length}`
                : `${quest.steps.length} ${quest.steps.length === 1 ? 'step' : 'steps'}`}
          </div>

          {quest.progress.status === 'IN_PROGRESS' &&
            quest.steps[quest.progress.currentStep] && (
              <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="font-medium">
                  {quest.steps[quest.progress.currentStep].title}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {quest.steps[quest.progress.currentStep].description}
                </p>
              </div>
            )}

          <div className="mt-2 text-sm text-muted-foreground">
            Reward: {quest.rewardValue}
          </div>

          {quest.progress.status === 'NOT_STARTED' && (
            <button
              type="button"
              onClick={() => onStartQuest(quest.id)}
              className="mt-4 rounded-xl border border-foreground/20 px-4 py-2 text-sm font-medium transition hover:bg-accent"
            >
              Start Quest
            </button>
          )}

          {quest.progress.status === 'IN_PROGRESS' && (
            <button
              type="button"
              onClick={() => onCompleteStep(quest.id)}
              className="mt-4 rounded-xl border border-foreground/20 px-4 py-2 text-sm font-medium transition hover:bg-accent"
            >
              Complete Step
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function PeopleTab({
  loading,
  people,
  followedIds,
  onFollow,
}: {
  loading: boolean;
  people: PublicUser[] | null;
  followedIds: Set<string>;
  onFollow: (id: string) => void;
}) {
  if (loading || people === null) {
    return (
      <p className="font-mono text-sm text-muted-foreground">Finding people...</p>
    );
  }

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
        No one else has explored this Parallel publicly yet — you might be one of
        the first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {people.map((person) => {
        const followed = followedIds.has(person.id);

        return (
          <div
            key={person.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
          >
            <div>
              <p className="font-medium">@{person.username}</p>
              {person.bio && (
                <p className="mt-0.5 text-sm text-muted-foreground">{person.bio}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onFollow(person.id)}
              disabled={followed}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
                followed
                  ? 'border-border text-muted-foreground'
                  : 'border-foreground/20 hover:bg-accent',
              ].join(' ')}
            >
              <UserPlus className="h-4 w-4" />
              {followed ? 'Following' : 'Follow'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
