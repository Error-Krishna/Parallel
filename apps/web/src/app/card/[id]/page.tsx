'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Copy, Download, Sparkles } from 'lucide-react';
import type { IdentityCardDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';

const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function PublicCardSharePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cardId = params.id;

  const [card, setCard] = useState<IdentityCardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    api.cards
      .get(cardId)
      .then((result) => {
        if (!active) return;
        setCard(result);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError('This Identity Card could not be found.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cardId]);

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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <p className="text-sm text-muted-foreground">Loading Identity Card...</p>
      </main>
    );
  }

  if (error || !card) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center text-foreground">
        <p className="text-lg font-semibold">Identity Card unavailable</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {error ?? 'This card link may have expired or does not exist.'}
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

  const imageSrc = card.imageUrl.startsWith('http')
    ? card.imageUrl
    : `${API_ORIGIN}${card.imageUrl}`;

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
        <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={card.metadata?.title ?? 'Parallel Identity Card'}
            className="aspect-[9/16] w-full object-cover"
          />
        </div>

        <div className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-6">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {card.metadata?.eyebrow ?? card.cardType}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {card.metadata?.title ?? 'Parallel Identity Card'}
            </h1>
            {card.metadata?.username && (
              <p className="mt-1 text-sm text-muted-foreground">
                @{card.metadata.username.replace(/^@/, '')}
              </p>
            )}
            {card.metadata?.subtitle && (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {card.metadata.subtitle}
              </p>
            )}
          </div>

          {card.metadata?.stats && card.metadata.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {card.metadata.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-border bg-background/60 p-3"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

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
                  Copy share link
                </>
              )}
            </button>

            <a
              href={imageSrc}
              download={`parallel-card-${card.id}.svg`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              Download SVG
            </a>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Curious which Parallels are hiding in your own life?
            </p>
            <button
              type="button"
              onClick={() => router.push('/signup')}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              Discover your Parallels →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
