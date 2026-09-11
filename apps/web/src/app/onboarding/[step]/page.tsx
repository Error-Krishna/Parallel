'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

export default function OnboardingStepPage() {
  const params = useParams<{ step: string }>();
  const router = useRouter();

  const step = Number(params.step);

  const [questions, setQuestions] = useState<
    Awaited<ReturnType<typeof api.onboarding.getQuestions>>
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuestions() {
      try {
        const data = await api.onboarding.getQuestions();
        setQuestions(data);
      } catch {
        setError('Could not load your questions. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadQuestions();
  }, []);

  const question = useMemo(() => questions[step - 1], [questions, step]);

  async function handleContinue() {
    if (!question || !selected || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.onboarding.submitAnswer({
        questionKey: question.key,
        answerValue: selected,
      });

      if (step < questions.length) {
        router.push(`/onboarding/${step + 1}`);
      } else {
        router.push('/onboarding/reveal');
      }
    } catch {
      setError('Could not save your answer. Please try again.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (error && !question) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!question) {
    return null;
  }

  const progress = (step / questions.length) * 100;

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--parallel-builder)]" />
            <span className="font-mono text-sm font-medium tracking-tight">
              PARALLEL
            </span>
          </div>

          <span className="font-mono text-xs text-muted-foreground">
            {step} / {questions.length}
          </span>
        </header>

        <div className="mt-6 h-1 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-[var(--parallel-builder)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>

        <section className="flex flex-1 flex-col justify-center py-16">
          <motion.div
            key={question.key}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              A little signal
            </p>

            <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              {question.question}
            </h1>

            <div className="mt-10 grid gap-3">
              {question.options.map((option) => {
                const isSelected = selected === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelected(option.value)}
                    className={[
                      'group rounded-2xl border p-5 text-left transition-all',
                      'hover:-translate-y-0.5 hover:border-foreground/30',
                      isSelected
                        ? 'border-[var(--parallel-builder)] bg-[var(--parallel-builder)]/10'
                        : 'border-border bg-card',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">{option.label}</span>

                      <span
                        className={[
                          'flex size-5 items-center justify-center rounded-full border transition',
                          isSelected
                            ? 'border-[var(--parallel-builder)] bg-[var(--parallel-builder)]'
                            : 'border-muted-foreground/40',
                        ].join(' ')}
                      >
                        {isSelected && (
                          <span className="size-2 rounded-full bg-background" />
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            )}

            <Button
              size="lg"
              className="mt-8 w-full sm:w-auto"
              disabled={!selected || submitting}
              onClick={handleContinue}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight />
                </>
              )}
            </Button>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
