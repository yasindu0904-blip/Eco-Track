import { useEffect, useState } from "react";
import { getParticipantEventUpdates } from "./cleanupEvent.api";
import type { ParticipantEventUpdates as Updates } from "./cleanupEvent.types";

export function ParticipantEventUpdates({ accessToken, eventId }: { accessToken: string; eventId: string }) {
  const [updates, setUpdates] = useState<Updates>();
  useEffect(() => { let active = true; void getParticipantEventUpdates(accessToken, eventId).then((value) => active && setUpdates(value)).catch(() => undefined); return () => { active = false; }; }, [accessToken, eventId]);
  if (!updates) return null;
  return <section className="event-editor-panel participant-updates"><h3>Participant updates</h3>{updates.event.lifecycleStatus === "CANCELLED" && <p className="event-editor-notice error">Cancelled: {updates.event.cancellationReason}</p>}{updates.event.lifecycleStatus === "COMPLETED" && <p className="event-editor-notice">This cleanup event is complete.</p>}{updates.notes.length === 0 ? <p>No participant updates yet.</p> : updates.notes.map((note) => <article className="event-operation-entry" key={note.id}><p>{note.noteText}</p><small>{note.author.fullName ?? "Event team"} · {new Date(note.createdAt).toLocaleString()}</small></article>)}</section>;
}
