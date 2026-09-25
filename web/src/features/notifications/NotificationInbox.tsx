import { listDateLabel } from "../../components/lists/usePagedList";
import { ListWindow, ListSections } from "../../components/lists/ListControls";
import { useCallback, useEffect, useRef, useState } from "react";

import { describeApiFailure } from "../../api/apiError";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.api";
import type { NotificationItem } from "./notification.types";
import "./notificationInbox.css";

type NotificationInboxProps = {
  accessToken: string;
  onBack: () => void;
  onNavigateNotification?: (notification: NotificationItem) => boolean | void;
};

type NotificationButtonProps = {
  accessToken?: string;
  onOpen: () => void;
};

function readableError(error: unknown): string {
  return describeApiFailure(
    error,
    "Unable to load your notifications.",
  ).message;
}

export function NotificationButton({
  accessToken,
  onOpen,
}: NotificationButtonProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;

    let active = true;
    const refresh = () => {
      void getUnreadNotificationCount(accessToken)
        .then((count) => {
          if (active) setUnreadCount(count);
        })
        .catch(() => undefined);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [accessToken]);

  if (!accessToken) return null;

  return (
    <button className="notification-trigger" type="button" onClick={onOpen}>
      <span aria-hidden="true">🔔</span>
      Notifications
      {unreadCount > 0 && (
        <span className="notification-count" aria-label={`${unreadCount} unread notifications`}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}

export function NotificationInbox({ accessToken, onNavigateNotification }: NotificationInboxProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const generation = useRef(0);
  const load = useCallback((): void => {
    const request = ++generation.current;
    setLoading(true); setLoadingMore(false);
    void Promise.all([
      listNotifications(accessToken, { unreadOnly }),
      getUnreadNotificationCount(accessToken),
    ])
      .then(([page, count]) => {
        if (request !== generation.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setUnreadCount(count);
      })
      .catch((caughtError: unknown) => {
        if (request !== generation.current) return;
        setError(readableError(caughtError));
      })
      .finally(() => {
        if (request !== generation.current) return;
        setLoading(false);
      });
  }, [accessToken, unreadOnly]);

  function changeUnreadFilter(checked: boolean): void {
    setLoading(true);
    setError(null);
    setNotice(null);
    setUnreadOnly(checked);
  }

  function retryLoad(): void {
    setLoading(true);
    setError(null);
    load();
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => { window.clearTimeout(timer); generation.current += 1; };
  }, [load]);

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    const request = generation.current;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listNotifications(accessToken, {
        cursor: nextCursor,
        unreadOnly,
      });
      if (request !== generation.current) return;
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      if (request !== generation.current) return;
      setError(readableError(caughtError));
    } finally {
      if (request === generation.current) setLoadingMore(false);
    }
  }

  async function openNotification(item: NotificationItem): Promise<void> {
    let openedItem = item;
    setError(null);
    if (!item.readAt) {
      try {
        openedItem = await markNotificationRead(accessToken, item.id);
        setUnreadCount((count) => Math.max(0, count - 1));
        setItems((current) => unreadOnly
          ? current.filter(({ id }) => id !== item.id)
          : current.map((entry) => entry.id === item.id ? openedItem : entry));
      } catch (caughtError) {
        setError(readableError(caughtError));
        return;
      }
    }

    if (onNavigateNotification?.(openedItem) === true) {
      return;
    }

    setNotice("This notification is saved, but it does not contain a safe destination available to this account.");
  }

  async function markAll(): Promise<void> {
    if (mutating || unreadCount === 0) return;
    setMutating(true);
    setError(null);
    try {
      const result = await markAllNotificationsRead(accessToken);
      setUnreadCount(0);
      setItems((current) => unreadOnly
        ? []
        : current.map((item) => item.readAt ? item : { ...item, readAt: result.readAt }));
      setNotice("All notifications are marked as read.");
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setMutating(false);
    }
  }

  return (
    <main className="notification-page">
      <header className="notification-header">

        <div>
          <span>Personal inbox</span>
          <h1>Notifications</h1>

        </div>
        <strong>{unreadCount} unread</strong>
      </header>

      <section className="notification-toolbar">
        <ListSections value={unreadOnly ? "unread" : "all"} options={[{ value: "unread", label: "Unread" }, { value: "all", label: "All" }]} onChange={value => changeUnreadFilter(value === "unread")} />
        <button type="button" disabled={mutating || unreadCount === 0} onClick={() => void markAll()}>
          {mutating ? "Updating…" : "Mark all as read"}
        </button>
      </section>

      {error && <p className="notification-message notification-error" role="alert">{error}</p>}
      {notice && <p className="notification-message">{notice}</p>}

      {loading ? (
        <section className="notification-empty">Loading your notifications…</section>
      ) : items.length === 0 ? (
        <section className="notification-empty">
          <strong>{unreadOnly ? "No unread notifications" : "Your inbox is clear"}</strong>

          {error && <button className="notification-retry" type="button" onClick={retryLoad}>Try again</button>}
        </section>
      ) : (
        <section className="notification-list" aria-live="polite">
          {<ListWindow items={items} key={String(unreadOnly)} hasMore={Boolean(nextCursor)} busy={loadingMore} loadMore={() => void loadMore()}>{visible => visible.map((item, index) => (
            <div key={item.id}>
              {(index === 0 || listDateLabel(visible[index - 1]!.createdAt) !== listDateLabel(item.createdAt)) && <h2 className="list-date-heading">{listDateLabel(item.createdAt)}</h2>}
            <button
              className={`notification-card ${item.readAt ? "notification-card-read" : "notification-card-unread"}`}
              type="button"
              key={item.id}
              onClick={() => void openNotification(item)}
            >
              <span className="notification-card-icon" aria-hidden="true">{item.readAt ? "✓" : "●"}</span>
              <span className="notification-card-copy">
                <strong>{item.title}</strong>
                <span>{item.message}</span>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </span>
            </button>
            </div>
          ))}</ListWindow>}
        </section>
      )}


    </main>
  );
}
