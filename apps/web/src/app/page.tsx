'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Compass, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const signals = [
  { icon: Compass, label: 'Explore', color: 'text-parallel-explorer' },
  { icon: Sparkles, label: 'Discover', color: 'text-parallel-music-head' },
  { icon: Users, label: 'Meet', color: 'text-parallel-builder' },
];

export default function Home() {
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-[15%] top-[25%] h-32 w-32 rounded-full bg-parallel-explorer/10 blur-3xl" />
        <div className="absolute bottom-[15%] right-[15%] h-40 w-40 rounded-full bg-parallel-music-head/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur"
        >
          <span className="h-2 w-2 rounded-full bg-parallel-gamer" />
          There&apos;s more than one version of you.
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-3xl text-balance text-5xl font-semibold tracking-tight sm:text-6xl"
        >
          Find the you that hasn&apos;t shown up yet.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl"
        >
          Parallel helps you discover different sides of yourself through interests,
          people, experiences, and the worlds you could step into.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-9 flex flex-col gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="h-12 rounded-full px-7 text-base">
            <Link href="/signup">
              Get started
              <ArrowRight />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 rounded-full px-7 text-base"
          >
            <Link href="/login">Log in</Link>
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 grid grid-cols-3 gap-3 sm:gap-6"
        >
          {signals.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex min-w-24 flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/50 px-5 py-4 backdrop-blur"
            >
              <Icon className={`size-5 ${color}`} />
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}
