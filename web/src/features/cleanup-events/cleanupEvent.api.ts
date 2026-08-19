import { apiRequest } from "../../api/apiClient";
import type { CleanupEventDraft, CleanupEventDraftInput } from "./cleanupEvent.types";
const root = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}/events`;
export const listDrafts = async (token: string, organizationId: string) => (await apiRequest<{data: CleanupEventDraft[]}>(`${root(organizationId)}/drafts`, { accessToken: token })).data;
const json = (body: unknown) => ({ body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
export const createDraft = async (token: string, organizationId: string, input: CleanupEventDraftInput) => (await apiRequest<{data: CleanupEventDraft}>(`${root(organizationId)}/drafts`, { accessToken: token, method: "POST", ...json(input) })).data;
export const addSession = (token: string, organizationId: string, eventId: string, input: {sessionDate:string;startTime:string;endTime:string;capacity:number}) => apiRequest(`${root(organizationId)}/${eventId}/sessions`, { accessToken: token, method: "POST", ...json(input) });
export const assignCoordinator = (token: string, organizationId: string, eventId: string, membershipId: string) => apiRequest(`${root(organizationId)}/${eventId}/coordinators`, { accessToken: token, method: "POST", ...json({ membershipId }) });
