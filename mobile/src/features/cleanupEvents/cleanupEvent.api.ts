import { apiRequest } from "../../api/apiClient";
import type {
  CleanupEventDraft,
  CleanupEventDraftInput,
  CleanupEventDraftPage,
  CleanupEventSessionInput,
  CleanupEventOwnedPage,
  CleanupEventPublicDetail,
  CleanupEventPublicPage,
  CleanupEventPublishReadiness,
  CleanupEventPublishResult,
} from "./cleanupEvent.types";

const root = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/events`;
const json = (body: unknown) => ({
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" },
});

export async function listDrafts(token: string, organizationId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  return (
    await apiRequest<{ data: CleanupEventDraftPage }>(
      `${root(organizationId)}/drafts?${query}`,
      { accessToken: token },
    )
  ).data;
}

export async function getDraft(token: string, organizationId: string, draftId: string) {
  return (
    await apiRequest<{ data: CleanupEventDraft }>(
      `${root(organizationId)}/drafts/${encodeURIComponent(draftId)}`,
      { accessToken: token },
    )
  ).data;
}

export async function createDraft(
  token: string,
  organizationId: string,
  input: CleanupEventDraftInput,
) {
  return (
    await apiRequest<{ data: CleanupEventDraft }>(
      `${root(organizationId)}/drafts`,
      { accessToken: token, method: "POST", ...json(input) },
    )
  ).data;
}

export async function updateDraft(
  token: string,
  organizationId: string,
  draftId: string,
  input: Partial<CleanupEventDraftInput>,
) {
  return (
    await apiRequest<{ data: CleanupEventDraft }>(
      `${root(organizationId)}/drafts/${encodeURIComponent(draftId)}`,
      { accessToken: token, method: "PATCH", ...json(input) },
    )
  ).data;
}

export async function discardDraft(token: string, organizationId: string, draftId: string) {
  await apiRequest(`${root(organizationId)}/drafts/${encodeURIComponent(draftId)}`, {
    accessToken: token,
    method: "DELETE",
  });
}

export async function saveSession(
  token: string,
  organizationId: string,
  eventId: string,
  input: CleanupEventSessionInput,
  sessionId?: string,
) {
  return apiRequest(
    sessionId
      ? `${root(organizationId)}/${encodeURIComponent(eventId)}/sessions/${encodeURIComponent(sessionId)}`
      : `${root(organizationId)}/${encodeURIComponent(eventId)}/sessions`,
    {
      accessToken: token,
      method: sessionId ? "PATCH" : "POST",
      ...json(input),
    },
  );
}

export async function removeSession(
  token: string,
  organizationId: string,
  eventId: string,
  sessionId: string,
) {
  await apiRequest(
    `${root(organizationId)}/${encodeURIComponent(eventId)}/sessions/${encodeURIComponent(sessionId)}`,
    { accessToken: token, method: "DELETE" },
  );
}

export async function assignCoordinator(
  token: string,
  organizationId: string,
  eventId: string,
  membershipId: string,
) {
  await apiRequest(`${root(organizationId)}/${encodeURIComponent(eventId)}/coordinators`, {
    accessToken: token,
    method: "POST",
    ...json({ membershipId }),
  });
}

export async function removeCoordinator(
  token: string,
  organizationId: string,
  eventId: string,
  membershipId: string,
) {
  await apiRequest(`${root(organizationId)}/${encodeURIComponent(eventId)}/coordinators`, {
    accessToken: token,
    method: "DELETE",
    ...json({ membershipId }),
  });
}

export async function getPublishReadiness(token: string, organizationId: string, eventId: string) {
  return (await apiRequest<{ data: CleanupEventPublishReadiness }>(
    `${root(organizationId)}/${encodeURIComponent(eventId)}/publish-readiness`,
    { accessToken: token },
  )).data;
}

export async function publishCleanupEvent(token: string, organizationId: string, eventId: string) {
  return (await apiRequest<{ data: CleanupEventPublishResult }>(
    `${root(organizationId)}/${encodeURIComponent(eventId)}/publish`,
    { accessToken: token, method: "POST" },
  )).data;
}

export async function listOwnedCleanupEvents(token: string, organizationId: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "25" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<{ data: CleanupEventOwnedPage }>(`${root(organizationId)}?${query}`, { accessToken: token })).data;
}

export async function listPublicCleanupEvents(token: string, cursor?: string) {
  const query = new URLSearchParams({ limit: "25" });
  if (cursor) query.set("cursor", cursor);
  return (await apiRequest<{ data: CleanupEventPublicPage }>(`/events?${query}`, { accessToken: token })).data;
}

export async function getPublicCleanupEvent(token: string, eventId: string) {
  return (await apiRequest<{ data: CleanupEventPublicDetail }>(
    `/events/${encodeURIComponent(eventId)}`,
    { accessToken: token },
  )).data;
}
