import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { spacing } from "../../components/theme";

type SummaryCardsProps<T> = {
  load: () => Promise<T>;
  children: (value: T) => ReactNode;
  label: string;
};

export function SummaryCards<T>({
  load,
  children,
  label,
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
      style={sharedStyles.card}
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
    >
      <Text style={sharedStyles.sectionTitle}>{label}</Text>
      <Button
        label={loading ? "Loading…" : "Refresh"}
        variant="secondary"
        disabled={loading}
        onPress={() => void refresh()}
      />
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
}: {
  label: string;
  value: number | string;
}) => (
  <View style={styles.metric}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  metric: { paddingVertical: spacing.sm },
  label: { fontSize: 12, fontWeight: "800", color: "#53645d" },
  value: { fontSize: 25, fontWeight: "900", color: "#173b2c" },
});
