import { createClient } from "@supabase/supabase-js";

import { env } from "../../config/env.js";
import { ApplicationError } from "../../errors/applicationError.js";
import { INCIDENT_EVIDENCE_LIMITS } from "./incident.constants.js";
import type { IncidentStorage } from "./incident.types.js";

function requireStorageConfiguration(): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApplicationError(
      503,
      "INCIDENT_STORAGE_NOT_CONFIGURED",
      "Incident photo storage is not configured. You can submit the report without photos.",
    );
  }
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

let storageClient: ReturnType<typeof createClient> | null = null;
let bucketReady: Promise<void> | null = null;

function client() {
  storageClient ??= createClient(env.SUPABASE_URL, requireStorageConfiguration(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return storageClient;
}

async function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const supabase = client();
    const existing = await supabase.storage.getBucket(env.INCIDENT_EVIDENCE_BUCKET);
    if (existing.data) return;

    const created = await supabase.storage.createBucket(env.INCIDENT_EVIDENCE_BUCKET, {
      public: false,
      fileSizeLimit: INCIDENT_EVIDENCE_LIMITS.maxFileSizeBytes,
      allowedMimeTypes: [...INCIDENT_EVIDENCE_LIMITS.allowedContentTypes],
    });
    if (created.error) {
      throw new ApplicationError(
        503,
        "INCIDENT_STORAGE_BUCKET_UNAVAILABLE",
        "The private incident-photo bucket is unavailable.",
      );
    }
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

async function storageBucket() {
  await ensureBucket();
  return client().storage.from(env.INCIDENT_EVIDENCE_BUCKET);
}

export const incidentStorage: IncidentStorage = {
  async createUploadIntent(storagePath) {
    const { data, error } = await (await storageBucket()).createSignedUploadUrl(storagePath, {
      upsert: false,
    });
    if (error) {
      throw new ApplicationError(502, "INCIDENT_UPLOAD_INTENT_FAILED", "A secure photo upload could not be prepared.");
    }
    return { token: data.token, signedUrl: data.signedUrl };
  },

  async objectExists(storagePath) {
    const separator = storagePath.lastIndexOf("/");
    const folder = storagePath.slice(0, separator);
    const fileName = storagePath.slice(separator + 1);
    const { data, error } = await (await storageBucket()).list(folder, {
      limit: 2,
      search: fileName,
    });
    if (error) {
      throw new ApplicationError(502, "INCIDENT_EVIDENCE_CHECK_FAILED", "Uploaded photo evidence could not be verified.");
    }
    return data.some((entry) => entry.name === fileName);
  },

  async createDownloadUrl(storagePath) {
    const { data, error } = await (await storageBucket()).createSignedUrl(storagePath, 300);
    if (error) {
      throw new ApplicationError(502, "INCIDENT_PHOTO_URL_FAILED", "A report photo could not be loaded.");
    }
    return data.signedUrl;
  },
};
