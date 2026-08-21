import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { describeApiFailure } from "../../api/apiError";
import { Button, Field, Notice, PageHeader, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { listOrganizationMembers } from "../memberships/administration/membershipAdministration.api";
import type { OrganizationMember } from "../memberships/administration/membershipAdministration.types";
import { COLOMBO_MAP_CENTER, LocationPicker, type MapLocation } from "../map";
import {
  assignCoordinator,
  createDraft,
  discardDraft,
  getDraft,
  listDrafts,
  removeCoordinator,
  removeSession,
  saveSession,
  updateDraft,
} from "./cleanupEvent.api";
import type {
  CleanupEventDraft,
  CleanupEventSessionInput,
  EventSession,
} from "./cleanupEvent.types";
import { CleanupEventPublishPanel } from "./CleanupEventPublishPanel";

type Props = {
  accessToken: string;
  organizationId: string;
  incidentId?: string;
  initialDraftId?: string;
  onBack: () => void;
  onMapInteractionChange?: (interacting: boolean) => void;
};

function tomorrow(): string {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

function displayName(member: OrganizationMember): string {
  return member.user.fullName?.trim() || member.user.email;
}

export function CleanupEventDraftScreen({
  accessToken,
  organizationId,
  incidentId,
  initialDraftId,
  onBack,
  onMapInteractionChange,
}: Props) {
  const [mode, setMode] = useState<"list" | "create" | "edit">(
    incidentId ? "create" : "list",
  );
  const [drafts, setDrafts] = useState<CleanupEventDraft[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [selected, setSelected] = useState<CleanupEventDraft>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [address, setAddress] = useState("");
  const [meetingAddress, setMeetingAddress] = useState("");
  const [meetingAtEvent, setMeetingAtEvent] = useState(false);
  const [location, setLocation] = useState<MapLocation>(COLOMBO_MAP_CENTER);
  const [locationConfirmed, setLocationConfirmed] = useState(false);

  const [editingSessionId, setEditingSessionId] = useState<string>();
  const [sessionDate, setSessionDate] = useState(tomorrow());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [capacity, setCapacity] = useState("25");
  const [sessionAddress, setSessionAddress] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionAtEvent, setSessionAtEvent] = useState(true);

  function openDraft(draft: CleanupEventDraft): void {
    setSelected(draft);
    setTitle(draft.title);
    setDescription(draft.description);
    setInstructions(draft.publicInstructions ?? "");
    setAddress(draft.eventAddress ?? "");
    setMeetingAddress(draft.meetingAddress ?? "");
    setMeetingAtEvent(
      draft.meetingLatitude === draft.eventLatitude &&
      draft.meetingLongitude === draft.eventLongitude,
    );
    setLocation({ latitude: draft.eventLatitude, longitude: draft.eventLongitude });
    setLocationConfirmed(true);
    setEditingSessionId(undefined);
    setMode("edit");
  }

  async function reloadDraft(draftId: string): Promise<void> {
    const refreshed = await getDraft(accessToken, organizationId, draftId);
    setSelected(refreshed);
    setDrafts((current) => current.map((draft) => draft.id === refreshed.id ? refreshed : draft));
  }

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      void Promise.all([
        listDrafts(accessToken, organizationId),
        initialDraftId ? getDraft(accessToken, organizationId, initialDraftId) : Promise.resolve(undefined),
        (async () => {
          const loaded: OrganizationMember[] = [];
          let cursor: string | undefined;
          do {
            const page = await listOrganizationMembers(accessToken, organizationId, cursor);
            loaded.push(...page.items.filter((member) => member.status === "ACTIVE"));
            cursor = page.nextCursor ?? undefined;
          } while (cursor);
          return loaded;
        })(),
      ])
        .then(([draftPage, initialDraft, loadedMembers]) => {
          if (!active) return;
          setDrafts(draftPage.items);
          setMembers(loadedMembers);
          if (initialDraft) openDraft(initialDraft);
        })
        .catch((reason: unknown) => {
          if (active) {
            setNotice({
              tone: "error",
              message: describeApiFailure(reason, "Unable to load cleanup-event drafts.").message,
            });
          }
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [accessToken, initialDraftId, organizationId]);

  const availableMembers = useMemo(
    () => members.filter(
      (member) => !selected?.coordinators.some(
        (coordinator) => coordinator.membershipId === member.id,
      ),
    ),
    [members, selected?.coordinators],
  );

  async function run(action: () => Promise<void>, fallback: string): Promise<void> {
    setBusy(true);
    setNotice(undefined);
    try {
      await action();
    } catch (reason) {
      setNotice({ tone: "error", message: describeApiFailure(reason, fallback).message });
    } finally {
      setBusy(false);
    }
  }

  function resetDraftForm(): void {
    setTitle("");
    setDescription("");
    setInstructions("");
    setAddress("");
    setMeetingAddress("");
    setMeetingAtEvent(false);
    setLocation(COLOMBO_MAP_CENTER);
    setLocationConfirmed(false);
  }

  function saveDraftDetails(): void {
    void run(async () => {
      if (mode === "create") {
        const created = await createDraft(accessToken, organizationId, {
          incidentId: incidentId ?? null,
          title: title.trim(),
          description: description.trim(),
          publicInstructions: instructions.trim() || null,
          eventLatitude: location.latitude,
          eventLongitude: location.longitude,
          eventAddress: address.trim() || null,
          meetingLatitude: meetingAtEvent ? location.latitude : null,
          meetingLongitude: meetingAtEvent ? location.longitude : null,
          meetingAddress: meetingAddress.trim() || null,
        });
        setDrafts((current) => [created, ...current]);
        openDraft(created);
        setNotice({ tone: "success", message: "Private cleanup-event draft saved." });
      } else if (selected) {
        const updated = await updateDraft(accessToken, organizationId, selected.id, {
          title: title.trim(),
          description: description.trim(),
          publicInstructions: instructions.trim() || null,
          eventLatitude: location.latitude,
          eventLongitude: location.longitude,
          eventAddress: address.trim() || null,
          meetingLatitude: meetingAtEvent ? location.latitude : null,
          meetingLongitude: meetingAtEvent ? location.longitude : null,
          meetingAddress: meetingAddress.trim() || null,
        });
        openDraft(updated);
        setDrafts((current) => current.map((draft) => draft.id === updated.id ? updated : draft));
        setNotice({ tone: "success", message: "Draft details updated." });
      }
    }, "Unable to save the cleanup-event draft.");
  }

  function resetSessionForm(): void {
    setEditingSessionId(undefined);
    setSessionDate(tomorrow());
    setStartTime("09:00");
    setEndTime("11:00");
    setCapacity("25");
    setSessionAddress("");
    setSessionNotes("");
    setSessionAtEvent(true);
  }

  function editSession(session: EventSession): void {
    setEditingSessionId(session.id);
    setSessionDate(session.sessionDate);
    setStartTime(session.startTime.slice(0, 5));
    setEndTime(session.endTime.slice(0, 5));
    setCapacity(session.capacity?.toString() ?? "");
    setSessionAddress(session.locationAddress ?? "");
    setSessionNotes(session.notes ?? "");
    setSessionAtEvent(session.locationLatitude !== null);
  }

  function sessionInput(): CleanupEventSessionInput {
    return {
      sessionDate,
      startTime: `${startTime}:00`,
      endTime: `${endTime}:00`,
      capacity: capacity ? Number(capacity) : null,
      locationLatitude: sessionAtEvent ? selected!.eventLatitude : null,
      locationLongitude: sessionAtEvent ? selected!.eventLongitude : null,
      locationAddress: sessionAddress.trim() || null,
      notes: sessionNotes.trim() || null,
    };
  }

  if (mode === "list") {
    return (
      <View style={styles.container}>
        <PageHeader
          eyebrow="Private planning"
          title="Cleanup-event drafts"
          subtitle="Drafts do not claim incidents or appear publicly."
          onBack={onBack}
          backLabel="Overview"
        />
        {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}
        <Button label="New direct draft" onPress={() => { resetDraftForm(); setMode("create"); }} />
        {drafts.length === 0 ? <Text style={styles.empty}>No private drafts yet.</Text> : drafts.map((draft) => (
          <Pressable key={draft.id} onPress={() => openDraft(draft)} style={sharedStyles.card}>
            <Text style={styles.title}>{draft.title}</Text>
            <Text style={styles.muted}>{draft.incidentId ? "Incident-linked" : "Direct"} · {draft.sessions.length} sessions · {draft.coordinators.length} coordinators</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageHeader
        eyebrow={mode === "create" ? "New private draft" : "Edit private draft"}
        title={mode === "create" ? "Plan cleanup activity" : selected?.title ?? "Cleanup-event draft"}
        subtitle="Set the event location, sessions, and coordinators before publishing."
        onBack={() => setMode("list")}
        backLabel="Drafts"
      />
      {incidentId && mode === "create" ? <Notice message={`Linked incident: ${incidentId}`} /> : null}
      {notice ? <Notice tone={notice.tone} message={notice.message} /> : null}

      <View style={sharedStyles.card}>
        <Field label="Title" value={title} onChangeText={setTitle} required />
        <Field label="Description" value={description} onChangeText={setDescription} multiline required />
        <Field label="Public instructions" value={instructions} onChangeText={setInstructions} multiline />
        <Field label="Event address" value={address} onChangeText={setAddress} />
        <Field label="Meeting address" value={meetingAddress} onChangeText={setMeetingAddress} />
        <LocationPicker
          value={location}
          disabled={busy}
          onMapInteractionChange={onMapInteractionChange}
          onChange={(value) => { setLocation(value); setLocationConfirmed(false); }}
          onConfirm={(value) => { setLocation(value); setLocationConfirmed(true); }}
        />
        <Pressable onPress={() => setMeetingAtEvent((current) => !current)} style={styles.toggle}>
          <Text style={styles.toggleMark}>{meetingAtEvent ? "✓" : "○"}</Text>
          <Text style={styles.toggleText}>Use event location as meeting point</Text>
        </Pressable>
        <Button
          label={busy ? "Saving…" : mode === "create" ? "Save private draft" : "Save changes"}
          loading={busy}
          disabled={!locationConfirmed || title.trim().length < 3 || description.trim().length < 10}
          onPress={saveDraftDetails}
        />
      </View>

      {mode === "edit" && selected ? (
        <>
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.sectionTitle}>Sessions</Text>
            <TextInput style={styles.input} value={sessionDate} onChangeText={setSessionDate} placeholder="YYYY-MM-DD" />
            <View style={styles.row}><TextInput style={[styles.input, styles.flex]} value={startTime} onChangeText={setStartTime} placeholder="09:00" /><TextInput style={[styles.input, styles.flex]} value={endTime} onChangeText={setEndTime} placeholder="11:00" /></View>
            <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="Capacity" />
            <TextInput style={styles.input} value={sessionAddress} onChangeText={setSessionAddress} placeholder="Session address" />
            <TextInput style={[styles.input, styles.multiline]} value={sessionNotes} onChangeText={setSessionNotes} multiline placeholder="Session notes" />
            <Pressable onPress={() => setSessionAtEvent((current) => !current)} style={styles.toggle}><Text style={styles.toggleMark}>{sessionAtEvent ? "✓" : "○"}</Text><Text style={styles.toggleText}>Use event coordinates</Text></Pressable>
            <Button label={editingSessionId ? "Update session" : "Add session"} loading={busy} onPress={() => void run(async () => { await saveSession(accessToken, organizationId, selected.id, sessionInput(), editingSessionId); await reloadDraft(selected.id); resetSessionForm(); setNotice({ tone: "success", message: "Draft session saved." }); }, "Unable to save the session.")} />
            {editingSessionId ? <Button label="Cancel session edit" variant="secondary" onPress={resetSessionForm} /> : null}
            {selected.sessions.map((session) => <View key={session.id} style={styles.item}><View style={styles.flex}><Text style={styles.itemTitle}>{session.sessionDate} · {session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)}</Text><Text style={styles.muted}>{session.capacity ?? "Open"} capacity</Text></View><Button label="Edit" variant="secondary" onPress={() => editSession(session)} /><Button label="Remove" variant="danger" onPress={() => void run(async () => { await removeSession(accessToken, organizationId, selected.id, session.id); await reloadDraft(selected.id); }, "Unable to remove the session.")} /></View>)}
          </View>

          <View style={sharedStyles.card}>
            <Text style={sharedStyles.sectionTitle}>Coordinators</Text>
            <Text style={sharedStyles.sectionSubtitle}>Assignment does not change an organization role.</Text>
            {selected.coordinators.map((coordinator) => <View key={coordinator.id} style={styles.item}><View style={styles.flex}><Text style={styles.itemTitle}>{coordinator.member.fullName || coordinator.member.email}</Text><Text style={styles.muted}>{coordinator.member.role}</Text></View><Button label="Remove" variant="danger" onPress={() => void run(async () => { await removeCoordinator(accessToken, organizationId, selected.id, coordinator.membershipId); await reloadDraft(selected.id); }, "Unable to remove the coordinator.")} /></View>)}
            {availableMembers.length > 0 ? <Text style={styles.label}>ASSIGN ACTIVE MEMBER</Text> : null}
            {availableMembers.map((member) => <Button key={member.id} label={`Assign ${displayName(member)}`} variant="secondary" onPress={() => void run(async () => { await assignCoordinator(accessToken, organizationId, selected.id, member.id); await reloadDraft(selected.id); setNotice({ tone: "success", message: "Coordinator assigned." }); }, "Unable to assign the coordinator.")} />)}
          </View>

          <CleanupEventPublishPanel
            accessToken={accessToken}
            organizationId={organizationId}
            eventId={selected.id}
            onPublished={(result) => {
              setDrafts((current) => current.filter((draft) => draft.id !== selected.id));
              setSelected(undefined);
              setMode("list");
              setNotice({
                tone: "success",
                message: result.incidentUpdated
                  ? "Event published and the linked incident was claimed."
                  : "Direct cleanup event published.",
              });
            }}
          />

          <Button label="Discard private draft" variant="danger" onPress={() => Alert.alert("Discard draft?", "All draft sessions and coordinator assignments will be removed.", [{ text: "Keep draft", style: "cancel" }, { text: "Discard", style: "destructive", onPress: () => void run(async () => { await discardDraft(accessToken, organizationId, selected.id); setDrafts((current) => current.filter((draft) => draft.id !== selected.id)); setSelected(undefined); setMode("list"); setNotice({ tone: "success", message: "Private draft discarded." }); }, "Unable to discard the draft.") }])} />
        </>
      ) : null}

      <Button label={mode === "edit" ? "All drafts" : "Cancel"} variant="secondary" onPress={() => { setMode("list"); setSelected(undefined); onMapInteractionChange?.(false); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  empty: { padding: spacing.lg, color: colors.textMuted, textAlign: "center" },
  input: { minHeight: 46, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, color: colors.text },
  multiline: { minHeight: 90, paddingTop: spacing.sm, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  toggle: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  toggleMark: { color: colors.primary, fontSize: 20, fontWeight: "900" },
  toggleText: { flex: 1, color: colors.text, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  label: { color: colors.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
});
