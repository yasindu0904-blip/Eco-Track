import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { spacing } from "../../components/theme";

type SummaryCardsProps<T> = {
  load: () => Promise<T>;
  children: (value: T) => ReactNode;
  label: string;
  compact?: boolean;
};

export function SummaryCards<T>({
  load,
  children,
  label,
  compact = false,
}: SummaryCardsProps<T>) {
  const [value, setValue] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      setValue(await load());
    } catch (reason) {
      setError(
        describeApiFailure(reason, `Unable to load ${label}.`).message,
      );
    } finally {
      setLoading(false);
    }
  }, [load, label]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <View
      style={[sharedStyles.card, compact && styles.compactCard]}
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
    >
      <View style={styles.headingRow}>
        <Text style={sharedStyles.sectionTitle}>{label}</Text>
        {compact ? (
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void refresh()}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshText}>{loading ? "Loading" : "Refresh"}</Text>
          </Pressable>
        ) : (
          <Button
            label={loading ? "Loading…" : "Refresh"}
            variant="secondary"
            disabled={loading}
            onPress={() => void refresh()}
          />
        )}
      </View>
      {error ? (
        <Notice
          tone="error"
          message={`Some summary data is unavailable: ${error}`}
        />
      ) : null}
      {value !== undefined
        ? children(value)
        : !loading && <Text>No summary data is available yet.</Text>}
    </View>
  );
}

export const total = (states: Record<string, number>) =>
  Object.values(states).reduce((sum, value) => sum + value, 0);

export const Metric = ({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) => (
  <View style={[styles.metric, compact && styles.metricCompact]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  compactCard: { gap: spacing.sm, padding: spacing.md },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  refreshButton: { paddingHorizontal: 8, paddingVertical: 5 },
  refreshText: { color: "#176B2A", fontSize: 12, fontWeight: "800" },
  metric: { paddingVertical: spacing.sm },
  metricCompact: { width: "50%", paddingHorizontal: 5 },
  label: { fontSize: 12, fontWeight: "800", color: "#53645d" },
  value: { fontSize: 25, fontWeight: "900", color: "#173b2c" },
});
