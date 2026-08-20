import { apiRequest } from "../../api/apiClient";
import type { CitizenSummary, OrganizationSummary, PlatformSummary } from "./dashboard.types";
const data = async <T>(path: string, accessToken: string) => (await apiRequest<{ data: T }>(path, { accessToken })).data;
export const getCitizenSummary = (token: string) => data<CitizenSummary>("/dashboards/citizen", token);
export const getOrganizationSummary = (token: string, organizationId: string) => data<OrganizationSummary>(`/organizations/${encodeURIComponent(organizationId)}/dashboard-summary`, token);
export const getPlatformSummary = (token: string) => data<PlatformSummary>("/dashboards/platform", token);
