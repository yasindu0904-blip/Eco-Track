import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { getOwnedCleanupEvent, listOwnedCleanupEvents } from "./cleanupEvent.api";
import type { CleanupEventOwnedSummary } from "./cleanupEvent.types";
import { EventParticipantOperationsScreen } from "./EventParticipantOperationsScreen";

type Props = { accessToken: string; organizationId: string; initialEventId?: string };

export function OrganizationCleanupEventListScreen({ accessToken, organizationId, initialEventId }: Props) {
  const [items, setItems] = useState<CleanupEventOwnedSummary[]>([]);
  const [selectedId, setSelectedId] = useState(initialEventId);
  const [selectedRecord, setSelectedRecord] = useState<CleanupEventOwnedSummary>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [selectionError, setSelectionError] = useState<string>();
  const load = useCallback(async (cursor?: string) => {
    setBusy(true); setError(undefined);
    try {
      const page = await listOwnedCleanupEvents(accessToken, organizationId, cursor);
      setItems((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
      if (!cursor) setSelectedId((current) => current ?? page.items[0]?.id);
    } catch (reason) { setError(describeApiFailure(reason, "Unable to load organization events.").message); }
    finally { setBusy(false); }
  }, [accessToken, organizationId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!initialEventId) return;
    let active = true;
    void getOwnedCleanupEvent(accessToken, organizationId, initialEventId)
      .then((record) => {
        if (active) setSelectedRecord(record);
      })
      .catch((reason: unknown) => {
        if (active) setSelectionError(describeApiFailure(reason, "Unable to open the selected organization event.").message);
      });
    return () => { active = false; };
  }, [accessToken, initialEventId, organizationId]);
  const visibleItems = selectedRecord && !items.some((item) => item.id === selectedRecord.id)
    ? [selectedRecord, ...items]
    : items;
  const selected = visibleItems.find((item) => item.id === selectedId);

  return <View style={styles.container}>
    <View style={sharedStyles.card}><Text style={styles.eyebrow}>ORGANIZATION EVENTS</Text><Text style={sharedStyles.sectionTitle}>Cleanup-event lifecycle</Text><Text style={sharedStyles.sectionSubtitle}>Private drafts and published records for this organization.</Text>
      {error ? <Notice tone="error" message={error} /> : null}
      {selectionError ? <Notice tone="error" message={selectionError} /> : null}
      {busy && visibleItems.length === 0 ? <Text style={styles.copy}>Loading events…</Text> : visibleItems.length === 0 ? <Text style={styles.copy}>No cleanup events yet.</Text> : visibleItems.map((item) => <Pressable accessibilityRole="button" key={item.id} onPress={() => { setSelectedId(item.id); setSelectedRecord(item); setSelectionError(undefined); }} style={[styles.item, item.id === selectedId && styles.selected]}><Text style={styles.title}>{item.title}</Text><Text style={styles.status}>{item.lifecycleStatus.replaceAll("_", " ")}</Text><Text style={styles.copy}>{item.incidentId ? "Incident-linked" : "Direct event"}</Text></Pressable>)}
      {nextCursor ? <Button label="Load more" variant="secondary" loading={busy} onPress={() => void load(nextCursor)} /> : null}
    </View>
    {selected ? <View style={sharedStyles.card}><Text style={styles.status}>{selected.lifecycleStatus.replaceAll("_", " ")}</Text><Text style={sharedStyles.sectionTitle}>{selected.title}</Text><Text style={styles.copy}>{selected.description}</Text><Text style={styles.copy}>{selected.eventAddress ?? `${selected.eventLatitude}, ${selected.eventLongitude}`}</Text></View> : null}
    {selected && selected.lifecycleStatus !== "DRAFT" ? <EventParticipantOperationsScreen accessToken={accessToken} organizationId={organizationId} eventId={selected.id} /> : null}
  </View>;
}
const styles = StyleSheet.create({ container: { gap: spacing.md }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 }, item: { gap: 3, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, title: { color: colors.text, fontWeight: "900", fontSize: 16 }, status: { color: colors.primary, fontWeight: "900", fontSize: 11 }, copy: { color: colors.textMuted, fontSize: 13 } });
