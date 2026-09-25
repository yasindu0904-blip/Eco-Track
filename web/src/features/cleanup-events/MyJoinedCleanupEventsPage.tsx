import { useListScroll } from "../../components/lists/useListScroll";
import { ListSections, PageControls } from "../../components/lists/ListControls";
import { eventSections, useListState, usePagedList, type EventSection } from "../../components/lists/usePagedList";
import { listMyEventParticipations } from "./cleanupEvent.api";
import "./cleanupEvent.css";

type Props = {
  accessToken: string;
  onBack: () => void;
  onOpenEvent: (eventId: string) => void;
};

export function MyJoinedCleanupEventsPage({ accessToken, onOpenEvent }: Props) {
  const [section, setSection] = useListState<EventSection | "withdrawn">("joined.section", "upcoming");
  const list = usePagedList("joined:" + section, cursor => listMyEventParticipations(accessToken, "all", cursor, section), false);
  const { items, busy, error } = list;
  useListScroll("joined:" + section + ":" + list.pageNumber, !busy);
  return (
    <main className="public-events-shell">
      <header className="event-editor-header">
        <div>
          <span>MY VOLUNTEERING</span>
          <h1>My joined cleanup events</h1>
        </div>

      </header>
      <ListSections value={section} options={[...eventSections, { value: "withdrawn", label: "Withdrawn / removed" }]} onChange={setSection} />
      {error && <p className="event-editor-notice error">{error}</p>}
      <section className="event-editor-panel public-event-list">
        {busy && items.length === 0 ? (
          <p>Loading your events…</p>
        ) : items.length === 0 ? (
          <div className="event-editor-empty">
            <strong>No events in this section</strong>

          </div>
        ) : (
          items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onOpenEvent(item.event.id)}
            >
              <strong>{item.event.title}</strong>
              <span>{item.event.organization.name}</span>
              <small>
                {new Date(item.event.startsAt).toLocaleString()} ·{" "}
                {item.event.displayStatus}
              </small>
              <small>
                {item.status} · Attendance {item.attendanceStatus}
              </small>
            </button>
          ))
        )}
        <PageControls {...list} />
      </section>
    </main>
  );
}
