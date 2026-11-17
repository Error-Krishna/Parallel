'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck } from 'lucide-react';
import type { NotificationDto } from '@parallel/shared-types';
import { api } from '@/lib/api-client';

function formatNotificationCopy(notification: NotificationDto): {
  title: string;
  subtitle: string;
  href: string | null;
} {
  const payload = notification.payload ?? {};

  switch (notification.type) {
    case 'NEW_FOLLOWER': {
      const username =
        typeof payload.followerUsername === 'string' && payload.followerUsername
          ? `@${payload.followerUsername}`
          : 'Someone';
      return {
        title: `${username} started following you`,
        subtitle: 'Check out their public Parallels.',
        href:
          typeof payload.followerUsername === 'string' && payload.followerUsername
            ? `/u/${payload.followerUsername}`
            : null,
      };
    }
    case 'TWIN_MATCHED': {
      const username =
        typeof payload.otherUsername === 'string' && payload.otherUsername
          ? `@${payload.otherUsername}`
          : 'a new Parallel Twin';
      const score =
        typeof payload.similarityScore === 'number'
          ? ` (${Math.round(payload.similarityScore)}% overlap)`
          : '';
      return {
        title: `You matched with ${username}${score}`,
        subtitle: 'You share a rare combination of Parallels.',
        href:
          typeof payload.twinId === 'string' && payload.twinId
            ? `/twins/${payload.twinId}`
            : null,
      };
    }
    case 'QUEST_COMPLETED': {
      const questTitle =
        typeof payload.questTitle === 'string' && payload.questTitle
          ? payload.questTitle
          : 'a Quest';
      const rewardValue =
        typeof payload.rewardValue === 'string' && payload.rewardValue
          ? `Unlocked: ${payload.rewardValue}`
          : 'Quest reward unlocked!';
      return {
        title: `Completed "${questTitle}"`,
        subtitle: rewardValue,
        href:
          typeof payload.parallelTypeId === 'string' && payload.parallelTypeId
            ? `/parallel/${payload.parallelTypeId}`
            : null,
      };
    }
    case 'WRAPPED_READY': {
      return {
        title: 'Your Parallel Wrapped is ready',
        subtitle: 'See how your Parallels evolved.',
        href:
          typeof payload.wrappedId === 'string' && payload.wrappedId
            ? `/wrapped/${payload.wrappedId}`
            : null,
      };
    }
    default: {
      return {
        title: notification.type.replaceAll('_', ' ').toLowerCase(),
        subtitle: 'New activity in your Parallel universe.',
        href: null,
      };
    }
  }
}

export function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!api.notifications?.list) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.notifications.list({ limit: 20 });
      setItems(response.items);
      setUnreadCount(response.unreadCount);
    } catch {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!api.notifications?.list) return;
    let active = true;

    api.notifications
      .list({ limit: 20 })
      .then((response) => {
        if (!active) return;
        setItems(response.items);
        setUnreadCount(response.unreadCount);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load notifications.');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  function handleToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      void loadNotifications();
    }
  }

  async function handleMarkRead(notification: NotificationDto) {
    if (notification.readAt || busyId === notification.id) {
      return;
    }

    setBusyId(notification.id);
    try {
      await api.notifications.markRead(notification.id);
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt } : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setError('Could not mark notification as read.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead();
      const readAt = new Date().toISOString();
      setItems((current) =>
        current.map((item) => (item.readAt ? item : { ...item, readAt })),
      );
      setUnreadCount(0);
    } catch {
      setError('Could not mark all notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-full border border-border p-2.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        aria-expanded={open}
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Notification center"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-xl sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Notifications</h2>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void handleMarkAllRead()}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {error && (
              <div className="px-4 py-3 text-xs text-destructive">{error}</div>
            )}

            {loading && items.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                Loading notifications...
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No notifications yet. As you explore Parallels, complete Quests,
                and meet Twins, updates will land here.
              </div>
            ) : (
              items.map((item) => {
                const { title, subtitle, href } = formatNotificationCopy(item);
                const isUnread = item.readAt === null;

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 px-4 py-3 text-left transition ${
                      isUnread ? 'bg-primary/5' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void handleMarkRead(item);
                        if (href) {
                          setOpen(false);
                          router.push(href);
                        }
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <p className="text-sm font-medium text-foreground">
                          {title}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {subtitle}
                      </p>
                    </button>

                    {isUnread && (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleMarkRead(item)}
                        className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
                        aria-label="Mark notification as read"
                        title="Mark read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
