import { ListSections } from "../../components/lists/ListControls";
import { listDateLabel } from "../../components/lists/usePagedList";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, PageHeader, Screen, sharedStyles } from "../../components/ui";
import { NavigationIcon } from "../../components/NavigationIcon";
import { colors, spacing } from "../../components/theme";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.api";
import type { NotificationItem } from "./notification.types";

type InboxProps = {
  accessToken: string;
  onBack: () => void;
  onNavigateNotification?: (notification: NotificationItem) => boolean | void;
};

export function NotificationButton({
  accessToken,
  onOpen,
  compact = false,
  inverse = false,
}: {
  accessToken: string;
  onOpen: () => void;
  compact?: boolean;
  inverse?: boolean;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getUnreadNotificationCount(accessToken)
        .then((value) => { if (active) setCount(value); })
        .catch(() => undefined);
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [accessToken]);

  return (
    <Pressable style={[styles.trigger, compact && styles.triggerCompact, inverse && styles.triggerInverse]} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Notifications${count > 0 ? `, ${count} unread` : ""}`}>
      <NavigationIcon name="bell" size={26} color={inverse ? colors.surface : colors.primary} />
      {!compact && <Text style={styles.triggerText}>Notifications</Text>}
      {count > 0 && <Text style={[styles.badge, compact && styles.compactBadge]}>{count > 99 ? "99+" : count}</Text>}
    </Pressable>
  );
}

export function NotificationInboxScreen({
  accessToken,
  onBack,
  onNavigateNotification,
}: InboxProps) {
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
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoadingMore(false);
    setLoading(true);
    setError(null);
    try {
      const [page, count] = await Promise.all([
        listNotifications(accessToken, { unreadOnly }),
        getUnreadNotificationCount(accessToken),
      ]);
      if (request !== generation.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setUnreadCount(count);
    } catch (caughtError) {
      if (request !== generation.current) return;
      setError(describeApiFailure(caughtError, "Unable to load notifications.").message);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [accessToken, unreadOnly]);

  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);

  const openItem = async (item: NotificationItem) => {
    setError(null);
    if (!item.readAt) {
      try {
        const updated = await markNotificationRead(accessToken, item.id);
        setUnreadCount((count) => Math.max(0, count - 1));
        setItems((current) => unreadOnly
          ? current.filter(({ id }) => id !== item.id)
          : current.map((entry) => entry.id === item.id ? updated : entry));
      } catch (caughtError) {
        setError(describeApiFailure(caughtError).message);
        return;
      }
    }

    if (onNavigateNotification?.(item) === true) return;
    setNotice("This update is saved, but it does not contain a safe destination available to this account.");
  };

  const markAll = async () => {
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
      setError(describeApiFailure(caughtError).message);
    } finally {
      setMutating(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore || loading) return;
    const request = generation.current;
    setLoadingMore(true);
    try {
      const page = await listNotifications(accessToken, { cursor: nextCursor, unreadOnly });
      if (request !== generation.current) return;
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      if (request !== generation.current) return;
      setError(describeApiFailure(caughtError).message);
    } finally {
      if (request === generation.current) setLoadingMore(false);
    }
  };

  return (
    <Screen onRefresh={load}>
      <PageHeader
        eyebrow="Personal inbox"
        title="Notifications"

        onBack={onBack}
        action={<Text style={styles.unread}>{unreadCount} unread</Text>}
      />
      <ListSections value={unreadOnly ? "unread" : "all"} options={[{ value: "unread", label: "Unread" }, { value: "all", label: "All" }]} onChange={value => setUnreadOnly(value === "unread")} />
      {error && <Notice tone="error" message={error} />}
      {notice && <Notice message={notice} />}
      {loading ? (
        <Notice message="Loading your notifications…" />
      ) : items.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>{unreadOnly ? "No unread notifications" : "Your inbox is clear"}</Text>

          <Button label="Refresh" variant="secondary" onPress={() => void load()} />
        </View>
      ) : items.map((item, index) => (
        <View key={item.id}>
          {(index === 0 || listDateLabel(items[index - 1]!.createdAt) !== listDateLabel(item.createdAt)) && <Text style={sharedStyles.sectionTitle}>{listDateLabel(item.createdAt)}</Text>}
        <Pressable key={item.id} onPress={() => void openItem(item)} style={[styles.card, !item.readAt && styles.unreadCard]}>
          <View style={sharedStyles.spacedRow}>
            <Text style={styles.title}>{item.title}</Text>
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
        </Pressable>
        </View>
      ))}
      {nextCursor && <Button label={loadingMore ? "Loading…" : "Load more"} disabled={loadingMore} variant="secondary" onPress={() => void loadMore()} />}
      <Button label="Mark all as read" disabled={mutating || unreadCount === 0} loading={mutating} onPress={() => void markAll()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: 14, backgroundColor: colors.surface },
  triggerCompact: { width: 46, minHeight: 46, justifyContent: "center", paddingHorizontal: 0, borderColor: colors.border, borderRadius: 12 },
  triggerText: { color: colors.primary, fontWeight: "800" },
  triggerInverse: { backgroundColor: "transparent", borderColor: "transparent" },
  compactBadge: { position: "absolute", top: -5, right: -6, borderWidth: 2, borderColor: colors.surface, minWidth: 22, paddingVertical: 2, paddingHorizontal: 4, fontSize: 10 },
  badge: { minWidth: 24, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.danger, color: colors.surface, fontSize: 11, fontWeight: "900", textAlign: "center" },
  unread: { color: colors.primary, fontWeight: "900" },
  filterLabel: { color: colors.text, fontWeight: "800" },
  card: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface },
  unreadCard: { borderLeftWidth: 5, borderLeftColor: colors.primary, backgroundColor: colors.surfaceMuted },
  title: { flex: 1, color: colors.text, fontSize: 17, fontWeight: "900" },
  newLabel: { color: colors.primary, fontSize: 10, fontWeight: "900" },
  message: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  date: { color: colors.textMuted, fontSize: 12 },
});
