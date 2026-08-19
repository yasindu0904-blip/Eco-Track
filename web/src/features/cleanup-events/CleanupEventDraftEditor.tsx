import { useCallback, useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { LocationPicker } from "../maps";
import { createDraft, listDrafts } from "./cleanupEvent.api";
import type { CleanupEventDraft } from "./cleanupEvent.types";
import "./cleanupEvent.css";

type Props = { accessToken: string; organizationId: string; incidentId?: string; onBack?: () => void };
export function CleanupEventDraftEditor({ accessToken, organizationId, incidentId, onBack }: Props) {
  const [drafts, setDrafts] = useState<CleanupEventDraft[]>([]);
  const [location, setLocation] = useState({ latitude: 6.927079, longitude: 79.861244 });
  const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => listDrafts(accessToken, organizationId).then(setDrafts).catch((reason) => setError(describeApiFailure(reason, "Unable to load event drafts.").message)), [accessToken, organizationId]);
  useEffect(() => { void load(); }, [load]);
  const submit = async (form: HTMLFormElement) => { setBusy(true); setError(null); const data = new FormData(form); try { await createDraft(accessToken, organizationId, { incidentId: incidentId ?? null, title: String(data.get("title")), description: String(data.get("description")), publicInstructions: String(data.get("instructions") || "") || null, eventLatitude: location.latitude, eventLongitude: location.longitude, eventAddress: String(data.get("address") || "") || null }); form.reset(); setConfirmed(false); await load(); } catch (reason) { setError(describeApiFailure(reason, "Unable to save the draft.").message); } finally { setBusy(false); } };
  return <main className="event-editor"><header>{onBack && <button onClick={onBack}>Back</button>}<h1>Cleanup event drafts</h1><p>Drafts stay private until they pass publish validation.</p></header>{error && <p role="alert">{error}</p>}<form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><label>Title<input name="title" minLength={3} maxLength={160} required/></label><label>Description<textarea name="description" minLength={10} required/></label><label>Public instructions<textarea name="instructions"/></label><label>Address<input name="address"/></label><LocationPicker value={location} disabled={busy} onChange={(value) => { setLocation(value); setConfirmed(false); }} onConfirm={(value) => { setLocation(value); setConfirmed(true); }}/><button disabled={busy || !confirmed}>{busy ? "Saving…" : "Save private draft"}</button></form><section><h2>Your organization’s drafts</h2>{!drafts.length ? <p>No drafts yet.</p> : drafts.map((draft) => <article key={draft.id}><strong>{draft.title}</strong><span>{draft.sessions.length} sessions · {draft.coordinators.length} coordinators</span></article>)}</section></main>;
}
