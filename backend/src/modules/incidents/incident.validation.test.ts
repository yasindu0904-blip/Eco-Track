import assert from "node:assert/strict";
import test from "node:test";

import { createIncidentSchema } from "./incident.validation.js";

const validIncident = {
  submissionId: "00000000-0000-4000-8000-000000000001",
  categoryId: "00000000-0000-4000-8000-000000000002",
  title: "Plastic waste blocking a canal",
  description: "A large pile of plastic waste is preventing water from flowing.",
  severity: "HIGH",
  latitude: 6.9271,
  longitude: 79.8612,
  addressText: "Near the west bridge",
  evidence: [],
};

test("accepts a valid Sri Lankan incident payload", () => {
  assert.equal(createIncidentSchema.safeParse(validIncident).success, true);
});

test("rejects coordinates outside the supported map area", () => {
  assert.equal(createIncidentSchema.safeParse({
    ...validIncident,
    latitude: 51.5072,
    longitude: -0.1276,
  }).success, false);
});

test("rejects unknown fields including organization ownership", () => {
  assert.equal(createIncidentSchema.safeParse({
    ...validIncident,
    organizationId: "00000000-0000-4000-8000-000000000003",
  }).success, false);
});

test("rejects unsafe evidence metadata", () => {
  assert.equal(createIncidentSchema.safeParse({
    ...validIncident,
    evidence: [{
      storagePath: "incidents/test/photo.gif",
      originalFileName: "photo.gif",
      contentType: "image/gif",
      sizeBytes: 200,
      sortOrder: 0,
    }],
  }).success, false);
});
