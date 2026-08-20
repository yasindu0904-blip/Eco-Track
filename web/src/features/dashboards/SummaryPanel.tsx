import { useCallback, useEffect, useState, type ReactNode } from "react";

export function SummaryPanel<T>({ load, children, label }: { load: () => Promise<T>; children: (value: T) => ReactNode; label: string }) {
  const [value, setValue] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const refresh = useCallback(async () => {
    setLoading(true); setError(undefined);
    try { setValue(await load()); } catch (reason) { setError(reason instanceof Error ? reason.message : `Unable to load ${label}.`); }
    finally { setLoading(false); }
  }, [load, label]);
  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);
  return <section aria-label={label} aria-busy={loading}>
    <div className="dashboard-summary-state"><strong>{label}</strong><button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
    {error && <p role="alert">Some summary data is unavailable: {error}</p>}
    {value ? children(value) : !loading && <p>No summary data is available yet.</p>}
  </section>;
}
