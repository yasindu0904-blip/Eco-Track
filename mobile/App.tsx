import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Alert, BackHandler, StyleSheet, Text, View } from "react-native";

import { AuthenticatedUserApp } from "./src/app/AuthenticatedUserApp";
import { hasCompletedProfile } from "./src/authorization/authorizationUi";
import { LoginScreen } from "./src/auth/LoginScreen";
import { ProfileOnboardingScreen } from "./src/auth/ProfileOnboardingScreen";
import { useAuthentication } from "./src/auth/useAuthentication";
import { BrandHeader, Button, LoadingState, Notice, Screen, sharedStyles } from "./src/components/ui";
import { NotificationInboxScreen } from "./src/features/notifications/NotificationInboxScreen";
import type { NotificationItem } from "./src/features/notifications/notification.types";
import { deactivateCurrentInstallationPush } from "./src/features/notifications/pushNotification.service";
import { usePushNotifications } from "./src/features/notifications/usePushNotifications";
import { SuperAdminDashboard } from "./src/features/superAdmin/SuperAdminDashboard";

export default function App() {
  const authentication = useAuthentication();
  const [showSuperAdminNotifications, setShowSuperAdminNotifications] = useState(false);
  const [pendingPushNotification, setPendingPushNotification] = useState<NotificationItem | null>(null);
  const handlePushNotification = useCallback((notification: NotificationItem) => {
    setPendingPushNotification(notification);
  }, []);
  const handlePushNotificationHandled = useCallback(() => {
    setPendingPushNotification(null);
  }, []);

  const stopPushRegistration = usePushNotifications({
    accessToken: authentication.accessToken,
    userId: authentication.profile?.id ?? null,
    enabled: authentication.status === "signedIn"
      && Boolean(authentication.profile && hasCompletedProfile(authentication.profile)),
    onNotificationResponse: handlePushNotification,
  });

  useEffect(() => {
    if (
      pendingPushNotification
      && authentication.status === "signedIn"
      && authentication.profile?.platformRole === "SUPER_ADMIN"
    ) {
      setShowSuperAdminNotifications(true);
      setPendingPushNotification(null);
    }
  }, [authentication.profile?.platformRole, authentication.status, pendingPushNotification]);

  useEffect(() => {
    if (!showSuperAdminNotifications) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setShowSuperAdminNotifications(false);
      return true;
    });
    return () => subscription.remove();
  }, [showSuperAdminNotifications]);

  const signOut = async () => {
    stopPushRegistration();
    setShowSuperAdminNotifications(false);
    setPendingPushNotification(null);
    if (authentication.accessToken && authentication.profile) {
      try {
        await deactivateCurrentInstallationPush(
          authentication.accessToken,
          authentication.profile.id,
        );
      } catch (error) {
        Alert.alert("Could not sign out safely", error instanceof Error ? error.message : "Please try again.");
        return;
      }
    }
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
          <Notice message={authentication.errorMessage ?? "Authentication failed."} tone="error" />
          <Button label="Try again" onPress={() => void authentication.retry()} />
          <Button label="Return to sign in" variant="secondary" onPress={() => void signOut()} />
        </View>
      </Screen>
    );
  } else if (authentication.profile && authentication.accessToken && !hasCompletedProfile(authentication.profile)) {
    content = <ProfileOnboardingScreen accessToken={authentication.accessToken} profile={authentication.profile} onCompleted={authentication.replaceProfile} onSignOut={() => void signOut()} />;
  } else if (authentication.profile && authentication.accessToken && authentication.profile.platformRole === "SUPER_ADMIN") {
    content = showSuperAdminNotifications
      ? <NotificationInboxScreen accessToken={authentication.accessToken} onBack={() => setShowSuperAdminNotifications(false)} />
      : <SuperAdminDashboard accessToken={authentication.accessToken} profile={authentication.profile} onOpenNotifications={() => setShowSuperAdminNotifications(true)} onSignOut={() => void signOut()} />;
  } else if (authentication.profile && authentication.accessToken) {
    content = <AuthenticatedUserApp accessToken={authentication.accessToken} profile={authentication.profile} pushNotification={pendingPushNotification} onPushNotificationHandled={handlePushNotificationHandled} onProfileUpdated={authentication.replaceProfile} onSignOut={signOut} />;
  } else {
    content = <LoadingState />;
  }

  return <><StatusBar style="dark" />{content}</>;
}

const styles = StyleSheet.create({
  errorScreen: { justifyContent: "center", minHeight: "100%" },
});
