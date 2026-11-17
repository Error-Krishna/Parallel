'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, LogOut, Pencil, Shield, Sparkles, Trash2 } from 'lucide-react';
import type { PublicUser, UserParallelDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/features/auth/auth-store';
import { MyParallelsManager } from '@/features/parallels/my-parallels-manager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ProfilePage() {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [parallels, setParallels] = useState<UserParallelDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [profileVisibility, setProfileVisibility] = useState<
    'public' | 'friends' | 'private'
  >('public');
  const [showActivityStatus, setShowActivityStatus] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const [exporting, setExporting] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [generatingWrapped, setGeneratingWrapped] = useState(false);
  const [wrappedError, setWrappedError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const [currentUser, manageableParallels] = await Promise.all([
          api.users.getMe(),
          api.parallels.listManageable(),
        ]);

        if (cancelled) return;

        setUser(currentUser);
        setUsername(currentUser.username);
        setBio(currentUser.bio ?? '');
        setParallels(manageableParallels);
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

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.auth.logout();
    } catch {
      // Clear local session even if token was already expired/revoked.
    } finally {
      clearAuth();
      router.replace('/');
    }
  }

  async function handleSavePrivacy() {
    if (savingPrivacy) return;
    setSavingPrivacy(true);
    setPrivacyStatus(null);
    setPrivacyError(null);

    try {
      await api.users.updateMe({
        visibilitySettings: {
          profileVisibility,
          showActivityStatus,
        },
      });
      setPrivacyStatus('Privacy preferences saved.');
    } catch (err) {
      setPrivacyError(
        err instanceof Error
          ? err.message
          : 'Could not update your privacy settings.',
      );
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function handleExportData() {
    if (exporting) return;
    setExporting(true);
    setPrivacyError(null);
    setPrivacyStatus(null);

    try {
      const exported = await api.users.exportData();
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `parallel-data-${user?.username ?? 'export'}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPrivacyStatus('Your data export has downloaded.');
    } catch (err) {
      setPrivacyError(
        err instanceof Error ? err.message : 'Could not export your data.',
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleting || deleteConfirmText.trim() !== 'DELETE') return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await api.users.deleteMe();
      clearAuth();
      router.replace('/');
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Could not delete your account right now.',
      );
      setDeleting(false);
    }
  }

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
        <div className="mb-10 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push('/map')}
            className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to map
          </button>

          <Button
            type="button"
            variant="outline"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? 'Logging out...' : 'Log out'}
          </Button>
        </div>

        <section className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Profile
          </p>

          <div className="mt-6 flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-2xl font-semibold">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
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
                  <p role="alert" className="text-sm text-destructive">
                    {saveError}
                  </p>
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

        <section className="mt-14 max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            My parallels
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Control what’s public, hidden, or removed.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ghost Parallels stay private until you publish them. Hidden Parallels
            leave your map reversibly; removing a Parallel tells Parallel not to
            suggest it again.
          </p>

          <MyParallelsManager parallels={parallels} onChange={setParallels} />
        </section>

        <section className="mt-14 max-w-2xl">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Parallel Wrapped
              </p>
            </div>
            <h2 className="mt-2 text-lg font-semibold">
              See how your Parallels evolved.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate a shareable story recap from your public Parallels,
              streaks, and curiosity moments. Private Ghost Parallels are never
              included.
            </p>
            {wrappedError && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {wrappedError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                disabled={generatingWrapped}
                onClick={async () => {
                  setGeneratingWrapped(true);
                  setWrappedError(null);
                  try {
                    const recap = await api.wrapped.generate('MONTHLY');
                    router.push(`/wrapped/${recap.id}`);
                  } catch {
                    setWrappedError(
                      'Could not generate your Parallel Wrapped right now.',
                    );
                  } finally {
                    setGeneratingWrapped(false);
                  }
                }}
              >
                <Sparkles />
                {generatingWrapped ? 'Generating...' : 'Generate Monthly Wrapped'}
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-14 max-w-2xl">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Privacy &amp; Data
              </p>
            </div>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-visibility">Profile visibility</Label>
                <select
                  id="profile-visibility"
                  value={profileVisibility}
                  onChange={(e) =>
                    setProfileVisibility(
                      e.target.value as 'public' | 'friends' | 'private',
                    )
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="public">Public — anyone can see your published Parallels</option>
                  <option value="friends">Friends — people you connect with</option>
                  <option value="private">Private — only visible to you</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={showActivityStatus}
                  onChange={(e) => setShowActivityStatus(e.target.checked)}
                />
                <span>Show activity status</span>
              </label>

              {privacyStatus && (
                <p role="status" className="text-sm text-emerald-400">
                  {privacyStatus}
                </p>
              )}

              {privacyError && (
                <p role="alert" className="text-sm text-destructive">
                  {privacyError}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingPrivacy}
                  onClick={() => void handleSavePrivacy()}
                >
                  {savingPrivacy ? 'Saving...' : 'Save privacy settings'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={exporting}
                  onClick={() => void handleExportData()}
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Exporting...' : 'Export my data (JSON)'}
                </Button>
              </div>

              <div className="border-t border-border pt-5">
                {!showDeleteConfirm ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setDeleteConfirmText('');
                      setDeleteError(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete my account
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                    <p className="text-sm font-medium text-destructive">
                      Delete account permanently
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This irreversibly deletes your account, Parallels, signals,
                      and sessions immediately. Type <strong>DELETE</strong> to
                      confirm.
                    </p>
                    <Input
                      aria-label="Type DELETE to confirm account deletion"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                    />
                    {deleteError && (
                      <p role="alert" className="text-xs text-destructive">
                        {deleteError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={
                          deleting || deleteConfirmText.trim() !== 'DELETE'
                        }
                        onClick={() => void handleDeleteAccount()}
                      >
                        {deleting ? 'Deleting...' : 'Permanently delete'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={deleting}
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
