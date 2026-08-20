import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  addEventNoteSchema,
  cancelEventSchema,
  eventEvidenceUploadIntentSchema,
  registerEventEvidenceSchema,
  transitionEventSchema,
} from "./eventOperations.validation.js";

test("EVT-06 validation keeps notes, evidence, transitions, and cancellation bounded", () => {
  assert.equal(addEventNoteSchema.safeParse({ visibility: "INTERNAL", noteText: "" }).success, false);
  assert.equal(addEventNoteSchema.safeParse({ visibility: "PARTICIPANTS", noteText: "Meet by the west entrance." }).success, true);
  assert.equal(eventEvidenceUploadIntentSchema.safeParse({ files: [{ originalFileName: "proof.exe", contentType: "application/octet-stream", sizeBytes: 100 }] }).success, false);
  assert.equal(registerEventEvidenceSchema.safeParse({
    storagePath: "events/a/b/c/proof.jpg",
    originalFileName: "proof.jpg",
    contentType: "image/jpeg",
    sizeBytes: 1_024,
    type: "AFTER",
  }).success, true);
  assert.equal(transitionEventSchema.safeParse({ targetWorkflowStatusId: randomUUID(), expectedUpdatedAt: "yesterday" }).success, false);
  assert.equal(cancelEventSchema.safeParse({ expectedUpdatedAt: new Date().toISOString(), reason: "too short" }).success, false);
});
