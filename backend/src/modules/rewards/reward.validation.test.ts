import assert from "node:assert/strict";
import test from "node:test";

import {
  listContributionsQuerySchema,
  specialContributionSourceKeySchema,
} from "./reward.validation.js";

test("contribution-list validation applies safe limits", () => {
  assert.deepEqual(
    listContributionsQuerySchema.parse({}),
    { limit: 20 },
  );
  assert.equal(
    listContributionsQuerySchema.parse({ limit: "50" }).limit,
    50,
  );
  assert.equal(
    listContributionsQuerySchema.safeParse({ limit: "51" }).success,
    false,
  );
  assert.equal(
    listContributionsQuerySchema.safeParse({ limit: "20", userId: "forbidden" }).success,
    false,
  );
});

test("special contribution keys must be stable backend identifiers", () => {
  assert.equal(
    specialContributionSourceKeySchema.parse("support-case:abc-123"),
    "support-case:abc-123",
  );
  assert.equal(specialContributionSourceKeySchema.safeParse("contains spaces").success, false);
  assert.equal(specialContributionSourceKeySchema.safeParse("").success, false);
});
