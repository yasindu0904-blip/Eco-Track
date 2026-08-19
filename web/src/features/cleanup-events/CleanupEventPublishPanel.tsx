import { useCallback, useEffect, useState } from "react";

import { ApiRequestError } from "../../api/apiClient";
import { describeApiFailure } from "../../api/apiError";
import { getPublicCleanupEvent, getPublishReadiness, publishCleanupEvent } from "./cleanupEvent.api";
import type { CleanupEventPublicDetail, CleanupEventPublishReadiness, CleanupEventPublishResult } from "./cleanupEvent.types";

type Props = { accessToken: string; organizationId: string; eventId: string; onPublished: (result: CleanupEventPublishResult) => void };

export function CleanupEventPublishPanel({ accessToken, organizationId, eventId, onPublished }: Props) {
  const [readiness, setReadiness] = useState<CleanupEventPublishReadiness>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [winningEventId, setWinningEventId] = useState<string>();
  const [winningEvent, setWinningEvent] = useState<CleanupEventPublicDetail>();
  const refresh = useCallback(async () => { setBusy(true); setError(undefined); try { setReadiness(await getPublishReadiness(accessToken, organizationId, eventId)); } catch (reason) { setError(describeApiFailure(reason, "Unable to check whether this event is ready.").message); } finally { setBusy(false); } }, [accessToken, eventId, organizationId]);
  useEffect(() => { const timeout = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timeout); }, [refresh]);
  async function publish(): Promise<void> {
    if (!window.confirm("Publish this cleanup event? Its public details will become visible and a linked incident will be claimed.")) return;
    setBusy(true); setError(undefined); setWinningEventId(undefined); setWinningEvent(undefined);
    try { onPublished(await publishCleanupEvent(accessToken, organizationId, eventId)); }
    catch (reason) {
      if (reason instanceof ApiRequestError && reason.code === "INCIDENT_ALREADY_CLAIMED") { const id = reason.details?.eventId; if (typeof id === "string") setWinningEventId(id); }
      setError(describeApiFailure(reason, "Unable to publish this cleanup event.").message);
      try { setReadiness(await getPublishReadiness(accessToken, organizationId, eventId)); } catch { /* Keep the publish error visible. */ }
    } finally { setBusy(false); }
  }
  return <section className="event-editor-panel event-publish-panel">
    <div className="event-editor-section-heading"><span>04</span><div><h2>Publish event</h2><p>EcoTrack checks the saved server data again inside one transaction before publishing.</p></div></div>
    {error && <p className="event-editor-notice error" role="alert">{error}</p>}
    {winningEventId && <p className="event-editor-linked">This incident is already claimed by event <code>{winningEventId}</code>.</p>}
    {winningEventId && !winningEvent && <button type="button" className="secondary" disabled={busy} onClick={() => void (async () => { setBusy(true); try { setWinningEvent(await getPublicCleanupEvent(accessToken, winningEventId)); } catch (reason) { setError(describeApiFailure(reason, "Unable to open the published event.").message); } finally { setBusy(false); } })()}>View already published event</button>}
    {winningEvent && <article className="event-editor-linked"><strong>{winningEvent.title}</strong><br />{winningEvent.organization.name} · {winningEvent.lifecycleStatus.replaceAll("_", " ")}<br />{winningEvent.eventAddress || `${winningEvent.eventLatitude}, ${winningEvent.eventLongitude}`}</article>}
    {!readiness ? <p>{busy ? "Checking readiness…" : "Readiness is unavailable."}</p> : <ul className="event-readiness-list">{readiness.checks.map((check) => <li className={check.ready ? "ready" : "blocked"} key={check.code}><strong>{check.ready ? "✓" : "!"}</strong><span>{check.message}</span></li>)}</ul>}
    <div className="event-editor-actions"><button type="button" className="secondary" disabled={busy} onClick={() => void refresh()}>Refresh checks</button><button type="button" disabled={busy || !readiness?.ready} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish cleanup event"}</button></div>
  </section>;
}
