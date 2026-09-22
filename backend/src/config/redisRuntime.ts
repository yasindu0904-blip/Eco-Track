import { createHash } from "node:crypto";
import { Redis } from "ioredis";

import { env } from "./env.js";

const prefix = env.REDIS_KEY_PREFIX ?? `ecotrack:${env.NODE_ENV}`;
function createClient(): Redis {
  const connection = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 500,
    commandTimeout: 500,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  connection.on("error", () => undefined);
  return connection;
}

let client = createClient();
let connecting: Promise<boolean> | null = null;

function key(part: string): string {
  return `${prefix}:${part}`;
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

async function ready(): Promise<boolean> {
  if (client.status === "ready") return true;
  if (connecting) return connecting;
  if (client.status === "end") client = createClient();
  if (client.status !== "wait") return false;
  connecting = client.connect().then(() => true, () => false).finally(() => {
    connecting = null;
  });
  return connecting;
}

export async function cachedValue<T>(
  scope: string,
  parts: unknown[],
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  if (!(await ready())) return load();
  const generationKey = key(`cache-generation:${scope}`);
  let cacheKey: string;
  try {
    const generation = await client.get(generationKey) ?? "0";
    cacheKey = key(`cache:${scope}:${generation}:${fingerprint(parts)}`);
    const cached = await client.get(cacheKey);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch {
    return load();
  }

  const value = await load();
  try {
    // A concurrent write can advance the generation while the DB query runs.
    if ((await client.get(generationKey) ?? "0") === cacheKey.split(":").at(-2)) {
      await client.set(cacheKey, JSON.stringify(value), "EX", ttlSeconds);
    }
  } catch {
    // Cache errors must not turn a successful database read into a failed request.
  }
  return value;
}

export function readCached<T>(
  cache: typeof cachedValue | undefined,
  scope: string,
  parts: unknown[],
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  return cache ? cache(scope, parts, ttlSeconds, load) : load();
}

export async function invalidateCache(scope: string): Promise<void> {
  if (!(await ready())) return;
  try {
    await client.incr(key(`cache-generation:${scope}`));
  } catch {
    // Every cached result also has a short expiry.
  }
}

const rateLimitScript = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
  return {count, redis.call('PTTL', KEYS[1])}
`;

export async function consumeRateLimit(
  name: string,
  identity: string,
  maximum: number,
  windowMilliseconds: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  if (!(await ready())) throw new Error("Redis rate limiter is unavailable.");
  const result = await client.eval(
    rateLimitScript, 1, key(`rate-limit:${name}:${fingerprint(identity)}`), windowMilliseconds,
  ) as [number, number];
  return {
    allowed: result[0] <= maximum,
    retryAfterSeconds: Math.max(1, Math.ceil(result[1] / 1000)),
  };
}

export async function notificationWorkerHealth(): Promise<{
  online: boolean;
  waiting: number;
  failed: number;
}> {
  if (!(await ready())) return { online: false, waiting: 0, failed: 0 };
  try {
    const [heartbeat, waiting, failed] = await Promise.all([
      client.get(key("worker:notifications")),
      client.llen("bull:ecotrack-notifications:wait"),
      client.zcard("bull:ecotrack-notifications:failed"),
    ]);
    return { online: heartbeat !== null, waiting, failed };
  } catch {
    return { online: false, waiting: 0, failed: 0 };
  }
}

export async function writeNotificationHeartbeat(): Promise<void> {
  if (!(await ready())) return;
  await client.set(key("worker:notifications"), new Date().toISOString(), "EX", 45);
}

export async function closeRedisRuntime(): Promise<void> {
  client.disconnect();
}
