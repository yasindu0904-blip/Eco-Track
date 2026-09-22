import type { ConnectionOptions } from "bullmq";

import { env } from "./env.js";

export const redisWorkerConnection: ConnectionOptions = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
};
