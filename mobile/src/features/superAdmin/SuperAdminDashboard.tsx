import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { ApiRequestError } from "../../api/apiClient";
import { pingSuperAdmin } from "../../auth/auth.api";
import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import { BrandHeader, Button, Field, LoadingState, Notice, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { NotificationButton } from "../notifications/NotificationInboxScreen";
import {
  approveOrganizationApplication,
  declineOrganizationApplication,
  getOrganizationApplicationForReview,
  listPendingOrganizationApplications,
} from "./organizationReview.api";
import type { OrganizationReviewApplication } from "./organizationReview.types";
import { getPlatformSummary } from "../dashboards/dashboard.api";
import { Metric, SummaryCards, total } from "../dashboards/SummaryCards";

type Props = {
  accessToken: string;
  profile: AuthenticatedUserProfile;
  onOpenNotifications: () => void;
  onSignOut: () => void;
};

function readableError(error: unknown): string {
  if (error instanceof ApiRequestError || error instanceof Error) {
    return error.message;
  }

  return "The Super Admin request could not be completed.";
}

export function SuperAdminDashboard({ accessToken, profile, onOpenNotifications, onSignOut }: Props) {
  const loadPlatformSummary = useCallback(() => getPlatformSummary(accessToken), [accessToken]);
  const [applications, setApplications] = useState<OrganizationReviewApplication[]>([]);
  const [selected, setSelected] = useState<OrganizationReviewApplication | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const pending = await listPendingOrganizationApplications(accessToken);
      setApplications(pending);

      if (selected && !pending.some((application) => application.id === selected.id)) {
        setSelected(null);
      }
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setLoading(false);
    }
  }, [accessToken, selected]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const selectApplication = async (applicationId: string) => {
    setLoadingDetails(true);
    setError(null);
    setNotice(null);

    try {
      setSelected(
        await getOrganizationApplicationForReview(accessToken, applicationId),
      );
      setReviewNotes("");
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setLoadingDetails(false);
    }
  };

  const completeReview = async (decision: "APPROVE" | "DECLINE") => {
    if (!selected) return;

    if (decision === "DECLINE" && reviewNotes.trim().length < 3) {
      setError("Enter a decline reason containing at least 3 characters.");
      return;
    }

    setReviewing(true);
    setError(null);

    try {
      const reviewed =
        decision === "APPROVE"
          ? await approveOrganizationApplication(accessToken, selected.id, reviewNotes)
          : await declineOrganizationApplication(accessToken, selected.id, reviewNotes);

      setApplications((current) => current.filter((item) => item.id !== selected.id));
      setSelected(null);
      setReviewNotes("");
      setNotice(
        `${reviewed.name} was ${decision === "APPROVE" ? "approved" : "declined"}. The requester notification was recorded.`,
      );
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setReviewing(false);
    }
  };

  const confirmReview = (decision: "APPROVE" | "DECLINE") => {
    if (!selected) return;

    Alert.alert(
      decision === "APPROVE" ? "Approve organization?" : "Decline organization?",
      decision === "APPROVE"
        ? "This activates the organization and service areas and creates the requester’s first ORG_ADMIN membership."
        : "This declines the application and records the review reason.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: decision === "APPROVE" ? "Approve" : "Decline",
          style: decision === "DECLINE" ? "destructive" : "default",
          onPress: () => void completeReview(decision),
        },
      ],
    );
  };

  const checkAccess = async () => {
    setCheckingAccess(true);
    setError(null);

    try {
      setNotice(await pingSuperAdmin(accessToken));
    } catch (caughtError) {
      setError(readableError(caughtError));
    } finally {
      setCheckingAccess(false);
    }
  };

  if (loading && applications.length === 0 && !error) {
    return <LoadingState message="Loading the Super Admin review queue…" />;
  }

  return (
    <Screen>
      <BrandHeader eyebrow="Protected platform area" title="Super Admin" compact />
      <SummaryCards load={loadPlatformSummary} label="Platform summary">{(summary) => <><Metric label="Active users" value={`${summary.users.active} / ${summary.users.total}`} /><Metric label="Organizations" value={total(summary.organizationsByState)} /><Metric label="Incidents" value={total(summary.incidentsByState)} /><Metric label="Cleanup events" value={total(summary.eventsByLifecycle)} /></>}</SummaryCards>
      <NotificationButton
        accessToken={accessToken}
        onOpen={onOpenNotifications}
      />

      <View style={[sharedStyles.card, styles.adminIdentity]}>
        <View style={styles.adminBadge}><Text style={styles.adminBadgeText}>★</Text></View>
        <View style={styles.identityCopy}>
          <Text style={styles.identityTitle}>{profile.fullName?.trim() || "EcoTrack Super Admin"}</Text>
          <Text style={styles.identityEmail}>{profile.email}</Text>
        </View>
      </View>

      <View style={[sharedStyles.card, styles.accessCard]}>
        <Text style={styles.accessEyebrow}>BACKEND AUTHORIZATION</Text>
        <Text style={styles.accessTitle}>Protected API access</Text>
        <Text style={styles.accessText}>CASL and the backend platform role—not this screen—decide whether these operations are allowed.</Text>
        <Button label="Verify protected access" onPress={() => void checkAccess()} loading={checkingAccess} />
      </View>

      {notice ? <Notice message={notice} tone="success" /> : null}
      {error ? <Notice message={error} tone="error" /> : null}

      <View style={sharedStyles.card}>
        <View style={sharedStyles.spacedRow}>
          <View style={styles.queueHeading}>
            <Text style={sharedStyles.sectionTitle}>Pending organizations</Text>
            <Text style={sharedStyles.sectionSubtitle}>{applications.length} waiting for review</Text>
          </View>
          <Pressable onPress={() => void loadApplications()}>
            <Text style={styles.refresh}>Refresh</Text>
          </Pressable>
        </View>

        {applications.length === 0 ? (
          <Notice message="There are no pending organization applications." tone="success" />
        ) : (
          applications.map((application) => (
            <Pressable
              key={application.id}
              onPress={() => void selectApplication(application.id)}
              style={[
                styles.applicationCard,
                selected?.id === application.id && styles.applicationCardSelected,
              ]}
            >
              <View style={styles.applicationCopy}>
                <Text style={styles.applicationName}>{application.name}</Text>
                <Text style={styles.applicationMeta}>
                  {application.serviceAreas.length} GN areas · {new Date(application.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.openText}>{loadingDetails ? "…" : "Open"}</Text>
            </Pressable>
          ))
        )}
      </View>

      {selected ? (
        <View style={sharedStyles.card}>
          <View>
            <Text style={styles.reviewEyebrow}>APPLICATION DETAILS</Text>
            <Text style={sharedStyles.sectionTitle}>{selected.name}</Text>
          </View>
          <Text style={styles.detail}><Text style={styles.detailLabel}>Requester: </Text>{selected.requester.fullName || selected.requester.email}</Text>
          <Text style={styles.detail}><Text style={styles.detailLabel}>Official email: </Text>{selected.officialEmail}</Text>
          <Text style={styles.detail}><Text style={styles.detailLabel}>Official phone: </Text>{selected.officialPhone}</Text>
          <Text style={styles.detail}><Text style={styles.detailLabel}>Registration: </Text>{selected.registrationNumber || "Not provided"}</Text>
          <Text style={styles.detail}><Text style={styles.detailLabel}>Address: </Text>{selected.officialAddress}</Text>
          {selected.description ? <Text style={styles.description}>{selected.description}</Text> : null}

          <View style={sharedStyles.divider} />
          <Text style={styles.detailLabel}>Proposed GN service areas</Text>
          {selected.serviceAreas.map((area) => (
            <View key={area.id} style={styles.areaCard}>
              <Text style={styles.areaName}>{area.name}</Text>
              <Text style={styles.areaMeta}>
                {area.officialCode ?? "No code"} · {area.divisionalSecretariatName ?? "Unknown DS"} · {area.districtName ?? "Unknown district"}
              </Text>
            </View>
          ))}

          <Field
            label="Review notes"
            value={reviewNotes}
            onChangeText={setReviewNotes}
            placeholder="Optional for approval; required for decline"
            multiline
          />
          <Button label="Approve organization" onPress={() => confirmReview("APPROVE")} loading={reviewing} />
          <Button label="Decline application" variant="danger" onPress={() => confirmReview("DECLINE")} disabled={reviewing} />
          <Button label="Close details" variant="secondary" onPress={() => setSelected(null)} disabled={reviewing} />
        </View>
      ) : null}

      <Button label="Sign out" variant="secondary" onPress={onSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  adminIdentity: { flexDirection: "row", alignItems: "center" },
  adminBadge: {
    width: 56,
    height: 56,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBadgeText: { color: colors.primaryDark, fontSize: 25, fontWeight: "900" },
  identityCopy: { flex: 1, gap: 3 },
  identityTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  identityEmail: { color: colors.textMuted, fontSize: 13 },
  accessCard: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  accessEyebrow: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  accessTitle: { color: colors.surface, fontSize: 21, fontWeight: "900" },
  accessText: { color: "#d7eadb", fontSize: 14, lineHeight: 21 },
  queueHeading: { flex: 1, gap: 3 },
  refresh: { color: colors.primary, fontSize: 13, fontWeight: "900" },
  applicationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    gap: spacing.sm,
  },
  applicationCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  applicationCopy: { flex: 1, gap: 3 },
  applicationName: { color: colors.text, fontSize: 15, fontWeight: "900" },
  applicationMeta: { color: colors.textMuted, fontSize: 12 },
  openText: { color: colors.primary, fontWeight: "900" },
  reviewEyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  detail: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  detailLabel: { color: colors.text, fontWeight: "800" },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21, fontStyle: "italic" },
  areaCard: { backgroundColor: colors.surfaceMuted, borderRadius: 12, padding: spacing.sm, gap: 3 },
  areaName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  areaMeta: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
