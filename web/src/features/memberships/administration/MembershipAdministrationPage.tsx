import { useCallback, useEffect, useState, type FormEvent } from "react";

import { describeApiFailure } from "../../../api/apiError";
import {
  addExistingMember,
  approveMembershipRequest,
  changeMemberRole,
  changeMemberStatus,
  declineMembershipRequest,
  listOrganizationMembers,
  listPendingMembershipRequests,
} from "./membershipAdministration.api";
import type {
  AdminMembershipRequest,
  MembershipRole,
  MembershipStatus,
  OrganizationMember,
} from "./membershipAdministration.types";
import "./membershipAdministration.css";

type Props = {
  accessToken: string;
  organizationId: string;
  organizationName: string;
  onBack: () => void;
};

function message(error: unknown, fallback: string) {
  return describeApiFailure(error, fallback).message;
}

function replaceMember(items: OrganizationMember[], updated: OrganizationMember) {
  return items.map((item) => item.id === updated.id ? updated : item);
}

export function MembershipAdministrationPage({ accessToken, organizationId, organizationName, onBack }: Props) {
  const [requests, setRequests] = useState<AdminMembershipRequest[]>([]);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
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
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<MembershipRole | "">("");
  const [status, setStatus] = useState<MembershipStatus | "">("");

  const loadRequests = useCallback(async (cursor?: string) => {
    setLoadingRequests(true);
    setRequestError(null);
    try {
      const page = await listPendingMembershipRequests(accessToken, organizationId, cursor);
      setRequests((current) => cursor ? [...current, ...page.items] : page.items);
      setRequestCursor(page.nextCursor);
    } catch (error) {
      setRequestError(message(error, "Unable to load pending requests."));
    } finally {
      setLoadingRequests(false);
    }
  }, [accessToken, organizationId]);

  const loadMembers = useCallback(async (cursor?: string) => {
    setLoadingMembers(true);
    setMemberError(null);
    try {
      const page = await listOrganizationMembers(accessToken, organizationId, {
        query,
        role: role || undefined,
        status: status || undefined,
        cursor,
      });
      setMembers((current) => cursor ? [...current, ...page.items] : page.items);
      setMemberCursor(page.nextCursor);
    } catch (error) {
      setMemberError(message(error, "Unable to load organization members."));
    } finally {
      setLoadingMembers(false);
    }
  }, [accessToken, organizationId, query, role, status]);

  useEffect(() => {
    let active = true;
    void listPendingMembershipRequests(accessToken, organizationId)
      .then((page) => {
        if (!active) return;
        setRequests(page.items);
        setRequestCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (active) setRequestError(message(error, "Unable to load pending requests."));
      })
      .finally(() => {
        if (active) setLoadingRequests(false);
      });
    void listOrganizationMembers(accessToken, organizationId)
      .then((page) => {
        if (!active) return;
        setMembers(page.items);
        setMemberCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (active) setMemberError(message(error, "Unable to load organization members."));
      })
      .finally(() => {
        if (active) setLoadingMembers(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken, organizationId]);

  async function approve(request: AdminMembershipRequest) {
    if (!window.confirm(`Approve ${request.requester.fullName ?? request.requester.email} as an Organization Member?`)) return;
    setBusyKey(`request-${request.id}`);
    setRequestError(null);
    try {
      await approveMembershipRequest(accessToken, organizationId, request.id);
      setRequests((current) => current.filter(({ id }) => id !== request.id));
      setNotice("Membership request approved.");
      await loadMembers();
    } catch (error) {
      setRequestError(message(error, "Unable to approve the request."));
      await loadRequests();
    } finally {
      setBusyKey(null);
    }
  }

  async function decline(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    setBusyKey(`request-${requestId}`);
    setRequestError(null);
    try {
      await declineMembershipRequest(accessToken, organizationId, requestId, declineReason);
      setRequests((current) => current.filter(({ id }) => id !== requestId));
      setDecliningId(null);
      setDeclineReason("");
      setNotice("Membership request declined.");
    } catch (error) {
      setRequestError(message(error, "Unable to decline the request."));
      await loadRequests();
    } finally {
      setBusyKey(null);
    }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("add-member");
    setMemberError(null);
    try {
      const added = await addExistingMember(accessToken, organizationId, email);
      setMembers((current) => [added, ...current]);
      setEmail("");
      setNotice("Existing EcoTrack user added as an Organization Member.");
    } catch (error) {
      setMemberError(message(error, "Unable to add the EcoTrack user."));
    } finally {
      setBusyKey(null);
    }
  }

  async function updateRole(member: OrganizationMember, nextRole: MembershipRole) {
    if (!window.confirm(`Change ${member.user.fullName ?? member.user.email} to ${nextRole === "ORG_ADMIN" ? "Organization Admin" : "Organization Member"}?`)) return;
    setBusyKey(`member-${member.id}`);
    try {
      const updated = await changeMemberRole(accessToken, organizationId, member.id, nextRole);
      setMembers((current) => replaceMember(current, updated));
      setNotice("Membership role updated.");
      setMemberError(null);
    } catch (error) {
      setMemberError(message(error, "Unable to update the membership role."));
      await loadMembers();
    } finally {
      setBusyKey(null);
    }
  }

  async function updateStatus(member: OrganizationMember, nextStatus: "ACTIVE" | "SUSPENDED" | "REMOVED") {
    if (!window.confirm(`${nextStatus === "REMOVED" ? "Remove" : nextStatus === "SUSPENDED" ? "Suspend" : "Reactivate"} ${member.user.fullName ?? member.user.email}?`)) return;
    setBusyKey(`member-${member.id}`);
    try {
      const updated = await changeMemberStatus(accessToken, organizationId, member.id, nextStatus);
      setMembers((current) => replaceMember(current, updated));
      setNotice("Membership status updated.");
      setMemberError(null);
    } catch (error) {
      setMemberError(message(error, "Unable to update the membership status."));
      await loadMembers();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <main className="membership-admin-page">
      <header className="membership-admin-header">
        <div><span>Organization workspace</span><h1>Membership administration</h1><p>{organizationName}</p></div>
        <button className="ma-button ma-secondary" type="button" onClick={onBack}>Back</button>
      </header>

      {notice && <p className="ma-notice ma-success" role="status">{notice}<button type="button" onClick={() => setNotice(null)}>Dismiss</button></p>}

      <section className="ma-card" aria-labelledby="pending-requests-heading">
        <div className="ma-section-heading"><div><h2 id="pending-requests-heading">Pending requests</h2><p>Approve verified members or decline with a clear reason.</p></div><button className="ma-button ma-secondary" type="button" disabled={loadingRequests} onClick={() => void loadRequests()}>Refresh</button></div>
        {requestError && <p className="ma-notice ma-error" role="alert">{requestError}</p>}
        <div className="ma-list" aria-busy={loadingRequests}>
          {requests.map((request) => (
            <article key={request.id} className="ma-request">
              <div className="ma-person"><div><h3>{request.requester.fullName ?? "EcoTrack user"}</h3><p>{request.requester.email}{request.requester.phoneNumber ? ` | ${request.requester.phoneNumber}` : ""}</p></div><small>{new Date(request.createdAt).toLocaleString()}</small></div>
              <p>{request.message ?? "No request message was provided."}</p>
              <div className="ma-actions"><button className="ma-button ma-primary" type="button" disabled={busyKey !== null} onClick={() => void approve(request)}>Approve</button><button className="ma-button ma-danger" type="button" disabled={busyKey !== null} onClick={() => { setDecliningId(request.id); setDeclineReason(""); }}>Decline</button></div>
              {decliningId === request.id && <form className="ma-decline" onSubmit={(event) => void decline(event, request.id)}><label>Decline reason<textarea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} minLength={5} maxLength={500} required /></label><div className="ma-actions"><button className="ma-button ma-danger" disabled={busyKey !== null}>Confirm decline</button><button className="ma-button ma-secondary" type="button" onClick={() => setDecliningId(null)}>Cancel</button></div></form>}
            </article>
          ))}
          {!loadingRequests && requests.length === 0 && <p className="ma-empty">There are no pending membership requests.</p>}
        </div>
        {requestCursor && <button className="ma-button ma-secondary" type="button" disabled={loadingRequests} onClick={() => void loadRequests(requestCursor)}>Load more requests</button>}
      </section>

      <section className="ma-card" aria-labelledby="members-heading">
        <div className="ma-section-heading"><div><h2 id="members-heading">Organization members</h2><p>Roles and access always apply only to this organization.</p></div></div>
        <form className="ma-add-form" onSubmit={add}><label>Existing EcoTrack user's verified email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><button className="ma-button ma-primary" disabled={busyKey !== null}>Add as member</button></form>
        <form className="ma-filters" onSubmit={(event) => { event.preventDefault(); void loadMembers(); }}><label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or email" /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value as MembershipRole | "")}><option value="">All roles</option><option value="ORG_MEMBER">Organization Member</option><option value="ORG_ADMIN">Organization Admin</option></select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as MembershipStatus | "")}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="REMOVED">Removed</option><option value="LEFT">Left</option></select></label><button className="ma-button ma-secondary" disabled={loadingMembers}>Apply filters</button></form>
        {memberError && <p className="ma-notice ma-error" role="alert">{memberError}</p>}
        <div className="ma-list" aria-busy={loadingMembers}>
          {members.map((member) => {
            const busy = busyKey === `member-${member.id}`;
            return <article key={member.id} className="ma-member"><div className="ma-person"><div><h3>{member.user.fullName ?? "EcoTrack user"}</h3><p>{member.user.email}{member.user.phoneNumber ? ` | ${member.user.phoneNumber}` : ""}</p></div><div className="ma-chips"><span>{member.role === "ORG_ADMIN" ? "Admin" : "Member"}</span><span className={`ma-status-${member.status.toLowerCase()}`}>{member.status}</span></div></div><p>Joined {new Date(member.joinedAt).toLocaleDateString()}</p><div className="ma-actions">{member.status === "ACTIVE" && <button className="ma-button ma-secondary" type="button" disabled={busy || busyKey !== null} onClick={() => void updateRole(member, member.role === "ORG_ADMIN" ? "ORG_MEMBER" : "ORG_ADMIN")}>{member.role === "ORG_ADMIN" ? "Demote to member" : "Promote to admin"}</button>}{member.status === "ACTIVE" ? <><button className="ma-button ma-secondary" type="button" disabled={busy || busyKey !== null} onClick={() => void updateStatus(member, "SUSPENDED")}>Suspend</button><button className="ma-button ma-danger" type="button" disabled={busy || busyKey !== null} onClick={() => void updateStatus(member, "REMOVED")}>Remove</button></> : <button className="ma-button ma-primary" type="button" disabled={busy || busyKey !== null} onClick={() => void updateStatus(member, "ACTIVE")}>Reactivate</button>}</div></article>;
          })}
          {!loadingMembers && members.length === 0 && <p className="ma-empty">No organization members match these filters.</p>}
        </div>
        {memberCursor && <button className="ma-button ma-secondary" type="button" disabled={loadingMembers} onClick={() => void loadMembers(memberCursor)}>Load more members</button>}
      </section>
    </main>
  );
}
