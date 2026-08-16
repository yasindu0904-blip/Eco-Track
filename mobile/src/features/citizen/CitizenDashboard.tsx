import { StyleSheet, Text, View } from "react-native";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import { BrandHeader, Button, Notice, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { NotificationButton } from "../notifications/NotificationInboxScreen";

type CitizenDashboardProps = {
  profile: AuthenticatedUserProfile;
  accessToken: string;
  onOpenNotifications: () => void;
  onManageMembership: () => void;
  onCreateOrganizationApplication: () => void;
  onViewApplications: () => void;
  onSignOut: () => void;
};

export function CitizenDashboard({
  profile,
  accessToken,
  onOpenNotifications,
  onManageMembership,
  onCreateOrganizationApplication,
  onViewApplications,
  onSignOut,
}: CitizenDashboardProps) {
  const displayName = profile.fullName?.trim() || "EcoTrack member";

  return (
    <Screen>
      <BrandHeader eyebrow="Citizen & volunteer" compact />

      <View style={[sharedStyles.card, styles.welcomeCard]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.welcomeCopy}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>
      </View>

      <Notice
        message="Every normal EcoTrack account can report as a citizen and voluntarily join cleanup events. Organization access is additional to this account."
      />

      <NotificationButton
        accessToken={accessToken}
        onOpen={onOpenNotifications}
      />

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Organization membership</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Find active organizations, request member access, edit your profile,
          and track your request status.
        </Text>
        <Button label="Manage membership" onPress={onManageMembership} />
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Organization onboarding</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Request a verified EcoTrack workspace for an existing environmental organization and select its official GN Division service areas.
        </Text>
        <Button
          label="Create organization request"
          onPress={onCreateOrganizationApplication}
        />
        <Button
          label="View my requests"
          variant="secondary"
          onPress={onViewApplications}
        />
      </View>

      <View style={[sharedStyles.card, styles.upcomingCard]}>
        <Text style={styles.upcomingEyebrow}>NEXT MAIN MODULE</Text>
        <Text style={sharedStyles.sectionTitle}>Incident reporting</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Map-based incident reporting is intentionally not simulated here because its backend API has not been implemented yet.
        </Text>
      </View>

      <Button label="Sign out" variant="secondary" onPress={onSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcomeCard: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  avatarText: { color: colors.surface, fontSize: 27, fontWeight: "900" },
  welcomeCopy: { flex: 1, gap: 2 },
  greeting: { color: colors.textMuted, fontSize: 13 },
  name: { color: colors.text, fontSize: 22, fontWeight: "900" },
  email: { color: colors.textMuted, fontSize: 13 },
  upcomingCard: { backgroundColor: colors.surfaceMuted },
  upcomingEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
});
