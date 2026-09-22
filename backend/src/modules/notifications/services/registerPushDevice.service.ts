import type { NotificationDependencies } from "../notification.dependencies.js";
import type {
  PushDeviceDto,
  RegisterPushDeviceCommand,
} from "../notification.types.js";
import { registerPushDeviceRecord } from "../repositories/pushDevice.repository.js";

export async function registerPushDevice(
  dependencies: NotificationDependencies,
  command: RegisterPushDeviceCommand,
): Promise<PushDeviceDto> {
  const device = await registerPushDeviceRecord(dependencies.prisma, command);

  return {
    ...device,
    registeredAt: device.registeredAt.toISOString(),
    lastSeenAt: device.lastSeenAt.toISOString(),
  };
}
