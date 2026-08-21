import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { allocateEventParticipant, listEventParticipants, markEventAttendance, reallocateEventParticipant, removeEventAllocation, removeEventParticipant } from "./cleanupEvent.api";
import type { EventParticipantOperationsPage } from "./cleanupEvent.types";

function hasSessionStarted(session: { sessionDate: string; startTime: string }): boolean {
  return new Date(`${session.sessionDate}T${session.startTime}+05:30`).getTime() <= Date.now();
}

function isAttendanceOpen(session: { sessionDate: string; startTime: string; status: string }): boolean {
  return session.status !== "CANCELLED" && (
    session.status === "IN_PROGRESS" ||
    session.status === "COMPLETED" ||
    hasSessionStarted(session)
  );
}

export function EventParticipantOperationsScreen({ accessToken, organizationId, eventId }: { accessToken: string; organizationId: string; eventId: string }) {
  const [page, setPage] = useState<EventParticipantOperationsPage>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try { setPage(await listEventParticipants(accessToken, organizationId, eventId)); setError(undefined); }
    catch (reason) { setError(describeApiFailure(reason, "Unable to load event volunteers.").message); }
  }, [accessToken, eventId, organizationId]);
  useEffect(() => { void load(); }, [load]);
  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError(undefined);
    try { await operation(); await load(); }
    catch (reason) { setError(describeApiFailure(reason, "The participant operation could not be completed.").message); }
    finally { setBusy(false); }
  };

  return <View style={sharedStyles.card}>
    <Text style={styles.eyebrow}>VOLUNTEER OPERATIONS</Text><Text style={sharedStyles.sectionTitle}>Allocation and attendance</Text>
    <Text style={sharedStyles.sectionSubtitle}>Contact details are available only in this protected organization workspace.</Text>
    {error ? <Notice tone="error" message={error} /> : null}
    {!page ? <Text style={styles.copy}>Loading volunteers…</Text> : page.participants.length === 0 ? <Text style={styles.copy}>No joined volunteers yet.</Text> : page.participants.map((participant) => {
      const active = participant.allocations.filter(({ status }) => status !== "REMOVED");
      const available = page.sessions.filter(({ id }) => participant.availableSessionIds.includes(id));
      const allocatable = available.filter((session) => session.status === "SCHEDULED" && !hasSessionStarted(session));
      const unallocated = allocatable.filter((session) => !active.some(({ sessionId }) => sessionId === session.id));
      return <View style={styles.card} key={participant.id}>
        <Text style={styles.title}>{participant.volunteer.fullName ?? "EcoTrack volunteer"}</Text><Text style={styles.copy}>{participant.volunteer.phoneNumber ?? "No phone number provided"}</Text><Text style={styles.copy}>Available sessions: {available.length}</Text>
        {active.map((allocation) => { const session = page.sessions.find(({ id }) => id === allocation.sessionId); const attendanceOpen = Boolean(session && isAttendanceOpen(session)); const reallocationTargets = allocatable.filter(({ capacity, allocatedCount, id }) => id !== allocation.sessionId && (capacity === null || allocatedCount < capacity)); return <View style={styles.allocation} key={allocation.id}>
          <Text style={styles.title}>{session?.sessionDate} · {session?.startTime.slice(0, 5)}</Text><Text style={styles.status}>{allocation.status}</Text>
          {allocation.status === "PLANNED" ? <>{reallocationTargets.length > 0 ? <><Text style={styles.label}>Move to another available future session</Text>{reallocationTargets.map((target) => <Button key={target.id} disabled={busy} variant="secondary" label={`${target.sessionDate} ${target.startTime.slice(0, 5)}`} onPress={() => void run(() => reallocateEventParticipant(accessToken, organizationId, eventId, allocation.id, target.id))} />)}</> : null}{attendanceOpen ? <><Button disabled={busy} label="Mark attended" onPress={() => void run(() => markEventAttendance(accessToken, organizationId, eventId, allocation.id, "ATTENDED"))} /><Button disabled={busy} variant="secondary" label="Mark absent" onPress={() => void run(() => markEventAttendance(accessToken, organizationId, eventId, allocation.id, "ABSENT"))} /></> : <Notice message="Attendance opens when this session starts." />}<Button disabled={busy} variant="danger" label="Remove allocation" onPress={() => Alert.alert("Remove allocation?", "The volunteer remains joined to the event.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void run(() => removeEventAllocation(accessToken, organizationId, eventId, allocation.id)) }])} /></> : null}
        </View>; })}
        {unallocated.map((session) => <Button key={session.id} disabled={busy || (session.capacity !== null && session.allocatedCount >= session.capacity)} variant="secondary" label={`Allocate ${session.sessionDate} ${session.startTime.slice(0, 5)}`} onPress={() => void run(() => allocateEventParticipant(accessToken, organizationId, eventId, participant.id, session.id))} />)}
        <TextInput style={styles.input} value={reasons[participant.id] ?? ""} onChangeText={(value) => setReasons((current) => ({ ...current, [participant.id]: value }))} placeholder="Removal reason (minimum 10 characters)" multiline />
        <Button disabled={busy || (reasons[participant.id]?.trim().length ?? 0) < 10} variant="danger" label="Remove volunteer from event" onPress={() => Alert.alert("Remove volunteer?", "This affects only this cleanup event.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void run(() => removeEventParticipant(accessToken, organizationId, eventId, participant.id, reasons[participant.id])) }])} />
      </View>;
    })}
  </View>;
}

const styles = StyleSheet.create({ eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 }, card: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceMuted }, allocation: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, title: { color: colors.text, fontWeight: "900" }, copy: { color: colors.textMuted }, label: { color: colors.textMuted, fontSize: 12, fontWeight: "700" }, status: { color: colors.primary, fontWeight: "900", fontSize: 11 }, input: { minHeight: 58, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, color: colors.text, textAlignVertical: "top" } });
