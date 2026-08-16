import { prisma } from "../../../database/prisma.js";

const completedProfileSelect = {
  id: true,
  email: true,
  fullName: true,
  phoneNumber: true,
  profileCompletedAt: true,
  platformRole: true,
  accountStatus: true,
} as const;

export function completeProfileRecord(
  userId: string,
  data: { fullName: string; phoneNumber: string },
) {
  return prisma.userProfile.update({
    where: { id: userId },
    data: {
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      profileCompletedAt: new Date(),
    },
    select: completedProfileSelect,
  });
}

export function updateProfileRecord(
  userId: string,
  data: { fullName: string; phoneNumber: string },
) {
  return prisma.userProfile.update({
    where: { id: userId },
    data: {
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
    },
    select: completedProfileSelect,
  });
}
