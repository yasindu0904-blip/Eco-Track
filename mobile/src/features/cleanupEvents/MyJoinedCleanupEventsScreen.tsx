import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { BrandHeader, Button, Notice, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { listMyEventParticipations } from "./cleanupEvent.api";
import type { EventParticipation } from "./cleanupEvent.types";

export function MyJoinedCleanupEventsScreen({ accessToken, onBack, onOpenEvent }: { accessToken: string; onBack: () => void; onOpenEvent: (eventId: string) => void }) {
  const [scope, setScope] = useState<"active" | "history">("active");
  const [items, setItems] = useState<EventParticipation[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const load = useCallback(async () => { setBusy(true); setError(undefined); try { setItems((await listMyEventParticipations(accessToken, scope)).items); } catch (reason) { setError(describeApiFailure(reason, "Unable to load your events.").message); } finally { setBusy(false); } }, [accessToken, scope]);
  useEffect(() => { void load(); }, [load]);
  return <Screen>
    <BrandHeader eyebrow="My volunteering" title="My joined events" subtitle="Active commitments, assignments, attendance, and history" compact />
    <View style={styles.tabs}><Button label="Active" variant={scope === "active" ? "primary" : "secondary"} onPress={() => setScope("active")} /><Button label="History" variant={scope === "history" ? "primary" : "secondary"} onPress={() => setScope("history")} /></View>
    {error ? <Notice tone="error" message={error} /> : null}
    <View style={sharedStyles.card}>{busy ? <Text style={styles.copy}>Loading your events…</Text> : items.length === 0 ? <Notice message={scope === "active" ? "Join a published cleanup to see it here." : "Withdrawn or removed events appear here."} /> : items.map((item) => <Pressable key={item.id} onPress={() => onOpenEvent(item.event.id)} style={styles.item}><View style={styles.flex}><Text style={styles.title}>{item.event.title}</Text><Text style={styles.copy}>{item.event.organization.name}</Text><Text style={styles.meta}>{item.status} · {item.availableSessionIds.length} available sessions</Text>{item.allocations.filter(({ status }) => status !== "REMOVED").map((allocation) => { const session = item.event.sessions.find(({ id }) => id === allocation.sessionId); return <Text style={styles.assignment} key={allocation.id}>Assigned {session?.sessionDate} {session?.startTime.slice(0, 5)} · {allocation.status}</Text>; })}</View><Text style={styles.arrow}>→</Text></Pressable>)}</View>
    <Button label="Citizen dashboard" variant="secondary" onPress={onBack} />
  </Screen>;
}

const styles = StyleSheet.create({ tabs: { flexDirection: "row", gap: spacing.sm }, item: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, flex: { flex: 1, gap: 3 }, title: { color: colors.text, fontSize: 16, fontWeight: "900" }, copy: { color: colors.textMuted }, meta: { color: colors.primary, fontSize: 11, fontWeight: "900" }, assignment: { color: colors.text, fontSize: 12, fontWeight: "700" }, arrow: { color: colors.primary, fontSize: 24 } });
