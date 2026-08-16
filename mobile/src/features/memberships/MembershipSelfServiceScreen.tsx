import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AuthenticatedUserProfile } from "../../auth/auth.types";
import { colors, spacing } from "../../components/theme";
import { BrandHeader, Button, Field, Notice, Screen, sharedStyles } from "../../components/ui";
import {
  listMyMembershipRequests,
  requestMembership,
  searchOrganizations,
  updateMyProfile,
  withdrawMembershipRequest,
} from "./membershipSelfService.api";
import type { MembershipRequest, MembershipRequestStatus, PublicOrganization } from "./membershipSelfService.types";

type Props = {
  accessToken: string;
  profile: AuthenticatedUserProfile;
  onProfileUpdated: (profile: AuthenticatedUserProfile) => void;
  onBack: () => void;
};

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function statusColor(status: MembershipRequestStatus) {
  if (status === "APPROVED") return styles.statusApproved;
  if (status === "DECLINED") return styles.statusDeclined;
  if (status === "WITHDRAWN") return styles.statusWithdrawn;
  return styles.statusPending;
}

export function MembershipSelfServiceScreen({ accessToken, profile, onProfileUpdated, onBack }: Props) {
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [organizationCursor, setOrganizationCursor] = useState<string | null>(null);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingOrganizations = useMemo(
    () => new Set(requests.filter(({ status }) => status === "PENDING").map(({ organization }) => organization.id)),
    [requests],
  );

  const loadOrganizations = useCallback(async (cursor?: string) => {
    setLoadingOrganizations(true);
    setOrganizationError(null);
    try {
      const page = await searchOrganizations(accessToken, query, cursor);
      setOrganizations((current) => cursor ? [...current, ...page.items] : page.items);
      setOrganizationCursor(page.nextCursor);
    } catch (error) {
      setOrganizationError(messageFrom(error, "Organizations could not be loaded. Check your connection and retry."));
    } finally {
      setLoadingOrganizations(false);
    }
  }, [accessToken, query]);

  const loadRequests = useCallback(async (cursor?: string) => {
    setLoadingRequests(true);
    setRequestError(null);
    try {
      const page = await listMyMembershipRequests(accessToken, cursor);
      setRequests((current) => cursor ? [...current, ...page.items] : page.items);
      setRequestCursor(page.nextCursor);
    } catch (error) {
      setRequestError(messageFrom(error, "Membership requests could not be loaded. Check your connection and retry."));
    } finally {
      setLoadingRequests(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadOrganizations();
    void loadRequests();
  }, [loadOrganizations, loadRequests]);

  async function saveProfile() {
    setSaving(true);
    setProfileNotice(null);
    try {
      const updated = await updateMyProfile(accessToken, { fullName, phoneNumber });
      setFullName(updated.fullName ?? "");
      setPhoneNumber(updated.phoneNumber ?? "");
      onProfileUpdated(updated);
      setProfileNotice({ text: "Your profile was updated.", error: false });
    } catch (error) {
      setProfileNotice({ text: messageFrom(error, "Your profile could not be updated."), error: true });
    } finally {
      setSaving(false);
    }
  }

  async function join(organizationId: string) {
    setBusyId(organizationId);
    setRequestError(null);
    try {
      const created = await requestMembership(accessToken, organizationId);
      setRequests((current) => [created, ...current]);
    } catch (error) {
      setRequestError(messageFrom(error, "The membership request could not be submitted."));
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  async function withdraw(requestId: string) {
    setBusyId(requestId);
    setRequestError(null);
    try {
      const updated = await withdrawMembershipRequest(accessToken, requestId);
      setRequests((current) => current.map((request) => request.id === requestId ? updated : request));
    } catch (error) {
      setRequestError(messageFrom(error, "The request could not be withdrawn."));
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen>
      <BrandHeader eyebrow="Account & membership" title="Join an organization" compact />
      <Button label="Back to dashboard" variant="secondary" onPress={onBack} />

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Edit profile</Text>
        <Text style={sharedStyles.sectionSubtitle}>Only your full name and phone number can be edited. Your verified email and roles stay protected.</Text>
        <View style={styles.readOnlyField}><Text style={styles.label}>Verified email</Text><Text style={styles.value}>{profile.email}</Text></View>
        <Field label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" required />
        <Field label="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" required />
        {profileNotice ? <Notice message={profileNotice.text} tone={profileNotice.error ? "error" : "success"} /> : null}
        <Button label="Save profile" onPress={() => void saveProfile()} loading={saving} disabled={!fullName.trim() || !phoneNumber.trim()} />
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Find active organizations</Text>
        <Text style={sharedStyles.sectionSubtitle}>Search approved organizations and request ORG_MEMBER access.</Text>
        <Field label="Organization name" value={query} onChangeText={setQuery} placeholder="Search organizations" />
        <Button label="Search" onPress={() => void loadOrganizations()} loading={loadingOrganizations} />
        {organizationError ? <><Notice message={organizationError} tone="error" /><Button label="Retry organization search" variant="secondary" onPress={() => void loadOrganizations()} /></> : null}
        {organizations.map((organization) => {
          const pending = pendingOrganizations.has(organization.id);
          return (
            <View key={organization.id} style={styles.resultCard}>
              <Text style={styles.resultTitle}>{organization.name}</Text>
              <Text style={styles.copy}>{organization.description ?? "No public description provided."}</Text>
              <Text style={styles.slug}>{organization.slug}</Text>
              <Button label={pending ? "Request pending" : "Request membership"} onPress={() => void join(organization.id)} loading={busyId === organization.id} disabled={pending || busyId !== null} />
            </View>
          );
        })}
        {!loadingOrganizations && organizations.length === 0 && !organizationError ? <Text style={styles.copy}>No active organizations match your search.</Text> : null}
        {organizationCursor ? <Button label="Load more organizations" variant="secondary" onPress={() => void loadOrganizations(organizationCursor)} disabled={loadingOrganizations} /> : null}
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>My membership requests</Text>
        <Text style={sharedStyles.sectionSubtitle}>Past requests stay visible. Only pending requests can be withdrawn.</Text>
        {requestError ? <Notice message={requestError} tone="error" /> : null}
        <Button label="Refresh requests" variant="secondary" onPress={() => void loadRequests()} loading={loadingRequests} />
        {requests.map((request) => (
          <View key={request.id} style={styles.resultCard}>
            <View style={sharedStyles.spacedRow}>
              <Text style={[styles.resultTitle, styles.flex]}>{request.organization.name}</Text>
              <View style={[styles.status, statusColor(request.status)]}><Text style={styles.statusText}>{request.status}</Text></View>
            </View>
            <Text style={styles.copy}>Submitted {new Date(request.createdAt).toLocaleDateString()}</Text>
            {request.reviewNotes ? <Text style={styles.copy}>Review note: {request.reviewNotes}</Text> : null}
            {request.status === "PENDING" ? <Button label="Withdraw pending request" variant="secondary" onPress={() => void withdraw(request.id)} loading={busyId === request.id} disabled={busyId !== null} /> : null}
          </View>
        ))}
        {!loadingRequests && requests.length === 0 ? <Text style={styles.copy}>You have no membership requests yet.</Text> : null}
        {requestCursor ? <Button label="Load older requests" variant="secondary" onPress={() => void loadRequests(requestCursor)} disabled={loadingRequests} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readOnlyField: { gap: spacing.xs, padding: spacing.md, borderRadius: 13, backgroundColor: colors.surfaceMuted },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  value: { color: colors.text, fontSize: 15, fontWeight: "700" },
  resultCard: { gap: spacing.sm, padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  resultTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  slug: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusPending: { backgroundColor: colors.warningSoft },
  statusApproved: { backgroundColor: colors.successSoft },
  statusDeclined: { backgroundColor: colors.dangerSoft },
  statusWithdrawn: { backgroundColor: colors.border },
  statusText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  flex: { flex: 1 },
});
