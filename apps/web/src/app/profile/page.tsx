'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import type { PublicUser, UserVisibleParallelDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [parallels, setParallels] = useState<UserVisibleParallelDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const currentUser = await api.users.getMe();

        if (cancelled) return;

        setUser(currentUser);
        setUsername(currentUser.username);
        setBio(currentUser.bio ?? '');

        const userParallels = await api.users.getUserParallels(currentUser.id);

        if (!cancelled) {
          setParallels(userParallels);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load your profile.',
          );
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Profile unavailable.</h1>
          <p className="mt-3 text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="font-mono text-sm text-muted-foreground">
          Loading profile...
        </p>
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

        <section className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Profile
          </p>

          <div className="mt-6 flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-2xl font-semibold">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`@${user.username}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                user.username.charAt(0).toUpperCase()
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                @{user.username}
              </h1>

              {user.bio && (
                <p className="mt-3 leading-7 text-muted-foreground">
                  {user.bio}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-10 max-w-2xl">
          {!editing ? (
            <Button
              variant="outline"
              onClick={() => {
                setUsername(user.username);
                setBio(user.bio ?? '');
                setSaveError(null);
                setEditing(true);
              }}
            >
              <Pencil />
              Edit Profile
            </Button>
          ) : (
            <div className="rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold">Edit Profile</h2>

              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    maxLength={30}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    maxLength={280}
                    rows={4}
                    className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>

                {saveError && (
                  <p className="text-sm text-destructive">{saveError}</p>
                )}

                <div className="flex gap-3">
                  <Button
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      setSaveError(null);

                      try {
                        const updated = await api.users.updateMe({
                          username: username.trim(),
                          bio,
                        });

                        setUser(updated);
                        setUsername(updated.username);
                        setBio(updated.bio ?? '');
                        setEditing(false);
                      } catch (err) {
                        setSaveError(
                          err instanceof Error
                            ? err.message
                            : 'Could not update your profile.',
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </Button>

                  <Button
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mt-12 max-w-2xl">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Identity evolution
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  See how your sides are changing.
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Track how your Parallel strengths evolve as you explore,
                  interact, and discover new sides of yourself.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => router.push('/map')}
              >
                View evolution
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Your parallels
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {parallels.map((parallel) => (
              <div
                key={parallel.id}
                className="rounded-2xl border border-border p-5"
              >
                <h2 className="font-semibold">
                  {parallel.parallelType.name}
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  {parallel.parallelType.description}
                </p>

                <p className="mt-4 font-mono text-xs text-muted-foreground">
                  {parallel.strengthPct.toFixed(1)}% strength
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
