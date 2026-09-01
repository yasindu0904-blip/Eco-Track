import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
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
  const [page, setPage] = useState<EventParticipantOperationsPage>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reasons, setReasons] = useState<Record<string, string>>({});
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
  const attendanceOpen = Boolean(
    page?.event.startsAt &&
      new Date(page.event.startsAt).getTime() <= Date.now(),
  );
  return (
    <View style={sharedStyles.card}>
      <Text style={styles.eyebrow}>VOLUNTEERS</Text>
      <Text style={sharedStyles.sectionTitle}>Attendance</Text>
      <Text style={sharedStyles.sectionSubtitle}>
        Contact details stay inside this protected organization workspace.
      </Text>
      {error ? <Notice tone="error" message={error} /> : null}
      {!page ? (
        <Text style={styles.copy}>Loading volunteers…</Text>
      ) : page.participants.length === 0 ? (
        <Text style={styles.copy}>No joined volunteers yet.</Text>
      ) : (
        page.participants.map((participant) => (
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
            <TextInput
              style={styles.input}
              value={reasons[participant.id] ?? ""}
              onChangeText={(value) =>
                setReasons((current) => ({
                  ...current,
                  [participant.id]: value,
                }))
              }
              placeholder="Removal reason (minimum 10 characters)"
              multiline
            />
            <Button
              disabled={
                busy ||
                participant.attendanceStatus === "ATTENDED" ||
                (reasons[participant.id]?.trim().length ?? 0) < 10
              }
              variant="danger"
              label="Remove volunteer"
              onPress={() =>
                Alert.alert(
                  "Remove volunteer?",
                  "This affects only this event.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () =>
                        void run(() =>
                          removeEventParticipant(
                            accessToken,
                            organizationId,
                            eventId,
                            participant.id,
                            reasons[participant.id],
                          ),
                        ),
                    },
                  ],
                )
              }
            />
          </View>
        ))
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
  input: {
    minHeight: 58,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    textAlignVertical: "top",
  },
});
