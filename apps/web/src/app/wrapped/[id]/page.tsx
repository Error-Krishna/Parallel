'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Flame,
  Share2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { WrappedRecapDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';

export default function PublicWrappedPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wrappedId = params.id;

  const [recap, setRecap] = useState<WrappedRecapDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api.wrapped
      .get(wrappedId)
      .then((result) => {
        if (!active) return;
        setRecap(result);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError('This Parallel Wrapped recap could not be found.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [wrappedId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <p className="text-sm text-muted-foreground">Opening Parallel Wrapped...</p>
      </main>
    );
  }

  if (error || !recap) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <p className="text-lg font-semibold">Wrapped recap unavailable</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {error ?? 'We could not find this recap.'}
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Explore Parallel
        </button>
      </main>
    );
  }

  const names = recap.parallelNames ?? {};
  const labelFor = (id: string | undefined) =>
    (id && names[id]) || 'Parallel';

  const {
    biggestEvolution,
    mostExplored,
    weirdestIntersection,
    streakHighlight,
    narrativeCopy,
  } = recap.highlights;

  const periodLabel = recap.period === 'ANNUAL' ? 'Annual' : 'Monthly';
  const usernameLabel = recap.username ? `@${recap.username}` : 'Your';

  const slides = [
    {
      key: 'intro',
      eyebrow: `${periodLabel} Wrapped`,
      title: `${usernameLabel}'s Parallel Story`,
      body: narrativeCopy,
      badge: `${new Date(recap.periodStart).toLocaleDateString()} – ${new Date(
        recap.periodEnd,
      ).toLocaleDateString()}`,
    },
    {
      key: 'momentum',
      eyebrow: 'Momentum & Curiosity',
      title: biggestEvolution
        ? `${labelFor(biggestEvolution.parallelTypeId)} ${
            biggestEvolution.deltaPct > 0 ? '+' : ''
          }${biggestEvolution.deltaPct}%`
        : mostExplored
          ? `Most explored: ${labelFor(mostExplored.parallelTypeId)}`
          : 'A calm stretch on your map',
      body: mostExplored
        ? `You had ${mostExplored.interactionCount} curiosity moments in ${labelFor(
            mostExplored.parallelTypeId,
          )}.`
        : 'Not every season needs to be loud. Your Parallels are waiting whenever you want to wander again.',
      badge: biggestEvolution ? 'Biggest evolution' : 'Curiosity snapshot',
    },
    {
      key: 'signature',
      eyebrow: 'Signature Mix & Rhythm',
      title: weirdestIntersection
        ? weirdestIntersection.parallelTypeIds.map(labelFor).join(' × ')
        : streakHighlight
          ? `${streakHighlight.streakCount}-day rhythm`
          : 'Uniquely yours',
      body: weirdestIntersection
        ? weirdestIntersection.note
        : streakHighlight
          ? `Your longest streak was ${streakHighlight.streakCount} days in ${labelFor(
              streakHighlight.parallelTypeId,
            )}.`
          : 'Make more Parallels public to uncover unexpected intersections.',
      badge: streakHighlight
        ? `Top streak: ${streakHighlight.streakCount}d in ${labelFor(
            streakHighlight.parallelTypeId,
          )}`
        : 'Identity intersection',
    },
    {
      key: 'share',
      eyebrow: 'Share Your Wrapped',
      title: 'Keep exploring every side of you',
      body: narrativeCopy,
      badge: `${periodLabel} recap ready`,
    },
  ];

  const activeSlide = slides[slideIndex] ?? slides[0]!;
  const isFirst = slideIndex === 0;
  const isLast = slideIndex === slides.length - 1;

  async function handleCopyLink() {
    if (typeof window === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleCreateCard() {
    if (!recap || creatingCard) return;
    setCreatingCard(true);
    setCardError(null);
    try {
      const created = await api.cards.create({
        cardType: 'WRAPPED',
        sourceId: recap.id,
      });
      router.push(`/card/${created.id}`);
    } catch {
      setCardError('Could not create a Wrapped Identity Card right now.');
    } finally {
      setCreatingCard(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 text-foreground">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        {/* Story progress segments */}
        <div className="mb-6 flex gap-2" aria-label="Story progress">
          {slides.map((slide, index) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => setSlideIndex(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-1.5 flex-1 rounded-full transition ${
                index <= slideIndex ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        <div className="min-h-64 space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            {slideIndex === 1 ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : slideIndex === 2 ? (
              <Flame className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {activeSlide.eyebrow}
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            {activeSlide.title}
          </h1>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {activeSlide.body}
          </p>

          <p className="inline-block rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground">
            {activeSlide.badge}
          </p>

          {isLast && (
            <div className="space-y-3 pt-4">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Link copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy recap link
                    </>
                  )}
                </button>

                {isAuthenticated && (
                  <button
                    type="button"
                    disabled={creatingCard}
                    onClick={() => void handleCreateCard()}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
                  >
                    <Share2 className="h-4 w-4" />
                    {creatingCard ? 'Creating...' : 'Make Identity Card'}
                  </button>
                )}
              </div>

              {cardError && (
                <p role="alert" className="text-xs text-destructive">
                  {cardError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation controls */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Previous
          </button>

          <span className="text-xs text-muted-foreground">
            {slideIndex + 1} / {slides.length}
          </span>

          {isLast ? (
            <button
              type="button"
              onClick={() => router.push(isAuthenticated ? '/map' : '/signup')}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            >
              {isAuthenticated ? 'Back to Map' : 'Discover yours'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setSlideIndex((i) => Math.min(slides.length - 1, i + 1))
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
