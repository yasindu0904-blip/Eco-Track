import assert from "node:assert/strict";
import test from "node:test";

import {
  createIncidentSchema,
  organizationIncidentDiscoveryQuerySchema,
  publicIncidentRadiusDiscoveryQuerySchema,
  publicIncidentViewportDiscoveryQuerySchema,
} from "./incident.validation.js";

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

test("accepts bounded public viewport and radius discovery queries", () => {
  const viewport = publicIncidentViewportDiscoveryQuerySchema.parse({
    west: "79.8",
    south: "6.8",
    east: "80",
    north: "7.1",
    zoom: "12",
    status: "ACTIVE",
  });
  assert.equal(viewport.limit, 50);
  assert.equal(viewport.status, "ACTIVE");

  const nearby = publicIncidentRadiusDiscoveryQuerySchema.parse({
    latitude: "6.9271",
    longitude: "79.8612",
    radiusMeters: "5000",
    limit: "25",
  });
  assert.equal(nearby.radiusMeters, 5000);
  assert.equal(nearby.limit, 25);
});

test("rejects unbounded organization and public discovery", () => {
  assert.equal(
    organizationIncidentDiscoveryQuerySchema.safeParse({ scope: "all" })
      .success,
    false,
  );
  assert.equal(
    publicIncidentViewportDiscoveryQuerySchema.safeParse({ scope: "all" })
      .success,
    false,
  );
  assert.equal(
    publicIncidentRadiusDiscoveryQuerySchema.safeParse({
      latitude: 6.9271,
      longitude: 79.8612,
      radiusMeters: 50_001,
    }).success,
    false,
  );
});
