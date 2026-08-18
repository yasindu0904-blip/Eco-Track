import { useCallback, useEffect, useState } from "react";

import { ApiRequestError } from "../../api/apiClient";
import { listMyCompletedCleanupEvents } from "./reward.api";
import type { CompletedCleanupEvent } from "./reward.types";
import "./reward.css";

type Props = {
  accessToken: string;
  onBack: () => void;
};

function readableError(error: unknown): string {
  return error instanceof ApiRequestError || error instanceof Error
    ? error.message
    : "EcoTrack could not load your historical review right now.";
}

export function HistoricalReviewPage({ accessToken, onBack }: Props) {
  const [events, setEvents] = useState<CompletedCleanupEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listMyCompletedCleanupEvents(accessToken);
      setEvents(page.items);
      setTotalCount(page.totalCount);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listMyCompletedCleanupEvents(accessToken, nextCursor);
      setEvents((current) => [...current, ...page.items]);
      setTotalCount(page.totalCount);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="impact-page">
      <header className="impact-header">
        <button type="button" onClick={onBack}>â† Dashboard</button>
        <div>
          <span>Citizen &amp; volunteer</span>
          <h1>Historical review</h1>
          <p>Your verified record of successfully concluded cleanup events.</p>
        </div>
      </header>

      {error && (
        <section className="impact-notice impact-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>Try again</button>
        </section>
      )}

      {loading ? (
        <section className="impact-state" aria-live="polite">Loading historical reviewâ€¦</section>
      ) : (
        <>
          <section className="impact-overview" aria-label="Completed cleanup event summary">
            <article className="impact-points-card">
              <span>Successfully concluded cleanup events</span>
              <strong>{totalCount}</strong>
              <p>Only completed events backed by verified participation are included.</p>
            </article>
          </section>
          <section className="impact-section">
            <div className="impact-section-heading">
              <div><span>Verified history</span><h2>Cleanup event names</h2></div>
              <strong>{totalCount} concluded</strong>
            </div>
            {events.length === 0 ? (
              <div className="impact-empty">
                <strong>No successfully concluded events yet</strong>
                <p>Completed events will appear after your attendance and contribution are verified.</p>
              </div>
            ) : (
              <div className="impact-history">
                {events.map((event) => (
                  <article key={event.contributionId}>
                    <span className="impact-history-points">âœ“</span>
                    <div>
                      <h3>{event.title}</h3>
                      <p>Successfully concluded cleanup event</p>
                      <small>Completed {new Date(event.completedAt).toLocaleDateString()}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {nextCursor && (
              <button className="impact-load-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Loadingâ€¦" : "Load more events"}
              </button>
            )}
          </section>
        </>
      )}
    </main>
  );
}
