import { ListSections, PageControls } from "../../components/lists/ListControls";
import { eventSections, useInvalidateLists, useListState, usePagedList, type EventSection } from "../../components/lists/usePagedList";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { getOwnedCleanupEvent, listOwnedCleanupEvents } from "./cleanupEvent.api";
import type { CleanupEventOwnedSummary } from "./cleanupEvent.types";
import { EventParticipantOperationsScreen } from "./EventParticipantOperationsScreen";
import { EventOperationsScreen } from "./EventOperationsScreen";

type Props = { accessToken: string; organizationId: string; initialEventId?: string; canCancel?: boolean };

export function OrganizationCleanupEventListScreen({ accessToken, organizationId, initialEventId, canCancel = false }: Props) {
  const invalidateLists = useInvalidateLists();
  const [section, setSection] = useListState<EventSection | "all">("owned.section:" + organizationId, "all");
  const list = usePagedList("owned:" + organizationId + ":" + section, cursor => listOwnedCleanupEvents(accessToken, organizationId, cursor, section === "all" ? undefined : section), true);
  const { items, busy, error } = list;
  const [selectedId, setSelectedId] = useState(initialEventId);
  const [selectedRecord, setSelectedRecord] = useState<CleanupEventOwnedSummary>();
  const [selectionError, setSelectionError] = useState<string>();
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
  const visibleItems = items;
  const selected = visibleItems.find((item) => item.id === selectedId) ?? selectedRecord;

  async function refreshSelected() {
    invalidateLists("owned:" + organizationId + ":");
    if (selectedId) {
      try { setSelectedRecord(await getOwnedCleanupEvent(accessToken, organizationId, selectedId)); }
      catch (reason) { setSelectionError(describeApiFailure(reason).message); }
    }
    list.refresh();
  }
  return <View style={styles.container}>
    <View style={sharedStyles.card}><Text style={styles.eyebrow}>ORGANIZATION EVENTS</Text><Text style={sharedStyles.sectionTitle}>Cleanup activities</Text>
      <ListSections value={section} options={[{ value: "all", label: "All" }, ...eventSections]} onChange={value => { setSection(value); setSelectedId(undefined); setSelectedRecord(undefined); }} />
      {error ? <Notice tone="error" message={error} /> : null}
      {selectionError ? <Notice tone="error" message={selectionError} /> : null}
      {busy && visibleItems.length === 0 ? <Text style={styles.copy}>Loading events…</Text> : visibleItems.length === 0 ? <Text style={styles.copy}>No cleanup events yet.</Text> : visibleItems.map((item) => <Pressable accessibilityRole="button" key={item.id} onPress={() => { setSelectedId(item.id); setSelectedRecord(item); setSelectionError(undefined); }} style={[styles.item, item.id === selectedId && styles.selected]}><Text style={styles.title}>{item.title}</Text><Text style={styles.status}>{item.lifecycleStatus.replaceAll("_", " ")}</Text><Text style={styles.copy}>{item.incidentId ? "Incident-linked" : "Direct event"}</Text></Pressable>)}
      <PageControls {...list} />
    </View>
    {selected ? <View style={sharedStyles.card}><Text style={styles.status}>{selected.lifecycleStatus.replaceAll("_", " ")}</Text><Text style={sharedStyles.sectionTitle}>{selected.title}</Text><Text style={styles.copy}>{selected.description}</Text><Text style={styles.copy}>{selected.eventAddress ?? `${selected.eventLatitude}, ${selected.eventLongitude}`}</Text></View> : null}
    {selected && selected.lifecycleStatus !== "DRAFT" ? <EventParticipantOperationsScreen key={`attendance:${selected.id}`} accessToken={accessToken} organizationId={organizationId} eventId={selected.id} /> : null}
    {selected && selected.lifecycleStatus !== "DRAFT" ? <EventOperationsScreen key={`operations:${selected.id}`} accessToken={accessToken} organizationId={organizationId} eventId={selected.id} canCancel={canCancel} onChanged={() => void refreshSelected()} /> : null}
  </View>;
}
const styles = StyleSheet.create({ container: { gap: spacing.md }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 }, item: { gap: 3, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, title: { color: colors.text, fontWeight: "900", fontSize: 16 }, status: { color: colors.primary, fontWeight: "400", fontSize: 11 }, copy: { color: colors.textMuted, fontSize: 13 } });
