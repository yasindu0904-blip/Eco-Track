import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import {
  ActionRow,
  AppMark,
  Button,
  Screen,
  SectionHeader,
  memberColors,
  memberSpacing,
  sharedStyles,
} from "../../components/memberUi";
import { getCitizenSummary } from "../dashboards/dashboard.api";
import { Metric, SummaryCards, total } from "../dashboards/SummaryCards";
import type { ActiveOrganizationMembership } from "../memberships/administration/membershipAdministration.types";
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
  onViewJoinedCleanupEvents: () => void;
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
  onViewJoinedCleanupEvents,
  onOpenImpact,
  onSignOut,
}: CitizenDashboardProps) {
  const displayName = profile.fullName?.trim() || "EcoTrack member";
  const firstName = displayName.split(/\s+/)[0];
  const loadSummary = useCallback(
    () => getCitizenSummary(accessToken),
    [accessToken],
  );

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <AppMark compact />
          <View>
            <Text style={styles.brandName}>EcoTrack</Text>
            <Text style={styles.workspaceLabel}>Personal workspace</Text>
          </View>
        </View>
        <NotificationButton
          accessToken={accessToken}
          onOpen={onOpenNotifications}
          compact
        />
      </View>

      <View style={styles.welcome}>
        <Text style={styles.welcomeEyebrow}>Welcome back</Text>
        <Text style={styles.welcomeTitle}>{firstName}</Text>
        <Text style={styles.welcomeCopy}>
          Take action in your community or continue an organization workspace.
        </Text>
      </View>

      <SummaryCards load={loadSummary} label="Your activity" compact>
        {(summary) => (
          <View style={styles.metricGrid}>
            <Metric compact label="Reports" value={total(summary.reportsByState)} />
            <Metric compact label="Upcoming" value={summary.upcomingEvents} />
            <Metric compact label="Impact points" value={summary.contributions.points} />
            <Metric compact label="Unread" value={summary.unreadNotifications} />
          </View>
        )}
      </SummaryCards>

      <View style={styles.section}>
        <SectionHeader
          title="Start here"
          subtitle="Choose one community action to continue."
        />
        <ActionRow
          title="Report an incident"
          description="Pin the location and share what you found."
          symbol="!"
          tone="primary"
          onPress={onReportIncident}
        />
        <ActionRow
          title="Find cleanup activity"
          description="Find incidents and cleanup activity around you."
          symbol="⌖"
          tone="warm"
          onPress={onFindCleanupActivity}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Your activity" />
        <ActionRow
          title="My reports"
          description="Check report details and status history."
          symbol="≡"
          onPress={onViewReports}
        />
        <ActionRow
          title="My joined events"
          description="See availability, assignments, and attendance."
          symbol="✓"
          onPress={onViewJoinedCleanupEvents}
        />
        <ActionRow
          title="My impact"
          description="Review points and community achievements."
          symbol="★"
          onPress={onOpenImpact}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Organizations" subtitle="Access stays separate for each organization." />
        {activeOrganization && onOpenOrganizationWorkspace ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenOrganizationWorkspace}
            style={({ pressed }) => [styles.organizationCard, pressed && styles.pressed]}
          >
            <View style={styles.organizationMark}>
              <Text style={styles.organizationMarkText}>
                {activeOrganization.organization.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.organizationCopy}>
              <Text style={styles.organizationMeta}>
                {activeOrganization.role === "ORG_ADMIN" ? "Organization admin" : "Organization member"}
              </Text>
              <Text style={styles.organizationName}>{activeOrganization.organization.name}</Text>
            </View>
            <Text style={styles.organizationArrow}>›</Text>
          </Pressable>
        ) : (
          <View style={[sharedStyles.card, styles.emptyOrganization]}>
            <Text style={sharedStyles.sectionTitle}>No active workspace yet</Text>
            <Text style={sharedStyles.sectionSubtitle}>
              Join an approved organization or request a workspace for an existing environmental group.
            </Text>
          </View>
        )}
        <ActionRow
          title="Manage membership"
          description="Find an organization or review your request."
          symbol="⌂"
          onPress={onManageMembership}
        />
        <ActionRow
          title="Organization requests"
          description="Submit a request or follow its review status."
          symbol="＋"
          onPress={activeOrganization ? onViewApplications : onCreateOrganizationApplication}
        />
        <Button
          label="View application history"
          variant="ghost"
          compact
          onPress={onViewApplications}
        />
      </View>

      <View style={styles.accountFooter}>
        <View style={styles.accountAvatar}>
          <Text style={styles.accountAvatarText}>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.accountCopy}>
          <Text style={styles.accountName}>{displayName}</Text>
          <Text style={styles.accountEmail}>{profile.email}</Text>
        </View>
        <Button label="Sign out" variant="ghost" compact onPress={onSignOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: memberSpacing.md,
    paddingBottom: memberSpacing.md,
    borderBottomWidth: 1,
    borderBottomColor: memberColors.border,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: memberSpacing.sm },
  brandName: { color: memberColors.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  workspaceLabel: { marginTop: 1, color: memberColors.textMuted, fontSize: 11 },
  welcome: { paddingVertical: memberSpacing.sm },
  welcomeEyebrow: { color: "#477456", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  welcomeTitle: { marginTop: 4, color: memberColors.text, fontSize: 34, fontWeight: "900", letterSpacing: -1.1 },
  welcomeCopy: { maxWidth: 330, marginTop: 5, color: memberColors.textMuted, fontSize: 14, lineHeight: 21 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap" },
  section: { gap: memberSpacing.sm },
  organizationCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: memberSpacing.md,
    padding: memberSpacing.md,
    borderRadius: 14,
    backgroundColor: "#183F2B",
  },
  organizationMark: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: memberColors.accent },
  organizationMarkText: { color: memberColors.primaryPressed, fontSize: 19, fontWeight: "900" },
  organizationCopy: { flex: 1, gap: 3 },
  organizationMeta: { color: "rgba(255,255,255,0.62)", fontSize: 11 },
  organizationName: { color: memberColors.surface, fontSize: 15, fontWeight: "800" },
  organizationArrow: { color: memberColors.surface, fontSize: 27 },
  emptyOrganization: { backgroundColor: memberColors.surfaceMuted, shadowOpacity: 0, elevation: 0 },
  pressed: { opacity: 0.9 },
  accountFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: memberSpacing.sm,
    paddingTop: memberSpacing.lg,
    borderTopWidth: 1,
    borderTopColor: memberColors.border,
  },
  accountAvatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: memberColors.primarySoft },
  accountAvatarText: { color: memberColors.primary, fontSize: 14, fontWeight: "900" },
  accountCopy: { flex: 1 },
  accountName: { color: memberColors.text, fontSize: 13, fontWeight: "800" },
  accountEmail: { color: memberColors.textMuted, fontSize: 11 },
});
