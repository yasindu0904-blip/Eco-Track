import { useCallback, useEffect, useState } from "react";
import { AppState, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { BrandHeader, Button, Notice, Screen, sharedStyles } from "../../components/ui";
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
  onOpenOrganizationApplications?: () => void;
};

export function NotificationButton({
  accessToken,
  onOpen,
}: {
  accessToken: string;
  onOpen: () => void;
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
    <Pressable style={styles.trigger} onPress={onOpen} accessibilityRole="button">
      <Text style={styles.triggerText}>🔔 Notifications</Text>
      {count > 0 && <Text style={styles.badge}>{count > 99 ? "99+" : count}</Text>}
    </Pressable>
  );
}

export function NotificationInboxScreen({
  accessToken,
  onBack,
  onOpenOrganizationApplications,
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, count] = await Promise.all([
        listNotifications(accessToken, { unreadOnly }),
        getUnreadNotificationCount(accessToken),
      ]);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setUnreadCount(count);
    } catch (caughtError) {
      setError(describeApiFailure(caughtError, "Unable to load notifications.").message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, unreadOnly]);

  useEffect(() => { void load(); }, [load]);

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

    if (item.type === "ORGANIZATION_REVIEW_UPDATED" && onOpenOrganizationApplications) {
      onOpenOrganizationApplications();
    } else {
      setNotice("This update is saved. Its linked screen will open when that feature is available.");
    }
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
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await listNotifications(accessToken, { cursor: nextCursor, unreadOnly });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(describeApiFailure(caughtError).message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Screen>
      <BrandHeader eyebrow="Personal inbox" title="Notifications" compact />
      <View style={sharedStyles.spacedRow}>
        <Button label="Back" variant="secondary" onPress={onBack} />
        <Text style={styles.unread}>{unreadCount} unread</Text>
      </View>
      <View style={[sharedStyles.card, sharedStyles.spacedRow]}>
        <Text style={styles.filterLabel}>Unread only</Text>
        <Switch value={unreadOnly} onValueChange={setUnreadOnly} trackColor={{ true: colors.primary }} />
      </View>
      {error && <Notice tone="error" message={error} />}
      {notice && <Notice message={notice} />}
      {loading ? (
        <Notice message="Loading your notifications…" />
      ) : items.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>{unreadOnly ? "No unread notifications" : "Your inbox is clear"}</Text>
          <Text style={sharedStyles.sectionSubtitle}>New EcoTrack updates will appear here.</Text>
          <Button label="Refresh" variant="secondary" onPress={() => void load()} />
        </View>
      ) : items.map((item) => (
        <Pressable key={item.id} onPress={() => void openItem(item)} style={[styles.card, !item.readAt && styles.unreadCard]}>
          <View style={sharedStyles.spacedRow}>
            <Text style={styles.title}>{item.title}</Text>
            {!item.readAt && <Text style={styles.newLabel}>NEW</Text>}
          </View>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
        </Pressable>
      ))}
      {nextCursor && <Button label={loadingMore ? "Loading…" : "Load more"} disabled={loadingMore} variant="secondary" onPress={() => void loadMore()} />}
      <Button label="Mark all as read" disabled={mutating || unreadCount === 0} loading={mutating} onPress={() => void markAll()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  trigger: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: 14, backgroundColor: colors.surface },
  triggerText: { color: colors.primary, fontWeight: "800" },
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
