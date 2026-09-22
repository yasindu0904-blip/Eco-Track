import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import type { NotificationItem } from "./notification.types";
import { markNotificationRead } from "./notification.api";
import {
  notificationItemFromResponse,
  registerCurrentInstallationForPush,
} from "./pushNotification.service";

type UsePushNotificationsOptions = {
  accessToken: string | null;
  userId: string | null;
  enabled: boolean;
  onNotificationResponse: (notification: NotificationItem) => void;
};

export function usePushNotifications({
  accessToken,
  userId,
  enabled,
  onNotificationResponse,
}: UsePushNotificationsOptions): void {
  useEffect(() => {
    if (!enabled || !accessToken || !userId) return;

    let active = true;
    const register = (devicePushToken?: Notifications.DevicePushToken) => {
      void registerCurrentInstallationForPush(accessToken, userId, devicePushToken).catch((error: unknown) => {
        if (active) console.warn("Push notification registration failed.", error);
      });
    };
    const processResponse = (response: Notifications.NotificationResponse | null) => {
      if (!active || !response) return;
      const notification = notificationItemFromResponse(response);
      if (notification) {
        void markNotificationRead(accessToken, notification.id).catch(() => undefined);
        onNotificationResponse(notification);
      }
      Notifications.clearLastNotificationResponse();
    };

    register();
    processResponse(Notifications.getLastNotificationResponse());

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      processResponse,
    );
    const tokenSubscription = Notifications.addPushTokenListener((devicePushToken) => {
      register(devicePushToken);
    });

    return () => {
      active = false;
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [accessToken, enabled, onNotificationResponse, userId]);
}
