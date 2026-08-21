import { useEffect, useState } from "react";

import { getUnreadNotificationCount } from "./notification.api";
import "./notificationInbox.css";

type NotificationButtonProps = {
  accessToken?: string;
  onOpen: () => void;
  active?: boolean;
};

export function NotificationButton({ accessToken, onOpen, active = false }: NotificationButtonProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    const refresh = () => {
      void getUnreadNotificationCount(accessToken)
        .then((count) => { if (active) setUnreadCount(count); })
        .catch(() => undefined);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [accessToken]);

  if (!accessToken) return null;
  return (
    <button
      className={`notification-trigger${active ? " citizen-dashboard-nav-active" : ""}`}
      type="button"
      onClick={onOpen}
      aria-current={active ? "page" : undefined}
    >
      <span aria-hidden="true">🔔</span>
      Notifications
      {unreadCount > 0 && (
        <span className="notification-count" aria-label={`${unreadCount} unread notifications`}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
