'use client';

import { useParams } from 'next/navigation';

export default function ParallelPage() {
  const params = useParams<{ parallelId: string }>();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Parallel
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          You entered a Parallel
        </h1>

        <p className="mt-3 font-mono text-sm text-muted-foreground">
          {params.parallelId}
        </p>
      </div>
    </main>
  );
}
