# EcoTrack Guide to Sri Lankan Service-Area Boundaries

## Purpose

This guide records the recommended approach for obtaining and using geographical boundaries for EcoTrack organization service areas, using locations such as **Kesbewa** and **Polgasowita** as examples.

It is intended for future work on:

- Map implementation
- Organization onboarding
- Service-area selection
- PostGIS database design
- Incident visibility
- Super Admin approval
- ERD and Prisma schema updates

---

## 1. First decide what kind of boundary is required

A place name does not always identify one unique official boundary.

For example, **Kesbewa** may refer to:

- Kesbewa Divisional Secretariat Division
- Kesbewa Urban Council area
- The town or locality commonly called Kesbewa
- One or more Grama Niladhari divisions around Kesbewa

These geographical areas are not necessarily identical.

Similarly, **Polgasowita** may refer to:

- One official Grama Niladhari Division
- Several neighbouring Grama Niladhari Divisions
- A postal locality
- A wider informal area understood by residents

Before importing or storing a boundary, EcoTrack must therefore identify the intended boundary type.

---

## 2. Recommended primary source: Sri Lanka NSDI

The preferred source for official administrative boundaries is the **Sri Lanka National Spatial Data Infrastructure (NSDI)**.

The NSDI provides government-origin spatial layers that may include:

- Provincial boundaries
- District boundaries
- Divisional Secretariat boundaries
- Grama Niladhari Division boundaries
- Other administrative and mapping layers

Relevant layers may expose fields such as:

### Divisional Secretariat layer

- `ds_division_name`
- `district_name`
- `province_name`
- Polygon geometry

### Grama Niladhari Division layer

- `gnd_name`
- `gnd_code`
- `gnd_number`
- `ds_division_name`
- `district_name`
- `province_name`
- Polygon geometry

Where supported, the layer can be queried and returned as **GeoJSON**, which is suitable for conversion to PostGIS geometry or geography values.

### Example use

For a Kesbewa Divisional Secretariat boundary, search or query using a value similar to:

```text
DS Division Name = Kesbewa
```

For Polgasowita, search the Grama Niladhari Division layer using a value similar to:

```text
GND Name contains Polgasowita
```

### NSDI references

- Divisional Secretariat layer:  
  https://gisapps.nsdi.gov.lk/server/rest/services/SLNSDI/Survey_10k/MapServer/3

- Grama Niladhari Division layer:  
  https://gisapps.nsdi.gov.lk/server/rest/services/SLNSDI/Survey_10k/MapServer/2

- NSDI boundaries portal:  
  https://nsdi.gov.lk/boundaries

> Implementation note: layer URLs, field names, and service availability must be rechecked when development begins because government GIS services may be updated.

---

## 3. Kesbewa boundary choices

EcoTrack may support several valid Kesbewa boundary interpretations.

### 3.1 Kesbewa Divisional Secretariat Division

Use the official Divisional Secretariat polygon when the organization covers the complete Kesbewa DS Division.

Example metadata:

```text
boundary_type = DS_DIVISION
source_name   = Sri Lanka NSDI
source_layer  = Divisional Secretariat boundary layer
```

An administrative map of the Kesbewa DS Division may also be used for visual confirmation, but vector geometry should be obtained from an official GIS source when possible.

Reference example:

https://www.ecoi.net/en/file/local/1067536/1222_1208265259_lk00744-admin-colombo-kesbewa-ds-div19jan07.pdf

### 3.2 Kesbewa Urban Council

Use the official local-authority or ward boundary when the organization operates within the Kesbewa Urban Council area rather than the full DS Division.

Example metadata:

```text
boundary_type = LOCAL_AUTHORITY
source_name   = Ministry of Provincial Councils and Local Government
```

Reference example:

https://mpclg.gov.lk/web/index.php?Itemid=203&id=91&lang=en&option=com_content&view=article

### 3.3 Selected Grama Niladhari Divisions

An organization may cover only certain parts of Kesbewa.

For example:

```text
Kesbewa North
Kesbewa South
Mampe East
Mampe West
```

Each selected GN Division should normally be stored as a separate service-area row.

Example:

| id | organization_id | area_name | boundary_type |
|---|---|---|---|
| area-01 | org-01 | Kesbewa North | GN_DIVISION |
| area-02 | org-01 | Mampe East | GN_DIVISION |
| area-03 | org-01 | Mampe West | GN_DIVISION |

This is easier to review, activate, deactivate, and maintain than permanently merging several areas into one large polygon.

---

## 4. Polgasowita boundary choices

Polgasowita may not have one universally accepted town boundary.

EcoTrack must decide whether the organization means:

```text
Only the official Polgasowita GN Division
```

or:

```text
The wider Polgasowita locality
```

### Recommended rule

- Use official GN polygons when the organization selects one or more recognized GN Divisions.
- Use a Super-Admin-approved custom polygon when the real operating area does not match official administrative boundaries.

The Kesbewa Divisional Secretariat GN listing can be used to confirm official GN names and codes.

Reference:

https://kesbewa.ds.gov.lk/index.php/en/administrative-structure/gn-divisions.html

> Verification note: exact GN names, codes, numbering, and current boundary geometry must be checked against the official dataset before importing them into EcoTrack.

---

## 5. Other possible boundary sources

### 5.1 Sri Lanka Survey Department

The Sri Lanka Survey Department provides GIS/vector data that may include administrative boundaries.

Possible formats include:

- Shapefile
- DXF
- Other GIS vector formats

This source is useful when the team requires:

- More authoritative source files
- Formal GIS datasets
- Offline import into PostGIS
- Project documentation showing government data origin

Some datasets may require a request, permission, or payment.

Reference:

https://www.survey.gov.lk/sdweb/pages_service_geo_information.php?id=df658590a4cbb1f955f5d386b242b6be8d5cadc0&l=s

### 5.2 NSDI WMS services

A Web Map Service can display boundary layers as map images.

WMS is useful for:

- Visual overlays
- Background reference layers
- Comparing a drawn polygon with official boundaries

However, a WMS image is not enough for EcoTrack's `ST_Covers` spatial queries. The system should obtain actual vector geometry through GeoJSON, shapefile, or another vector format.

### 5.3 geoBoundaries / HDX

geoBoundaries provides downloadable Sri Lankan administrative boundaries for multiple administrative levels.

It is useful for:

- Prototypes
- Development seed data
- Backup boundary data
- Offline GIS experimentation

Official NSDI or Survey Department data should still be preferred when available.

Reference:

https://data.humdata.org/dataset/geoboundaries-admin-boundaries-for-sri-lanka

### 5.4 OpenStreetMap

OpenStreetMap may contain administrative boundary relations.

It is useful for:

- Visual reference
- Prototype boundaries
- Filling gaps where official downloadable data is unavailable

However, completeness and accuracy may vary. It should not automatically be treated as the legal or official authority for approving an organization service area.

Reference:

https://wiki.openstreetmap.org/wiki/Relation%3Aboundary

---

## 6. Recommended EcoTrack service-area interface

EcoTrack should support three service-area creation methods.

### Method 1: Select one official administrative area

Example interface:

```text
Province: Western
District: Colombo
DS Division: Kesbewa
GN Division: Polgasowita
```

Flow:

```text
Organization applicant selects official area
    ↓
Frontend sends official feature identifier
    ↓
Backend loads the approved polygon
    ↓
Service-area request is saved
    ↓
Super Admin reviews and activates it
```

### Method 2: Select several official areas

Example:

```text
✓ Polgasowita GN Division
✓ Rilawala GN Division
✓ Siyambalagoda South GN Division
```

Recommended storage:

- Three selected areas
- Three `organization_service_areas` rows
- Same `organization_id`
- Different primary keys and polygons

This supports independent approval, naming, deactivation, and updates.

### Method 3: Draw a custom polygon

This is necessary when the organization's real service area does not exactly follow an official administrative boundary.

Flow:

```text
Organization applicant opens map
    ↓
Draws polygon
    ↓
Frontend sends GeoJSON
    ↓
Backend validates geometry
    ↓
Request is stored as PENDING_REVIEW
    ↓
Super Admin compares it with official layers
    ↓
Boundary becomes ACTIVE or REJECTED
```

A custom area should not be used for incident visibility until it has been approved.

---

## 7. Recommended database design

The service-area table should record both the geometry and its origin.

### Suggested enum

```dbml
Enum service_area_boundary_type {
  GN_DIVISION
  DS_DIVISION
  LOCAL_AUTHORITY
  CUSTOM_POLYGON
}
```

A separate lifecycle enum may be used:

```dbml
Enum service_area_status {
  PENDING_REVIEW
  ACTIVE
  REJECTED
  INACTIVE
}
```

### Suggested table

```dbml
Table organization_service_areas {
  id uuid [pk, default: `gen_random_uuid()`]
  organization_id uuid [not null]

  area_name varchar [not null]

  boundary geography [
    not null,
    note: 'PostGIS geography(Polygon, 4326). One row represents one named service area.'
  ]

  boundary_type service_area_boundary_type [not null]

  source_name varchar
  source_layer varchar
  source_feature_code varchar
  source_updated_at timestamp

  status service_area_status [not null, default: 'PENDING_REVIEW']

  reviewed_by_user_id uuid
  reviewed_at timestamp
  review_notes text

  created_at timestamp [not null, default: `now()`]
  updated_at timestamp [not null, default: `now()`]

  indexes {
    organization_id
    (organization_id, area_name) [unique]
  }
}
```

### Relationships

```dbml
Ref: organization_service_areas.organization_id
  > organizations.id

Ref: organization_service_areas.reviewed_by_user_id
  > user_profiles.id
```

---

## 8. Example records

### Kesbewa DS Division

```text
area_name           = Kesbewa DS Division
boundary_type       = DS_DIVISION
source_name         = Sri Lanka NSDI
source_layer        = Divisional Secretariat boundary layer
source_feature_code = official DS feature code
status              = ACTIVE
boundary            = official Kesbewa polygon
```

### Polgasowita GN Division

```text
area_name           = Polgasowita
boundary_type       = GN_DIVISION
source_name         = Sri Lanka NSDI
source_layer        = Grama Niladhari Division boundary layer
source_feature_code = official GN feature code
status              = ACTIVE
boundary            = official Polgasowita polygon
```

### Custom Kesbewa–Polgasowita operational area

```text
area_name           = Kesbewa–Polgasowita Community Coverage
boundary_type       = CUSTOM_POLYGON
source_name         = Organization-submitted polygon
source_layer        = N/A
source_feature_code = N/A
status              = PENDING_REVIEW
boundary            = GeoJSON polygon submitted by organization
```

---

## 9. How the selected boundary is used

When a citizen reports an incident, EcoTrack stores the incident as a shared platform record with a PostGIS point.

```text
Citizen selects current location or map pin
    ↓
Incident geo_point is stored
    ↓
PostGIS compares the point with ACTIVE service-area polygons
    ↓
Every covering organization can see the same incident
```

Conceptual query:

```sql
SELECT DISTINCT osa.organization_id
FROM organization_service_areas osa
WHERE osa.status = 'ACTIVE'
  AND ST_Covers(
        osa.boundary,
        :incident_geo_point
      );
```

`ST_Covers` is preferred because it can include a point located exactly on the polygon boundary.

The incident is not copied for each organization, and the citizen does not choose an organization.

---

## 10. Spatial index

The polygon column requires a PostGIS GiST index for efficient searches.

```sql
CREATE INDEX organization_service_areas_boundary_gist
ON organization_service_areas
USING GIST (boundary);
```

The ordinary `organization_id` index helps retrieve all areas belonging to one organization.

DBML or Prisma may not fully express every PostGIS index, so the GiST index should be added and reviewed in the PostgreSQL migration SQL.

---

## 11. Polygon versus MultiPolygon

### Polygon

Use one `Polygon` when one row represents one continuous named area.

Recommended default:

```text
One named service area = one row = one Polygon
```

### MultiPolygon

Use a `MultiPolygon` only when one named service area contains several disconnected shapes that must be managed and approved together.

Because EcoTrack already supports several rows per organization, separate Polygon rows are usually simpler and easier to review.

---

## 12. Import and conversion workflow

A possible data-import process is:

```text
Official source provides GeoJSON or shapefile
    ↓
Team verifies coordinate reference system
    ↓
Convert geometry to EPSG:4326 when required
    ↓
Validate polygons
    ↓
Import official boundaries into reference tables
    ↓
Organization selects feature IDs
    ↓
Create organization_service_areas records
    ↓
Super Admin approves
```

Important checks:

- Confirm coordinate reference system
- Convert to longitude/latitude EPSG:4326
- Validate polygon closure
- Repair invalid polygons only through a controlled GIS process
- Preserve official source identifiers
- Record source date/version
- Prevent unauthorized geometry editing after approval
- Reapprove meaningful service-area changes

---

## 13. Optional reference-boundary tables

Instead of copying every official polygon directly into every organization record, EcoTrack may later introduce reusable reference tables.

Example:

```text
administrative_areas
- id
- name
- code
- level
- parent_id
- boundary
- source_name
- source_updated_at
```

Then:

```text
organization_service_areas
- id
- organization_id
- administrative_area_id   nullable
- custom_boundary           nullable
- area_name
- boundary_type
- status
```

This approach avoids storing the same Kesbewa or Polgasowita polygon repeatedly when several organizations select it.

### Simpler MVP approach

For the semester MVP, it may be easier to store the selected polygon directly in `organization_service_areas` while preserving its source metadata.

### More normalized future approach

For a larger production system, use shared `administrative_areas` reference records and link organizations to them.

---

## 14. Recommended final decision for EcoTrack

EcoTrack should:

1. Prefer official Sri Lankan NSDI or Survey Department vector boundaries.
2. Import or query official DS and GN boundaries.
3. Allow organizations to search and select official areas such as Kesbewa and Polgasowita.
4. Store each separately managed selected area as its own row.
5. Allow several areas for one organization.
6. Allow custom polygons when the real service area does not match administrative boundaries.
7. Require Super Admin approval before an area becomes active.
8. Store source name, source layer, official feature code, and source date.
9. Use PostGIS `ST_Covers` to calculate incident visibility.
10. Use GiST indexes for efficient spatial queries.
11. Preserve historical and inactive areas rather than hard-deleting them.
12. Recheck official source licences, attribution requirements, field names, and service availability before production import.

---

## 15. Key memory line

> EcoTrack should combine official Sri Lankan administrative boundaries with approved custom polygons. Organizations may select one or several areas, each stored as a service-area record, and PostGIS should determine which organizations can see a shared incident by checking whether the incident point is covered by each active boundary.

