import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { hasCompletedProfile } from "./src/authorization/authorizationUi";
import { LoginScreen } from "./src/auth/LoginScreen";
import { ProfileOnboardingScreen } from "./src/auth/ProfileOnboardingScreen";
import { useAuthentication } from "./src/auth/useAuthentication";
import { BrandHeader, Button, LoadingState, Notice, Screen, sharedStyles } from "./src/components/ui";
import { CitizenDashboard } from "./src/features/citizen/CitizenDashboard";
import { NotificationInboxScreen } from "./src/features/notifications/NotificationInboxScreen";
import { IncidentReportScreen, MyReportsScreen } from "./src/features/incidents";
import type { IncidentDetail } from "./src/features/incidents/incident.types";
import { MyOrganizationApplicationsScreen } from "./src/features/organizations/MyOrganizationApplicationsScreen";
import { OrganizationApplicationScreen } from "./src/features/organizations/OrganizationApplicationScreen";
import { OrganizationWorkspaceScreen } from "./src/features/organizations/OrganizationWorkspaceScreen";
import type { OrganizationApplication } from "./src/features/organizations/organizationApplication.types";
import { SuperAdminDashboard } from "./src/features/superAdmin/SuperAdminDashboard";

type CitizenView = "dashboard" | "createOrganization" | "organizationApplications" | "organizationWorkspace" | "reportIncident" | "myReports";

export default function App() {
  const authentication = useAuthentication();
  const [citizenView, setCitizenView] = useState<CitizenView>("dashboard");
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [submittedApplication, setSubmittedApplication] =
    useState<OrganizationApplication | null>(null);
  const [submittedIncident, setSubmittedIncident] =
    useState<IncidentDetail | null>(null);

  const signOut = async () => {
    setCitizenView("dashboard");
    setShowNotifications(false);
    setSelectedOrganizationId("");
    setSubmittedApplication(null);
    setSubmittedIncident(null);
    await authentication.signOut();
  };

  let content;

  if (authentication.status === "loading") {
    content = <LoadingState message="Securing your EcoTrack session…" />;
  } else if (authentication.status === "signedOut") {
    content = <LoginScreen />;
  } else if (authentication.status === "error") {
    content = (
      <Screen contentStyle={styles.errorScreen}>
        <BrandHeader compact />
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>We could not complete sign-in</Text>
          <Notice
            message={authentication.errorMessage ?? "Authentication failed."}
            tone="error"
          />
          <Button label="Try again" onPress={() => void authentication.retry()} />
          <Button label="Return to sign in" variant="secondary" onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  } else if (
    authentication.profile &&
    authentication.accessToken &&
    !hasCompletedProfile(authentication.profile)
  ) {
    content = (
      <ProfileOnboardingScreen
        accessToken={authentication.accessToken}
        profile={authentication.profile}
        onCompleted={authentication.replaceProfile}
        onSignOut={() => void signOut()}
      />
    );
  } else if (
    authentication.profile &&
    authentication.accessToken &&
    authentication.profile.platformRole === "SUPER_ADMIN"
  ) {
    content = showNotifications ? (
      <NotificationInboxScreen
        accessToken={authentication.accessToken}
        onBack={() => setShowNotifications(false)}
      />
    ) : (
      <SuperAdminDashboard
        accessToken={authentication.accessToken}
        profile={authentication.profile}
        onOpenNotifications={() => setShowNotifications(true)}
        onSignOut={() => void signOut()}
      />
    );
  } else if (authentication.profile && authentication.accessToken) {
    const activeMemberships = authentication.profile.activeMemberships ?? [];
    const activeMembership =
      activeMemberships.find(
        (membership) =>
          membership.organizationId === selectedOrganizationId,
      ) ?? activeMemberships[0];

    if (showNotifications) {
      content = (
        <NotificationInboxScreen
          accessToken={authentication.accessToken}
          onBack={() => setShowNotifications(false)}
          onOpenOrganizationApplications={() => {
            setShowNotifications(false);
            setCitizenView("organizationApplications");
          }}
        />
      );
    } else if (citizenView === "createOrganization") {
      content = (
        <OrganizationApplicationScreen
          accessToken={authentication.accessToken}
          initialEmail={authentication.profile.email}
          onBack={() => setCitizenView("dashboard")}
          onSubmitted={(application) => {
            setSubmittedApplication(application);
            setCitizenView("organizationApplications");
          }}
        />
      );
    } else if (citizenView === "organizationApplications") {
      content = (
        <MyOrganizationApplicationsScreen
          accessToken={authentication.accessToken}
          submittedApplication={submittedApplication}
          onBack={() => {
            setSubmittedApplication(null);
            setCitizenView("dashboard");
            void authentication.refreshProfile();
          }}
          onCreateAnother={() => {
            setSubmittedApplication(null);
            setCitizenView("createOrganization");
          }}
        />
      );
    } else if (citizenView === "organizationWorkspace" && activeMembership) {
      content = (
        <OrganizationWorkspaceScreen
          profile={authentication.profile}
          accessToken={authentication.accessToken}
          memberships={activeMemberships}
          selectedOrganizationId={activeMembership.organizationId}
          onSelectOrganization={setSelectedOrganizationId}
          onBack={() => setCitizenView("dashboard")}
          onViewApplications={() => setCitizenView("organizationApplications")}
          onSignOut={() => void signOut()}
        />
      );
    } else if (citizenView === "reportIncident") {
      content = (
        <IncidentReportScreen
          accessToken={authentication.accessToken}
          onBack={() => setCitizenView("dashboard")}
          onSubmitted={(incident) => {
            setSubmittedIncident(incident);
            setCitizenView("myReports");
          }}
        />
      );
    } else if (citizenView === "myReports") {
      content = (
        <MyReportsScreen
          accessToken={authentication.accessToken}
          submittedIncident={submittedIncident}
          onBack={() => {
            setSubmittedIncident(null);
            setCitizenView("dashboard");
          }}
          onNewReport={() => {
            setSubmittedIncident(null);
            setCitizenView("reportIncident");
          }}
        />
      );
    } else {
      content = (
        <CitizenDashboard
          accessToken={authentication.accessToken}
          profile={authentication.profile}
          onOpenNotifications={() => setShowNotifications(true)}
          activeOrganization={activeMembership}
          onOpenOrganizationWorkspace={
            activeMembership
              ? () => {
                  setSelectedOrganizationId(activeMembership.organizationId);
                  setCitizenView("organizationWorkspace");
                }
              : undefined
          }
          onCreateOrganizationApplication={() => setCitizenView("createOrganization")}
          onViewApplications={() => setCitizenView("organizationApplications")}
          onReportIncident={() => setCitizenView("reportIncident")}
          onViewReports={() => setCitizenView("myReports")}
          onSignOut={() => void signOut()}
        />
      );
    }
  } else {
    content = <LoadingState />;
  }

  return (
    <>
      <StatusBar style="dark" />
      {content}
    </>
  );
}

const styles = StyleSheet.create({
  errorScreen: { justifyContent: "center", minHeight: "100%" },
});
