import { lazy } from "react";

import type { AuthenticatedUserProfile } from "../features/auth/auth.types";
import { isSuperAdminDestination, useBrowserNavigation } from "./navigation";
import { RouteBoundary } from "./RouteBoundary";

const SuperAdminDashboard = lazy(() => import("../features/super-admin/SuperAdminDashboard").then(
  (module) => ({ default: module.SuperAdminDashboard }),
));
const NotificationInbox = lazy(() => import("../features/notifications/NotificationInbox").then(
  (module) => ({ default: module.NotificationInbox }),
));

type Props = {
  profile: AuthenticatedUserProfile;
  accessToken: string;
  onSignOut: () => Promise<void> | void;
};

export function SuperAdminApp({
  profile,
  accessToken,
  onSignOut,
}: Props) {
  const { destination, navigate, back } = useBrowserNavigation(
    { screen: "dashboard" } as const,
    isSuperAdminDestination,
  );

  return (
    <RouteBoundary resetKey={destination.screen}>
      {destination.screen === "notifications" ? (
        <NotificationInbox
          accessToken={accessToken}
          onBack={() => back({ screen: "dashboard" })}
        />
      ) : (
        <SuperAdminDashboard
          profile={profile}
          accessToken={accessToken}
          onOpenNotifications={() => navigate({ screen: "notifications" })}
          onSignOut={() => void onSignOut()}
        />
      )}
    </RouteBoundary>
  );
}
