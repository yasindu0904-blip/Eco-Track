import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError } from "../../errors/applicationError.js";
import { parseDashboardRange } from "./dashboard.validation.js";

test("dashboard ranges accept bounded ISO windows", () => {
  const value = parseDashboardRange({ from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:00Z" });
  assert.equal(value.from?.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("dashboard ranges reject reversed and overlong windows", () => {
  for (const query of [
    { from: "2026-02-01T00:00:00Z", to: "2026-01-01T00:00:00Z" },
    { from: "2024-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" },
  ]) assert.throws(() => parseDashboardRange(query), (error) => error instanceof ApplicationError && error.statusCode === 400);
});
