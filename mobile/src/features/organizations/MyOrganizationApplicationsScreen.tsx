import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiRequestError } from "../../api/apiClient";
import { Button, LoadingState, Notice, PageHeader, Screen, sharedStyles } from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import { listMyOrganizationApplications } from "./organizationApplication.api";
import type { OrganizationApplication, OrganizationStatus } from "./organizationApplication.types";

type Props = {
  accessToken: string;
  submittedApplication?: OrganizationApplication | null;
  onBack: () => void;
  onCreateAnother: () => void;
};

function statusLabel(status: OrganizationStatus): string {
  return status.replaceAll("_", " ");
}

function statusTone(status: OrganizationStatus) {
  if (status === "ACTIVE") return styles.statusActive;
  if (status === "DECLINED" || status === "SUSPENDED") return styles.statusDanger;
  return styles.statusPending;
}

export function MyOrganizationApplicationsScreen({
  accessToken,
  submittedApplication,
  onBack,
  onCreateAnother,
}: Props) {
  const [applications, setApplications] = useState<OrganizationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setApplications(await listMyOrganizationApplications(accessToken));
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiRequestError || caughtError instanceof Error
          ? caughtError.message
          : "Your organization requests could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <LoadingState message="Loading your organization requests…" />;
  }

  return (
    <Screen>
      <PageHeader
        eyebrow="My requests"
        title="Organization requests"
        subtitle="Follow each application from submission through review."
        onBack={onBack}
        backLabel="Dashboard"
      />
      {submittedApplication ? (
        <Notice message={`${submittedApplication.name} was submitted successfully and is waiting for Super Admin review.`} tone="success" />
      ) : null}
      {error ? <Notice message={error} tone="error" /> : null}

      {applications.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.sectionTitle}>No organization requests yet</Text>
          <Text style={sharedStyles.sectionSubtitle}>
            When you submit an organization onboarding request, its review status will appear here.
          </Text>
        </View>
      ) : (
        applications.map((application) => (
          <View key={application.id} style={sharedStyles.card}>
            <View style={sharedStyles.spacedRow}>
              <Text style={[sharedStyles.sectionTitle, styles.applicationName]}>{application.name}</Text>
              <View style={[styles.status, statusTone(application.status)]}>
                <Text style={styles.statusText}>{statusLabel(application.status)}</Text>
              </View>
            </View>
            <Text style={styles.date}>Submitted {new Date(application.createdAt).toLocaleDateString()}</Text>
            <View style={sharedStyles.divider} />
            <Text style={styles.detail}><Text style={styles.detailLabel}>Official email: </Text>{application.officialEmail}</Text>
            <Text style={styles.detail}><Text style={styles.detailLabel}>Service areas: </Text>{application.serviceAreas.length}</Text>
            {application.serviceAreas.map((area) => (
              <Text key={area.id} style={styles.area}>• {area.areaName} ({area.status.replaceAll("_", " ")})</Text>
            ))}
            {application.reviewNotes ? (
              <Notice
                message={`Review notes: ${application.reviewNotes}`}
                tone={application.status === "DECLINED" ? "error" : "info"}
              />
            ) : null}
          </View>
        ))
      )}

      <Button label="Refresh statuses" onPress={() => void load()} />
      <Button label="Create another request" variant="secondary" onPress={onCreateAnother} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  applicationName: { flex: 1 },
  status: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusActive: { backgroundColor: colors.successSoft },
  statusDanger: { backgroundColor: colors.dangerSoft },
  statusPending: { backgroundColor: colors.warningSoft },
  statusText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  date: { color: colors.textMuted, fontSize: 12 },
  detail: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  detailLabel: { color: colors.text, fontWeight: "800" },
  area: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginLeft: spacing.xs },
});
