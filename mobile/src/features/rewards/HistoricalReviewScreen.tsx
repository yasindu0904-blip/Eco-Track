import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { BrandHeader, Button, Notice, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { listMyCompletedCleanupEvents } from "./reward.api";
import type { CompletedCleanupEvent } from "./reward.types";

type Props = { accessToken: string; onBack: () => void };

export function HistoricalReviewScreen({ accessToken, onBack }: Props) {
  const [events, setEvents] = useState<CompletedCleanupEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listMyCompletedCleanupEvents(accessToken);
      setEvents(page.items);
      setTotalCount(page.totalCount);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(describeApiFailure(caughtError, "EcoTrack could not load your historical review.").message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timeoutId = setTimeout(() => void load(), 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listMyCompletedCleanupEvents(accessToken, nextCursor);
      setEvents((current) => [...current, ...page.items]);
      setTotalCount(page.totalCount);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(describeApiFailure(caughtError).message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Screen>
      <BrandHeader eyebrow="Citizen & volunteer" title="Historical review" subtitle="Verified successfully concluded cleanup events" compact />
      <Button label="Back to dashboard" variant="secondary" onPress={onBack} />
      {error ? <><Notice tone="error" message={error} /><Button label="Try again" variant="secondary" onPress={() => void load()} /></> : null}
      {loading ? <Notice message="Loading historical reviewâ€¦" /> : (
        <>
          <View style={styles.totalCard}>
            <Text style={styles.eyebrow}>SUCCESSFULLY CONCLUDED</Text>
            <Text style={styles.total}>{totalCount}</Text>
            <Text style={styles.note}>Only completed cleanup events backed by verified participation are included.</Text>
          </View>
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.sectionTitle}>Cleanup event names</Text>
            {events.length === 0 ? (
              <Text style={sharedStyles.sectionSubtitle}>No successfully concluded events yet.</Text>
            ) : events.map((event) => (
              <View key={event.contributionId} style={styles.eventRow}>
                <Text style={styles.check}>âœ“</Text>
                <View style={styles.flex}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.date}>Completed {new Date(event.completedAt).toLocaleDateString()}</Text>
                </View>
              </View>
            ))}
            {nextCursor ? <Button label={loadingMore ? "Loadingâ€¦" : "Load more events"} loading={loadingMore} variant="secondary" onPress={() => void loadMore()} /> : null}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  totalCard: { padding: spacing.lg, gap: spacing.xs, borderRadius: 22, backgroundColor: colors.primaryDark },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  total: { color: colors.surface, fontSize: 58, lineHeight: 64, fontWeight: "900" },
  note: { color: "#c4d9c8", fontSize: 13, lineHeight: 19 },
  eventRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  check: { width: 42, height: 42, paddingTop: 9, color: colors.primary, borderRadius: 13, backgroundColor: colors.primarySoft, textAlign: "center", fontWeight: "900" },
  eventTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  date: { marginTop: 5, color: colors.textMuted, fontSize: 11 },
});
