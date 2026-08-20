import { createClient } from "@supabase/supabase-js";

import { env } from "../../../config/env.js";
import { ApplicationError } from "../../../errors/applicationError.js";
import { EVENT_EVIDENCE_LIMITS } from "./eventOperations.constants.js";
import type { EventEvidenceStorage } from "./eventOperations.types.js";

function requireStorageConfiguration(): string {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApplicationError(503, "EVENT_STORAGE_NOT_CONFIGURED", "Cleanup-event evidence storage is not configured.");
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
    const existing = await supabase.storage.getBucket(env.EVENT_EVIDENCE_BUCKET);
    if (existing.data) return;
    const created = await supabase.storage.createBucket(env.EVENT_EVIDENCE_BUCKET, {
      public: false,
      fileSizeLimit: EVENT_EVIDENCE_LIMITS.maxFileSizeBytes,
      allowedMimeTypes: [...EVENT_EVIDENCE_LIMITS.allowedContentTypes],
    });
    if (created.error) {
      throw new ApplicationError(503, "EVENT_STORAGE_BUCKET_UNAVAILABLE", "The private cleanup-event evidence bucket is unavailable.");
    }
  })().catch((error) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

async function bucket() {
  await ensureBucket();
  return client().storage.from(env.EVENT_EVIDENCE_BUCKET);
}

export const eventEvidenceStorage: EventEvidenceStorage = {
  async createUploadIntent(storagePath) {
    const { data, error } = await (await bucket()).createSignedUploadUrl(storagePath, { upsert: false });
    if (error) throw new ApplicationError(502, "EVENT_UPLOAD_INTENT_FAILED", "A secure evidence upload could not be prepared.");
    return { token: data.token, signedUrl: data.signedUrl };
  },
  async objectExists(storagePath) {
    const separator = storagePath.lastIndexOf("/");
    const folder = storagePath.slice(0, separator);
    const fileName = storagePath.slice(separator + 1);
    const { data, error } = await (await bucket()).list(folder, { limit: 2, search: fileName });
    if (error) throw new ApplicationError(502, "EVENT_EVIDENCE_CHECK_FAILED", "Uploaded event evidence could not be verified.");
    return data.some((entry) => entry.name === fileName);
  },
  async createDownloadUrl(storagePath) {
    const { data, error } = await (await bucket()).createSignedUrl(storagePath, 300);
    if (error) throw new ApplicationError(502, "EVENT_EVIDENCE_URL_FAILED", "Cleanup-event evidence could not be loaded.");
    return data.signedUrl;
  },
};
