import { z } from "zod";

import { sriLankaMapLocationSchema } from "../maps/map.validation.js";
import { sriLankaMapViewportQuerySchema } from "../maps/map.validation.js";
import {
  INCIDENT_EVIDENCE_LIMITS,
  INCIDENT_LIST_LIMITS,
} from "./incident.constants.js";

const contentTypeSchema = z.enum(
  INCIDENT_EVIDENCE_LIMITS.allowedContentTypes,
);

export const evidenceFileMetadataSchema = z.object({
  originalFileName: z.string().trim().min(1).max(255),
  contentType: contentTypeSchema,
  sizeBytes: z.number().int().min(1).max(
    INCIDENT_EVIDENCE_LIMITS.maxFileSizeBytes,
    "Each photo must be 8 MB or smaller.",
  ),
}).strict();

export const createEvidenceUploadIntentsSchema = z.object({
  submissionId: z.uuid(),
  files: z.array(evidenceFileMetadataSchema)
    .min(1)
    .max(INCIDENT_EVIDENCE_LIMITS.maxFiles),
}).strict();

export const incidentEvidenceSchema = evidenceFileMetadataSchema.extend({
  storagePath: z.string().trim().min(1).max(700),
  caption: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(INCIDENT_EVIDENCE_LIMITS.maxFiles - 1),
}).strict();

export const createIncidentSchema = z.object({
  submissionId: z.uuid(),
  categoryId: z.uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5_000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  addressText: z.string().trim().min(3).max(500).optional(),
  evidence: z.array(incidentEvidenceSchema)
    .max(INCIDENT_EVIDENCE_LIMITS.maxFiles)
    .default([]),
}).strict().superRefine((incident, context) => {
  const location = sriLankaMapLocationSchema.safeParse({
    latitude: incident.latitude,
    longitude: incident.longitude,
  });

  if (!location.success) {
    context.addIssue({
      code: "custom",
      path: ["latitude"],
      message: location.error.issues[0]?.message ?? "The incident location is invalid.",
    });
  }

  const paths = new Set<string>();
  const sortOrders = new Set<number>();
  for (const item of incident.evidence) {
    if (paths.has(item.storagePath)) {
      context.addIssue({ code: "custom", path: ["evidence"], message: "Evidence paths must be unique." });
    }
    if (sortOrders.has(item.sortOrder)) {
      context.addIssue({ code: "custom", path: ["evidence"], message: "Evidence order values must be unique." });
    }
    paths.add(item.storagePath);
    sortOrders.add(item.sortOrder);
  }
});

export const incidentIdParametersSchema = z.object({ id: z.uuid() }).strict();

export const incidentListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(INCIDENT_LIST_LIMITS.maxLimit)
    .default(INCIDENT_LIST_LIMITS.defaultLimit),
  cursor: z.string().trim().min(1).max(500).optional(),
}).strict();

const organizationIncidentFilters = {
  status: z.enum([
    "ACTIVE",
    "CLEANUP_ORGANIZED",
    "RESOLVED",
    "EXPIRED",
    "ARCHIVED",
  ]).optional(),
  categoryId: z.uuid().optional(),
  reportedAfter: z.iso.datetime({ offset: true }).optional(),
};

export const organizationIncidentDiscoveryQuerySchema = z.union([
  sriLankaMapViewportQuerySchema.safeExtend(organizationIncidentFilters),
  z.object({
    ...organizationIncidentFilters,
    scope: z.literal("all"),
  }).strict(),
]);

export type ValidatedCreateIncident = z.infer<typeof createIncidentSchema>;
export type ValidatedEvidenceUploadRequest = z.infer<typeof createEvidenceUploadIntentsSchema>;
export type ValidatedOrganizationIncidentDiscovery = z.infer<
  typeof organizationIncidentDiscoveryQuerySchema
>;
