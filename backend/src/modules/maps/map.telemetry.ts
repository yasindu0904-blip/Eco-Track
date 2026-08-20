export type SpatialQueryMetric = {
  operation: string;
  projection: "PUBLIC" | "ORGANIZATION";
  mode: "VIEWPORT" | "RADIUS" | "BOUNDARY";
  durationMs: number;
  resultCount: number;
};

export type SpatialQueryObserver = (metric: SpatialQueryMetric) => void;

export const logSpatialQueryMetric: SpatialQueryObserver = (metric) => {
  console.info(JSON.stringify({ event: "spatial_query", ...metric }));
};

export async function observeSpatialQuery<T>(
  observer: SpatialQueryObserver | undefined,
  metric: Omit<SpatialQueryMetric, "durationMs" | "resultCount">,
  query: () => Promise<T>,
  countResults: (result: T) => number = (result) => Array.isArray(result) ? result.length : 0,
): Promise<T> {
  const startedAt = performance.now();
  const result = await query();
  observer?.({
    ...metric,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    resultCount: countResults(result),
  });
  return result;
}
