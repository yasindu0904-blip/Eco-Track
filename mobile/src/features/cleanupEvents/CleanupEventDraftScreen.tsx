import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, Screen, sharedStyles } from "../../components/ui";
import { LocationPicker } from "../map";
import { createDraft, listDrafts } from "./cleanupEvent.api";
import type { CleanupEventDraft } from "./cleanupEvent.types";

type Props = { accessToken: string; organizationId: string; incidentId?: string; onBack: () => void };
export function CleanupEventDraftScreen({ accessToken, organizationId, incidentId, onBack }: Props) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [location, setLocation] = useState({ latitude: 6.927079, longitude: 79.861244 });
  const [confirmed, setConfirmed] = useState(false); const [drafts, setDrafts] = useState<CleanupEventDraft[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = () => listDrafts(accessToken, organizationId).then(setDrafts).catch((reason) => setError(describeApiFailure(reason, "Unable to load drafts.").message));
  useEffect(() => { void load(); }, [accessToken, organizationId]);
  const save = async () => { setBusy(true); setError(null); try { await createDraft(accessToken, organizationId, { incidentId: incidentId ?? null, title: title.trim(), description: description.trim(), eventLatitude: location.latitude, eventLongitude: location.longitude }); setTitle(""); setDescription(""); setConfirmed(false); await load(); } catch (reason) { setError(describeApiFailure(reason, "Unable to save the draft.").message); } finally { setBusy(false); } };
  return <Screen><Text style={sharedStyles.sectionTitle}>Cleanup event drafts</Text><Text style={styles.help}>Private until published. Choose and confirm an event location.</Text>{error && <Notice tone="error" message={error}/>}<TextInput accessibilityLabel="Event title" placeholder="Event title" value={title} onChangeText={setTitle} style={styles.input}/><TextInput accessibilityLabel="Event description" placeholder="Describe the cleanup" value={description} onChangeText={setDescription} multiline style={[styles.input, styles.area]}/><LocationPicker value={location} disabled={busy} onChange={(value) => { setLocation(value); setConfirmed(false); }} onConfirm={(value) => { setLocation(value); setConfirmed(true); }}/><Button label={busy ? "Saving…" : "Save private draft"} disabled={busy || !confirmed || title.trim().length < 3 || description.trim().length < 10} onPress={save}/><Text style={sharedStyles.sectionTitle}>Drafts</Text>{!drafts.length ? <Text>No drafts yet.</Text> : drafts.map((draft) => <View key={draft.id} style={sharedStyles.card}><Text style={styles.title}>{draft.title}</Text><Text>{draft.sessions.length} sessions · {draft.coordinators.length} coordinators</Text></View>)}<Button label="Back" variant="secondary" onPress={onBack}/></Screen>;
}
const styles = StyleSheet.create({ help: { color: "#527061", marginBottom: 12 }, input: { borderWidth: 1, borderColor: "#b8cfc0", borderRadius: 10, padding: 12, marginBottom: 12 }, area: { minHeight: 100, textAlignVertical: "top" }, title: { fontWeight: "700", fontSize: 17, color: "#173d2d" } });
