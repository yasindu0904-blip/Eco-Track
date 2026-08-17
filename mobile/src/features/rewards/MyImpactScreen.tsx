import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import {
  BrandHeader,
  Button,
  Notice,
  Screen,
  sharedStyles,
} from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  getMyImpactSummary,
  listMyContributions,
} from "./reward.api";
import type {
  Contribution,
  ImpactSummary,
} from "./reward.types";

type MyImpactScreenProps = {
  accessToken: string;
  onBack: () => void;
};

export function MyImpactScreen({
  accessToken,
  onBack,
}: MyImpactScreenProps) {
  const [summary, setSummary] = useState<ImpactSummary | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, page] = await Promise.all([
        getMyImpactSummary(accessToken),
        listMyContributions(accessToken),
      ]);
      setSummary(nextSummary);
      setContributions(page.items);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(describeApiFailure(
        caughtError,
        "EcoTrack could not load your impact right now.",
      ).message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listMyContributions(accessToken, nextCursor);
      setContributions((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(describeApiFailure(caughtError).message);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Screen>
      <BrandHeader
        eyebrow="Citizen & volunteer"
        title="My Impact"
        subtitle="Verified community action and non-monetary achievements"
        compact
      />
      <Button label="Back to dashboard" variant="secondary" onPress={onBack} />

      {error ? (
        <>
          <Notice tone="error" message={error} />
          <Button label="Try again" variant="secondary" onPress={() => void load()} />
        </>
      ) : null}

      {loading ? (
        <Notice message="Loading your verified impact…" />
      ) : summary ? (
        <>
          <View style={styles.pointsCard}>
            <Text style={styles.pointsEyebrow}>VERIFIED CONTRIBUTION POINTS</Text>
            <Text style={styles.pointsValue}>{summary.totalPoints}</Text>
            <Text style={styles.pointsNote}>
              Recognition only—points are not money, employment, or access permissions.
            </Text>
          </View>

          <View style={styles.breakdownGrid}>
            {summary.breakdown.map((item) => (
              <View key={item.type} style={styles.breakdownCard}>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownPoints}>{item.points} pts</Text>
                <Text style={styles.breakdownCount}>
                  {item.count} verified {item.count === 1 ? "action" : "actions"}
                </Text>
              </View>
            ))}
          </View>

          <View style={sharedStyles.card}>
            <View style={sharedStyles.spacedRow}>
              <Text style={sharedStyles.sectionTitle}>Achievements</Text>
              <Text style={styles.countLabel}>{summary.achievements.length} earned</Text>
            </View>
            {summary.achievements.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Your first achievement is ahead</Text>
                <Text style={sharedStyles.sectionSubtitle}>
                  Verified reports and confirmed cleanup participation will build your impact.
                </Text>
              </View>
            ) : summary.achievements.map((achievement) => (
              <View key={achievement.id} style={styles.achievementCard}>
                <Text style={styles.star}>★</Text>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>{achievement.name}</Text>
                  <Text style={styles.itemDescription}>{achievement.description}</Text>
                  <Text style={styles.itemDate}>
                    Earned {new Date(achievement.awardedAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={sharedStyles.card}>
            <View style={sharedStyles.spacedRow}>
              <Text style={sharedStyles.sectionTitle}>Contribution history</Text>
              <Text style={styles.countLabel}>{summary.contributionCount} records</Text>
            </View>
            {contributions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No verified contributions yet</Text>
                <Text style={sharedStyles.sectionSubtitle}>
                  Submitting or joining alone does not award points. Rewards begin after verified action.
                </Text>
              </View>
            ) : contributions.map((contribution) => (
              <View key={contribution.id} style={styles.historyCard}>
                <Text style={styles.historyPoints}>+{contribution.points}</Text>
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>{contribution.label}</Text>
                  <Text style={styles.itemDescription}>{contribution.reason}</Text>
                  <Text style={styles.itemDate}>
                    {new Date(contribution.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
            {nextCursor ? (
              <Button
                label={loadingMore ? "Loading…" : "Load more history"}
                loading={loadingMore}
                variant="secondary"
                onPress={() => void loadMore()}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pointsCard: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: 22,
    backgroundColor: colors.primaryDark,
  },
  pointsEyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  pointsValue: { color: colors.surface, fontSize: 58, lineHeight: 64, fontWeight: "900" },
  pointsNote: { color: "#c4d9c8", fontSize: 13, lineHeight: 19 },
  breakdownGrid: { gap: spacing.sm },
  breakdownCard: { padding: spacing.md, gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface },
  breakdownLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  breakdownPoints: { color: colors.primaryDark, fontSize: 22, fontWeight: "900" },
  breakdownCount: { color: colors.textMuted, fontSize: 12 },
  countLabel: { color: colors.primary, fontSize: 12, fontWeight: "900" },
  emptyState: { padding: spacing.md, gap: spacing.xs, borderRadius: 14, backgroundColor: colors.surfaceMuted },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  achievementCard: { flexDirection: "row", gap: spacing.md, padding: spacing.md, borderRadius: 15, backgroundColor: colors.surfaceMuted },
  star: { width: 42, height: 42, paddingTop: 8, color: colors.primary, borderRadius: 13, backgroundColor: "#d7f1bd", textAlign: "center", fontSize: 20, fontWeight: "900" },
  historyCard: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyPoints: { minWidth: 54, height: 44, paddingTop: 12, color: colors.primary, borderRadius: 12, backgroundColor: colors.primarySoft, textAlign: "center", fontWeight: "900" },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  itemDescription: { marginTop: 4, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  itemDate: { marginTop: 5, color: colors.textMuted, fontSize: 11 },
});
