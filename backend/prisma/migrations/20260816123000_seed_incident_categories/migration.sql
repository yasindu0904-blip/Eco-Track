BEGIN;

INSERT INTO "public"."incident_categories" (
  "id",
  "name",
  "description",
  "is_active"
) VALUES
  (
    gen_random_uuid(),
    'Litter and Waste',
    'Dumped rubbish, litter, plastics, or unmanaged solid waste.',
    true
  ),
  (
    gen_random_uuid(),
    'Pollution',
    'Air, water, soil, smoke, chemical, or drainage pollution.',
    true
  ),
  (
    gen_random_uuid(),
    'Wildlife Issue',
    'Wildlife hazards, injured animals, or damage to natural habitats.',
    true
  ),
  (
    gen_random_uuid(),
    'Environmental Damage',
    'Damage to trees, waterways, public green space, or ecosystems.',
    true
  )
ON CONFLICT ("name") DO UPDATE
SET
  "description" = EXCLUDED."description",
  "is_active" = true;

COMMIT;
