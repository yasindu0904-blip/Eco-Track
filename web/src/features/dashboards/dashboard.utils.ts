export const total = (states: Record<string, number>) => Object.values(states).reduce((sum, value) => sum + value, 0);
