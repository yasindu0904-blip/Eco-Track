import type { NextFunction, Request, Response } from "express";

import { invalidateCache } from "../config/redisRuntime.js";

export function invalidateAfterSuccessfulWrite(scopes: string[]) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      let invalidationStarted = false;
      const originalJson = response.json.bind(response);
      response.json = ((body: unknown) => {
        if (!invalidationStarted && response.statusCode >= 200 && response.statusCode < 300) {
          invalidationStarted = true;
          void Promise.all(scopes.map(invalidateCache)).then(
            () => { originalJson(body); },
            () => { originalJson(body); },
          );
          return response;
        }
        return originalJson(body);
      }) as typeof response.json;
      response.once("finish", () => {
        if (!invalidationStarted && response.statusCode >= 200 && response.statusCode < 300) {
          void Promise.all(scopes.map(invalidateCache)).catch(() => undefined);
        }
      });
    }
    next();
  };
}
