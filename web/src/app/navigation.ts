import { useCallback, useEffect, useState } from "react";

export type OrganizationWorkspaceTab =
  | "overview"
  | "incident-discovery"
  | "event-drafts"
  | "events"
  | "members";

export type UserDestination =
  | { screen: "dashboard" }
  | { screen: "notifications" }
  | { screen: "membership" }
  | { screen: "organization-workspaces" }
  | { screen: "organization-apply" }
  | { screen: "organization-applications" }
  | {
      screen: "organization-workspace";
      organizationId: string;
      tab?: OrganizationWorkspaceTab;
      incidentId?: string;
      eventId?: string;
    }
  | { screen: "incident-create" }
  | { screen: "incident-reports"; incidentId?: string }
  | { screen: "incident-discovery" }
  | {
      screen: "cleanup-events";
      eventId?: string;
      returnTo?: "incident-discovery" | "joined-cleanup-events";
    }
  | { screen: "joined-cleanup-events"; eventId?: string }
  | { screen: "impact" };

export type SuperAdminDestination =
  | { screen: "dashboard" }
  | { screen: "notifications" };

export function isSuperAdminDestination(
  value: unknown,
): value is SuperAdminDestination {
  if (!value || typeof value !== "object") return false;
  const screen = (value as Partial<SuperAdminDestination>).screen;
  return screen === "dashboard" || screen === "notifications";
}

type HistoryState<T> = {
  ecoTrackDestination?: T;
};

export function isUserDestination(value: unknown): value is UserDestination {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UserDestination>;

  if (candidate.screen === "organization-workspace") {
    return typeof candidate.organizationId === "string" &&
      candidate.organizationId.length > 0;
  }

  if (candidate.screen === "cleanup-events") {
    const cleanupCandidate = candidate as Partial<Extract<
      UserDestination,
      { screen: "cleanup-events" }
    >>;
    return (
      (cleanupCandidate.eventId === undefined || typeof cleanupCandidate.eventId === "string") &&
      (cleanupCandidate.returnTo === undefined ||
        cleanupCandidate.returnTo === "incident-discovery" ||
        cleanupCandidate.returnTo === "joined-cleanup-events")
    );
  }

  return [
    "dashboard",
    "notifications",
    "membership",
    "organization-workspaces",
    "organization-apply",
    "organization-applications",
    "incident-create",
    "incident-reports",
    "incident-discovery",
    "joined-cleanup-events",
    "impact",
  ].includes(candidate.screen ?? "");
}

export function cleanupEventReturnDestination(
  destination: Extract<UserDestination, { screen: "cleanup-events" }>,
): UserDestination {
  return destination.returnTo
    ? { screen: destination.returnTo }
    : { screen: "dashboard" };
}

export function useBrowserNavigation<T>(
  initialDestination: T,
  validate: (value: unknown) => value is T,
) {
  const [destination, setDestination] = useState<T>(() => {
    const current = (window.history.state as HistoryState<T> | null)
      ?.ecoTrackDestination;
    return validate(current) ? current : initialDestination;
  });

  useEffect(() => {
    const current = (window.history.state as HistoryState<T> | null)
      ?.ecoTrackDestination;
    if (!validate(current)) {
      window.history.replaceState(
        { ...window.history.state, ecoTrackDestination: initialDestination },
        "",
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      const next = (event.state as HistoryState<T> | null)
        ?.ecoTrackDestination;
      setDestination(validate(next) ? next : initialDestination);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [initialDestination, validate]);

  const navigate = useCallback((next: T, replace = false) => {
    const method = replace ? "replaceState" : "pushState";
    window.history[method](
      { ...window.history.state, ecoTrackDestination: next },
      "",
    );
    setDestination(next);
  }, []);

  const back = useCallback((fallback: T) => {
    if ((window.history.state as HistoryState<T> | null)?.ecoTrackDestination) {
      window.history.back();
      return;
    }

    navigate(fallback, true);
  }, [navigate]);

  return { destination, navigate, back };
}
