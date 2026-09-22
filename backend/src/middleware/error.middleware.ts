import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApplicationError } from "../errors/applicationError.js";

export function errorMiddleware(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApplicationError) {
    if (error.statusCode === 429 && typeof error.details?.retryAfterSeconds === "number") {
      response.setHeader("Retry-After", String(error.details.retryAfterSeconds));
    }
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });

    return;
  }

  console.error("Unexpected EcoTrack API error:", error);

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  });
}
