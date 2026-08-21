import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { describeApiFailure } from "../../api/apiError";

type SummaryPanelProps<T> = {
  load: () => Promise<T>;
  children: (value: T) => ReactNode;
  label: string;
};

export function SummaryPanel<T>({
  load,
  children,
  label,
}: SummaryPanelProps<T>) {
  const [value, setValue] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      setValue(await load());
    } catch (reason) {
      setError(
        describeApiFailure(reason, `Unable to load ${label}.`).message,
      );
    } finally {
      setLoading(false);
    }
  }, [load, label]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  return (
    <section aria-label={label} aria-busy={loading}>
      <div className="dashboard-summary-state">
        <strong>{label}</strong>
        <button
          className="dashboard-summary-refresh"
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label={loading ? `Refreshing ${label}` : `Refresh ${label}`}
          title={loading ? `Refreshing ${label}` : `Refresh ${label}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M6.1 9a7 7 0 0 1 11.6-2.6L20 11" />
            <path d="m4 13 2.3 4.6A7 7 0 0 0 17.9 15" />
          </svg>
        </button>
      </div>
      {error ? (
        <p role="alert">Some summary data is unavailable: {error}</p>
      ) : null}
      {value !== undefined
        ? children(value)
        : !loading && <p>No summary data is available yet.</p>}
    </section>
  );
}
