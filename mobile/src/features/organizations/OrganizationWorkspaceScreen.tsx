import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import { BrandHeader, Button, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import type { ActiveOrganizationMembership } from "../memberships/administration/membershipAdministration.types";
import { CleanupWorkflowScreen } from "../cleanupWorkflows";
import { OrganizationIncidentDiscovery } from "./OrganizationIncidentDiscovery";

type OrganizationWorkspaceScreenProps = {
  profile: AuthenticatedUserProfile;
  accessToken: string;
  memberships: ActiveOrganizationMembership[];
  selectedOrganizationId: string;
  onSelectOrganization: (organizationId: string) => void;
  onBack: () => void;
  onViewApplications: () => void;
  onSignOut: () => void;
};

export function OrganizationWorkspaceScreen({
  profile,
  accessToken,
  memberships,
  selectedOrganizationId,
  onSelectOrganization,
  onBack,
  onViewApplications,
  onSignOut,
}: OrganizationWorkspaceScreenProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "incidentDiscovery" | "cleanupWorkflow">("overview");
  const [mapInteracting, setMapInteracting] = useState(false);
  const membership =
    memberships.find(
      (item) => item.organization.id === selectedOrganizationId,
    ) ?? memberships[0];

  if (!membership) {
    return null;
  }

  return (
    <Screen scrollEnabled={!mapInteracting}>
      <BrandHeader
        eyebrow="Organization workspace"
        title={membership.organization.name}
        subtitle={profile.email}
        compact
      />

      {memberships.length > 1 ? (
        <View style={styles.organizationSwitcher}>
          {memberships.map((item) => {
            const selected = item.organization.id === membership.organization.id;

            return (
              <Pressable
                accessibilityRole="button"
                key={item.organization.id}
                onPress={() => onSelectOrganization(item.organization.id)}
                style={[
                  styles.organizationOption,
                  selected && styles.organizationOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.organizationOptionText,
                    selected && styles.organizationOptionTextSelected,
                  ]}
                >
                  {item.organization.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === "overview" }}
          onPress={() => {
            setMapInteracting(false);
            setActiveTab("overview");
          }}
          style={[styles.tab, activeTab === "overview" && styles.tabSelected]}
        >
          <Text style={[styles.tabText, activeTab === "overview" && styles.tabTextSelected]}>
            Overview
          </Text>
        </Pressable>
        {activeTab === "incidentDiscovery" ? (
          <Text style={styles.breadcrumb}>/ Incident discovery</Text>
        ) : activeTab === "cleanupWorkflow" ? (
          <Text style={styles.breadcrumb}>/ Cleanup workflow</Text>
        ) : null}
      </View>

      {activeTab === "overview" ? (
        <>
          <View style={sharedStyles.card}>
            <View style={sharedStyles.spacedRow}>
              <View style={styles.accessValue}>
                <Text style={styles.label}>MEMBERSHIP</Text>
                <Text style={styles.value}>
                  {membership.role === "ORG_ADMIN"
                    ? "Organization admin"
                    : "Organization member"}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>ACTIVE</Text>
              </View>
            </View>
            <View style={sharedStyles.divider} />
            <View style={styles.accessValue}>
              <Text style={styles.label}>WORKSPACE</Text>
              <Text style={styles.value}>{membership.organization.slug}</Text>
            </View>
          </View>

          <View style={[sharedStyles.card, styles.acceptedCard]}>
            <Text style={styles.acceptedEyebrow}>ACCESS GRANTED</Text>
            <Text style={sharedStyles.sectionTitle}>
              Organization onboarding accepted
            </Text>
            <Text style={sharedStyles.sectionSubtitle}>
              This workspace is available through your active organization
              membership.
            </Text>
            <Button
              label="View organization requests"
              onPress={onViewApplications}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open incident discovery"
            onPress={() => setActiveTab("incidentDiscovery")}
            style={({ pressed }) => [
              styles.toolCard,
              pressed && styles.toolCardPressed,
            ]}
          >
            <View style={styles.toolIcon}>
              <Text style={styles.toolIconText}>!</Text>
            </View>
            <View style={styles.toolCopy}>
              <Text style={styles.toolEyebrow}>INCIDENT DISCOVERY</Text>
              <Text style={styles.toolTitle}>Available now</Text>
              <Text style={styles.toolDescription}>
                Search covered reports and review them by GN Division.
              </Text>
            </View>
            <Text style={styles.toolArrow}>→</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open cleanup event planning"
            onPress={() => setActiveTab("cleanupWorkflow")}
            style={({ pressed }) => [
              styles.toolCard,
              pressed && styles.toolCardPressed,
            ]}
          >
            <View style={styles.toolIcon}>
              <Text style={styles.toolIconText}>+</Text>
            </View>
            <View style={styles.toolCopy}>
              <Text style={styles.toolEyebrow}>CLEANUP EVENTS</Text>
              <Text style={styles.toolTitle}>Plan an activity</Text>
              <Text style={styles.toolDescription}>
                Review the protected event stages available to your organization.
              </Text>
            </View>
            <Text style={styles.toolArrow}>→</Text>
          </Pressable>
        </>
      ) : activeTab === "cleanupWorkflow" ? (
        <CleanupWorkflowScreen
          accessToken={accessToken}
          organizationId={membership.organization.id}
          onBack={() => setActiveTab("overview")}
        />
      ) : (
        <OrganizationIncidentDiscovery
          key={membership.organization.id}
          accessToken={accessToken}
          organizationId={membership.organization.id}
          onMapInteractionChange={setMapInteracting}
        />
      )}

      <Button label="Back to citizen dashboard" variant="secondary" onPress={onBack} />
      <Button label="Sign out" variant="secondary" onPress={onSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  organizationSwitcher: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  organizationOption: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  organizationOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  organizationOptionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
  },
  organizationOptionTextSelected: { color: colors.primary },
  accessValue: { flex: 1, gap: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  value: { color: colors.text, fontSize: 16, fontWeight: "800" },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.successSoft,
  },
  statusText: { color: colors.success, fontSize: 11, fontWeight: "900" },
  acceptedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  acceptedEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  tabSelected: { backgroundColor: colors.primarySoft },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: "900" },
  tabTextSelected: { color: colors.primary },
  breadcrumb: {
    alignSelf: "center",
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  toolCard: {
    minHeight: 128,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  toolCardPressed: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  toolIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: colors.warningSoft,
  },
  toolIconText: {
    color: colors.warning,
    fontSize: 24,
    fontWeight: "900",
  },
  toolCopy: { flex: 1, gap: 3 },
  toolEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  toolTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  toolDescription: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  toolArrow: { color: colors.warning, fontSize: 24, fontWeight: "900" },
});
