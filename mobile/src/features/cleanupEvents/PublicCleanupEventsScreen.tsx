import { IncidentEvidence } from "../incidents/IncidentEvidence";
import { getPublicIncident } from "../incidents/incident.api";
import type { IncidentDetail } from "../incidents/incident.types";
import { ListSections, PageControls } from "../../components/lists/ListControls";
import { eventSections, useListState, usePagedList, type EventSection } from "../../components/lists/usePagedList";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import {
  Notice,
  PageHeader,
  Screen,
  sharedStyles,
} from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  getPublicCleanupEvent,
  listPublicCleanupEvents,
} from "./cleanupEvent.api";
import type {
  CleanupEventPublicDetail,
  EventParticipation,
} from "./cleanupEvent.types";
import { EventParticipationPanel } from "./EventParticipationPanel";
import { ParticipantEventUpdatesPanel } from "./ParticipantEventUpdatesPanel";

type Props = {
  accessToken: string;
  initialEventId?: string;
  onBack: () => void;
};

export function PublicCleanupEventsScreen({
  accessToken,
  initialEventId,
  onBack,
}: Props) {
  const [section, setSection] = useListState<EventSection>("events.section", "upcoming");
  const list = usePagedList("events:" + section, cursor => listPublicCleanupEvents(accessToken, cursor, section), true, !initialEventId);
  const items = list.items;
  const detailRequest = useRef(0);
  useEffect(() => () => { detailRequest.current += 1; }, []);
  const [incident, setIncident] = useState<IncidentDetail>();
  const [selected, setSelected] = useState<CleanupEventPublicDetail>();
  const [busy, setBusy] = useState(Boolean(initialEventId));
  const [error, setError] = useState<string>();
  const [participationContext, setParticipationContext] = useState<{
    eventId: string;
    participation: EventParticipation | null;
  }>();
  async function open(id: string): Promise<void> {
    const request = ++detailRequest.current;
    setBusy(true);
    setError(undefined);
      setIncident(undefined);
    try {
      const detail = await getPublicCleanupEvent(accessToken, id);
        if (request !== detailRequest.current) return;
        setSelected(detail);
        if (detail.incidentId) {
          const linkedIncident = await getPublicIncident(accessToken, detail.incidentId);
          if (request === detailRequest.current) setIncident(linkedIncident);
        }
    } catch (reason) {
      if (request !== detailRequest.current) return;
      setError(
        describeApiFailure(reason, "Unable to load event details.").message,
      );
    } finally {
      if (request === detailRequest.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (initialEventId) void open(initialEventId);
  // The destination ID controls opening a detail page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEventId]);
  const handleParticipationChanged = useCallback(
    (participation: EventParticipation | null) => {
      if (selected)
        setParticipationContext({ eventId: selected.id, participation });
    },
    [selected],
  );

  return (
    <Screen rememberKey={selected ? undefined : "events:" + section}>
      <PageHeader
        eyebrow="Community cleanups"
        title={selected ? selected.title : "Published events"}
        onBack={
          selected && !initialEventId ? () => setSelected(undefined) : onBack
        }
        backLabel={selected && !initialEventId ? "Events" : "Back"}
        action={
          selected ? (
            <View style={styles.eventHeading}>
              <Text style={styles.organizationName}>{selected.organization.name}</Text>
              <Text style={styles.status}>{selected.displayStatus}</Text>
            </View>
          ) : undefined
        }
      />
      {!selected && <ListSections value={section} options={eventSections} onChange={value => { detailRequest.current += 1; setBusy(false); setSection(value); }} />}
      {list.error && <Notice tone="error" message={list.error} />}
      {error ? <Notice tone="error" message={error} /> : null}
      {selected ? (
        <>
          <View style={[sharedStyles.card, styles.detail]}>
            <Text style={styles.copy}>{selected.description}</Text>
            <Text style={styles.heading}>VOLUNTEER INSTRUCTIONS</Text>
            <Text style={styles.copy}>{selected.publicInstructions}</Text>
            <Text style={styles.heading}>LOCATION</Text>
            <Text style={styles.copy}>
              {selected.meetingAddress ||
                selected.eventAddress ||
                `${selected.eventLatitude}, ${selected.eventLongitude}`}
            </Text>
            <Text style={styles.heading}>DATE AND TIME</Text>
            <Text style={styles.organization}>
              {new Date(selected.startsAt).toLocaleString()}
            </Text>
            <Text style={styles.copy}>
              {selected.joinedVolunteerCount} volunteers joined ·{" "}
              {selected.capacity ?? "Open"} capacity
            </Text>
          </View>
          <EventParticipationPanel
            accessToken={accessToken}
            event={selected}
            onChanged={handleParticipationChanged}
          />
          {participationContext?.eventId === selected.id &&
          participationContext.participation?.status === "JOINED" ? (
            <ParticipantEventUpdatesPanel
              accessToken={accessToken}
              eventId={selected.id}
            />
          ) : null}
          {incident && <IncidentEvidence incident={incident} />}
        </>
      ) : (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>
            Upcoming and active events
          </Text>
          {busy && items.length === 0 ? (
            <Text style={styles.copy}>Loading events...</Text>
          ) : items.length === 0 ? (
            <Text style={styles.copy}>No published events yet.</Text>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => void open(item.id)}
                style={styles.item}
              >
                <View style={styles.flex}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.copy}>{item.organization.name}</Text>
                  <Text style={styles.meta}>
                    {new Date(item.startsAt).toLocaleString()} ·{" "}
                    {item.displayStatus}
                  </Text>
                </View>
                <Text style={styles.arrow}>→</Text>
              </Pressable>
            ))
          )}
          <PageControls {...list} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  detail: { borderColor: colors.primary },
  status: { alignSelf: "flex-start", color: colors.success, fontSize: 11, fontWeight: "900" },
  organization: { color: colors.text, fontWeight: "800" },
  eventHeading: { gap: 10, alignItems: "flex-start" },
  organizationName: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  copy: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  heading: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  session: {
    gap: 3,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flex: { flex: 1, gap: 3 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  arrow: { color: colors.primary, fontSize: 24 },
});
