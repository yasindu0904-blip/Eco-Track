import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { describeApiFailure } from "../../../api/apiError";
import { colors, spacing } from "../../../components/theme";
import { BrandHeader, Button, Field, Notice, Screen, sharedStyles } from "../../../components/ui";
import {
  addExistingMember,
  approveMembershipRequest,
  changeMemberRole,
  changeMemberStatus,
  declineMembershipRequest,
  listOrganizationMembers,
  listPendingMembershipRequests,
} from "./membershipAdministration.api";
import type { AdminMembershipRequest, MembershipRole, OrganizationMember } from "./membershipAdministration.types";

type Props = {
  accessToken: string;
  organizationId: string;
  organizationName: string;
  onBack: () => void;
};

function errorMessage(error: unknown, fallback: string) {
  return describeApiFailure(error, fallback).message;
}

function replaceMember(items: OrganizationMember[], updated: OrganizationMember) {
  return items.map((item) => item.id === updated.id ? updated : item);
}

export function MembershipAdministrationScreen({ accessToken, organizationId, organizationName, onBack }: Props) {
  const [requests, setRequests] = useState<AdminMembershipRequest[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [memberCursor, setMemberCursor] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [email, setEmail] = useState("");

  const loadRequests = useCallback(async (cursor?: string) => {
    setLoadingRequests(true);
    setRequestError(null);
    try {
      const page = await listPendingMembershipRequests(accessToken, organizationId, cursor);
      setRequests((current) => cursor ? [...current, ...page.items] : page.items);
      setRequestCursor(page.nextCursor);
    } catch (error) {
      setRequestError(errorMessage(error, "Pending requests could not be loaded. Check your connection and retry."));
    } finally {
      setLoadingRequests(false);
    }
  }, [accessToken, organizationId]);

  const loadMembers = useCallback(async (cursor?: string) => {
    setLoadingMembers(true);
    setMemberError(null);
    try {
      const page = await listOrganizationMembers(accessToken, organizationId, cursor);
      setMembers((current) => cursor ? [...current, ...page.items] : page.items);
      setMemberCursor(page.nextCursor);
    } catch (error) {
      setMemberError(errorMessage(error, "Organization members could not be loaded. Check your connection and retry."));
    } finally {
      setLoadingMembers(false);
    }
  }, [accessToken, organizationId]);

  useEffect(() => {
    void loadRequests();
    void loadMembers();
  }, [loadMembers, loadRequests]);

  async function approve(request: AdminMembershipRequest) {
    setBusyKey(`request-${request.id}`);
    setRequestError(null);
    try {
      await approveMembershipRequest(accessToken, organizationId, request.id);
      setRequests((current) => current.filter(({ id }) => id !== request.id));
      setNotice("Membership request approved.");
      await loadMembers();
    } catch (error) {
      setRequestError(errorMessage(error, "The membership request could not be approved."));
      await loadRequests();
    } finally {
      setBusyKey(null);
    }
  }

  async function decline(requestId: string) {
    setBusyKey(`request-${requestId}`);
    setRequestError(null);
    try {
      await declineMembershipRequest(accessToken, organizationId, requestId, declineReason);
      setRequests((current) => current.filter(({ id }) => id !== requestId));
      setDecliningId(null);
      setDeclineReason("");
      setNotice("Membership request declined.");
    } catch (error) {
      setRequestError(errorMessage(error, "The membership request could not be declined."));
      await loadRequests();
    } finally {
      setBusyKey(null);
    }
  }

  async function add() {
    setBusyKey("add-member");
    setMemberError(null);
    try {
      const member = await addExistingMember(accessToken, organizationId, email);
      setMembers((current) => [member, ...current]);
      setEmail("");
      setNotice("Existing EcoTrack user added as an Organization Member.");
    } catch (error) {
      setMemberError(errorMessage(error, "The EcoTrack user could not be added."));
    } finally {
      setBusyKey(null);
    }
  }

  async function updateRole(member: OrganizationMember, role: MembershipRole) {
    setBusyKey(`member-${member.id}`);
    try {
      const updated = await changeMemberRole(accessToken, organizationId, member.id, role);
      setMembers((current) => replaceMember(current, updated));
      setNotice("Membership role updated.");
      setMemberError(null);
    } catch (error) {
      setMemberError(errorMessage(error, "The membership role could not be updated."));
      await loadMembers();
    } finally {
      setBusyKey(null);
    }
  }

  async function updateStatus(member: OrganizationMember, status: "ACTIVE" | "SUSPENDED" | "REMOVED") {
    setBusyKey(`member-${member.id}`);
    try {
      const updated = await changeMemberStatus(accessToken, organizationId, member.id, status);
      setMembers((current) => replaceMember(current, updated));
      setNotice("Membership status updated.");
      setMemberError(null);
    } catch (error) {
      setMemberError(errorMessage(error, "The membership status could not be updated."));
      await loadMembers();
    } finally {
      setBusyKey(null);
    }
  }

  function confirm(title: string, body: string, action: () => void, destructive = false) {
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", style: destructive ? "destructive" : "default", onPress: action },
    ]);
  }

  return (
    <Screen>
      <BrandHeader eyebrow="Organization workspace" title="Membership administration" subtitle={organizationName} compact />
      <Button label="Back" variant="secondary" onPress={onBack} />
      {notice ? <Notice message={notice} tone="success" /> : null}

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Pending requests</Text>
        <Text style={sharedStyles.sectionSubtitle}>Approve verified members or decline with a useful reason.</Text>
        {requestError ? <Notice message={requestError} tone="error" /> : null}
        <Button label="Refresh requests" variant="secondary" loading={loadingRequests} onPress={() => void loadRequests()} />
        {requests.map((request) => (
          <View key={request.id} style={styles.itemCard}>
            <Text style={styles.itemTitle}>{request.requester.fullName ?? "EcoTrack user"}</Text>
            <Text style={styles.copy}>{request.requester.email}</Text>
            {request.requester.phoneNumber ? <Text style={styles.copy}>{request.requester.phoneNumber}</Text> : null}
            <Text style={styles.copy}>{request.message ?? "No request message was provided."}</Text>
            <Button label="Approve as member" loading={busyKey === `request-${request.id}`} disabled={busyKey !== null} onPress={() => confirm("Approve membership", `Approve ${request.requester.fullName ?? request.requester.email}?`, () => void approve(request))} />
            <Button label="Decline" variant="danger" disabled={busyKey !== null} onPress={() => { setDecliningId(request.id); setDeclineReason(""); }} />
            {decliningId === request.id ? <View style={styles.declineBox}><Field label="Decline reason" value={declineReason} onChangeText={setDeclineReason} multiline required /><Button label="Confirm decline" variant="danger" loading={busyKey === `request-${request.id}`} disabled={declineReason.trim().length < 5} onPress={() => confirm("Decline membership", "The requester will receive this decision and reason.", () => void decline(request.id), true)} /><Button label="Cancel" variant="secondary" onPress={() => setDecliningId(null)} /></View> : null}
          </View>
        ))}
        {!loadingRequests && requests.length === 0 ? <Text style={styles.empty}>There are no pending membership requests.</Text> : null}
        {requestCursor ? <Button label="Load more requests" variant="secondary" disabled={loadingRequests} onPress={() => void loadRequests(requestCursor)} /> : null}
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Add an existing user</Text>
        <Text style={sharedStyles.sectionSubtitle}>Use the person's exact verified EcoTrack email. New additions start as Organization Members.</Text>
        <Field label="Verified email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" required />
        <Button label="Add as member" loading={busyKey === "add-member"} disabled={!email.trim() || busyKey !== null} onPress={() => void add()} />
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>Organization members</Text>
        <Text style={sharedStyles.sectionSubtitle}>The final active Organization Admin cannot be demoted, suspended, or removed.</Text>
        {memberError ? <Notice message={memberError} tone="error" /> : null}
        <Button label="Refresh members" variant="secondary" loading={loadingMembers} onPress={() => void loadMembers()} />
        {members.map((member) => {
          const busy = busyKey === `member-${member.id}`;
          return (
            <View key={member.id} style={styles.itemCard}>
              <View style={sharedStyles.spacedRow}><Text style={[styles.itemTitle, styles.flex]}>{member.user.fullName ?? "EcoTrack user"}</Text><View style={styles.status}><Text style={styles.statusText}>{member.role === "ORG_ADMIN" ? "ADMIN" : "MEMBER"} | {member.status}</Text></View></View>
              <Text style={styles.copy}>{member.user.email}</Text>
              {member.user.phoneNumber ? <Text style={styles.copy}>{member.user.phoneNumber}</Text> : null}
              {member.status === "ACTIVE" ? <><Button label={member.role === "ORG_ADMIN" ? "Demote to member" : "Promote to admin"} variant="secondary" loading={busy} disabled={busyKey !== null} onPress={() => { const nextRole = member.role === "ORG_ADMIN" ? "ORG_MEMBER" : "ORG_ADMIN"; confirm("Change organization role", `Change this user to ${nextRole === "ORG_ADMIN" ? "Organization Admin" : "Organization Member"}?`, () => void updateRole(member, nextRole)); }} /><Button label="Suspend" variant="secondary" disabled={busyKey !== null} onPress={() => confirm("Suspend membership", "This user will lose organization workspace access.", () => void updateStatus(member, "SUSPENDED"), true)} /><Button label="Remove" variant="danger" disabled={busyKey !== null} onPress={() => confirm("Remove membership", "The historical membership record will be preserved.", () => void updateStatus(member, "REMOVED"), true)} /></> : <Button label="Reactivate" loading={busy} disabled={busyKey !== null} onPress={() => confirm("Reactivate membership", "Restore this user's organization workspace access?", () => void updateStatus(member, "ACTIVE"))} />}
            </View>
          );
        })}
        {!loadingMembers && members.length === 0 ? <Text style={styles.empty}>No organization members were found.</Text> : null}
        {memberCursor ? <Button label="Load more members" variant="secondary" disabled={loadingMembers} onPress={() => void loadMembers(memberCursor)} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  itemCard: { gap: spacing.sm, padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  itemTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  copy: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  declineBox: { gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.dangerSoft },
  empty: { color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.successSoft },
  statusText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  flex: { flex: 1 },
});
