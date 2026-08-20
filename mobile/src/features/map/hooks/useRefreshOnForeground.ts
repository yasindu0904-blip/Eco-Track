import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { createForegroundRefreshGate, type EcoTrackAppState } from "../foregroundRefreshGate";

export function useRefreshOnForeground(
  refresh: () => void,
  minimumIntervalMilliseconds = 10_000,
): void {
  const callbackRef = useRef(refresh);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const gateRef = useRef(createForegroundRefreshGate(minimumIntervalMilliseconds));

  useEffect(() => {
    callbackRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    gateRef.current = createForegroundRefreshGate(minimumIntervalMilliseconds);
  }, [minimumIntervalMilliseconds]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (gateRef.current.shouldRefresh(
        previousState as EcoTrackAppState,
        nextState as EcoTrackAppState,
        Date.now(),
      )) {
        callbackRef.current();
      }
    });

    return () => subscription.remove();
  }, []);
}
