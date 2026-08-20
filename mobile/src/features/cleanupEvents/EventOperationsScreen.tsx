import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Field, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { addEventNote, cancelCleanupEvent, completeCleanupEvent, getEventCompletionReadiness, getEventOperations, transitionEventSessionStatus, transitionEventStatus, uploadEventEvidence } from "./cleanupEvent.api";
import type { EventCompletionReadiness, EventOperations } from "./cleanupEvent.types";

type Props = { accessToken: string; organizationId: string; eventId: string; canCancel: boolean };
type EvidenceType = "BEFORE" | "PROGRESS" | "AFTER";
type NoteVisibility = "PARTICIPANTS" | "INTERNAL";

export function EventOperationsScreen({ accessToken, organizationId, eventId, canCancel }: Props) {
  const [data, setData] = useState<EventOperations>();
  const [readiness, setReadiness] = useState<EventCompletionReadiness>();
  const [noteText, setNoteText] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("PARTICIPANTS");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("PROGRESS");
  const [evidenceSessionId, setEvidenceSessionId] = useState("");
  const [evidenceCaption, setEvidenceCaption] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const operations = await getEventOperations(accessToken, organizationId, eventId);
      setData(operations);
      setReadiness(operations.availableTransitions.some(({ lifecycleStatus }) => lifecycleStatus === "COMPLETED") ? await getEventCompletionReadiness(accessToken, organizationId, eventId) : undefined);
    } catch (reason) { setError(describeApiFailure(reason, "Unable to load event operations.").message); }
  }, [accessToken, eventId, organizationId]);
  useEffect(() => { void load(); }, [load]);

  async function run(operation: () => Promise<unknown>, success: string) {
    setBusy(true); setError(undefined); setMessage(undefined);
    try { await operation(); setMessage(success); await load(); }
    catch (reason) { setError(describeApiFailure(reason, "The event operation could not be completed.").message); }
    finally { setBusy(false); }
  }

  async function chooseAndUploadEvidence() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError("Photo-library permission is needed to upload event evidence."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await run(async () => {
      const resized = await manipulateAsync(asset.uri, asset.width > 1600 ? [{ resize: { width: 1600 } }] : [], { compress: 0.72, format: SaveFormat.JPEG });
      const bytes = await (await fetch(resized.uri)).arrayBuffer();
      if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("The evidence photo is larger than 8 MB after compression.");
      await uploadEventEvidence(accessToken, organizationId, eventId, { data: bytes, originalFileName: `${(asset.fileName ?? "event-evidence").replace(/\.[^.]+$/, "")}.jpg`, contentType: "image/jpeg", sizeBytes: bytes.byteLength }, { type: evidenceType, sessionId: evidenceSessionId || null, caption: evidenceCaption.trim() || null });
      setEvidenceCaption("");
    }, "Evidence uploaded and recorded.");
  }

  if (!data) return <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Event operations</Text>{error ? <Notice tone="error" message={error} /> : <Text style={styles.copy}>Loading operations...</Text>}</View>;
  const terminal = ["COMPLETED", "CANCELLED"].includes(data.event.lifecycleStatus);
  const canComplete = data.availableTransitions.some(({ lifecycleStatus }) => lifecycleStatus === "COMPLETED");
  const confirmComplete = () => Alert.alert("Complete event?", "This resolves the linked incident and awards eligible volunteers.", [{ text: "Keep open", style: "cancel" }, { text: "Complete", onPress: () => void run(() => completeCleanupEvent(accessToken, organizationId, eventId, data.event.updatedAt), "Cleanup event completed.") }]);
  const confirmCancel = () => Alert.alert("Cancel event?", "Participants will be notified and the incident claim released.", [{ text: "Keep event", style: "cancel" }, { text: "Cancel event", style: "destructive", onPress: () => void run(() => cancelCleanupEvent(accessToken, organizationId, eventId, data.event.updatedAt, cancellationReason), "Cleanup event cancelled.") }]);

  return <View style={styles.container}>
    <View style={[sharedStyles.card, styles.hero]}><Text style={styles.eyebrow}>LIVE OPERATIONS</Text><Text style={sharedStyles.sectionTitle}>{data.event.currentWorkflowStatus.label}</Text><Text style={styles.copy}>Protected notes, evidence, session progress, and lifecycle history.</Text><Button label="Refresh operations" variant="secondary" loading={busy} onPress={() => void load()} />{error ? <Notice tone="error" message={error} /> : null}{message ? <Notice tone="success" message={message} /> : null}</View>
    {!terminal ? <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Post an update</Text><View style={styles.choiceRow}>{(["PARTICIPANTS", "INTERNAL"] as NoteVisibility[]).map((item) => <Choice key={item} label={item === "PARTICIPANTS" ? "Participants" : "Internal only"} selected={visibility === item} onPress={() => setVisibility(item)} />)}</View><Field label="Note" value={noteText} onChangeText={setNoteText} multiline required /><Button label="Add event note" loading={busy} disabled={!noteText.trim()} onPress={() => void run(async () => { await addEventNote(accessToken, organizationId, eventId, visibility, noteText); setNoteText(""); }, "Event note added.")} /></View> : null}
    {!terminal ? <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Photo evidence</Text><Text style={styles.meta}>EVIDENCE TYPE</Text><View style={styles.choiceRow}>{(["BEFORE", "PROGRESS", "AFTER"] as EvidenceType[]).map((item) => <Choice key={item} label={item} selected={evidenceType === item} onPress={() => setEvidenceType(item)} />)}</View><Text style={styles.meta}>SESSION</Text><View style={styles.choiceRow}><Choice label="Whole event" selected={!evidenceSessionId} onPress={() => setEvidenceSessionId("")} />{data.sessions.map((session) => <Choice key={session.id} label={`${session.sessionDate} · ${session.startTime.slice(0, 5)}`} selected={evidenceSessionId === session.id} onPress={() => setEvidenceSessionId(session.id)} />)}</View><Field label="Caption (optional)" value={evidenceCaption} onChangeText={setEvidenceCaption} multiline /><Button label="Choose and upload photo" loading={busy} onPress={() => void chooseAndUploadEvidence()} /></View> : null}
    <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Sessions</Text>{data.sessions.map((session) => <View key={session.id} style={styles.entry}><Text style={styles.title}>{session.sessionDate} · {session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)}</Text><Text style={styles.meta}>{session.status.replaceAll("_", " ")}</Text>{!terminal && session.status === "SCHEDULED" ? <View style={styles.actions}><Button label="Start" loading={busy} onPress={() => void run(() => transitionEventSessionStatus(accessToken, organizationId, eventId, session.id, "IN_PROGRESS", session.updatedAt), "Session started.")} /><Button label="Cancel" variant="danger" loading={busy} onPress={() => void run(() => transitionEventSessionStatus(accessToken, organizationId, eventId, session.id, "CANCELLED", session.updatedAt), "Session cancelled.")} /></View> : null}{!terminal && session.status === "IN_PROGRESS" ? <View style={styles.actions}><Button label="Complete" loading={busy} onPress={() => void run(() => transitionEventSessionStatus(accessToken, organizationId, eventId, session.id, "COMPLETED", session.updatedAt), "Session completed.")} /><Button label="Cancel" variant="danger" loading={busy} onPress={() => void run(() => transitionEventSessionStatus(accessToken, organizationId, eventId, session.id, "CANCELLED", session.updatedAt), "Session cancelled.")} /></View> : null}</View>)}</View>
    {!terminal ? <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Event lifecycle</Text>{data.availableTransitions.filter(({ lifecycleStatus }) => !["PUBLISHED", "COMPLETED", "CANCELLED"].includes(lifecycleStatus)).map((target) => <Button key={target.id} label={`Move to ${target.label}`} loading={busy} onPress={() => void run(() => transitionEventStatus(accessToken, organizationId, eventId, target.id, data.event.updatedAt), `Event moved to ${target.label}.`)} />)}{canComplete && readiness ? <View style={styles.readiness}><Text style={styles.title}>Completion readiness</Text>{readiness.checks.map((check) => <Text key={check.code} style={check.ready ? styles.ready : styles.blocked}>{check.ready ? "✓" : "!"} {check.message}</Text>)}<Button label="Complete cleanup event" disabled={!readiness.ready} loading={busy} onPress={confirmComplete} /></View> : null}{canCancel && data.availableTransitions.some(({ lifecycleStatus }) => lifecycleStatus === "CANCELLED") ? <View style={styles.cancel}><Field label="Cancellation reason" value={cancellationReason} onChangeText={setCancellationReason} multiline required /><Button label="Cancel cleanup event" variant="danger" disabled={cancellationReason.trim().length < 10} loading={busy} onPress={confirmCancel} /></View> : null}</View> : null}
    <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Operational notes</Text>{data.notes.length === 0 ? <Text style={styles.copy}>No operational notes yet.</Text> : data.notes.map((note) => <View key={note.id} style={styles.entry}><Text style={styles.meta}>{note.visibility === "INTERNAL" ? "INTERNAL" : "PARTICIPANTS"}</Text><Text style={styles.copy}>{note.noteText}</Text><Text style={styles.small}>{note.author.fullName ?? "Organization member"} · {new Date(note.createdAt).toLocaleString()}</Text></View>)}</View>
    <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Evidence</Text>{data.evidence.length === 0 ? <Text style={styles.copy}>No evidence uploaded yet.</Text> : data.evidence.map((item) => <View key={item.id} style={styles.entry}><Image source={{ uri: item.url }} style={styles.image} /><Text style={styles.meta}>{item.type}</Text>{item.caption ? <Text style={styles.copy}>{item.caption}</Text> : null}</View>)}</View>
    <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Status timeline</Text>{data.history.map((entry) => <View key={entry.id} style={styles.entry}><Text style={styles.title}>{entry.fromStatus?.label ?? "Created"} → {entry.toStatus.label}</Text>{entry.notes ? <Text style={styles.copy}>{entry.notes}</Text> : null}<Text style={styles.small}>{entry.changedBy.fullName ?? "Organization member"} · {new Date(entry.changedAt).toLocaleString()}</Text></View>)}</View>
  </View>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ container: { gap: spacing.md }, hero: { borderColor: colors.primary }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 }, copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, title: { color: colors.text, fontSize: 15, fontWeight: "900" }, meta: { color: colors.primary, fontSize: 11, fontWeight: "900" }, small: { color: colors.textMuted, fontSize: 11 }, choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, choice: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface }, choiceSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, choiceText: { color: colors.textMuted, fontWeight: "800" }, choiceTextSelected: { color: colors.primary }, entry: { gap: spacing.sm, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, actions: { gap: spacing.sm }, readiness: { gap: spacing.sm, paddingTop: spacing.md }, ready: { color: colors.success, fontSize: 13 }, blocked: { color: colors.danger, fontSize: 13 }, cancel: { gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, image: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: colors.surfaceMuted } });
