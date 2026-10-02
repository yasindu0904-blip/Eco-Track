type Listener = (count: number | undefined) => void;
const listeners = new Map<string, Set<Listener>>();

// Session-scoped signals, not a cached count. The API remains the source of truth.
export function publishNotificationCount(accessToken: string, count?: number): void {
  listeners.get(accessToken)?.forEach(listener => listener(count));
}

export function subscribeNotificationCount(accessToken: string, listener: Listener): () => void {
  let sessionListeners = listeners.get(accessToken);
  if (!sessionListeners) {
    sessionListeners = new Set();
    listeners.set(accessToken, sessionListeners);
  }
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
    if (sessionListeners.size === 0) listeners.delete(accessToken);
  };
}
