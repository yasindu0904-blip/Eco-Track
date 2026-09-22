import type { PrismaClient } from "../../../generated/prisma/client.js";

import { ApplicationError } from "../../../errors/applicationError.js";
import type { RegisterPushDeviceCommand } from "../notification.types.js";

const pushDeviceSelect = {
  installationId: true,
  platform: true,
  deviceName: true,
  appVersion: true,
  isActive: true,
  registeredAt: true,
  lastSeenAt: true,
} as const;

export async function registerPushDeviceRecord(
  prisma: PrismaClient,
  command: RegisterPushDeviceCommand,
) {
  return prisma.$transaction(async (transaction) => {
    const existingInstallation = await transaction.userDevice.findUnique({
      where: { installationId: command.installationId },
      select: { userId: true },
    });

    if (existingInstallation && existingInstallation.userId !== command.userId) {
      throw new ApplicationError(
        409,
        "PUSH_INSTALLATION_CONFLICT",
        "This app installation is already registered to another account.",
      );
    }

    const now = new Date();

    await transaction.userDevice.updateMany({
      where: {
        expoPushToken: command.expoPushToken,
        NOT: { installationId: command.installationId },
      },
      data: {
        expoPushToken: null,
        isActive: false,
        deactivatedAt: now,
      },
    });

    return transaction.userDevice.upsert({
      where: { installationId: command.installationId },
      create: {
        userId: command.userId,
        installationId: command.installationId,
        expoPushToken: command.expoPushToken,
        platform: command.platform,
        deviceName: command.deviceName,
        appVersion: command.appVersion,
        isActive: true,
        registeredAt: now,
        lastSeenAt: now,
      },
      update: {
        expoPushToken: command.expoPushToken,
        platform: command.platform,
        deviceName: command.deviceName,
        appVersion: command.appVersion,
        isActive: true,
        deactivatedAt: null,
        lastSeenAt: now,
      },
      select: pushDeviceSelect,
    });
  });
}

export async function deactivatePushDeviceRecord(
  prisma: PrismaClient,
  userId: string,
  installationId: string,
): Promise<void> {
  await prisma.userDevice.updateMany({
    where: { userId, installationId, isActive: true },
    data: {
      expoPushToken: null,
      isActive: false,
      deactivatedAt: new Date(),
    },
  });
}
