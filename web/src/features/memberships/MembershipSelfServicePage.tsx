import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type { AuthenticatedUserProfile } from "../auth/auth.types";
import {
  listMyMembershipRequests,
  requestMembership,
  searchOrganizations,
  updateMyProfile,
  withdrawMembershipRequest,
} from "./membershipSelfService.api";
import type {
  MembershipRequest,
  MembershipRequestStatus,
  PublicOrganization,
} from "./membershipSelfService.types";
import "./membershipSelfService.css";

type MembershipSelfServicePageProps = {
  accessToken: string;
  profile: AuthenticatedUserProfile;
  onProfileUpdated: (profile: AuthenticatedUserProfile) => void;
  onBack: () => void;
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function statusLabel(status: MembershipRequestStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function MembershipSelfServicePage({
  accessToken,
  profile,
  onProfileUpdated,
  onBack,
}: MembershipSelfServicePageProps) {
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile.phoneNumber ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [organizationCursor, setOrganizationCursor] = useState<string | null>(null);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [busyOrganizationId, setBusyOrganizationId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const pendingOrganizationIds = useMemo(
    () => new Set(requests.filter(({ status }) => status === "PENDING").map(({ organization }) => organization.id)),
    [requests],
  );

  const loadRequests = useCallback(async (cursor?: string) => {
    setLoadingRequests(true);
    setRequestError(null);
    try {
      const page = await listMyMembershipRequests(accessToken, cursor);
      setRequests((current) => cursor ? [...current, ...page.items] : page.items);
      setRequestCursor(page.nextCursor);
    } catch (error) {
      setRequestError(errorText(error, "Unable to load your membership requests."));
    } finally {
      setLoadingRequests(false);
    }
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    void listMyMembershipRequests(accessToken)
      .then((page) => {
        if (!active) return;
        setRequests(page.items);
        setRequestCursor(page.nextCursor);
      })
      .catch((error: unknown) => {
        if (active) setRequestError(errorText(error, "Unable to load your membership requests."));
      })
      .finally(() => {
        if (active) setLoadingRequests(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchOrganizations(accessToken, query)
        .then((page) => {
          if (!active) return;
          setOrganizations(page.items);
          setOrganizationCursor(page.nextCursor);
        })
        .catch((error: unknown) => {
          if (active) setSearchError(errorText(error, "Unable to search organizations."));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [accessToken, query]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      const updated = await updateMyProfile(accessToken, { fullName, phoneNumber });
      setFullName(updated.fullName ?? "");
      setPhoneNumber(updated.phoneNumber ?? "");
      onProfileUpdated(updated);
      setProfileMessage("Your profile was updated.");
    } catch (error) {
      setProfileError(errorText(error, "Unable to update your profile."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function join(organizationId: string) {
    setBusyOrganizationId(organizationId);
    setRequestError(null);
    try {
      const created = await requestMembership(accessToken, organizationId);
      setRequests((current) => [created, ...current]);
    } catch (error) {
      setRequestError(errorText(error, "Unable to submit the membership request."));
      await loadRequests();
    } finally {
      setBusyOrganizationId(null);
    }
  }

  async function withdraw(requestId: string) {
    setWithdrawingId(requestId);
    setRequestError(null);
    try {
      const updated = await withdrawMembershipRequest(accessToken, requestId);
      setRequests((current) => current.map((item) => item.id === requestId ? updated : item));
    } catch (error) {
      setRequestError(errorText(error, "Unable to withdraw the membership request."));
      await loadRequests();
    } finally {
      setWithdrawingId(null);
    }
  }

  async function loadMoreOrganizations() {
    if (!organizationCursor) return;
    setSearching(true);
    try {
      const page = await searchOrganizations(accessToken, query, organizationCursor);
      setOrganizations((current) => [...current, ...page.items]);
      setOrganizationCursor(page.nextCursor);
    } catch (error) {
      setSearchError(errorText(error, "Unable to load more organizations."));
    } finally {
      setSearching(false);
    }
  }

  return (
    <main className="membership-page">
      <header className="membership-page-header">
        <div>
          <span>EcoTrack account</span>
          <h1>Profile &amp; organization membership</h1>
          <p>Manage your personal details and request member access to an active organization.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={onBack}>Back to dashboard</button>
      </header>

      <div className="membership-layout">
        <section className="membership-card" aria-labelledby="edit-profile-heading">
          <h2 id="edit-profile-heading">Edit profile</h2>
          <p>Email, account status, role, and internal IDs cannot be changed here.</p>
          <form onSubmit={saveProfile} className="membership-form">
            <label>Verified email<input value={profile.email} disabled /></label>
            <label>Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={120} disabled={savingProfile} required /></label>
            <label>Phone number<input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} minLength={7} maxLength={30} disabled={savingProfile} required /></label>
            {profileError && <p className="membership-error" role="alert">{profileError}</p>}
            {profileMessage && <p className="membership-success" role="status">{profileMessage}</p>}
            <button className="button button-primary" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</button>
          </form>
        </section>

        <section className="membership-card membership-card-wide" aria-labelledby="find-organizations-heading">
          <div className="membership-section-heading">
            <div><h2 id="find-organizations-heading">Find organizations</h2><p>Only active, approved EcoTrack organizations are shown.</p></div>
            <label className="membership-search">Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Organization name" /></label>
          </div>
          {searchError && <p className="membership-error" role="alert">{searchError}</p>}
          <div className="organization-results" aria-busy={searching}>
            {organizations.map((organization) => {
              const pending = pendingOrganizationIds.has(organization.id);
              const busy = busyOrganizationId === organization.id;
              return (
                <article key={organization.id}>
                  <div><h3>{organization.name}</h3><p>{organization.description ?? "No public description provided."}</p><small>{organization.slug}</small></div>
                  <button className="button button-primary" type="button" disabled={pending || busy || Boolean(busyOrganizationId)} onClick={() => void join(organization.id)}>
                    {pending ? "Request pending" : busy ? "Requesting…" : "Request membership"}
                  </button>
                </article>
              );
            })}
            {!searching && organizations.length === 0 && <p>No active organizations match your search.</p>}
          </div>
          {organizationCursor && <button className="button button-secondary" type="button" disabled={searching} onClick={() => void loadMoreOrganizations()}>{searching ? "Loading…" : "Load more organizations"}</button>}
        </section>

        <section className="membership-card membership-card-full" aria-labelledby="my-requests-heading">
          <div className="membership-section-heading"><div><h2 id="my-requests-heading">My membership requests</h2><p>Request history remains visible after approval, decline, or withdrawal.</p></div><button className="button button-secondary" type="button" disabled={loadingRequests} onClick={() => void loadRequests()}>Refresh</button></div>
          {requestError && <p className="membership-error" role="alert">{requestError}</p>}
          <div className="membership-request-list" aria-busy={loadingRequests}>
            {requests.map((request) => (
              <article key={request.id}>
                <div><h3>{request.organization.name}</h3><p>Submitted {new Date(request.createdAt).toLocaleDateString()}</p>{request.reviewNotes && <small>Review note: {request.reviewNotes}</small>}</div>
                <div className="membership-request-actions"><span className={`membership-status membership-status-${request.status.toLowerCase()}`}>{statusLabel(request.status)}</span>{request.status === "PENDING" && <button className="button button-secondary" type="button" disabled={withdrawingId === request.id} onClick={() => void withdraw(request.id)}>{withdrawingId === request.id ? "Withdrawing…" : "Withdraw"}</button>}</div>
              </article>
            ))}
            {!loadingRequests && requests.length === 0 && <p>You have not requested organization membership yet.</p>}
          </div>
          {requestCursor && <button className="button button-secondary" type="button" disabled={loadingRequests} onClick={() => void loadRequests(requestCursor)}>Load older requests</button>}
        </section>
      </div>
    </main>
  );
}
