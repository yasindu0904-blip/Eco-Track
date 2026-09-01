import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  getMyEventParticipation,
  joinCleanupEvent,
  withdrawFromCleanupEvent,
} from "./cleanupEvent.api";
import type {
  CleanupEventPublicDetail,
  EventParticipation,
} from "./cleanupEvent.types";
type Props = {
  accessToken: string;
  event: CleanupEventPublicDetail;
  onChanged?: (value: EventParticipation | null) => void;
};
export function EventParticipationPanel({
  accessToken,
  event,
  onChanged,
}: Props) {
  const [participation, setParticipation] = useState<EventParticipation | null>(
    null,
  );
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const value = await getMyEventParticipation(accessToken, event.id);
      setParticipation(value);
      onChanged?.(value);
      setError(undefined);
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to load your participation.")
          .message,
      );
    } finally {
      setBusy(false);
    }
  }, [accessToken, event.id, onChanged]);
  useEffect(() => {
    void load();
  }, [load]);
  async function volunteer() {
    setBusy(true);
    setError(undefined);
    try {
      const saved = (await joinCleanupEvent(accessToken, event.id))
        .participation;
      setParticipation(saved);
      setMessage("You are now volunteering for this cleanup event.");
      onChanged?.(saved);
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to join this cleanup event.")
          .message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    setBusy(true);
    setError(undefined);
    try {
      const saved = await withdrawFromCleanupEvent(accessToken, event.id);
      setParticipation(saved);
      setMessage("You withdrew from this event.");
      onChanged?.(saved);
    } catch (reason) {
      setError(describeApiFailure(reason, "Unable to withdraw.").message);
    } finally {
      setBusy(false);
    }
  }
  const active = participation?.status === "JOINED";
  const removed = participation?.status === "REMOVED";
  const open =
    event.lifecycleStatus === "PUBLISHED" &&
    new Date(event.startsAt).getTime() > Date.now();
  return (
    <View style={[sharedStyles.card, styles.panel]}>
      <Text style={styles.eyebrow}>VOLUNTEER</Text>
      <Text style={sharedStyles.sectionTitle}>
        {active ? "You are volunteering" : "Join this cleanup"}
      </Text>
      <Text style={sharedStyles.sectionSubtitle}>
        One tap reserves your place. You will receive an in-app reminder 30
        minutes before the event.
      </Text>
      {participation ? (
        <Text style={styles.status}>
          {participation.status} · {participation.attendanceStatus}
        </Text>
      ) : null}
      {error ? <Notice tone="error" message={error} /> : null}
      {message ? <Notice tone="success" message={message} /> : null}
      {removed ? (
        <Notice
          tone="error"
          message="The event team removed this participation."
        />
      ) : active ? (
        <Button
          variant="danger"
          disabled={busy || participation.attendanceStatus !== "UNMARKED"}
          label="Withdraw"
          onPress={() =>
            Alert.alert(
              "Withdraw?",
              "You can volunteer again while the event remains open.",
              [
                { text: "Keep place", style: "cancel" },
                {
                  text: "Withdraw",
                  style: "destructive",
                  onPress: () => void withdraw(),
                },
              ],
            )
          }
        />
      ) : open ? (
        <Button
          loading={busy}
          label={
            participation?.status === "WITHDRAWN"
              ? "Volunteer again"
              : "Volunteer"
          }
          onPress={() => void volunteer()}
        />
      ) : (
        <Notice message="This event is not open for new volunteers." />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { backgroundColor: colors.surfaceMuted, borderColor: colors.primary },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  status: {
    alignSelf: "flex-start",
    color: colors.primary,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 99,
    fontWeight: "900",
  },
});
