import { useEffect, useState } from "react";
import { describeApiFailure } from "../../api/apiError";
import { fetchCleanupWorkflow } from "./cleanupWorkflow.api";
import type { CleanupWorkflow } from "./cleanupWorkflow.types";
import "./cleanupWorkflow.css";

type Props = { accessToken: string; organizationId: string; onBack?: () => void };

export function CleanupWorkflowView({ accessToken, organizationId, onBack }: Props) {
  const [workflow, setWorkflow] = useState<CleanupWorkflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    fetchCleanupWorkflow(accessToken, organizationId)
      .then((value) => { if (active) { setWorkflow(value); setError(null); } })
      .catch((reason) => { if (active) setError(describeApiFailure(reason, "Unable to load the cleanup workflow.").message); });
    return () => { active = false; };
  }, [accessToken, organizationId, reload]);

  return (
    <main className="workflow-page">
      <header><div>{onBack && <button type="button" onClick={onBack}>Back</button>}<h1>Cleanup workflow</h1></div><p>Protected lifecycle steps used by this organization’s cleanup events.</p></header>
      {error && <section className="workflow-message" role="alert"><p>{error}</p><button type="button" onClick={() => setReload((value) => value + 1)}>Try again</button></section>}
      {!error && !workflow && <p className="workflow-message" aria-live="polite">Loading workflow…</p>}
      {workflow && <ol className="workflow-list">{workflow.statuses.map((status) => {
        const destinations = workflow.transitions.filter((item) => item.fromStatusId === status.id).map((item) => workflow.statuses.find((candidate) => candidate.id === item.toStatusId)?.label).filter(Boolean);
        return <li key={status.id} className={!status.isActive ? "inactive" : ""}><div><strong>{status.label}</strong><span>{status.mappedLifecycleStatus.replaceAll("_", " ")}</span></div><p>{status.isInitial ? "Initial status" : status.isFinal ? "Final status" : destinations.length ? `May move to: ${destinations.join(", ")}` : "No configured next step"}</p></li>;
      })}</ol>}
    </main>
  );
}
