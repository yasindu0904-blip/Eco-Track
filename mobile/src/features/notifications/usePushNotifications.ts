import { useCallback, useEffect, useRef } from "react";
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
}: UsePushNotificationsOptions): () => void {
  const registrationController = useRef<AbortController | null>(null);
  const stopRegistration = useCallback(() => {
    registrationController.current?.abort();
    registrationController.current = null;
  }, []);

  useEffect(() => {
    if (!enabled || !accessToken || !userId) return;

    let active = true;
    const controller = new AbortController();
    registrationController.current = controller;
    const register = (devicePushToken?: Notifications.DevicePushToken) => {
      void registerCurrentInstallationForPush(accessToken, userId, devicePushToken, controller.signal).catch((error: unknown) => {
        if (active && !controller.signal.aborted) console.warn("Push notification registration failed.", error);
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
      controller.abort();
      if (registrationController.current === controller) registrationController.current = null;
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [accessToken, enabled, onNotificationResponse, userId]);

  return stopRegistration;
}
