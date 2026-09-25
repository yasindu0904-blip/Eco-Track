import { ListWindow } from "../../components/lists/ListControls";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Button, Field, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  listEventParticipants,
  markEventAttendance,
  removeEventParticipant,
} from "./cleanupEvent.api";
import type { EventParticipantOperationsPage } from "./cleanupEvent.types";
export function EventParticipantOperationsScreen({
  accessToken,
  organizationId,
  eventId,
}: {
  accessToken: string;
  organizationId: string;
  eventId: string;
}) {
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState<EventParticipantOperationsPage>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [removingId, setRemovingId] = useState<string>();
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    try {
      setPage(
        await listEventParticipants(accessToken, organizationId, eventId),
      );
      setError(undefined);
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to load event volunteers.").message,
      );
    }
  }, [accessToken, eventId, organizationId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(operation: () => Promise<unknown>) {
    setBusy(true);
    try {
      await operation();
      setRemovingId(undefined);
      setReason("");
      await load();
    } catch (reason) {
      setError(
        describeApiFailure(
          reason,
          "The volunteer operation could not be completed.",
        ).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadMore() {
    if (!page?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await listEventParticipants(accessToken, organizationId, eventId, "JOINED", page.nextCursor);
      setPage(current => current ? { ...next, participants: [...current.participants, ...next.participants] } : next);
    } catch (reason) { setError(describeApiFailure(reason).message); }
    finally { setLoadingMore(false); }
  }
  const attendanceOpen = Boolean(
    page?.event.startsAt &&
      new Date(page.event.startsAt).getTime() <= Date.now(),
  );
  return (
    <View style={sharedStyles.card}>
      <Text style={styles.eyebrow}>VOLUNTEERS</Text>
      <View style={sharedStyles.spacedRow}>
        <Text style={sharedStyles.sectionTitle}>Attendance</Text>
        <Button label="Refresh" variant="secondary" disabled={busy} onPress={() => void load()} />
      </View>

      {error ? <Notice tone="error" message={error} /> : null}
      {!page ? (
        <Text style={styles.copy}>Loading volunteers…</Text>
      ) : page.participants.length === 0 ? (
        <Text style={styles.copy}>No joined volunteers yet.</Text>
      ) : (
        <ListWindow items={page.participants} hasMore={Boolean(page.nextCursor)} busy={loadingMore} loadMore={() => void loadMore()}>{visible => visible.map((participant) => (
          <View style={styles.card} key={participant.id}>
            <Text style={styles.title}>
              {participant.volunteer.fullName ?? "EcoTrack volunteer"}
            </Text>
            <Text style={styles.copy}>
              {participant.volunteer.phoneNumber ?? "No phone number provided"}
            </Text>
            <Text style={styles.status}>{participant.attendanceStatus}</Text>
            {participant.attendanceStatus === "UNMARKED" && attendanceOpen ? (
              <>
                <Button
                  disabled={busy}
                  label="Mark attended"
                  onPress={() =>
                    void run(() =>
                      markEventAttendance(
                        accessToken,
                        organizationId,
                        eventId,
                        participant.id,
                        "ATTENDED",
                      ),
                    )
                  }
                />
                <Button
                  disabled={busy}
                  variant="secondary"
                  label="Mark absent"
                  onPress={() =>
                    void run(() =>
                      markEventAttendance(
                        accessToken,
                        organizationId,
                        eventId,
                        participant.id,
                        "ABSENT",
                      ),
                    )
                  }
                />
              </>
            ) : participant.attendanceStatus === "UNMARKED" ? (
              <Notice message="Attendance opens at the event start time." />
            ) : null}
            {removingId === participant.id && participant.attendanceStatus !== "ATTENDED" ? (
              <>
                <Field label="Removal reason" value={reason} onChangeText={setReason} placeholder="At least 10 characters" multiline required />
                <Button label="Cancel removal" variant="secondary" disabled={busy} onPress={() => { setRemovingId(undefined); setReason(""); }} />
                <Button
                  label="Confirm removal"
                  variant="danger"
                  disabled={busy || reason.trim().length < 10}
                  onPress={() => Alert.alert("Remove volunteer?", "This affects only this event.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => void run(() => removeEventParticipant(accessToken, organizationId, eventId, participant.id, reason)) },
                  ])}
                />
              </>
            ) : (
              <Button
                label="Remove volunteer"
                variant="danger"
                disabled={busy || participant.attendanceStatus === "ATTENDED"}
                onPress={() => { setRemovingId(participant.id); setReason(""); }}
              />
            )}
          </View>
        ))}</ListWindow>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  title: { color: colors.text, fontWeight: "900" },
  copy: { color: colors.textMuted },
  status: { color: colors.primary, fontWeight: "900" },
});
