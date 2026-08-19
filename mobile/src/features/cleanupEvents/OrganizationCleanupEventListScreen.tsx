import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { listOwnedCleanupEvents } from "./cleanupEvent.api";
import type { CleanupEventOwnedSummary } from "./cleanupEvent.types";

export function OrganizationCleanupEventListScreen({ accessToken, organizationId }: { accessToken: string; organizationId: string }) {
  const [items, setItems] = useState<CleanupEventOwnedSummary[]>([]); const [nextCursor, setNextCursor] = useState<string | null>(null); const [busy, setBusy] = useState(true); const [error, setError] = useState<string>();
  const load = useCallback(async (cursor?: string) => { setBusy(true); setError(undefined); try { const page = await listOwnedCleanupEvents(accessToken, organizationId, cursor); setItems((current) => cursor ? [...current, ...page.items] : page.items); setNextCursor(page.nextCursor); } catch (reason) { setError(describeApiFailure(reason, "Unable to load organization events.").message); } finally { setBusy(false); } }, [accessToken, organizationId]);
  useEffect(() => { void load(); }, [load]);
  return <View style={sharedStyles.card}><Text style={styles.eyebrow}>ORGANIZATION EVENTS</Text><Text style={sharedStyles.sectionTitle}>Cleanup-event lifecycle</Text><Text style={sharedStyles.sectionSubtitle}>Private drafts and published records for this organization.</Text>{error ? <Notice tone="error" message={error} /> : null}{busy && items.length === 0 ? <Text style={styles.copy}>Loading events…</Text> : items.length === 0 ? <Text style={styles.copy}>No cleanup events yet.</Text> : items.map((item) => <View key={item.id} style={styles.item}><Text style={styles.title}>{item.title}</Text><Text style={styles.status}>{item.lifecycleStatus.replaceAll("_", " ")}</Text><Text style={styles.copy}>{item.incidentId ? "Incident-linked" : "Direct event"}</Text></View>)}{nextCursor ? <Button label="Load more" variant="secondary" loading={busy} onPress={() => void load(nextCursor)} /> : null}</View>;
}
const styles = StyleSheet.create({ eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 }, item: { gap: 3, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, title: { color: colors.text, fontWeight: "900", fontSize: 16 }, status: { color: colors.primary, fontWeight: "900", fontSize: 11 }, copy: { color: colors.textMuted, fontSize: 13 } });
