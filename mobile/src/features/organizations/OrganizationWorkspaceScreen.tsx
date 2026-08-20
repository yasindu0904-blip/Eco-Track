import { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import { BrandHeader, Button, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import type { ActiveOrganizationMembership } from "../memberships/administration/membershipAdministration.types";
import { CleanupEventDraftScreen, OrganizationCleanupEventListScreen } from "../cleanupEvents";
import { MembershipAdministrationScreen } from "../memberships/administration/MembershipAdministrationScreen";
import { OrganizationIncidentDiscovery } from "./OrganizationIncidentDiscovery";
import { getOrganizationSummary } from "../dashboards/dashboard.api";
import { Metric, SummaryCards, total } from "../dashboards/SummaryCards";

type OrganizationWorkspaceScreenProps = {
  profile: AuthenticatedUserProfile;
  accessToken: string;
  memberships: ActiveOrganizationMembership[];
  selectedOrganizationId: string;
  onSelectOrganization: (organizationId: string) => void;
  onBack: () => void;
  onViewApplications: () => void;
  onSignOut: () => void;
  initialTab?: "overview" | "incidentDiscovery" | "eventDrafts" | "events" | "members";
  initialIncidentId?: string;
  initialEventId?: string;
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
  initialTab = "overview",
  initialIncidentId,
  initialEventId,
}: OrganizationWorkspaceScreenProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "incidentDiscovery" | "eventDrafts" | "events" | "members">(initialTab);
  const [linkedIncidentId, setLinkedIncidentId] = useState<string | undefined>(initialIncidentId);
  const [selectedOwnedEventId, setSelectedOwnedEventId] = useState<string | undefined>(initialEventId);
  const [selectedDraftId, setSelectedDraftId] = useState<string | undefined>(initialTab === "eventDrafts" ? initialEventId : undefined);
  const [mapInteracting, setMapInteracting] = useState(false);
  const membership =
    memberships.find(
      (item) => item.organization.id === selectedOrganizationId,
    );
  const organizationId = membership?.organization.id ?? "";
  const loadSummary = useCallback(() => getOrganizationSummary(accessToken, organizationId), [accessToken, organizationId]);

  useEffect(() => {
    if (activeTab === "overview") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setMapInteracting(false);
      setActiveTab("overview");
      return true;
    });
    return () => subscription.remove();
  }, [activeTab]);

  if (!membership) {
    return null;
  }

  if (activeTab === "members" && membership.role === "ORG_ADMIN") {
    return (
      <MembershipAdministrationScreen
        accessToken={accessToken}
        organizationId={membership.organization.id}
        organizationName={membership.organization.name}
        onBack={() => setActiveTab("overview")}
      />
    );
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
                onPress={() => {
                  setMapInteracting(false);
                  setLinkedIncidentId(undefined);
                  setSelectedOwnedEventId(undefined);
                  setSelectedDraftId(undefined);
                  setActiveTab("overview");
                  onSelectOrganization(item.organization.id);
                }}
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
        ) : null}
        {activeTab === "eventDrafts" ? (
          <Text style={styles.breadcrumb}>/ Cleanup-event drafts</Text>
        ) : null}
        {activeTab === "events" ? <Text style={styles.breadcrumb}>/ Organization events</Text> : null}
        {activeTab === "members" ? <Text style={styles.breadcrumb}>/ Membership administration</Text> : null}
      </View>

      {activeTab === "eventDrafts" ? (
        <CleanupEventDraftScreen
          key={`${membership.organization.id}-${linkedIncidentId ?? selectedDraftId ?? "direct"}`}
          accessToken={accessToken}
          organizationId={membership.organization.id}
          incidentId={linkedIncidentId}
          initialDraftId={selectedDraftId}
          onMapInteractionChange={setMapInteracting}
          onBack={() => {
            setMapInteracting(false);
            setLinkedIncidentId(undefined);
            setSelectedDraftId(undefined);
            setActiveTab("overview");
          }}
        />
      ) : activeTab === "events" ? (
        <OrganizationCleanupEventListScreen
          key={`${membership.organization.id}-${selectedOwnedEventId ?? "list"}`}
          accessToken={accessToken}
          organizationId={membership.organization.id}
          initialEventId={selectedOwnedEventId}
          canCancel={membership.role === "ORG_ADMIN"}
        />
      ) : activeTab === "overview" ? (
        <>
          <SummaryCards load={loadSummary} label="Organization summary">{(summary) => <><Metric label="Covered incidents" value={total(summary.coveringIncidentsByState)} /><Metric label="Upcoming sessions" value={summary.upcomingSessions} /><Metric label="Joined participants" value={summary.joinedParticipants} /><Metric label="Pending membership requests" value={summary.pendingMembershipRequests} /></>}</SummaryCards>
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
          {membership.role === "ORG_ADMIN" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open membership administration"
              onPress={() => setActiveTab("members")}
              style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
            >
              <View style={styles.toolIcon}><Text style={styles.toolIconText}>M</Text></View>
              <View style={styles.toolCopy}><Text style={styles.toolEyebrow}>MEMBERSHIP ADMINISTRATION</Text><Text style={styles.toolTitle}>Members and requests</Text><Text style={styles.toolDescription}>Review requests and manage roles for this organization.</Text></View>
              <Text style={styles.toolArrow}>→</Text>
            </Pressable>
          ) : null}
          {membership.role === "ORG_ADMIN" ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open cleanup-event drafts"
              onPress={() => {
                setLinkedIncidentId(undefined);
                setActiveTab("eventDrafts");
              }}
              style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
            >
              <View style={styles.toolIcon}><Text style={styles.toolIconText}>+</Text></View>
              <View style={styles.toolCopy}>
                <Text style={styles.toolEyebrow}>CLEANUP-EVENT PLANNING</Text>
                <Text style={styles.toolTitle}>Draft workspace</Text>
                <Text style={styles.toolDescription}>Create private plans, sessions, and coordinator assignments.</Text>
              </View>
              <Text style={styles.toolArrow}>→</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open organization cleanup events"
            onPress={() => setActiveTab("events")}
            style={({ pressed }) => [styles.toolCard, pressed && styles.toolCardPressed]}
          >
            <View style={styles.toolIcon}><Text style={styles.toolIconText}>✓</Text></View>
            <View style={styles.toolCopy}><Text style={styles.toolEyebrow}>ORGANIZATION EVENTS</Text><Text style={styles.toolTitle}>Lifecycle overview</Text><Text style={styles.toolDescription}>See private drafts and published cleanup events for this organization.</Text></View>
            <Text style={styles.toolArrow}>→</Text>
          </Pressable>
        </>
      ) : (
        <OrganizationIncidentDiscovery
          key={membership.organization.id}
          accessToken={accessToken}
          organizationId={membership.organization.id}
          canReview={membership.role === "ORG_ADMIN"}
          onMapInteractionChange={setMapInteracting}
          onOpenEvent={(eventId, lifecycleStatus) => {
            setMapInteracting(false);
            setSelectedOwnedEventId(eventId);
            if (lifecycleStatus === "DRAFT" && membership.role === "ORG_ADMIN") {
              setSelectedDraftId(eventId);
              setActiveTab("eventDrafts");
            } else {
              setSelectedDraftId(undefined);
              setActiveTab("events");
            }
          }}
          onCreateDraftFromIncident={membership.role === "ORG_ADMIN" ? (incidentId) => {
            setMapInteracting(false);
            setLinkedIncidentId(incidentId);
            setActiveTab("eventDrafts");
          } : undefined}
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
