import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { ApplicationError } from "../errors/applicationError.js";

export function notFoundMiddleware(
  _request: Request,
  _response: Response,
  next: NextFunction,
): void {
  // Forward unmatched routes to the shared error handling middleware.
  next(
    new ApplicationError(
      404,
      "ROUTE_NOT_FOUND",
      "The requested route was not found.",
    ),
  );
}