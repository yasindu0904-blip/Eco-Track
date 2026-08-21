import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Notice, PageHeader, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { getPublicCleanupEvent, listPublicCleanupEvents } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail, CleanupEventPublicSummary } from "./cleanupEvent.types";
import { EventParticipationPanel } from "./EventParticipationPanel";
import { ParticipantEventUpdatesPanel } from "./ParticipantEventUpdatesPanel";

type Props = { accessToken: string; initialEventId?: string; onBack: () => void };

export function PublicCleanupEventsScreen({ accessToken, initialEventId, onBack }: Props) {
  const [items, setItems] = useState<CleanupEventPublicSummary[]>([]);
  const [selected, setSelected] = useState<CleanupEventPublicDetail>();
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const load = useCallback(async (cursor?: string) => {
    setBusy(true); setError(undefined);
    try {
      if (initialEventId && !cursor) {
        setSelected(await getPublicCleanupEvent(accessToken, initialEventId));
        return;
      }
      const page = await listPublicCleanupEvents(accessToken, cursor);
      setItems((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (reason) { setError(describeApiFailure(reason, "Unable to load cleanup events.").message); }
    finally { setBusy(false); }
  }, [accessToken, initialEventId]);
  useEffect(() => { void load(); }, [load]);

  async function open(id: string): Promise<void> {
    setBusy(true); setError(undefined);
    try { setSelected(await getPublicCleanupEvent(accessToken, id)); }
    catch (reason) { setError(describeApiFailure(reason, "Unable to load event details.").message); }
    finally { setBusy(false); }
  }

  return <Screen>
    <PageHeader
      eyebrow="Community cleanups"
      title={selected ? selected.title : "Published events"}
      subtitle={selected ? selected.organization.name : "Verified schedules, instructions, and volunteer availability."}
      onBack={selected && !initialEventId ? () => setSelected(undefined) : onBack}
      backLabel={selected && !initialEventId ? "Events" : "Back"}
      action={selected ? <Text style={styles.status}>{selected.lifecycleStatus.replaceAll("_", " ")}</Text> : undefined}
    />
    {error ? <Notice tone="error" message={error} /> : null}
    {selected ? <>
      <View style={[sharedStyles.card, styles.detail]}>
        <Text style={styles.copy}>{selected.description}</Text>
        <Text style={styles.heading}>VOLUNTEER INSTRUCTIONS</Text><Text style={styles.copy}>{selected.publicInstructions}</Text>
        <Text style={styles.heading}>LOCATION</Text><Text style={styles.copy}>{selected.meetingAddress || selected.eventAddress || `${selected.eventLatitude}, ${selected.eventLongitude}`}</Text>
        <Text style={styles.heading}>SESSIONS</Text>
        {selected.sessions.map((session) => <View key={session.id} style={styles.session}><Text style={styles.organization}>{session.sessionDate} · {session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)}</Text><Text style={styles.copy}>{session.locationAddress || "Event location"} · {session.capacity ?? "Open"} capacity</Text></View>)}
      </View>
      <EventParticipationPanel accessToken={accessToken} event={selected} />
      <ParticipantEventUpdatesPanel accessToken={accessToken} eventId={selected.id} />
    </> : <View style={sharedStyles.card}>
      <Text style={sharedStyles.sectionTitle}>Upcoming and active events</Text>
      {busy && items.length === 0 ? <Text style={styles.copy}>Loading events...</Text> : items.length === 0 ? <Text style={styles.copy}>No published events yet.</Text> : items.map((item) => <Pressable key={item.id} onPress={() => void open(item.id)} style={styles.item}><View style={styles.flex}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.copy}>{item.organization.name}</Text><Text style={styles.meta}>{item.lifecycleStatus.replaceAll("_", " ")}</Text></View><Text style={styles.arrow}>→</Text></Pressable>)}
      {nextCursor ? <Button label="Load more" variant="secondary" loading={busy} onPress={() => void load(nextCursor)} /> : null}
    </View>}
  </Screen>;
}

const styles = StyleSheet.create({ detail: { borderColor: colors.primary }, status: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.successSoft, color: colors.success, fontSize: 11, fontWeight: "900" }, organization: { color: colors.text, fontWeight: "800" }, copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 }, heading: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: spacing.sm }, session: { gap: 3, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }, item: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, flex: { flex: 1, gap: 3 }, itemTitle: { color: colors.text, fontSize: 16, fontWeight: "900" }, meta: { color: colors.primary, fontSize: 11, fontWeight: "900" }, arrow: { color: colors.primary, fontSize: 24 } });
