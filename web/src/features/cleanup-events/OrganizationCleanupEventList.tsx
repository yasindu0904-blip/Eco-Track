import { ListSections, PageControls } from "../../components/lists/ListControls";
import { eventSections, useInvalidateLists, useListState, usePagedList, type EventSection } from "../../components/lists/usePagedList";
import { Fragment, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { getOwnedCleanupEvent, listOwnedCleanupEvents } from "./cleanupEvent.api";
import type { CleanupEventOwnedSummary } from "./cleanupEvent.types";
import { EventParticipantOperations } from "./EventParticipantOperations";
import { EventOperationsWorkspace } from "./EventOperationsWorkspace";

type Props = { accessToken: string; organizationId: string; initialEventId?: string; canCancel?: boolean };

export function OrganizationCleanupEventList({ accessToken, organizationId, initialEventId, canCancel = false }: Props) {
  const invalidateLists = useInvalidateLists();
  const [section, setSection] = useListState<EventSection | "all">("owned.section:" + organizationId, "all");
  const list = usePagedList("owned:" + organizationId + ":" + section, cursor => listOwnedCleanupEvents(accessToken, organizationId, cursor, section === "all" ? undefined : section), false);
  const { items, busy, error } = list;
  const [selectedId, setSelectedId] = useState(initialEventId);
  const [selectedRecord, setSelectedRecord] = useState<CleanupEventOwnedSummary>();
  const [selectionError, setSelectionError] = useState<string>();
  useEffect(() => {
    if (!initialEventId) return;
    let active = true;
    void getOwnedCleanupEvent(accessToken, organizationId, initialEventId)
      .then((record) => {
        if (active) setSelectedRecord(record);
      })
      .catch((reason: unknown) => {
        if (active) setSelectionError(describeApiFailure(reason, "Unable to open the selected organization event.").message);
      });
    return () => { active = false; };
  }, [accessToken, initialEventId, organizationId]);
  const visibleItems = items;
  const selected = visibleItems.find((item) => item.id === selectedId) ?? selectedRecord;

  async function refreshSelected() {
    invalidateLists("owned:" + organizationId + ":");
    if (selectedId) {
      try { setSelectedRecord(await getOwnedCleanupEvent(accessToken, organizationId, selectedId)); }
      catch (reason) { setSelectionError(describeApiFailure(reason).message); }
    }
    list.refresh();
  }
  return <section className="event-editor">
    <header className="event-editor-header"><div><span>ORGANIZATION EVENTS</span><h1>Cleanup activities</h1></div></header>
    <ListSections value={section} options={[{ value: "all", label: "All" }, ...eventSections]} onChange={value => { setSection(value); setSelectedId(undefined); setSelectedRecord(undefined); }} />
    {error && <p className="event-editor-notice error" role="alert">{error}</p>}
    {selectionError && <p className="event-editor-notice error" role="alert">{selectionError}</p>}
    <section className="event-editor-panel">
      {busy && visibleItems.length === 0 ? <p>Loading events…</p> : visibleItems.length === 0 ? <div className="event-editor-empty"><strong>No cleanup events</strong></div> : <div className="public-event-list organization-event-list">
        {visibleItems.map((item, index) => <Fragment key={item.id}>{index > 0 && <hr className="organization-event-separator" />}<button type="button" className={item.id === selectedId ? "selected" : undefined} key={item.id} onClick={() => { setSelectedId(item.id); setSelectedRecord(item); setSelectionError(undefined); }}>
          <strong>{item.title}</strong><span>{item.lifecycleStatus.replaceAll("_", " ")}</span><small>{item.incidentId ? "Incident-linked" : "Direct event"} · Updated {new Date(item.updatedAt).toLocaleString()}</small>
        </button></Fragment>)}
      </div>}
      <PageControls {...list} />
    </section>
    {selected && <section className="event-editor-panel public-event-detail" aria-label="Selected organization event">
      <span className="public-event-status">{selected.lifecycleStatus.replaceAll("_", " ")}</span>
      <h2>{selected.title}</h2><p>{selected.description}</p>

      <p>{selected.eventAddress ?? `${selected.eventLatitude}, ${selected.eventLongitude}`}</p>
    </section>}
    {selected && selected.lifecycleStatus !== "DRAFT" && <EventParticipantOperations key={`attendance:${selected.id}`} accessToken={accessToken} organizationId={organizationId} eventId={selected.id} />}
    {selected && selected.lifecycleStatus !== "DRAFT" && <EventOperationsWorkspace key={`operations:${selected.id}`} accessToken={accessToken} organizationId={organizationId} eventId={selected.id} canCancel={canCancel} onChanged={() => void refreshSelected()} />}
  </section>;
}
