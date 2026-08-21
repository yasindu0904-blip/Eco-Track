import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { getMyEventParticipation, joinCleanupEvent, updateEventAvailability, withdrawFromCleanupEvent } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail, EventParticipation } from "./cleanupEvent.types";

type Props = {
  accessToken: string;
  event: CleanupEventPublicDetail;
  onChanged?: (value: EventParticipation | null) => void;
};

export function EventParticipationPanel({ accessToken, event, onChanged }: Props) {
  const [participation, setParticipation] = useState<EventParticipation | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const loadParticipation = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      const value = await getMyEventParticipation(accessToken, event.id);
      setParticipation(value);
      setSelected(value?.availableSessionIds ?? []);
      onChanged?.(value);
    } catch (reason) {
      setError(describeApiFailure(reason, "Unable to load your participation.").message);
    } finally {
      setBusy(false);
    }
  }, [accessToken, event.id, onChanged]);

  useEffect(() => {
    void loadParticipation();
  }, [loadParticipation]);
  function toggle(id: string): void { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  async function save(): Promise<void> {
    if (selected.length === 0) { setError("Select at least one future session."); return; }
    setBusy(true); setError(undefined); setMessage(undefined);
    try {
      const value = participation?.status === "JOINED" ? await updateEventAvailability(accessToken, event.id, selected) : (await joinCleanupEvent(accessToken, event.id, selected)).participation;
      setParticipation(value); setSelected(value.availableSessionIds); setMessage(participation?.status === "JOINED" ? "Your availability was updated." : "You joined this cleanup event."); onChanged?.(value);
    } catch (reason) { setError(describeApiFailure(reason, "Unable to save your participation.").message); }
    finally { setBusy(false); }
  }
  async function withdraw(): Promise<void> {
    setBusy(true); setError(undefined); setMessage(undefined);
    try { const value = await withdrawFromCleanupEvent(accessToken, event.id); setParticipation(value); setMessage("You have withdrawn from this event."); onChanged?.(value); }
    catch (reason) { setError(describeApiFailure(reason, "Unable to withdraw from this event.").message); }
    finally { setBusy(false); }
  }
  const active = participation?.status === "JOINED";
  const removed = participation?.status === "REMOVED";
  const canJoin = ["PUBLISHED", "SCHEDULED"].includes(event.lifecycleStatus);
  const activeAllocations = participation?.allocations.filter(({ status }) => status !== "REMOVED") ?? [];

  return <View style={[sharedStyles.card, styles.panel]}>
    <Text style={styles.eyebrow}>VOLUNTEER AVAILABILITY</Text><Text style={sharedStyles.sectionTitle}>{active ? "Your selected sessions" : "Join this cleanup"}</Text><Text style={sharedStyles.sectionSubtitle}>Select every session you can attend. Availability does not guarantee allocation.</Text>
    {participation ? <><Text style={styles.status}>{participation.status}</Text><Button variant="secondary" disabled={busy} loading={busy} label="Refresh assignment" onPress={() => void loadParticipation()} /></> : null}
    {error ? <Notice tone="error" message={error} /> : null}{message ? <Notice tone="success" message={message} /> : null}
    {active ? <View style={styles.assignments}>
      <Text style={styles.eyebrow}>EVENT TEAM ASSIGNMENT</Text><Text style={styles.assignmentHeading}>Your assigned sessions</Text>
      {activeAllocations.length === 0
        ? <Notice message="You are joined, but the event team has not assigned you to a session yet." />
        : activeAllocations.map((allocation) => {
          const session = event.sessions.find(({ id }) => id === allocation.sessionId);
          return <View key={allocation.id} style={styles.assignment}>
            <View style={styles.flex}><Text style={styles.optionTitle}>{session ? `${session.sessionDate} · ${session.startTime.slice(0, 5)}–${session.endTime.slice(0, 5)}` : "Assigned event session"}</Text><Text style={styles.copy}>{session?.locationAddress || event.meetingAddress || event.eventAddress || "Event location"}</Text></View>
            <Text style={styles.status}>{allocation.status === "PLANNED" ? "ASSIGNED" : allocation.status}</Text>
          </View>;
        })}
    </View> : null}
    {event.sessions.map((session) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(session.id), disabled: busy || removed }} disabled={busy || removed || (!active && !canJoin)} key={session.id} onPress={() => toggle(session.id)} style={styles.option}><View style={[styles.checkbox, selected.includes(session.id) && styles.checked]}><Text style={styles.checkmark}>{selected.includes(session.id) ? "✓" : ""}</Text></View><View style={styles.flex}><Text style={styles.optionTitle}>{session.sessionDate} · {session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)}</Text><Text style={styles.copy}>{session.locationAddress || "Event location"}</Text></View></Pressable>)}
    {removed ? <Notice tone="error" message="This participation was removed by the event team and cannot be rejoined." /> : canJoin || active ? <><Button loading={busy} disabled={selected.length === 0} label={active ? "Update availability" : participation?.status === "WITHDRAWN" ? "Rejoin cleanup" : "Join cleanup"} onPress={() => void save()} />{active ? <Button variant="danger" disabled={busy} label="Withdraw" onPress={() => Alert.alert("Withdraw from event?", "Your saved availability remains in the event history.", [{ text: "Keep participation", style: "cancel" }, { text: "Withdraw", style: "destructive", onPress: () => void withdraw() }])} /> : null}</> : <Notice message="This event is no longer open for joining." />}
  </View>;
}

const styles = StyleSheet.create({ panel: { backgroundColor: colors.surfaceMuted, borderColor: colors.primary }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 }, status: { alignSelf: "flex-start", color: colors.primary, backgroundColor: colors.successSoft, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 99, fontWeight: "900" }, assignments: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, backgroundColor: colors.surface }, assignmentHeading: { color: colors.text, fontSize: 16, fontWeight: "900" }, assignment: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, option: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }, checkbox: { width: 22, height: 22, borderWidth: 2, borderColor: colors.primary, borderRadius: 5, alignItems: "center", justifyContent: "center" }, checked: { backgroundColor: colors.primary }, checkmark: { color: colors.surface, fontWeight: "900" }, flex: { flex: 1, gap: 3 }, optionTitle: { color: colors.text, fontWeight: "800" }, copy: { color: colors.textMuted, fontSize: 13 } });
