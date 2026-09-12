'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type {
  ContentItemDto,
  ParallelTypeDto,
  PublicUser,
  QuestDto,
} from '@parallel/shared-types';
import { api } from '@/lib/api-client';

export default function ParallelPage() {
  const params = useParams<{ parallelId: string }>();

  const [parallel, setParallel] = useState<ParallelTypeDto | null>(null);
  const [items, setItems] = useState<ContentItemDto[]>([]);
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [quests, setQuests] = useState<QuestDto[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<ContentItemDto | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'quests' | 'people'>(
    'feed',
  );
  const [error, setError] = useState<string | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadParallel() {
      try {
        const result = await api.parallels.get(params.parallelId);

        if (!cancelled) {
          setParallel(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load this Parallel.',
          );
        }
      }
    }

    void loadParallel();

    return () => {
      cancelled = true;
    };
  }, [params.parallelId]);

  useEffect(() => {
    let cancelled = false;

    async function loadFeed() {
      try {
        setLoadingFeed(true);

        const result = await api.parallels.getFeed(params.parallelId);

        if (!cancelled) {
          setItems(result.items);
          setNextCursor(result.nextCursor);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load the Parallel feed.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingFeed(false);
        }
      }
    }

    void loadFeed();

    return () => {
      cancelled = true;
    };
  }, [params.parallelId]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div>
          <h1 className="text-3xl font-bold">Parallel unavailable.</h1>
          <p className="mt-3 text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  async function followPerson(userId: string) {
    try {
      await api.users.follow(userId);

      setFollowing((current) => {
        const next = new Set(current);
        next.add(userId);
        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not follow this person.',
      );
    }
  }

  async function loadQuests() {
    try {
      const result = await api.parallels.getQuests(params.parallelId);
      setQuests(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load quests in this Parallel.',
      );
    }
  }

  async function loadPeople() {
    try {
      const result = await api.parallels.getPeople(params.parallelId);
      setPeople(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load people in this Parallel.',
      );
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);

      const result = await api.parallels.getFeed(
        params.parallelId,
        nextCursor,
      );

      setItems((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load more content.',
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function openContent(item: ContentItemDto) {
    try {
      setLoadingContent(true);
      setError(null);

      const content = await api.content.get(item.id);
      setSelectedItem(content);

      void api.content.interact(item.id, 'VIEW').catch(() => {});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load this content.',
      );
    } finally {
      setLoadingContent(false);
    }
  }

  if (!parallel) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-mono text-sm text-muted-foreground">
          Entering Parallel...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Parallel
          </p>

          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            {parallel.name}
          </h1>

          <p className="mt-3 text-muted-foreground">
            {parallel.description}
          </p>
        </header>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === 'feed'
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground'
            }`}
          >
            Feed
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('quests');
              void loadQuests();
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === 'quests'
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground'
            }`}
          >
            Quests
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('people');
              void loadPeople();
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              activeTab === 'people'
                ? 'bg-foreground text-background'
                : 'border border-border text-muted-foreground'
            }`}
          >
            People
          </button>
        </div>

        {activeTab === 'quests' ? (
          <section className="space-y-4">
            {quests.length === 0 ? (
              <div className="rounded-2xl border border-border p-8 text-center">
                <h2 className="text-xl font-semibold">
                  No quests yet.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  New experiments will appear here as this Parallel grows.
                </p>
              </div>
            ) : (
              quests.map((quest) => (
                <article
                  key={quest.id}
                  className="rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {quest.title}
                      </h2>
                      <p className="mt-2 text-muted-foreground">
                        {quest.description}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-border px-3 py-1 font-mono text-xs">
                      {quest.progress.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{quest.steps.length} steps</span>
                    <span>Reward: {quest.rewardValue}</span>
                  </div>
                </article>
              ))
            )}
          </section>
        ) : activeTab === 'people' ? (
          <section className="space-y-4">
            {people.length === 0 ? (
              <div className="rounded-2xl border border-border p-8 text-center">
                <h2 className="text-xl font-semibold">
                  We&apos;re still finding your people.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  No other people have surfaced in this Parallel yet.
                </p>
              </div>
            ) : (
              people.map((person) => (
                <article
                  key={person.id}
                  className="rounded-2xl border border-border bg-card p-6"
                >
                  <h2 className="text-xl font-semibold">
                    @{person.username}
                  </h2>

                  {person.bio && (
                    <p className="mt-2 text-muted-foreground">
                      {person.bio}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void followPerson(person.id)}
                    disabled={following.has(person.id)}
                    className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-foreground/30 disabled:cursor-default disabled:opacity-60"
                  >
                    {following.has(person.id) ? 'Following' : 'Follow'}
                  </button>
                </article>
              ))
            )}
          </section>
        ) : selectedItem ? (
          <section>
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="mb-6 font-mono text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to {parallel.name}
            </button>

            <article className="rounded-2xl border border-border bg-card p-6">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                {selectedItem.type.replace('_', ' ')}
              </p>

              <h2 className="mt-3 text-2xl font-semibold">
                {getTitle(selectedItem)}
              </h2>

              <p className="mt-4 leading-7 text-muted-foreground">
                {getBody(selectedItem)}
              </p>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void api.content.interact(selectedItem.id, 'LIKE').catch(() => {})
                  }
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-foreground/30"
                >
                  Like
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void api.content.interact(selectedItem.id, 'SAVE').catch(() => {})
                  }
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-foreground/30"
                >
                  Save
                </button>
              </div>
            </article>
          </section>
        ) : (
        <section className="space-y-4">
          {loadingFeed ? (
            <p className="font-mono text-sm text-muted-foreground">
              Finding your people...
            </p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-border p-8 text-center">
              <h2 className="text-xl font-semibold">
                We&apos;re still finding your people.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                There&apos;s nothing here yet. Check back as this Parallel
                grows.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openContent(item)}
                className="block w-full rounded-2xl border border-border bg-card p-6 text-left transition hover:border-foreground/30"
              >
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {item.type.replace('_', ' ')}
                </p>

                <h2 className="mt-3 text-xl font-semibold">
                  {getTitle(item)}
                </h2>

                <p className="mt-2 leading-7 text-muted-foreground">
                  {getBody(item)}
                </p>
              </button>
            ))
          )}
        </section>
        )}

        {nextCursor && (
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="rounded-full border border-border px-5 py-2 text-sm font-medium transition hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}

        {loadingContent && (
          <p className="mt-4 font-mono text-sm text-muted-foreground">
            Opening...
          </p>
        )}
      </div>
    </main>
  );
}

function getTitle(item: ContentItemDto): string {
  if (
    typeof item.payload === 'object' &&
    item.payload !== null &&
    'title' in item.payload &&
    typeof item.payload.title === 'string'
  ) {
    return item.payload.title;
  }

  return 'Something from this Parallel';
}

function getBody(item: ContentItemDto): string {
  if (
    typeof item.payload === 'object' &&
    item.payload !== null &&
    'body' in item.payload &&
    typeof item.payload.body === 'string'
  ) {
    return item.payload.body;
  }

  return 'Explore this side of yourself.';
}
