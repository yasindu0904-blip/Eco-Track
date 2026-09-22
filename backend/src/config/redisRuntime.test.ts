import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";

import {
  cachedValue,
  closeRedisRuntime,
  consumeRateLimit,
  invalidateCache,
  notificationWorkerHealth,
  writeNotificationHeartbeat,
} from "./redisRuntime.js";
import { invalidateAfterSuccessfulWrite } from "../middleware/cacheInvalidation.middleware.js";

test("Redis shares limits and refreshes cached reads after invalidation", {
  skip: !process.env.TEST_REDIS_URL,
}, async () => {
  try {
    const identity = `redis-test-${Date.now()}`;
    const outcomes = await Promise.all(Array.from({ length: 10 }, () =>
      consumeRateLimit("test", identity, 5, 60_000)));
    assert.equal(outcomes.filter((item) => item.allowed).length, 5);
    assert.ok(outcomes.every((item) => item.retryAfterSeconds > 0));

    let loads = 0;
    const load = async () => ({ value: ++loads });
    assert.deepEqual(await cachedValue("test-cache", [identity], 60, load), { value: 1 });
    assert.deepEqual(await cachedValue("test-cache", [identity], 60, load), { value: 1 });
    assert.deepEqual(await cachedValue("test-cache", [identity, "other-organization"], 60, load), { value: 2 });
    await invalidateCache("test-cache");
    assert.deepEqual(await cachedValue("test-cache", [identity], 60, load), { value: 3 });

    await writeNotificationHeartbeat();
    assert.equal((await notificationWorkerHealth()).online, true);

    let current = 1;
    const app = express();
    const scope = `test-http:${identity}`;
    app.use(invalidateAfterSuccessfulWrite([scope]));
    app.get("/value", async (_request, response) => {
      response.json(await cachedValue(scope, [], 60, async () => ({ current })));
    });
    app.post("/value", (_request, response) => {
      current = 2;
      response.json({ saved: true });
    });
    const server = app.listen(0, "127.0.0.1");
    try {
      if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
      const address = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${address.port}/value`;
      assert.deepEqual(await fetch(url).then((response) => response.json()), { current: 1 });
      assert.equal((await fetch(url, { method: "POST" })).status, 200);
      assert.deepEqual(await fetch(url).then((response) => response.json()), { current: 2 });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    await closeRedisRuntime();
  }
});
