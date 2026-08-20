import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  acceptedPlanIndexes,
  boundedFixtureScanLimits,
  captureSourceHashes,
  hashText,
  queries,
  requiredIndexes,
} from "../../scripts/explainSpatialQueries.js";

type PlanCheck = {
  acceptedIndexes: string[];
  selectedAcceptedIndexes: string[];
  indexEligibilitySelectedIndexes: string[];
  naturalIndexSelected: boolean;
  boundedFixtureScanAccepted: boolean;
  evidenceKind: "NATURAL_INDEX" | "BOUNDED_FIXTURE_SCAN" | "UNSATISFIED";
  satisfied: boolean;
};

type PlanEvidence = {
  rowCounts: Record<string, number>;
  indexes: Array<{ indexname: string }>;
  planSummary: Record<string, { indexes: string[] }>;
  indexEligibilitySummary: Record<string, { indexes: string[] }>;
  planChecks: Record<string, PlanCheck>;
  queryHashes: Record<string, string>;
  sourceHashes: Record<string, string>;
};

test("checked-in MAP-03 plans independently prove every primary query", async () => {
  const path = new URL(
    "../../../../docs/team-plans/MAP-03_Query_Plans.json",
    import.meta.url,
  );
  const evidence = JSON.parse(await readFile(path, "utf8")) as PlanEvidence;
  const catalogIndexes = new Set(evidence.indexes.map(({ indexname }) => indexname));

  for (const indexName of requiredIndexes) {
    assert.equal(catalogIndexes.has(indexName), true, `Missing captured index ${indexName}.`);
  }

  assert.deepEqual(evidence.sourceHashes, await captureSourceHashes());

  for (const [queryName, sql] of Object.entries(queries)) {
    const summary = evidence.planSummary[queryName];
    const storedCheck = evidence.planChecks[queryName];
    const acceptedIndexes = [...(acceptedPlanIndexes[queryName] ?? [])];
    assert.ok(summary, `Missing plan summary for ${queryName}.`);
    assert.ok(storedCheck, `Missing plan check for ${queryName}.`);
    assert.equal(evidence.queryHashes[queryName], hashText(sql), `${queryName} SQL changed.`);

    const selectedAcceptedIndexes = acceptedIndexes.filter((indexName) =>
      summary.indexes.includes(indexName));
    const naturalIndexSelected = selectedAcceptedIndexes.length > 0;
    const boundedScan = boundedFixtureScanLimits[queryName];
    const boundedFixtureScanAccepted = Boolean(
      boundedScan &&
      evidence.rowCounts[boundedScan.rowCountKey] !== undefined &&
      evidence.rowCounts[boundedScan.rowCountKey]! <= boundedScan.maximumRows,
    );
    const indexEligibilitySelectedIndexes = acceptedIndexes.filter((indexName) =>
      evidence.indexEligibilitySummary[queryName]?.indexes.includes(indexName));
    const boundedFixtureEvidenceSatisfied = boundedFixtureScanAccepted &&
      indexEligibilitySelectedIndexes.length > 0;
    const satisfied = naturalIndexSelected || boundedFixtureEvidenceSatisfied;
    const evidenceKind = naturalIndexSelected
      ? "NATURAL_INDEX"
      : boundedFixtureEvidenceSatisfied
        ? "BOUNDED_FIXTURE_SCAN"
        : "UNSATISFIED";

    assert.deepEqual(storedCheck, {
      acceptedIndexes,
      selectedAcceptedIndexes,
      indexEligibilitySelectedIndexes,
      naturalIndexSelected,
      boundedFixtureScanAccepted,
      evidenceKind,
      satisfied,
    });
    assert.equal(satisfied, true, `No valid index or bounded scan evidence for ${queryName}.`);
  }

  assert.deepEqual(
    Object.keys(evidence.planSummary).sort(),
    Object.keys(queries).sort(),
    "Plan evidence contains stale or missing queries.",
  );
  assert.ok(Object.values(evidence.rowCounts).every((count) => count > 0));
});
