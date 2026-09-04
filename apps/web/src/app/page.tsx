export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Parallel
      </span>
      <h1 className="max-w-lg text-4xl font-semibold tracking-tight text-balance">
        Find the you that hasn&apos;t shown up yet.
      </h1>
      <p className="max-w-md text-muted-foreground">
        Setup complete — the web app is talking to nothing yet on purpose. Start building
        in <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">src/features/</code>.
      </p>
    </main>
  );
}
