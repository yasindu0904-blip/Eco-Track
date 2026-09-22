import { apiRequest } from "../../api/apiClient";

type RegisterPushDeviceInput = {
  installationId: string;
  expoPushToken: string;
  platform: "ANDROID" | "IOS";
  deviceName?: string;
  appVersion?: string;
};

export async function registerPushDevice(
  accessToken: string,
  input: RegisterPushDeviceInput,
): Promise<void> {
  await apiRequest(
    `/push-devices/${encodeURIComponent(input.installationId)}`,
    {
      method: "PUT",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expoPushToken: input.expoPushToken,
        platform: input.platform,
        deviceName: input.deviceName,
        appVersion: input.appVersion,
      }),
    },
  );
}

export async function deactivatePushDevice(
  accessToken: string,
  installationId: string,
): Promise<void> {
  await apiRequest(
    `/push-devices/${encodeURIComponent(installationId)}`,
    { method: "DELETE", accessToken },
  );
}
