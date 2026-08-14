import { completeProfileRecord } from "../repositories/profile.repository.js";

export function completeProfile(
  userId: string,
  data: { fullName: string; phoneNumber: string },
) {
  return completeProfileRecord(userId, data);
}
