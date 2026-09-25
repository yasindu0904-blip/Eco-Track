import { ListWindow } from "../../components/lists/ListControls";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { describeApiFailure } from "../../api/apiError";
import {
  Button,
  Field,
  Notice,
  PageHeader,
  sharedStyles,
} from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { listOrganizationMembers } from "../memberships/administration/membershipAdministration.api";
import type { OrganizationMember } from "../memberships/administration/membershipAdministration.types";
import {
  AdministrativeAreaMapSearch,
  COLOMBO_MAP_CENTER,
  LocationPicker,
  type MapBoundaryFeatureCollection,
  type MapLocation,
  type MapMarkerFeature,
} from "../map";
import { getOrganizationIncidentDetail } from "../organizations/organizationIncidentDiscovery.api";
import type { OrganizationIncidentDetail } from "../organizations/organizationIncidentDiscovery.types";
import {
  assignCoordinator,
  createDraft,
  discardDraft,
  getDraft,
  listDrafts,
  removeCoordinator,
  updateDraft,
} from "./cleanupEvent.api";
import type { CleanupEventDraft } from "./cleanupEvent.types";
import { CleanupEventPublishPanel } from "./CleanupEventPublishPanel";
type Props = {
  accessToken: string;
  organizationId: string;
  incidentId?: string;
  initialDraftId?: string;
  onBack: () => void;
  onMapInteractionChange?: (interacting: boolean) => void;
};
function tomorrow() {
  const date = new Date(Date.now() + 86_400_000);
  return date.toISOString().slice(0, 10);
}
function marker(incident: OrganizationIncidentDetail): MapMarkerFeature {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [incident.longitude, incident.latitude],
    },
    properties: {
      id: incident.id,
      kind: "INCIDENT",
      title: incident.title,
      status: incident.status,
      category: incident.category.name,
    },
  };
}
function dateParts(value?: string | null) {
  const date = value
    ? new Date(value)
    : new Date(`${tomorrow()}T09:00:00+05:30`);
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  ).toISOString();
  return { day: local.slice(0, 10), time: local.slice(11, 16) };
}
export function CleanupEventDraftScreen({
  accessToken,
  organizationId,
  incidentId,
  initialDraftId,
  onBack,
  onMapInteractionChange,
}: Props) {
  const initial = dateParts();
  const [draftCursor, setDraftCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [drafts, setDrafts] = useState<CleanupEventDraft[]>([]);
  const [selected, setSelected] = useState<CleanupEventDraft>();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [linkedIncident, setLinkedIncident] =
    useState<OrganizationIncidentDetail>();
  const [creating, setCreating] = useState(Boolean(incidentId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState<MapLocation>(COLOMBO_MAP_CENTER);
  const [confirmed, setConfirmed] = useState(false);
  const [boundary, setBoundary] = useState<MapBoundaryFeatureCollection>();
  const [coordinatorId, setCoordinatorId] = useState("");
  const load = useCallback(async () => {
    try {
      const [page, memberPage] = await Promise.all([
        listDrafts(accessToken, organizationId),
        listOrganizationMembers(accessToken, organizationId),
      ]);
      setDrafts(page.items);
      setDraftCursor(page.nextCursor);
      setMembers(memberPage.items);
      if (initialDraftId)
        open(await getDraft(accessToken, organizationId, initialDraftId));
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to load cleanup drafts.").message,
      );
    }
  }, [accessToken, initialDraftId, organizationId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function loadMoreDrafts() {
    if (!draftCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listDrafts(accessToken, organizationId, draftCursor);
      setDrafts(current => [...current, ...page.items]);
      setDraftCursor(page.nextCursor);
    } catch (reason) { setError(describeApiFailure(reason).message); } finally { setLoadingMore(false); }
  }
  const activeIncidentId = incidentId ?? selected?.incidentId ?? null;
  useEffect(() => {
    if (!activeIncidentId) {
      setLinkedIncident(undefined);
      return;
    }
    let active = true;
    void getOrganizationIncidentDetail(
      accessToken,
      organizationId,
      activeIncidentId,
    )
      .then((value) => {
        if (active) {
          setLinkedIncident(value);
          setLocation({ latitude: value.latitude, longitude: value.longitude });
          setConfirmed(true);
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            describeApiFailure(reason, "Unable to load linked incident.")
              .message,
          );
      });
    return () => {
      active = false;
    };
  }, [accessToken, activeIncidentId, organizationId]);
  function confirmDeleteDraft(draft: CleanupEventDraft) {
    if (busy) return;
    Alert.alert("Delete draft?", `Delete "${draft.title}"? This cannot be undone.`, [
      { text: "Keep", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteDraft(draft) },
    ]);
  }
  async function deleteDraft(draft: CleanupEventDraft) {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await discardDraft(accessToken, organizationId, draft.id);
      setDrafts(items => items.filter(item => item.id !== draft.id));
      if (selected?.id === draft.id) { reset(); setCreating(false); }
      setMessage("Draft deleted.");
    } catch (reason) {
      setError(describeApiFailure(reason, "Unable to delete this draft.").message);
    } finally { setBusy(false); }
  }
  function deleteControl(draft: CleanupEventDraft) {
    return <Pressable accessibilityRole="button" accessibilityLabel={`Delete draft: ${draft.title}`}
      disabled={busy} style={styles.deleteDraft} onPress={() => confirmDeleteDraft(draft)}>
      <Text style={styles.deleteDraftText}>{"\u00d7"}</Text>
    </Pressable>;
  }
  function open(draft: CleanupEventDraft) {
    const parts = dateParts(draft.startsAt);
    setSelected(draft);
    setCreating(false);
    setTitle(draft.title);
    setDescription(draft.description);
    setInstructions(draft.publicInstructions ?? "");
    setAddress(draft.eventAddress ?? "");
    setDate(parts.day);
    setTime(parts.time);
    setCapacity(draft.capacity?.toString() ?? "");
    setLocation({
      latitude: draft.eventLatitude,
      longitude: draft.eventLongitude,
    });
    setConfirmed(true);
    setBoundary(undefined);
  }
  function reset() {
    const parts = dateParts();
    setSelected(undefined);
    setTitle("");
    setDescription("");
    setInstructions("");
    setAddress("");
    setDate(parts.day);
    setTime(parts.time);
    setCapacity("");
    setLocation(COLOMBO_MAP_CENTER);
    setConfirmed(Boolean(incidentId));
    setBoundary(undefined);
    setCreating(true);
  }
  async function save() {
    const linked = Boolean(incidentId ?? selected?.incidentId);
    if (!title.trim() || description.trim().length < 10) {
      setError("Add a title and a clear description.");
      return;
    }
    if (!linked && !confirmed) {
      setError("Confirm the event location first.");
      return;
    }
    const startsAt = new Date(`${date}T${time}:00+05:30`);
    if (Number.isNaN(startsAt.getTime())) {
      setError("Enter a valid date and time.");
      return;
    }
    setBusy(true);
    try {
      const input = {
        title: title.trim(),
        description: description.trim(),
        publicInstructions: instructions.trim() || null,
        eventAddress: address.trim() || null,
        startsAt: startsAt.toISOString(),
        capacity: capacity ? Number(capacity) : null,
        ...(!linked
          ? {
              eventLatitude: location.latitude,
              eventLongitude: location.longitude,
            }
          : {}),
      };
      const saved = selected
        ? await updateDraft(accessToken, organizationId, selected.id, input)
        : await createDraft(accessToken, organizationId, {
            ...input,
            incidentId: incidentId ?? null,
          });
      setDrafts((items) => [
        saved,
        ...items.filter(({ id }) => id !== saved.id),
      ]);
      open(saved);
      setMessage("Private draft saved.");
      setError(undefined);
    } catch (reason) {
      setError(
        describeApiFailure(reason, "Unable to save this event.").message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh(id: string) {
    const draft = await getDraft(accessToken, organizationId, id);
    setDrafts((items) => items.map((item) => (item.id === id ? draft : item)));
    open(draft);
  }
  const available = useMemo(
    () =>
      members.filter(
        (member) =>
          !selected?.coordinators.some(
            ({ membershipId }) => membershipId === member.id,
          ),
      ),
    [members, selected],
  );
  return (
    <View style={styles.screen}>
      <PageHeader
        eyebrow="Organization cleanup"
        title={
          selected
            ? "Edit cleanup event"
            : creating
              ? "New cleanup event"
              : "Cleanup drafts"
        }

        onBack={onBack}
        backLabel="Workspace"
        action={<Button label="New" variant="secondary" onPress={reset} />}
      />
      {error ? <Notice tone="error" message={error} /> : null}
      {message ? <Notice tone="success" message={message} /> : null}
      {!creating && !selected ? (
        <View style={sharedStyles.card}>
          {drafts.length === 0 ? (
            <Notice message="No private drafts yet." />
          ) : (
            <ListWindow items={drafts} hasMore={Boolean(draftCursor)} busy={loadingMore} loadMore={() => void loadMoreDrafts()} >{visible => visible.map((draft) => (
              <View key={draft.id} style={styles.draftRow}>
              <Pressable
                style={styles.item}
                disabled={busy}
                onPress={() => open(draft)}
              >
                <Text style={styles.title}>{draft.title}</Text>
                <Text style={styles.copy}>
                  {draft.startsAt
                    ? new Date(draft.startsAt).toLocaleString()
                    : "Time not set"}
                </Text>
              </Pressable>
                {deleteControl(draft)}
              </View>
            ))}</ListWindow>
          )}
        </View>
      ) : (
        <>
          <View style={sharedStyles.card}>
            <View style={sharedStyles.spacedRow}>
            <Text style={styles.eyebrow}>01 · EVENT DETAILS</Text>
              {selected ? deleteControl(selected) : null}
            </View>
            <Field
              label="Title"
              value={title}
              onChangeText={setTitle}
              required
            />
            <Field
              label="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              required
            />
            <Field
              label="Public instructions"
              value={instructions}
              onChangeText={setInstructions}
              multiline
            />
            <Field
              label="Date (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              required
            />
            <Field
              label="Start time (HH:MM)"
              value={time}
              onChangeText={setTime}
              required
            />
            <Field
              label="Volunteer capacity (optional)"
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
            />
            <Field
              label="Address or meeting note"
              value={address}
              onChangeText={setAddress}
            />
            {linkedIncident ? (
              <>
                <Notice
                  tone="info"
                  message={`Location locked to incident: ${linkedIncident.title}`}
                />
                <LocationPicker
                  value={location}
                  disabled
                  confirmed
                  referenceMarker={marker(linkedIncident)}
                  focusReferenceLabel="Focus incident"
                  onConfirm={() => undefined}
                  onMapInteractionChange={onMapInteractionChange}
                />
              </>
            ) : (
              <>
                <AdministrativeAreaMapSearch
                  accessToken={accessToken}
                  onBoundaryChange={setBoundary}
                />
                <LocationPicker
                  value={location}
                  boundaries={boundary}
                  confirmed={confirmed}
                  onChange={(value) => {
                    setLocation(value);
                    setConfirmed(false);
                  }}
                  onConfirm={(value) => {
                    setLocation(value);
                    setConfirmed(true);
                  }}
                  onMapInteractionChange={onMapInteractionChange}
                />
              </>
            )}
            <Button
              label={selected ? "Save changes" : "Create draft"}
              loading={busy}
              onPress={() => void save()}
            />

          </View>
          {selected ? (
            <>
              <View style={sharedStyles.card}>
                <Text style={styles.eyebrow}>02 · COORDINATORS</Text>
                <Text style={styles.copy}>
                  Assign an active member to manage updates and attendance.
                </Text>
                {available.map((member) => (
                  <Button
                    key={member.id}
                    variant="secondary"
                    label={`Assign ${member.user.fullName || member.user.email}`}
                    disabled={busy}
                    onPress={() =>
                      void (async () => {
                        setCoordinatorId(member.id);
                        await assignCoordinator(
                          accessToken,
                          organizationId,
                          selected.id,
                          member.id,
                        );
                        await refresh(selected.id);
                        setCoordinatorId("");
                      })()
                    }
                    loading={coordinatorId === member.id}
                  />
                ))}
                {selected.coordinators.map((coordinator) => (
                  <View style={styles.row} key={coordinator.id}>
                    <Text style={styles.title}>
                      {coordinator.member.fullName || coordinator.member.email}
                    </Text>
                    <Button
                      label="Remove"
                      variant="danger"
                      onPress={() =>
                        void (async () => {
                          await removeCoordinator(
                            accessToken,
                            organizationId,
                            selected.id,
                            coordinator.membershipId,
                          );
                          await refresh(selected.id);
                        })()
                      }
                    />
                  </View>
                ))}
              </View>
              <CleanupEventPublishPanel
                accessToken={accessToken}
                organizationId={organizationId}
                eventId={selected.id}
                onPublished={() => {
                  setDrafts((items) =>
                    items.filter(({ id }) => id !== selected.id),
                  );
                  setSelected(undefined);
                  setCreating(false);
                  setMessage("Cleanup event published.");
                }}
              />
            </>
          ) : null}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  draftRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  deleteDraft: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  deleteDraftText: { color: "#a33128", fontSize: 28 },
  screen: { gap: spacing.md },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  item: {
    flex: 1,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontWeight: "900" },
  copy: { color: colors.textMuted },
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
