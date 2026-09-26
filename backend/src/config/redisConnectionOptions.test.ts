import assert from "node:assert/strict";
import test from "node:test";
import { Redis } from "ioredis";
import { redisConnectionOptions } from "./redisConnectionOptions.js";

test("queue options preserve a remote Redis endpoint and encoded credentials", () => {
  const client = new Redis({
    ...redisConnectionOptions("redis://demo:p%40ss%3Aword@redis.internal:6380/2"),
    lazyConnect: true,
  });
  try {
    assert.equal(client.options.host, "redis.internal");
    assert.equal(client.options.port, 6380);
    assert.equal(client.options.username, "demo");
    assert.equal(client.options.password, "p@ss:word");
    assert.equal(client.options.db, 2);
    assert.equal(client.options.maxRetriesPerRequest, null);
    assert.equal(client.options.tls, undefined);
  } finally {
    client.disconnect();
  }
});

test("TLS Redis URLs enable TLS in the options consumed by ioredis", () => {
  const client = new Redis({
    ...redisConnectionOptions("rediss://default:secret@redis.internal:6381"),
    lazyConnect: true,
  });
  try {
    assert.equal(client.options.host, "redis.internal");
    assert.equal(client.options.port, 6381);
    assert.ok(client.options.tls);
  } finally {
    client.disconnect();
  }
});
