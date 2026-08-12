import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { LoginScreen } from "./src/auth/LoginScreen";
import { useAuthentication } from "./src/auth/useAuthentication";
import { BrandHeader, Button, LoadingState, Notice, Screen, sharedStyles } from "./src/components/ui";
import { CitizenDashboard } from "./src/features/citizen/CitizenDashboard";
import { MyOrganizationApplicationsScreen } from "./src/features/organizations/MyOrganizationApplicationsScreen";
import { OrganizationApplicationScreen } from "./src/features/organizations/OrganizationApplicationScreen";
import type { OrganizationApplication } from "./src/features/organizations/organizationApplication.types";
import { SuperAdminDashboard } from "./src/features/superAdmin/SuperAdminDashboard";

type CitizenView = "dashboard" | "createOrganization" | "organizationApplications";

export default function App() {
  const authentication = useAuthentication();
  const [citizenView, setCitizenView] = useState<CitizenView>("dashboard");
  const [submittedApplication, setSubmittedApplication] =
    useState<OrganizationApplication | null>(null);

  const signOut = async () => {
    setCitizenView("dashboard");
    setSubmittedApplication(null);
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
    authentication.profile.platformRole === "SUPER_ADMIN"
  ) {
    content = (
      <SuperAdminDashboard
        accessToken={authentication.accessToken}
        profile={authentication.profile}
        onSignOut={() => void signOut()}
      />
    );
  } else if (authentication.profile && authentication.accessToken) {
    if (citizenView === "createOrganization") {
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
          }}
          onCreateAnother={() => {
            setSubmittedApplication(null);
            setCitizenView("createOrganization");
          }}
        />
      );
    } else {
      content = (
        <CitizenDashboard
          profile={authentication.profile}
          onCreateOrganizationApplication={() => setCitizenView("createOrganization")}
          onViewApplications={() => setCitizenView("organizationApplications")}
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
