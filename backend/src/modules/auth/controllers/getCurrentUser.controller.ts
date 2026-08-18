import type {
  Request,
  Response,
} from "express";

export function getCurrentUserController(
  request: Request,
  response: Response,
): void {
  const { profile } = request.authentication;

  response.status(200).json({
    data: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phoneNumber: profile.phoneNumber,
      profileCompletedAt: profile.profileCompletedAt,
      platformRole: profile.platformRole,
      accountStatus: profile.accountStatus,
    },
  });
}
