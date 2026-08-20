import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import { ApiRequestError } from "../../api/apiClient";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { getParticipantEventUpdates } from "./cleanupEvent.api";
import type { ParticipantEventUpdates } from "./cleanupEvent.types";

export function ParticipantEventUpdatesPanel({ accessToken, eventId }: { accessToken: string; eventId: string }) {
  const [data, setData] = useState<ParticipantEventUpdates>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => { setError(undefined); try { setData(await getParticipantEventUpdates(accessToken, eventId)); } catch (reason) { if (reason instanceof ApiRequestError && reason.statusCode === 404) return; setError(describeApiFailure(reason, "Unable to load participant updates.").message); } }, [accessToken, eventId]);
  useEffect(() => { void load(); }, [load]);
  if (!data && !error) return null;
  return <View style={sharedStyles.card}><Text style={sharedStyles.sectionTitle}>Participant updates</Text>{error ? <Notice tone="error" message={error} /> : null}{data?.event.cancellationReason ? <Notice tone="warning" message={`Cancelled: ${data.event.cancellationReason}`} /> : null}{data?.notes.length === 0 ? <Text style={styles.copy}>No participant updates yet.</Text> : data?.notes.map((note) => <View key={note.id} style={styles.entry}><Text style={styles.copy}>{note.noteText}</Text><Text style={styles.meta}>{note.author.fullName ?? "Event team"} · {new Date(note.createdAt).toLocaleString()}</Text></View>)}<Button label="Refresh updates" variant="secondary" onPress={() => void load()} /></View>;
}
const styles = StyleSheet.create({ entry: { gap: spacing.xs, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, meta: { color: colors.primary, fontSize: 11, fontWeight: "800" } });
