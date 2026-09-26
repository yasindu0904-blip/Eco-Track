import { ListSections, PageControls } from "../../components/lists/ListControls";
import { eventSections, useListState, usePagedList, type EventSection } from "../../components/lists/usePagedList";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Notice,
  PageHeader,
  Screen,
  sharedStyles,
} from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { listMyEventParticipations } from "./cleanupEvent.api";

export function MyJoinedCleanupEventsScreen({
  accessToken,
  onBack,
  onOpenEvent,
}: {
  accessToken: string;
  onBack: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const [section, setSection] = useListState<EventSection | "withdrawn">("joined.section", "upcoming");
  const list = usePagedList("joined:" + section, cursor => listMyEventParticipations(accessToken, "all", cursor, section), true);
  const { items, busy, error } = list;
  return (
    <Screen rememberKey={"joined:" + section} onRefresh={list.refresh}>
      <PageHeader
        eyebrow="My volunteering"
        title="My joined events"
        onBack={onBack}
        backLabel="Dashboard"
      />
      <ListSections value={section} options={[...eventSections, { value: "withdrawn", label: "Withdrawn / removed" }]} onChange={setSection} />
      {error ? <Notice tone="error" message={error} /> : null}
      <View style={sharedStyles.card}>
        {busy ? (
          <Text style={styles.copy}>Loading your events…</Text>
        ) : items.length === 0 ? (
          <Notice message="No events in this section." />
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onOpenEvent(item.event.id)}
              style={styles.item}
            >
              <View style={styles.flex}>
                <Text style={styles.title}>{item.event.title}</Text>
                <Text style={styles.copy}>{item.event.organization.name}</Text>
                <Text style={styles.meta}>
                  {new Date(item.event.startsAt).toLocaleString()} ·{" "}
                  {item.event.displayStatus}
                </Text>
                <Text style={styles.assignment}>
                  {item.status} · Attendance {item.attendanceStatus}
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </Pressable>
          ))
        )}
      </View>
      <PageControls {...list} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: spacing.sm },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  flex: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 16, fontWeight: "900" },
  copy: { color: colors.textMuted },
  meta: { color: colors.primary, fontSize: 11, fontWeight: "900" },
  assignment: { color: colors.text, fontSize: 12, fontWeight: "700" },
  arrow: { color: colors.primary, fontSize: 24 },
});
