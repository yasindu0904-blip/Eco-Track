import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { ApiRequestError } from "../../api/apiClient";
import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { getPublishReadiness, publishCleanupEvent } from "./cleanupEvent.api";
import type { CleanupEventPublishReadiness, CleanupEventPublishResult } from "./cleanupEvent.types";

type Props = { accessToken: string; organizationId: string; eventId: string; onPublished: (result: CleanupEventPublishResult) => void };

export function CleanupEventPublishPanel({ accessToken, organizationId, eventId, onPublished }: Props) {
  const [readiness, setReadiness] = useState<CleanupEventPublishReadiness>(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const refresh = useCallback(async () => { setBusy(true); setError(undefined); try { setReadiness(await getPublishReadiness(accessToken, organizationId, eventId)); } catch (reason) { setError(describeApiFailure(reason, "Unable to check event readiness.").message); } finally { setBusy(false); } }, [accessToken, eventId, organizationId]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function publish(): Promise<void> { setBusy(true); setError(undefined); try { onPublished(await publishCleanupEvent(accessToken, organizationId, eventId)); } catch (reason) { let message = describeApiFailure(reason, "Unable to publish this event.").message; if (reason instanceof ApiRequestError && reason.code === "INCIDENT_ALREADY_CLAIMED" && typeof reason.details?.eventId === "string") message += ` Winning event: ${reason.details.eventId}.`; setError(message); try { setReadiness(await getPublishReadiness(accessToken, organizationId, eventId)); } catch { /* Keep original error. */ } } finally { setBusy(false); } }
  return <View style={[sharedStyles.card, styles.panel]}><Text style={styles.eyebrow}>04 · PUBLISH EVENT</Text><Text style={sharedStyles.sectionTitle}>Final readiness</Text><Text style={sharedStyles.sectionSubtitle}>The server checks these saved requirements again inside one transaction.</Text>{error ? <Notice tone="error" message={error} /> : null}{readiness?.checks.map((check) => <View key={check.code} style={[styles.check, !check.ready && styles.blocked]}><Text style={[styles.mark, !check.ready && styles.blockedMark]}>{check.ready ? "✓" : "!"}</Text><Text style={styles.copy}>{check.message}</Text></View>)}<Button label="Refresh checks" variant="secondary" loading={busy} onPress={() => void refresh()} /><Button label="Publish cleanup event" loading={busy} disabled={!readiness?.ready} onPress={() => Alert.alert("Publish cleanup event?", "Public details will become visible and a linked incident will be claimed.", [{ text: "Keep private", style: "cancel" }, { text: "Publish", onPress: () => void publish() }])} /></View>;
}

const styles = StyleSheet.create({ panel: { borderColor: colors.primary }, eyebrow: { color: colors.primary, fontWeight: "900", fontSize: 11, letterSpacing: 1 }, check: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: 10, backgroundColor: colors.successSoft }, blocked: { backgroundColor: colors.warningSoft }, mark: { color: colors.success, fontSize: 18, fontWeight: "900" }, blockedMark: { color: colors.warning }, copy: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 } });
