import { useCallback, useEffect, useState } from "react";

import { ApiRequestError } from "../../api/apiClient";
import {
  getMyImpactSummary,
  listMyContributions,
} from "./reward.api";
import type {
  Contribution,
  ImpactSummary,
} from "./reward.types";
import "./reward.css";

type MyImpactPageProps = {
  accessToken: string;
  onBack: () => void;
};

function readableError(error: unknown): string {
  return error instanceof ApiRequestError || error instanceof Error
    ? error.message
    : "EcoTrack could not load your impact right now.";
}

export function MyImpactPage({ accessToken, onBack }: MyImpactPageProps) {
  const [summary, setSummary] = useState<ImpactSummary | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSummary, page] = await Promise.all([
        getMyImpactSummary(accessToken),
        listMyContributions(accessToken),
      ]);
      setSummary(nextSummary);
      setContributions(page.items);
      setNextCursor(page.nextCursor);
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listMyContributions(accessToken, nextCursor);
      setContributions((current) => [...current, ...page.items]);
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
        <button type="button" onClick={onBack}>← Dashboard</button>
        <div>
          <span>Citizen &amp; volunteer</span>
          <h1>My Impact</h1>
          <p>Verified community actions and non-monetary EcoTrack achievements.</p>
        </div>
      </header>

      {error && (
        <section className="impact-notice impact-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>Try again</button>
        </section>
      )}

      {loading ? (
        <section className="impact-state" aria-live="polite">Loading your verified impact…</section>
      ) : summary ? (
        <>
          <section className="impact-overview" aria-label="Impact summary">
            <article className="impact-points-card">
              <span>Verified contribution points</span>
              <strong>{summary.totalPoints}</strong>
              <p>Recognition only—points are not money, employment, or access permissions.</p>
            </article>
            <div className="impact-breakdown">
              {summary.breakdown.map((item) => (
                <article key={item.type}>
                  <span>{item.label}</span>
                  <strong>{item.points} pts</strong>
                  <small>{item.count} verified {item.count === 1 ? "action" : "actions"}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="impact-section">
            <div className="impact-section-heading">
              <div>
                <span>Milestones</span>
                <h2>Achievements</h2>
              </div>
              <strong>{summary.achievements.length} earned</strong>
            </div>
            {summary.achievements.length === 0 ? (
              <div className="impact-empty">
                <strong>Your first achievement is ahead</strong>
                <p>Verified reports and confirmed cleanup participation will build your impact.</p>
              </div>
            ) : (
              <div className="impact-achievements">
                {summary.achievements.map((achievement) => (
                  <article key={achievement.id}>
                    <span aria-hidden="true">★</span>
                    <div>
                      <h3>{achievement.name}</h3>
                      <p>{achievement.description}</p>
                      <small>Earned {new Date(achievement.awardedAt).toLocaleDateString()}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="impact-section">
            <div className="impact-section-heading">
              <div>
                <span>Private history</span>
                <h2>Why points were awarded</h2>
              </div>
              <strong>{summary.contributionCount} records</strong>
            </div>
            {contributions.length === 0 ? (
              <div className="impact-empty">
                <strong>No verified contributions yet</strong>
                <p>Submitting or joining alone does not award points. EcoTrack records rewards only after verified action.</p>
              </div>
            ) : (
              <div className="impact-history">
                {contributions.map((contribution) => (
                  <article key={contribution.id}>
                    <span className="impact-history-points">+{contribution.points}</span>
                    <div>
                      <h3>{contribution.label}</h3>
                      <p>{contribution.reason}</p>
                      <small>{new Date(contribution.createdAt).toLocaleString()}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {nextCursor && (
              <button
                className="impact-load-more"
                type="button"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Loading…" : "Load more history"}
              </button>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
