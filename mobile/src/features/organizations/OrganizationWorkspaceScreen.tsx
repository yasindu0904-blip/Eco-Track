import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type {
  ActiveOrganizationMembership,
  AuthenticatedUserProfile,
} from "../../auth/auth.types";
import { BrandHeader, Button, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { OrganizationIncidentReview } from "./OrganizationIncidentReview";

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
  const [activeTab, setActiveTab] = useState<"overview" | "incidentReview">("overview");
  const [mapInteracting, setMapInteracting] = useState(false);
  const membership =
    memberships.find(
      (item) => item.organizationId === selectedOrganizationId,
    ) ?? memberships[0];

  if (!membership) {
    return null;
  }

  return (
    <Screen scrollEnabled={!mapInteracting}>
      <BrandHeader
        eyebrow="Organization workspace"
        title={membership.organizationName}
        subtitle={profile.email}
        compact
      />

      {memberships.length > 1 ? (
        <View style={styles.organizationSwitcher}>
          {memberships.map((item) => {
            const selected = item.organizationId === membership.organizationId;

            return (
              <Pressable
                accessibilityRole="button"
                key={item.organizationId}
                onPress={() => onSelectOrganization(item.organizationId)}
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
                  {item.organizationName}
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
          onPress={() => setActiveTab("overview")}
          style={[styles.tab, activeTab === "overview" && styles.tabSelected]}
        >
          <Text style={[styles.tabText, activeTab === "overview" && styles.tabTextSelected]}>
            Overview
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activeTab === "incidentReview" }}
          onPress={() => setActiveTab("incidentReview")}
          style={[styles.tab, activeTab === "incidentReview" && styles.tabSelected]}
        >
          <Text style={[styles.tabText, activeTab === "incidentReview" && styles.tabTextSelected]}>
            Incident review
          </Text>
        </Pressable>
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
              <Text style={styles.value}>{membership.organizationSlug}</Text>
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
        </>
      ) : (
        <OrganizationIncidentReview
          key={membership.organizationId}
          accessToken={accessToken}
          organizationId={membership.organizationId}
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
});
