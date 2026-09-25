import { ListWindow } from "../../components/lists/ListControls";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { describeApiFailure } from "../../api/apiError";
import { listOrganizationMembers } from "../memberships/administration/membershipAdministration.api";
import type { OrganizationMember } from "../memberships/administration/membershipAdministration.types";
import {
  AdministrativeAreaMapSearch,
  COLOMBO_MAP_CENTER,
  LocationPicker,
  type MapBoundaryFeatureCollection,
  type MapLocation,
  type MapMarkerFeature,
} from "../maps";
import { getOrganizationIncidentDetail } from "../organizations/workspace/organizationIncidentDiscovery.api";
import type { OrganizationIncidentDetail } from "../organizations/workspace/organizationIncidentDiscovery.types";
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
import "./cleanupEvent.css";

type Props = {
  accessToken: string;
  organizationId: string;
  incidentId?: string;
  initialDraftId?: string;
  onBack?: () => void;
};
type Notice = { tone: "success" | "error"; message: string };

function defaultStart(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
function localDateTime(value?: string | null): string {
  if (!value) return defaultStart();
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
function incidentMarker(
  incident: OrganizationIncidentDetail,
): MapMarkerFeature {
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

export function CleanupEventDraftEditor({ accessToken, organizationId, incidentId, initialDraftId }: Props) {
  const [draftCursor, setDraftCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [drafts, setDrafts] = useState<CleanupEventDraft[]>([]);
  const [selected, setSelected] = useState<CleanupEventDraft>();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [linkedIncident, setLinkedIncident] =
    useState<OrganizationIncidentDetail>();
  const [showCreate, setShowCreate] = useState(Boolean(incidentId));
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>();
  const [location, setLocation] = useState<MapLocation>(COLOMBO_MAP_CENTER);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [boundary, setBoundary] = useState<MapBoundaryFeatureCollection>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [address, setAddress] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart());
  const [capacity, setCapacity] = useState("");
  const [coordinatorMembershipId, setCoordinatorMembershipId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [draftPage, memberPage] = await Promise.all([
        listDrafts(accessToken, organizationId),
        listOrganizationMembers(accessToken, organizationId, {
          status: "ACTIVE",
        }),
      ]);
      setDrafts(draftPage.items);
      setDraftCursor(draftPage.nextCursor);
      setMembers(memberPage.items);
      if (initialDraftId)
        setSelected(
          await getDraft(accessToken, organizationId, initialDraftId),
        );
    } catch (reason) {
      setNotice({
        tone: "error",
        message: describeApiFailure(
          reason,
          "Unable to load cleanup-event drafts.",
        ).message,
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, initialDraftId, organizationId]);
  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function loadMoreDrafts() {
    if (!draftCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listDrafts(accessToken, organizationId, draftCursor);
      setDrafts(current => [...current, ...page.items]);
      setDraftCursor(page.nextCursor);
    } catch (reason) { setNotice({ tone: "error", message: describeApiFailure(reason).message }); } finally { setLoadingMore(false); }
  }
  const activeIncidentId = incidentId ?? selected?.incidentId ?? null;
  useEffect(() => {
    if (!activeIncidentId) return;
    let active = true;
    void getOrganizationIncidentDetail(
      accessToken,
      organizationId,
      activeIncidentId,
    )
      .then((incident) => {
        if (!active) return;
        setLinkedIncident(incident);
        setLocation({
          latitude: incident.latitude,
          longitude: incident.longitude,
        });
        setLocationConfirmed(true);
      })
      .catch((reason) => {
        if (active)
          setNotice({
            tone: "error",
            message: describeApiFailure(
              reason,
              "Unable to load the linked incident.",
            ).message,
          });
      });
    return () => {
      active = false;
    };
  }, [accessToken, activeIncidentId, organizationId]);

  function resetForm(): void {
    setTitle("");
    setDescription("");
    setInstructions("");
    setAddress("");
    setStartsAt(defaultStart());
    setCapacity("");
    setLocation(COLOMBO_MAP_CENTER);
    setLocationConfirmed(Boolean(incidentId));
    setBoundary(undefined);
  }
  async function deleteDraft(draft: CleanupEventDraft) {
    if (busy || !window.confirm(`Delete draft "${draft.title}"? This cannot be undone.`)) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await discardDraft(accessToken, organizationId, draft.id);
      setDrafts(items => items.filter(item => item.id !== draft.id));
      if (selected?.id === draft.id) {
        setSelected(undefined);
        setShowCreate(false);
        resetForm();
      }
      setNotice({ tone: "success", message: "Draft deleted." });
    } catch (reason) {
      setNotice({ tone: "error", message: describeApiFailure(reason, "Unable to delete this draft.").message });
    } finally { setBusy(false); }
  }

  function openDraft(draft: CleanupEventDraft): void {
    setSelected(draft);
    setShowCreate(false);
    setTitle(draft.title);
    setDescription(draft.description);
    setInstructions(draft.publicInstructions ?? "");
    setAddress(draft.eventAddress ?? "");
    setStartsAt(localDateTime(draft.startsAt));
    setCapacity(draft.capacity?.toString() ?? "");
    setLocation({
      latitude: draft.eventLatitude,
      longitude: draft.eventLongitude,
    });
    setLocationConfirmed(true);
    setBoundary(undefined);
  }
  const availableCoordinators = useMemo(
    () =>
      members.filter(
        (member) =>
          !selected?.coordinators.some(
            ({ membershipId }) => membershipId === member.id,
          ),
      ),
    [members, selected],
  );

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    const linked = Boolean(incidentId ?? selected?.incidentId);
    if (!linked && !locationConfirmed) {
      setNotice({
        tone: "error",
        message: "Confirm the event location before saving.",
      });
      return;
    }
    setBusy(true);
    setNotice(undefined);
    try {
      const input = {
        title,
        description,
        publicInstructions: instructions || null,
        eventAddress: address || null,
        startsAt: new Date(startsAt).toISOString(),
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
      setDrafts((current) => [
        saved,
        ...current.filter(({ id }) => id !== saved.id),
      ]);
      openDraft(saved);
      setNotice({
        tone: "success",
        message: selected ? "Draft updated." : "Private draft created.",
      });
    } catch (reason) {
      setNotice({
        tone: "error",
        message: describeApiFailure(reason, "Unable to save the cleanup event.")
          .message,
      });
    } finally {
      setBusy(false);
    }
  }

  async function refreshDraft(id: string): Promise<void> {
    const draft = await getDraft(accessToken, organizationId, id);
    setDrafts((items) => items.map((item) => (item.id === id ? draft : item)));
    openDraft(draft);
  }
  const marker =
    activeIncidentId && linkedIncident?.id === activeIncidentId
      ? incidentMarker(linkedIncident)
      : undefined;

  if (loading)
    return (
      <section className="event-editor">
        <p>Loading cleanup events…</p>
      </section>
    );
  return (
    <section className="event-editor">
      <header className="event-editor-header">
        <div>

          <span>ORGANIZATION CLEANUP</span>
          <h1>Cleanup events</h1>

        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(undefined);
            resetForm();
            setShowCreate(true);
          }}
        >
          New event
        </button>
      </header>
      {notice && (
        <p
          className={`event-editor-notice ${notice.tone === "error" ? "error" : ""}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.message}
        </p>
      )}
      {!showCreate && !selected && (
        <div className="event-editor-item-list">
          {drafts.length === 0 ? (
            <div className="event-editor-empty">
              <strong>No private drafts</strong>
              <p>Create a cleanup event to begin.</p>
            </div>
          ) : (
            <ListWindow items={drafts} hasMore={Boolean(draftCursor)} busy={loadingMore} loadMore={() => void loadMoreDrafts()} >{visible => visible.map((draft) => (
              <article key={draft.id}>
                <span>
                  <strong>{draft.title}</strong>
                  <small>
                    {localDateTime(draft.startsAt).replace("T", " · ")} ·{" "}
                    {draft.locationLockedToIncident
                      ? "Incident location"
                      : "Direct location"}
                  </small>
                </span>
                <div className="event-draft-row-actions">
                  <button type="button" disabled={busy} onClick={() => openDraft(draft)}>Continue</button>
                  <button type="button" className="event-draft-delete" disabled={busy}
                    aria-label={`Delete draft: ${draft.title}`} title="Delete draft"
                    onClick={() => void deleteDraft(draft)}>&times;</button>
                </div>
              </article>
            ))}</ListWindow>
          )}
        </div>
      )}
      {(showCreate || selected) && (
        <div className="event-editor-layout">
          <form className="event-editor-panel" onSubmit={save}>
            <div className="event-editor-section-heading">
              <span>01</span>
              <div>
                <h2>{selected ? "Event details" : "Create event"}</h2>

              </div>
              {selected && <button type="button" className="event-draft-delete" disabled={busy}
                aria-label={`Delete draft: ${selected.title}`} title="Delete draft"
                onClick={() => void deleteDraft(selected)}>&times;</button>}
            </div>
            <div className="event-editor-form-grid">
              <label>
                Title
                <input
                  value={title}
                  minLength={3}
                  maxLength={160}
                  required
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label>
                Start date and time
                <input
                  type="datetime-local"
                  value={startsAt}
                  required
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </label>
              <label>
                Volunteer capacity (optional)
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </label>
              <label className="wide">
                Description
                <textarea
                  value={description}
                  minLength={10}
                  maxLength={5000}
                  required
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label className="wide">
                Public instructions
                <textarea
                  value={instructions}
                  maxLength={3000}
                  onChange={(event) => setInstructions(event.target.value)}
                />
              </label>
              <label className="wide">
                Address or meeting note
                <input
                  value={address}
                  maxLength={500}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </label>
            </div>
            {marker ? (
              <div className="event-editor-linked">
                <strong>Location locked to: {linkedIncident?.title}</strong>

                <LocationPicker
                  value={location}
                  disabled
                  confirmed
                  referenceMarker={marker}
                  focusReferenceLabel="Focus incident"
                  onConfirm={() => undefined}
                />
              </div>
            ) : (
              <>
                <AdministrativeAreaMapSearch
                  accessToken={accessToken}
                  onBoundaryChange={setBoundary}
                />
                <LocationPicker
                  value={location}
                  boundaries={boundary}
                  disabled={busy}
                  confirmed={locationConfirmed}
                  confirmLabel="Confirm event location"
                  onChange={(value) => {
                    setLocation(value);
                    setLocationConfirmed(false);
                  }}
                  onConfirm={(value) => {
                    setLocation(value);
                    setLocationConfirmed(true);
                  }}
                />
              </>
            )}
            <div className="event-editor-actions">
              <button disabled={busy}>
                {busy ? "Saving…" : selected ? "Save changes" : "Create draft"}
              </button>

            </div>
          </form>
          {selected && (
            <>
              <section className="event-editor-panel">
                <div className="event-editor-section-heading">
                  <span>02</span>
                  <div>
                    <h2>Coordinators</h2>

                  </div>
                </div>
                <div className="event-editor-coordinator-form">
                  <select
                    value={coordinatorMembershipId}
                    onChange={(event) =>
                      setCoordinatorMembershipId(event.target.value)
                    }
                  >
                    <option value="">Select an active member</option>
                    {availableCoordinators.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.user.fullName || member.user.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !coordinatorMembershipId}
                    onClick={() =>
                      void (async () => {
                        setBusy(true);
                        try {
                          await assignCoordinator(
                            accessToken,
                            organizationId,
                            selected.id,
                            coordinatorMembershipId,
                          );
                          await refreshDraft(selected.id);
                          setCoordinatorMembershipId("");
                        } finally {
                          setBusy(false);
                        }
                      })()
                    }
                  >
                    Assign
                  </button>
                </div>
                <div className="event-editor-item-list">
                  {selected.coordinators.map((coordinator) => (
                    <article key={coordinator.id}>
                      <span>
                        <strong>
                          {coordinator.member.fullName ||
                            coordinator.member.email}
                        </strong>
                        <small>{coordinator.member.role}</small>
                      </span>
                      <button
                        className="danger"
                        type="button"
                        onClick={() =>
                          void (async () => {
                            await removeCoordinator(
                              accessToken,
                              organizationId,
                              selected.id,
                              coordinator.membershipId,
                            );
                            await refreshDraft(selected.id);
                          })()
                        }
                      >
                        Remove
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <CleanupEventPublishPanel
                accessToken={accessToken}
                organizationId={organizationId}
                eventId={selected.id}
                onPublished={(result) => {
                  setDrafts((items) =>
                    items.filter(({ id }) => id !== selected.id),
                  );
                  setSelected(undefined);
                  setNotice({
                    tone: "success",
                    message: result.incidentUpdated
                      ? "Event published and the linked incident was claimed."
                      : "Event published.",
                  });
                }}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
