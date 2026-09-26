import type { ConnectionOptions } from "bullmq";

import { env } from "./env.js";
import { redisConnectionOptions } from "./redisConnectionOptions.js";

export const redisWorkerConnection: ConnectionOptions = redisConnectionOptions(env.REDIS_URL);
