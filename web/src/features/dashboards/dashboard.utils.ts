// The initial accumulator keeps empty summaries at zero.
export const total = (states: Record<string, number>) => Object.values(states).reduce((sum, value) => sum + value, 0);
