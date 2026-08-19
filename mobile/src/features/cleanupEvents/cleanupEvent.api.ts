import { apiRequest } from "../../api/apiClient";
import type { CleanupEventDraft, CleanupEventDraftInput } from "./cleanupEvent.types";
const root=(id:string)=>`/organizations/${encodeURIComponent(id)}/events`; const json=(body:unknown)=>({body:JSON.stringify(body),headers:{"Content-Type":"application/json"}});
export const listDrafts=async(token:string,organizationId:string)=>(await apiRequest<{data:CleanupEventDraft[]}>(`${root(organizationId)}/drafts`,{accessToken:token})).data;
export const createDraft=async(token:string,organizationId:string,input:CleanupEventDraftInput)=>(await apiRequest<{data:CleanupEventDraft}>(`${root(organizationId)}/drafts`,{accessToken:token,method:"POST",...json(input)})).data;
