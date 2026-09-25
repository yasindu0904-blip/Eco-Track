import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export function ListSections<T extends string>({ value, options, onChange }: { value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <ScrollView style={styles.tabStrip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{options.map(option => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)} style={[styles.tab, value === option.value && styles.selected]}><Text style={styles.label}>{option.label}</Text></Pressable>)}</ScrollView>;
}
export function PageControls({ hasNext, busy, next, refresh }: { hasNext: boolean; busy: boolean; next: () => void; refresh?: () => void }) {
  return <View style={styles.controls}>{hasNext && <Pressable accessibilityRole="button" accessibilityLabel="Load more" disabled={busy} onPress={next} style={styles.control}><Text style={styles.label}>{busy ? "Loading…" : "Load more"}</Text></Pressable>}{refresh && <Pressable accessibilityRole="button" accessibilityLabel="Refresh" disabled={busy} onPress={refresh} style={styles.control}><Text style={styles.label}>Refresh</Text></Pressable>}</View>;
}
export function ListWindow<T>({ items, children, hasMore = false, loadMore, busy = false }: { items: T[]; children: (items: T[]) => ReactNode; hasMore?: boolean; loadMore?: () => void; busy?: boolean }) {
  const [limit, setLimit] = useState(20);
  return <>{children(items.slice(0, limit))}<PageControls hasNext={limit < items.length || hasMore} busy={busy} next={() => { setLimit(limit + 20); if (limit >= items.length) loadMore?.(); }} /></>;
}
const styles = StyleSheet.create({
  tabStrip: { flexGrow: 0 },
  tabs: { gap: 8, borderBottomWidth: 1, borderBottomColor: "#DCE4DC" },
  tab: { padding: 12, borderBottomWidth: 3, borderBottomColor: "transparent" },
  selected: { borderBottomColor: "#195F38" },
  label: { color: "#195F38", fontWeight: "700", fontSize: 14 },
  controls: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  control: { padding: 12, minHeight: 44 },
});
