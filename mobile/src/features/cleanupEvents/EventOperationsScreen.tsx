import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
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
  const [visibility, setVisibility] = useState<"PARTICIPANTS" | "INTERNAL">("PARTICIPANTS");
  const [evidenceType, setEvidenceType] = useState<"BEFORE" | "PROGRESS" | "AFTER">("PROGRESS");
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [picking, setPicking] = useState(false);
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
    setError(undefined);
    setMessage(undefined);
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
  async function chooseEvidence(source: "library" | "camera" = "library") {
    if (busy || picking) return;
    setPicking(true);
    setError(undefined);
    try {
      const permission = source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError(source === "camera"
          ? "Camera permission is needed to photograph cleanup evidence."
          : "Photo-library permission is required.");
        return;
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.75, cameraType: ImagePicker.CameraType.back })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.75 });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    } catch (reason) {
      setError(describeApiFailure(reason, source === "camera" ? "Unable to take a photo." : "Unable to select a photo.").message);
    } finally {
      setPicking(false);
    }
  }
  async function uploadEvidence() {
    if (!photo || busy) return;
    await run(async () => {
      const response = await fetch(photo.uri);
      if (!response.ok) throw new Error("Unable to read the selected photo. Please choose it again.");
      const buffer = await response.arrayBuffer();
      await uploadEventEvidence(accessToken, organizationId, eventId, {
        data: buffer,
        originalFileName: photo.fileName ?? `event-${Date.now()}.jpg`,
        contentType: photo.mimeType ?? "image/jpeg",
        sizeBytes: buffer.byteLength,
      }, { type: evidenceType, caption: caption || null });
      setPhoto(undefined);
      setCaption("");
    }, "Evidence uploaded and recorded.");
  }
  if (!data)
    return (
      <View style={sharedStyles.card}>
        <Text>{error ?? "Loading event operations…"}</Text>
        {error && <Button label="Try again" variant="secondary" onPress={() => void load()} />}
      </View>
    );
  const terminal =
    data.event.lifecycleStatus === "COMPLETED" ||
    data.event.lifecycleStatus === "CANCELLED";
  return (
    <View style={styles.shell}>
      {error ? <Notice tone="error" message={error} /> : null}
      {message ? <Notice tone="success" message={message} /> : null}
      {!terminal ? (
        <>
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.sectionTitle}>Post an update</Text>
            <Choices label="Visibility" value={visibility} onChange={setVisibility} disabled={busy} options={[
              { value: "PARTICIPANTS", label: "Participants" },
              { value: "INTERNAL", label: "Internal team only" },
            ]} />
            <Field
              label="Note"
              value={note}
              onChangeText={value => setNote(value.slice(0, 2000))}
              multiline
            />
            <Button
              label="Add note"
              disabled={busy || !note.trim()}
              onPress={() =>
                void run(async () => {
                  await addEventNote(
                    accessToken,
                    organizationId,
                    eventId,
                    visibility,
                    note,
                  );
                  setNote("");
                }, "Event note added.")
              }
            />
          </View>
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.sectionTitle}>Upload evidence</Text>
            <Choices label="Evidence type" value={evidenceType} onChange={setEvidenceType} disabled={busy} options={[
              { value: "BEFORE", label: "Before" },
              { value: "PROGRESS", label: "Progress" },
              { value: "AFTER", label: "After" },
            ]} />
            <Field label="Caption" value={caption} onChangeText={value => setCaption(value.slice(0, 500))} />
            {photo && <Image source={{ uri: photo.uri }} style={styles.photo} accessibilityLabel="Selected evidence photo" />}
            <Button label="Take photo" variant="secondary" disabled={busy || picking} onPress={() => void chooseEvidence("camera")} />
            <Button label={photo ? "Change photo" : "Choose photo"} variant="secondary" disabled={busy || picking} onPress={() => void chooseEvidence()} />
            <Button label="Upload evidence" disabled={busy || picking || !photo} onPress={() => void uploadEvidence()} />
          </View>
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.sectionTitle}>Finish event</Text>
            <Button label="Refresh checks" variant="secondary" disabled={busy || picking} onPress={() => void load()} />
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
        <Text style={sharedStyles.sectionTitle}>Notes</Text>
        {data.notes.length === 0 && <Text style={styles.copy}>No operational notes yet.</Text>}
        {data.notes.map((item) => (
          <View style={styles.entry} key={item.id}>
            <Text style={styles.title}>{item.visibility === "INTERNAL" ? "Internal" : "Participants"}</Text>
            <Text style={styles.copy}>{item.noteText}</Text>
            <Text style={styles.copy}>{item.author.fullName ?? "Organization member"} · {new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        ))}
      </View>
      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Evidence</Text>
        {data.evidence.length === 0 && <Text style={styles.copy}>No evidence uploaded yet.</Text>}
        {data.evidence.map((item) => (
          <View style={styles.entry} key={item.id}>
            <Image source={{ uri: item.url }} style={styles.photo} accessibilityLabel={item.caption ?? `${item.type.toLowerCase()} cleanup evidence`} />
            <Text style={styles.title}>{item.type}</Text>
            {item.caption && <Text style={styles.copy}>{item.caption}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
function Choices<T extends string>({ label, value, options, onChange, disabled }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return <View style={styles.choices}>
    <Text style={styles.title}>{label}</Text>
    <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value, disabled }} disabled={disabled} onPress={() => onChange(option.value)} style={[styles.choice, value === option.value && styles.choiceSelected]}>
        <Text style={styles.choiceText}>{option.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  shell: { gap: spacing.md },
  photo: { width: "100%", height: 200, borderRadius: 12, resizeMode: "contain", backgroundColor: colors.surfaceMuted },
  choices: { gap: spacing.sm },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: { padding: spacing.sm, minHeight: 44, justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 9 },
  choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  choiceText: { color: colors.primary, fontWeight: "700" },
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
