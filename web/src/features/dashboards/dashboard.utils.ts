// Sum all state counts, returning zero when the summary has no entries.
export const total = (states: Record<string, number>) => Object.values(states).reduce((sum, value) => sum + value, 0);
