import assert from "node:assert/strict";
import test from "node:test";

import { MAP_LIMITS } from "./map.constants.js";
import { toGeoJsonPoint } from "./map.types.js";
import {
  mapLocationSchema,
  mapRadiusQuerySchema,
  mapViewportQuerySchema,
  sriLankaMapLocationSchema,
  sriLankaMapRadiusQuerySchema,
  sriLankaMapViewportQuerySchema,
} from "./map.validation.js";

test("accepts named Sri Lankan coordinates and preserves GeoJSON order", () => {
  const location = mapLocationSchema.parse({
    latitude: "6.9271",
    longitude: "79.8612",
  });

  assert.deepEqual(location, {
    latitude: 6.9271,
    longitude: 79.8612,
  });
  assert.deepEqual(toGeoJsonPoint(location).coordinates, [
    79.8612,
    6.9271,
  ]);
});

test("rejects invalid coordinate ranges", () => {
  assert.equal(
    mapLocationSchema.safeParse({
      latitude: 91,
      longitude: 79.8612,
    }).success,
    false,
  );
  assert.equal(
    mapLocationSchema.safeParse({
      latitude: 6.9271,
      longitude: -181,
    }).success,
    false,
  );
});

test("accepts a bounded viewport and applies the default page size", () => {
  const result = mapViewportQuerySchema.parse({
    west: 79.8,
    south: 6.8,
    east: 80,
    north: 7,
    zoom: 12,
  });

  assert.equal(result.limit, MAP_LIMITS.defaultPageSize);
});

test("rejects reversed, antimeridian, and excessive bounds", () => {
  const reversed = mapViewportQuerySchema.safeParse({
    west: 80,
    south: 6.8,
    east: 79.8,
    north: 7,
    zoom: 12,
  });
  const excessive = mapViewportQuerySchema.safeParse({
    west: 78,
    south: 5,
    east: 82,
    north: 10,
    zoom: 7,
  });

  assert.equal(reversed.success, false);
  assert.equal(excessive.success, false);
});

test("enforces radius and page-size limits", () => {
  assert.equal(
    mapRadiusQuerySchema.safeParse({
      latitude: 6.9271,
      longitude: 79.8612,
      radiusMeters: MAP_LIMITS.maxRadiusMeters + 1,
    }).success,
    false,
  );
  assert.equal(
    mapRadiusQuerySchema.safeParse({
      latitude: 6.9271,
      longitude: 79.8612,
      radiusMeters: 1_000,
      limit: MAP_LIMITS.maxPageSize + 1,
    }).success,
    false,
  );
});

test("accepts locations inside the supported Sri Lanka map range", () => {
  const result = sriLankaMapLocationSchema.safeParse({
    latitude: 6.9271,
    longitude: 79.8612,
  });

  assert.equal(result.success, true);
});

test("rejects globally valid coordinates outside the Sri Lanka map range", () => {
  const result = sriLankaMapLocationSchema.safeParse({
    latitude: 51.5072,
    longitude: -0.1276,
  });

  assert.equal(result.success, false);
});

test("keeps viewport and radius searches inside the Sri Lanka map range", () => {
  assert.equal(
    sriLankaMapViewportQuerySchema.safeParse({
      west: 79.8,
      south: 6.8,
      east: 80,
      north: 7,
      zoom: 12,
    }).success,
    true,
  );
  assert.equal(
    sriLankaMapViewportQuerySchema.safeParse({
      west: 78.9,
      south: 6.8,
      east: 79.8,
      north: 7,
      zoom: 12,
    }).success,
    false,
  );
  assert.equal(
    sriLankaMapRadiusQuerySchema.safeParse({
      latitude: 40.7128,
      longitude: -74.006,
      radiusMeters: 1_000,
    }).success,
    false,
  );
});
