import assert from "node:assert/strict";
import test from "node:test";

import { isPrismaTransactionConflict } from "./membershipAdministration.repository.js";

test("recognizes direct and adapter-wrapped transaction conflicts", () => {
  assert.equal(isPrismaTransactionConflict({ code: "P2034" }), true);
  assert.equal(
    isPrismaTransactionConflict({
      code: "P2039",
      meta: {
        driverAdapterError: {
          cause: { kind: "postgres", originalCode: "40001" },
        },
      },
    }),
    true,
  );
  assert.equal(
    isPrismaTransactionConflict({
      cause: { kind: "postgres", originalCode: "40P01" },
    }),
    true,
  );
  assert.equal(
    isPrismaTransactionConflict({
      cause: { kind: "TransactionWriteConflict" },
    }),
    true,
  );
});

test("recognizes Prisma's stable transaction-conflict message only", () => {
  assert.equal(
    isPrismaTransactionConflict({
      message: "Transaction failed due to a write conflict or a deadlock. Please retry your transaction",
    }),
    true,
  );
  assert.equal(
    isPrismaTransactionConflict({
      code: "P2039",
      meta: {
        driverAdapterError: {
          cause: { kind: "postgres", originalCode: "23514" },
        },
      },
      message: "A database check constraint was rejected.",
    }),
    false,
  );
});
