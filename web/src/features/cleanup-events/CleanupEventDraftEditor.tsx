import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { describeApiFailure } from "../../api/apiError";
import {
  listOrganizationMembers,
} from "../memberships/administration/membershipAdministration.api";
import type { OrganizationMember } from "../memberships/administration/membershipAdministration.types";
import { COLOMBO_MAP_CENTER, LocationPicker, type MapLocation } from "../maps";
import {
  addSession,
  assignCoordinator,
  createDraft,
  discardDraft,
  getDraft,
  listDrafts,
  removeCoordinator,
  removeSession,
  updateDraft,
  updateSession,
} from "./cleanupEvent.api";
import type {
  CleanupEventDraft,
  CleanupEventSessionInput,
  EventSession,
} from "./cleanupEvent.types";
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

function tomorrow(): string {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

function memberName(member: OrganizationMember): string {
  return member.user.fullName?.trim() || member.user.email;
}

export function CleanupEventDraftEditor({
  accessToken,
  organizationId,
  incidentId,
  initialDraftId,
  onBack,
}: Props) {
  const [drafts, setDrafts] = useState<CleanupEventDraft[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [selected, setSelected] = useState<CleanupEventDraft>();
  const [showCreate, setShowCreate] = useState(Boolean(incidentId));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>();

  const [createLocation, setCreateLocation] = useState<MapLocation>(COLOMBO_MAP_CENTER);
  const [createLocationConfirmed, setCreateLocationConfirmed] = useState(false);
  const [createMeetingAtEvent, setCreateMeetingAtEvent] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editMeetingAddress, setEditMeetingAddress] = useState("");
  const [editLocation, setEditLocation] = useState<MapLocation>(COLOMBO_MAP_CENTER);
  const [editLocationConfirmed, setEditLocationConfirmed] = useState(true);
  const [editMeetingAtEvent, setEditMeetingAtEvent] = useState(false);

  const [editingSessionId, setEditingSessionId] = useState<string>();
  const [sessionDate, setSessionDate] = useState(tomorrow());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [capacity, setCapacity] = useState("25");
  const [sessionAddress, setSessionAddress] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionAtEvent, setSessionAtEvent] = useState(true);
  const [coordinatorMembershipId, setCoordinatorMembershipId] = useState("");

  function openDraft(draft: CleanupEventDraft): void {
    setSelected(draft);
    setEditTitle(draft.title);
    setEditDescription(draft.description);
    setEditInstructions(draft.publicInstructions ?? "");
    setEditAddress(draft.eventAddress ?? "");
    setEditMeetingAddress(draft.meetingAddress ?? "");
    setEditLocation({ latitude: draft.eventLatitude, longitude: draft.eventLongitude });
    setEditLocationConfirmed(true);
    setEditMeetingAtEvent(
      draft.meetingLatitude === draft.eventLatitude &&
      draft.meetingLongitude === draft.eventLongitude,
    );
    setEditingSessionId(undefined);
  }

  const loadDrafts = useCallback(async (cursor?: string, append = false) => {
    const page = await listDrafts(accessToken, organizationId, cursor);
    setDrafts((current) => append ? [...current, ...page.items] : page.items);
    setNextCursor(page.nextCursor);
  }, [accessToken, organizationId]);

  const refreshDraft = useCallback(async (draftId: string) => {
    const refreshed = await getDraft(accessToken, organizationId, draftId);
    setSelected(refreshed);
    setDrafts((current) => current.map((draft) => draft.id === refreshed.id ? refreshed : draft));
    return refreshed;
  }, [accessToken, organizationId]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      setSelected(undefined);
      setNotice(undefined);
      void Promise.all([
      listDrafts(accessToken, organizationId),
      initialDraftId ? getDraft(accessToken, organizationId, initialDraftId) : Promise.resolve(undefined),
      (async () => {
        const loaded: OrganizationMember[] = [];
        let cursor: string | undefined;
        do {
          const page = await listOrganizationMembers(accessToken, organizationId, {
            status: "ACTIVE",
            cursor,
          });
          loaded.push(...page.items);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        return loaded;
      })(),
      ])
        .then(([draftPage, initialDraft, loadedMembers]) => {
          if (!active) return;
          setDrafts(draftPage.items);
          setNextCursor(draftPage.nextCursor);
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
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [accessToken, initialDraftId, organizationId]);

  const availableCoordinators = useMemo(
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

  function submitCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      const created = await createDraft(accessToken, organizationId, {
        incidentId: incidentId ?? null,
        title: String(data.get("title")),
        description: String(data.get("description")),
        publicInstructions: String(data.get("instructions") || "") || null,
        eventLatitude: createLocation.latitude,
        eventLongitude: createLocation.longitude,
        eventAddress: String(data.get("address") || "") || null,
        meetingLatitude: createMeetingAtEvent ? createLocation.latitude : null,
        meetingLongitude: createMeetingAtEvent ? createLocation.longitude : null,
        meetingAddress: String(data.get("meetingAddress") || "") || null,
      });
      setDrafts((current) => [created, ...current]);
      openDraft(created);
      setShowCreate(false);
      setCreateLocationConfirmed(false);
      form.reset();
      setNotice({ tone: "success", message: "Private cleanup-event draft saved." });
    }, "Unable to save the cleanup-event draft.");
  }

  function saveDraft(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!selected) return;
    void run(async () => {
      const updated = await updateDraft(accessToken, organizationId, selected.id, {
        title: editTitle,
        description: editDescription,
        publicInstructions: editInstructions || null,
        eventLatitude: editLocation.latitude,
        eventLongitude: editLocation.longitude,
        eventAddress: editAddress || null,
        meetingLatitude: editMeetingAtEvent ? editLocation.latitude : null,
        meetingLongitude: editMeetingAtEvent ? editLocation.longitude : null,
        meetingAddress: editMeetingAddress || null,
      });
      openDraft(updated);
      setDrafts((current) => current.map((draft) => draft.id === updated.id ? updated : draft));
      setNotice({ tone: "success", message: "Draft details updated." });
    }, "Unable to update the draft.");
  }

  function sessionInput(): CleanupEventSessionInput {
    return {
      sessionDate,
      startTime: `${startTime}:00`,
      endTime: `${endTime}:00`,
      capacity: capacity ? Number(capacity) : null,
      locationLatitude: sessionAtEvent ? selected!.eventLatitude : null,
      locationLongitude: sessionAtEvent ? selected!.eventLongitude : null,
      locationAddress: sessionAddress || null,
      notes: sessionNotes || null,
    };
  }

  function resetSession(): void {
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

  function saveSession(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!selected) return;
    void run(async () => {
      if (editingSessionId) {
        await updateSession(
          accessToken,
          organizationId,
          selected.id,
          editingSessionId,
          sessionInput(),
        );
      } else {
        await addSession(accessToken, organizationId, selected.id, sessionInput());
      }
      await refreshDraft(selected.id);
      resetSession();
      setNotice({ tone: "success", message: "Draft session saved." });
    }, "Unable to save the draft session.");
  }

  return (
    <section className="event-editor">
      <header className="event-editor-header">
        <div>
          <span>PRIVATE PLANNING WORKSPACE</span>
          <h1>Cleanup-event drafts</h1>
          <p>Create direct or incident-linked plans. Nothing becomes public or claims an incident until publishing.</p>
        </div>
        <div className="event-editor-header-actions">
          {onBack && <button className="secondary" type="button" onClick={onBack}>Back</button>}
          <button type="button" onClick={() => { setSelected(undefined); setShowCreate(true); }}>
            New draft
          </button>
        </div>
      </header>

      {notice && <p className={`event-editor-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.message}</p>}

      {showCreate && (
        <form className="event-editor-panel" onSubmit={submitCreate}>
          <div className="event-editor-section-heading"><span>01</span><div><h2>Draft details</h2><p>Required planning information remains organization-private.</p></div></div>
          {incidentId && <p className="event-editor-linked">Linked incident: <code>{incidentId}</code></p>}
          <div className="event-editor-fields">
            <label>Title<input name="title" minLength={3} maxLength={160} required /></label>
            <label className="wide">Description<textarea name="description" minLength={10} maxLength={5000} rows={5} required /></label>
            <label className="wide">Public instructions<textarea name="instructions" maxLength={3000} rows={3} /></label>
            <label>Event address<input name="address" maxLength={500} /></label>
            <label>Meeting address<input name="meetingAddress" maxLength={500} /></label>
          </div>
          <div className="event-editor-section-heading"><span>02</span><div><h2>Event location</h2><p>Move the map and confirm the exact Sri Lankan location.</p></div></div>
          <LocationPicker
            value={createLocation}
            disabled={busy}
            onChange={(value) => { setCreateLocation(value); setCreateLocationConfirmed(false); }}
            onConfirm={(value) => { setCreateLocation(value); setCreateLocationConfirmed(true); }}
          />
          <label className="event-editor-check"><input type="checkbox" checked={createMeetingAtEvent} onChange={(event) => setCreateMeetingAtEvent(event.target.checked)} />Use the event location as the meeting point</label>
          <div className="event-editor-actions"><button type="button" className="secondary" onClick={() => setShowCreate(false)}>Cancel</button><button disabled={busy || !createLocationConfirmed}>{busy ? "Saving…" : "Save private draft"}</button></div>
        </form>
      )}

      {!showCreate && !selected && (
        <section className="event-editor-panel">
          <div className="event-editor-section-heading"><span>01</span><div><h2>Organization drafts</h2><p>Choose a draft to manage its details, sessions, and coordinators.</p></div></div>
          {loading ? <p>Loading drafts…</p> : drafts.length === 0 ? <div className="event-editor-empty"><strong>No private drafts yet</strong><p>Create a direct event or start from a covered incident.</p></div> : <div className="event-editor-draft-list">{drafts.map((draft) => <button type="button" key={draft.id} onClick={() => openDraft(draft)}><span><strong>{draft.title}</strong><small>{draft.incidentId ? "Incident-linked draft" : "Direct draft"}</small></span><span>{draft.sessions.length} sessions · {draft.coordinators.length} coordinators</span></button>)}</div>}
          {nextCursor && <button className="secondary" type="button" disabled={busy} onClick={() => void run(() => loadDrafts(nextCursor, true), "Unable to load more drafts.")}>Load more drafts</button>}
        </section>
      )}

      {selected && !showCreate && (
        <div className="event-editor-workspace">
          <aside className="event-editor-draft-sidebar">
            <button className="secondary" type="button" onClick={() => setSelected(undefined)}>← All drafts</button>
            {drafts.map((draft) => <button type="button" className={draft.id === selected.id ? "selected" : ""} key={draft.id} onClick={() => openDraft(draft)}><strong>{draft.title}</strong><small>{draft.sessions.length} sessions</small></button>)}
          </aside>

          <div className="event-editor-detail">
            <form className="event-editor-panel" onSubmit={saveDraft}>
              <div className="event-editor-section-heading"><span>01</span><div><h2>Edit draft</h2><p>{selected.incidentId ? `Linked to incident ${selected.incidentId}` : "Direct cleanup event"}</p></div></div>
              <div className="event-editor-fields">
                <label>Title<input value={editTitle} minLength={3} maxLength={160} onChange={(event) => setEditTitle(event.target.value)} required /></label>
                <label className="wide">Description<textarea value={editDescription} minLength={10} maxLength={5000} rows={5} onChange={(event) => setEditDescription(event.target.value)} required /></label>
                <label className="wide">Public instructions<textarea value={editInstructions} maxLength={3000} rows={3} onChange={(event) => setEditInstructions(event.target.value)} /></label>
                <label>Event address<input value={editAddress} maxLength={500} onChange={(event) => setEditAddress(event.target.value)} /></label>
                <label>Meeting address<input value={editMeetingAddress} maxLength={500} onChange={(event) => setEditMeetingAddress(event.target.value)} /></label>
              </div>
              <LocationPicker value={editLocation} disabled={busy} onChange={(value) => { setEditLocation(value); setEditLocationConfirmed(false); }} onConfirm={(value) => { setEditLocation(value); setEditLocationConfirmed(true); }} />
              <label className="event-editor-check"><input type="checkbox" checked={editMeetingAtEvent} onChange={(event) => setEditMeetingAtEvent(event.target.checked)} />Use the event location as the meeting point</label>
              <div className="event-editor-actions"><button disabled={busy || !editLocationConfirmed}>{busy ? "Saving…" : "Save changes"}</button><button className="danger" type="button" disabled={busy} onClick={() => { if (window.confirm("Discard this private draft and all of its sessions?")) void run(async () => { await discardDraft(accessToken, organizationId, selected.id); setDrafts((current) => current.filter((draft) => draft.id !== selected.id)); setSelected(undefined); setNotice({ tone: "success", message: "Private draft discarded." }); }, "Unable to discard the draft."); }}>Discard draft</button></div>
            </form>

            <section className="event-editor-panel">
              <div className="event-editor-section-heading"><span>02</span><div><h2>Sessions</h2><p>Add each real date and time period separately.</p></div></div>
              <form className="event-editor-session-form" onSubmit={saveSession}>
                <label>Date<input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} required /></label>
                <label>Starts<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></label>
                <label>Ends<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></label>
                <label>Capacity<input type="number" min="1" max="100000" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label>
                <label>Session address<input value={sessionAddress} maxLength={500} onChange={(event) => setSessionAddress(event.target.value)} /></label>
                <label className="wide">Notes<textarea value={sessionNotes} maxLength={2000} onChange={(event) => setSessionNotes(event.target.value)} /></label>
                <label className="event-editor-check wide"><input type="checkbox" checked={sessionAtEvent} onChange={(event) => setSessionAtEvent(event.target.checked)} />Use the event coordinates for this session</label>
                <div className="event-editor-actions wide"><button disabled={busy}>{editingSessionId ? "Update session" : "Add session"}</button>{editingSessionId && <button className="secondary" type="button" onClick={resetSession}>Cancel edit</button>}</div>
              </form>
              <div className="event-editor-item-list">{selected.sessions.length === 0 ? <p>No sessions added.</p> : selected.sessions.map((session) => <article key={session.id}><span><strong>{session.sessionDate}</strong><small>{session.startTime.slice(0, 5)}–{session.endTime.slice(0, 5)} · {session.capacity ?? "Open"} capacity</small></span><span className="event-editor-row-actions"><button type="button" onClick={() => editSession(session)}>Edit</button><button type="button" className="danger" onClick={() => void run(async () => { await removeSession(accessToken, organizationId, selected.id, session.id); await refreshDraft(selected.id); }, "Unable to remove the session.")}>Remove</button></span></article>)}</div>
            </section>

            <section className="event-editor-panel">
              <div className="event-editor-section-heading"><span>03</span><div><h2>Coordinators</h2><p>Assignment gives event responsibility only; it does not change organization roles.</p></div></div>
              <div className="event-editor-coordinator-form"><select value={coordinatorMembershipId} onChange={(event) => setCoordinatorMembershipId(event.target.value)}><option value="">Select an active member</option>{availableCoordinators.map((member) => <option key={member.id} value={member.id}>{memberName(member)} · {member.role === "ORG_ADMIN" ? "Admin" : "Member"}</option>)}</select><button type="button" disabled={busy || !coordinatorMembershipId} onClick={() => void run(async () => { await assignCoordinator(accessToken, organizationId, selected.id, coordinatorMembershipId); await refreshDraft(selected.id); setCoordinatorMembershipId(""); setNotice({ tone: "success", message: "Coordinator assigned." }); }, "Unable to assign the coordinator.")}>Assign coordinator</button></div>
              <div className="event-editor-item-list">{selected.coordinators.length === 0 ? <p>No coordinators assigned.</p> : selected.coordinators.map((coordinator) => <article key={coordinator.id}><span><strong>{coordinator.member.fullName || coordinator.member.email}</strong><small>{coordinator.member.role === "ORG_ADMIN" ? "Organization admin" : "Organization member"}</small></span><button type="button" className="danger" onClick={() => void run(async () => { await removeCoordinator(accessToken, organizationId, selected.id, coordinator.membershipId); await refreshDraft(selected.id); }, "Unable to remove the coordinator.")}>Remove</button></article>)}</div>
            </section>

            <CleanupEventPublishPanel
              accessToken={accessToken}
              organizationId={organizationId}
              eventId={selected.id}
              onPublished={(result) => {
                setDrafts((current) => current.filter((draft) => draft.id !== selected.id));
                setSelected(undefined);
                setNotice({
                  tone: "success",
                  message: result.incidentUpdated
                    ? "Event published and the linked incident was claimed."
                    : "Direct cleanup event published.",
                });
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
