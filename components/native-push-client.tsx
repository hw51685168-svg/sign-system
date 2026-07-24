"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

type PushToken = {
  value: string;
};

type PushNotificationActionPerformed = {
  notification?: {
    data?: {
      url?: string;
      targetUrl?: string;
    };
  };
};

type NativePushTokenEvent = CustomEvent<{
  status: "registered" | "unavailable" | "error";
  token?: string;
  platform?: string;
  provider?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  error?: string;
}>;

type AndroidNativeBridge = {
  getNotificationPermissionStatus?: () => string;
  getFcmAvailabilityStatus?: () => string;
  requestNotificationPermission?: () => string;
  requestFcmToken?: () => void;
  showTestNotification?: (title: string, body: string) => void;
};

declare global {
  interface Window {
    HuangxiangAndroid?: AndroidNativeBridge;
  }
}

async function registerToken(payload: {
  token: string;
  platform?: string;
  provider?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
}) {
  await fetch("/api/native-push/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: payload.token,
      platform: payload.platform || "android",
      provider: payload.provider || "fcm",
      deviceModel: payload.deviceModel,
      osVersion: payload.osVersion,
      appVersion: payload.appVersion || process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"
    })
  });
}

export function NativePushClient() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (process.env.NEXT_PUBLIC_ENABLE_NATIVE_PUSH === "0") return;

    let cancelled = false;

    async function registerWithAndroidBridge() {
      const bridge = window.HuangxiangAndroid;
      if (!bridge?.requestFcmToken) return false;

      const onToken = (event: Event) => {
        const detail = (event as NativePushTokenEvent).detail;
        if (cancelled || !detail) return;
        if (detail.status === "registered" && detail.token) {
          registerToken({ ...detail, token: detail.token }).catch((error) => {
            console.error("Native FCM token registration failed", error);
          });
        } else if (detail.status === "error" || detail.status === "unavailable") {
          console.warn("Native FCM token unavailable", detail.error || detail.status);
        }
      };

      window.addEventListener("huangxiang:native-push-token", onToken);
      bridge.requestFcmToken();

      return () => window.removeEventListener("huangxiang:native-push-token", onToken);
    }

    async function registerWithCapacitorPlugin() {
      const [{ Capacitor }, { PushNotifications }] = await Promise.all([
        import("@capacitor/core"),
        import("@capacitor/push-notifications")
      ]);

      if (!Capacitor.isNativePlatform()) return;
      if (Capacitor.getPlatform() !== "android") return;

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== "granted") return;

      await PushNotifications.register();

      await PushNotifications.addListener("registration", async (token: PushToken) => {
        if (cancelled) return;
        await registerToken({
          token: token.value,
          platform: Capacitor.getPlatform(),
          provider: "fcm",
          appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"
        }).catch((error) => console.error("Native push token registration failed", error));
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.error("Native push registration failed", error);
      });

      await PushNotifications.addListener("pushNotificationActionPerformed", (event: PushNotificationActionPerformed) => {
        const targetUrl = event.notification?.data?.targetUrl || event.notification?.data?.url || "/notifications";
        window.location.href = targetUrl;
      });
    }

    let cleanupBridge: false | (() => void) | undefined;

    async function setup() {
      cleanupBridge = await registerWithAndroidBridge();
      if (!cleanupBridge) await registerWithCapacitorPlugin();
    }

    setup().catch((error) => {
      console.error("Native push setup failed", error);
    });

    return () => {
      cancelled = true;
      if (typeof cleanupBridge === "function") cleanupBridge();
    };
  }, [status]);

  return null;
}
