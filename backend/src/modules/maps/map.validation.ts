import { z } from "zod";

import {
  MAP_LIMITS,
  SRI_LANKA_APPROXIMATE_BOUNDS,
} from "./map.constants.js";

const finiteNumberFromInput = z.coerce.number().finite();

export const latitudeSchema = finiteNumberFromInput
  .min(-90, "Latitude must be at least -90.")
  .max(90, "Latitude must be at most 90.");

export const longitudeSchema = finiteNumberFromInput
  .min(-180, "Longitude must be at least -180.")
  .max(180, "Longitude must be at most 180.");

export const mapLocationSchema = z
  .object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
  })
  .strict();

function isWithinSriLankaApproximateBounds(location: {
  latitude: number;
  longitude: number;
}): boolean {
  return (
    location.latitude >=
      SRI_LANKA_APPROXIMATE_BOUNDS.south &&
    location.latitude <=
      SRI_LANKA_APPROXIMATE_BOUNDS.north &&
    location.longitude >=
      SRI_LANKA_APPROXIMATE_BOUNDS.west &&
    location.longitude <=
      SRI_LANKA_APPROXIMATE_BOUNDS.east
  );
}

export const sriLankaMapLocationSchema =
  mapLocationSchema.refine(
    isWithinSriLankaApproximateBounds,
    {
      message:
        "The selected location must be within the supported Sri Lanka map range.",
    },
  );

const paginationFields = {
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAP_LIMITS.maxPageSize)
    .default(MAP_LIMITS.defaultPageSize),
};

export const mapViewportQuerySchema = z
  .object({
    west: longitudeSchema,
    south: latitudeSchema,
    east: longitudeSchema,
    north: latitudeSchema,
    zoom: z.coerce
      .number()
      .int()
      .min(MAP_LIMITS.minZoom)
      .max(MAP_LIMITS.maxZoom),
    ...paginationFields,
  })
  .strict()
  .superRefine((bounds, context) => {
    if (bounds.west >= bounds.east) {
      context.addIssue({
        code: "custom",
        message:
          "West longitude must be less than east longitude. Antimeridian-crossing bounds are not supported.",
        path: ["east"],
      });
    }

    if (bounds.south >= bounds.north) {
      context.addIssue({
        code: "custom",
        message: "South latitude must be less than north latitude.",
        path: ["north"],
      });
    }

    if (
      bounds.east - bounds.west >
      MAP_LIMITS.maxLongitudeSpanDegrees
    ) {
      context.addIssue({
        code: "custom",
        message: `Map bounds may span at most ${MAP_LIMITS.maxLongitudeSpanDegrees} longitude degrees.`,
        path: ["east"],
      });
    }

    if (
      bounds.north - bounds.south >
      MAP_LIMITS.maxLatitudeSpanDegrees
    ) {
      context.addIssue({
        code: "custom",
        message: `Map bounds may span at most ${MAP_LIMITS.maxLatitudeSpanDegrees} latitude degrees.`,
        path: ["north"],
      });
    }
  });

export const mapRadiusQuerySchema = z
  .object({
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    radiusMeters: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAP_LIMITS.maxRadiusMeters),
    ...paginationFields,
  })
  .strict();

export const sriLankaMapViewportQuerySchema =
  mapViewportQuerySchema.refine(
    (bounds) =>
      bounds.west >=
        SRI_LANKA_APPROXIMATE_BOUNDS.west &&
      bounds.east <=
        SRI_LANKA_APPROXIMATE_BOUNDS.east &&
      bounds.south >=
        SRI_LANKA_APPROXIMATE_BOUNDS.south &&
      bounds.north <=
        SRI_LANKA_APPROXIMATE_BOUNDS.north,
    {
      message:
        "Map bounds must remain within the supported Sri Lanka map range.",
    },
  );

export const sriLankaMapRadiusQuerySchema =
  mapRadiusQuerySchema.refine(
    isWithinSriLankaApproximateBounds,
    {
      message:
        "The radius-search center must be within the supported Sri Lanka map range.",
    },
  );

export type ValidatedMapLocation = z.infer<
  typeof mapLocationSchema
>;

export type ValidatedMapViewportQuery = z.infer<
  typeof mapViewportQuerySchema
>;

export type ValidatedMapRadiusQuery = z.infer<
  typeof mapRadiusQuerySchema
>;

export type ValidatedSriLankaMapLocation = z.infer<
  typeof sriLankaMapLocationSchema
>;

export type ValidatedSriLankaMapViewportQuery = z.infer<
  typeof sriLankaMapViewportQuerySchema
>;

export type ValidatedSriLankaMapRadiusQuery = z.infer<
  typeof sriLankaMapRadiusQuerySchema
>;
