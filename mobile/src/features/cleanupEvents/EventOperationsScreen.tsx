import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { describeApiFailure } from "../../api/apiError";
import { Button, Field, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  addEventNote,
  cancelCleanupEvent,
  completeCleanupEvent,
  getEventCompletionReadiness,
  getEventOperations,
  uploadEventEvidence,
} from "./cleanupEvent.api";
import type {
  EventCompletionReadiness,
  EventOperations,
} from "./cleanupEvent.types";
export function EventOperationsScreen({
  accessToken,
  organizationId,
  eventId,
  canCancel,
  onChanged,
}: {
  accessToken: string;
  organizationId: string;
  eventId: string;
  canCancel: boolean;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<EventOperations>();
  const [readiness, setReadiness] = useState<EventCompletionReadiness>();
  const [note, setNote] = useState("");
  const [caption, setCaption] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const load = useCallback(async () => {
    try {
      const operations = await getEventOperations(
        accessToken,
        organizationId,
        eventId,
      );
      setData(operations);
      setReadiness(
        operations.event.lifecycleStatus === "PUBLISHED"
          ? await getEventCompletionReadiness(
              accessToken,
              organizationId,
              eventId,
            )
          : undefined,
      );
      setError(undefined);
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to load event operations.").message,
      );
    }
  }, [accessToken, eventId, organizationId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await operation();
      setMessage(success);
      await load();
      onChanged?.();
    } catch (reason) {
      setError(
        describeApiFailure(
          reason,
          "The event operation could not be completed.",
        ).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function chooseEvidence() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo-library permission is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.75,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const response = await fetch(asset.uri);
    const buffer = await response.arrayBuffer();
    await run(
      () =>
        uploadEventEvidence(
          accessToken,
          organizationId,
          eventId,
          {
            data: buffer,
            originalFileName: asset.fileName ?? `event-${Date.now()}.jpg`,
            contentType: asset.mimeType ?? "image/jpeg",
            sizeBytes: asset.fileSize ?? buffer.byteLength,
          },
          { type: "PROGRESS", caption: caption || null },
        ),
      "Evidence uploaded.",
    );
  }
  if (!data)
    return (
      <View style={sharedStyles.card}>
        <Text>{error ?? "Loading event operations…"}</Text>
      </View>
    );
  const terminal =
    data.event.lifecycleStatus === "COMPLETED" ||
    data.event.lifecycleStatus === "CANCELLED";
  return (
    <View style={styles.shell}>
      <View style={sharedStyles.card}>
        <Text style={styles.eyebrow}>EVENT OPERATIONS</Text>
        <Text style={sharedStyles.sectionTitle}>
          {data.event.currentWorkflowStatus.label}
        </Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Post updates, record evidence, then complete or cancel the event.
        </Text>
        {error ? <Notice tone="error" message={error} /> : null}
        {message ? <Notice tone="success" message={message} /> : null}
      </View>
      {!terminal ? (
        <>
          <View style={sharedStyles.card}>
            <Field
              label="Participant update"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Button
              label="Post update"
              disabled={busy || !note.trim()}
              onPress={() =>
                void run(async () => {
                  await addEventNote(
                    accessToken,
                    organizationId,
                    eventId,
                    "PARTICIPANTS",
                    note,
                  );
                  setNote("");
                }, "Update posted.")
              }
            />
            <Field
              label="Evidence caption"
              value={caption}
              onChangeText={setCaption}
            />
            <Button
              label="Choose and upload evidence"
              disabled={busy}
              onPress={() => void chooseEvidence()}
            />
          </View>
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.sectionTitle}>Finish event</Text>
            {readiness?.checks.map((check) => (
              <Text
                style={check.ready ? styles.ready : styles.blocked}
                key={check.code}
              >
                {check.ready ? "✓" : "!"} {check.message}
              </Text>
            ))}
            <Button
              label="Complete cleanup event"
              disabled={busy || !readiness?.ready}
              onPress={() =>
                Alert.alert(
                  "Complete event?",
                  "This will resolve a linked incident.",
                  [
                    { text: "Not yet", style: "cancel" },
                    {
                      text: "Complete",
                      onPress: () =>
                        void run(
                          () =>
                            completeCleanupEvent(
                              accessToken,
                              organizationId,
                              eventId,
                              data.event.updatedAt,
                            ),
                          "Event completed.",
                        ),
                    },
                  ],
                )
              }
            />
            {canCancel ? (
              <>
                <Field
                  label="Cancellation reason"
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                />
                <Button
                  label="Cancel cleanup event"
                  variant="danger"
                  disabled={busy || cancelReason.trim().length < 10}
                  onPress={() =>
                    Alert.alert(
                      "Cancel event?",
                      "Volunteers will be notified.",
                      [
                        { text: "Keep event", style: "cancel" },
                        {
                          text: "Cancel event",
                          style: "destructive",
                          onPress: () =>
                            void run(
                              () =>
                                cancelCleanupEvent(
                                  accessToken,
                                  organizationId,
                                  eventId,
                                  data.event.updatedAt,
                                  cancelReason,
                                ),
                              "Event cancelled.",
                            ),
                        },
                      ],
                    )
                  }
                />
              </>
            ) : null}
          </View>
        </>
      ) : null}
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Updates and evidence</Text>
        {data.notes.map((item) => (
          <View style={styles.entry} key={item.id}>
            <Text style={styles.title}>{item.visibility}</Text>
            <Text style={styles.copy}>{item.noteText}</Text>
          </View>
        ))}
        {data.evidence.map((item) => (
          <View style={styles.entry} key={item.id}>
            <Text style={styles.title}>{item.type} evidence</Text>
            <Text style={styles.copy}>{item.caption || "Photo recorded"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  shell: { gap: spacing.md },
  eyebrow: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1,
  },
  ready: { color: colors.success },
  blocked: { color: colors.warning },
  entry: {
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  title: { color: colors.text, fontWeight: "900" },
  copy: { color: colors.textMuted },
});
