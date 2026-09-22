import type { NotificationDependencies } from "../notification.dependencies.js";
import { deactivatePushDeviceRecord } from "../repositories/pushDevice.repository.js";

export async function deactivatePushDevice(
  dependencies: NotificationDependencies,
  userId: string,
  installationId: string,
): Promise<void> {
  await deactivatePushDeviceRecord(
    dependencies.prisma,
    userId,
    installationId,
  );
}
