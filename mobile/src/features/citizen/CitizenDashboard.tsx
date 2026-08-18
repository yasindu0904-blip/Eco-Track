import { StyleSheet, Text, View } from "react-native";

import type {
  ActiveOrganizationMembership,
  AuthenticatedUserProfile,
} from "../../auth/auth.types";
import { BrandHeader, Button, Notice, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { NotificationButton } from "../notifications/NotificationInboxScreen";

type CitizenDashboardProps = {
  profile: AuthenticatedUserProfile;
  accessToken: string;
  onOpenNotifications: () => void;
  onManageMembership: () => void;
  activeOrganization?: ActiveOrganizationMembership;
  onOpenOrganizationWorkspace?: () => void;
  onCreateOrganizationApplication: () => void;
  onViewApplications: () => void;
  onReportIncident: () => void;
  onViewReports: () => void;
  onFindCleanupActivity: () => void;
  onOpenHistoricalReview: () => void;
  onOpenImpact: () => void;
  onSignOut: () => void;
};

export function CitizenDashboard({
  profile,
  accessToken,
  onOpenNotifications,
  onManageMembership,
  activeOrganization,
  onOpenOrganizationWorkspace,
  onCreateOrganizationApplication,
  onViewApplications,
  onReportIncident,
  onViewReports,
  onFindCleanupActivity,
  onOpenHistoricalReview,
  onOpenImpact,
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

      {activeOrganization && onOpenOrganizationWorkspace ? (
        <View style={[sharedStyles.card, styles.organizationCard]}>
          <Text style={styles.organizationEyebrow}>ACTIVE ORGANIZATION</Text>
          <Text style={sharedStyles.sectionTitle}>
            {activeOrganization.organizationName}
          </Text>
          <Text style={sharedStyles.sectionSubtitle}>
            {activeOrganization.role === "ORG_ADMIN"
              ? "Organization admin"
              : "Organization member"}
          </Text>
          <Button
            label="Open organization workspace"
            onPress={onOpenOrganizationWorkspace}
          />
        </View>
      ) : null}

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
        <Text style={styles.upcomingEyebrow}>AVAILABLE NOW</Text>
        <Text style={sharedStyles.sectionTitle}>Incident reporting</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Confirm your current location or a manually positioned map pin, add evidence, and follow the shared status.
        </Text>
        <Button label="Report an incident" onPress={onReportIncident} />
        <Button label="View My Reports" variant="secondary" onPress={onViewReports} />
      </View>

      <View style={sharedStyles.card}>
        <Text style={styles.upcomingEyebrow}>FIND CLEANUP ACTIVITY</Text>
        <Text style={sharedStyles.sectionTitle}>Discover incidents nearby</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Browse environmental incidents in the visible map area or run an
          explicit five-kilometre search from your current location.
        </Text>
        <Button label="Open discovery map" onPress={onFindCleanupActivity} />
      </View>

      <View style={sharedStyles.card}>
        <Text style={styles.upcomingEyebrow}>HISTORICAL REVIEW</Text>
        <Text style={sharedStyles.sectionTitle}>Successfully concluded events</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          See your verified completed-event count and review each cleanup event name.
        </Text>
        <Button label="Open historical review" onPress={onOpenHistoricalReview} />
      </View>

      <View style={sharedStyles.card}>
        <Text style={styles.upcomingEyebrow}>MY IMPACT</Text>
        <Text style={sharedStyles.sectionTitle}>Rewards and achievements</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          See non-monetary points and the private history behind every verified contribution.
        </Text>
        <Button label="Open My Impact" onPress={onOpenImpact} />
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
  organizationCard: {
    borderColor: colors.primary,
  },
  organizationEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
});
