import { updateProfileRecord } from "../repositories/profile.repository.js";

export function updateProfile(
  userId: string,
  data: { fullName: string; phoneNumber: string },
) {
  return updateProfileRecord(userId, data);
}
