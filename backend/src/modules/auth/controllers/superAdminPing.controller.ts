import type {
  Request,
  Response,
} from "express";

export function superAdminPingController(
  _request: Request,
  response: Response,
): void {
  response.status(200).json({
    data: {
      message: "Super Admin access confirmed.",
    },
  });
}