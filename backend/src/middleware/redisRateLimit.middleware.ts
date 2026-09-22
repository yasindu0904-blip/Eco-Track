import type { NextFunction, Request, Response } from "express";

import { ApplicationError } from "../errors/applicationError.js";
import { consumeRateLimit } from "../config/redisRuntime.js";

export type RateLimitConsumer = typeof consumeRateLimit;

export function createRedisRateLimit(
  consume: RateLimitConsumer,
  name: string,
  maximum: number,
  windowMilliseconds: number,
) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = request.authentication?.profile.id;
      if (!userId) throw new ApplicationError(401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
      let result: Awaited<ReturnType<RateLimitConsumer>>;
      try {
        result = await consume(name, userId, maximum, windowMilliseconds);
      } catch {
        throw new ApplicationError(503, "RATE_LIMIT_UNAVAILABLE", "This action is temporarily unavailable. Please try again shortly.");
      }
      if (!result.allowed) {
        response.setHeader("Retry-After", String(result.retryAfterSeconds));
        throw new ApplicationError(429, "RATE_LIMITED", "Too many requests. Please wait before trying again.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
