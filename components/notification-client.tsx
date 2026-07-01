"use client";

import { useEffect, useState } from "react";

type RecentNotification = {
  id: string;
  title: string;
  body: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  clickUrl: string;
  createdAt: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await registration.update().catch(() => undefined);
  return navigator.serviceWorker.ready;
}

export function NotificationClient() {
  const [toast, setToast] = useState<RecentNotification | null>(null);

  useEffect(() => {
    const seenStorageKey = "hx-seen-notification-ids";

    function loadSeenIds() {
      try {
        return new Set<string>(JSON.parse(localStorage.getItem(seenStorageKey) || "[]"));
      } catch {
        return new Set<string>();
      }
    }

    function saveSeenIds(ids: Set<string>) {
      localStorage.setItem(seenStorageKey, JSON.stringify([...ids].slice(-120)));
    }

    async function enablePush() {
      if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
        window.alert("這個瀏覽器目前不支援推播通知，請改用支援 PWA Push 的瀏覽器測試。");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        window.alert("尚未允許通知權限，請到瀏覽器或手機設定中開啟通知。");
        return;
      }

      const registration = await registerServiceWorker();
      if (!registration) return;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        registration.showNotification("推播尚未完成設定", {
          body: "系統缺少 VAPID Key，請先由系統管理員完成推播環境設定。",
          icon: "/app-icon.svg",
          data: { url: "/notifications" }
        });
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription)
      });

      const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
        body: "推播通知已開啟，之後重要事項會提醒您。",
        icon: "/app-icon.svg",
        badge: "/app-icon.svg",
        data: { url: "/notifications" },
        vibrate: [180, 80, 180]
      };
      registration.showNotification("推播通知已開啟", notificationOptions);
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-enable-push]");
      if (!button) return;
      void enablePush();
    }

    let initialized = false;
    async function pollRecentNotifications() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notifications/recent", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { notifications?: RecentNotification[] };
        const notifications = payload.notifications ?? [];
        const seenIds = loadSeenIds();

        if (!initialized) {
          notifications.forEach((notification) => seenIds.add(notification.id));
          saveSeenIds(seenIds);
          initialized = true;
          return;
        }

        const unreadNew = notifications.filter((notification) => !seenIds.has(notification.id));
        if (unreadNew.length === 0) return;

        unreadNew.forEach((notification) => seenIds.add(notification.id));
        saveSeenIds(seenIds);
        const latest = unreadNew[0];
        setToast(latest);
        window.setTimeout(() => setToast((current) => (current?.id === latest.id ? null : current)), 9000);
        navigator.vibrate?.(latest.priority === "URGENT" ? [250, 120, 250] : [180]);
      } catch {
        // Login pages, route changes, and offline moments can fail silently. Push still handles notifications.
      }
    }

    void registerServiceWorker().catch(() => undefined);
    void pollRecentNotifications();
    const interval = window.setInterval(pollRecentNotifications, 8000);
    window.addEventListener("focus", pollRecentNotifications);
    document.addEventListener("click", handleClick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", pollRecentNotifications);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-lg rounded-lg border border-brand-200 bg-white p-4 shadow-soft md:left-auto md:right-5 md:mx-0">
      <div className="flex items-start gap-3">
        <div className={`mt-1 h-3 w-3 rounded-full ${toast.priority === "URGENT" ? "bg-red-600" : toast.priority === "HIGH" ? "bg-amber-500" : "bg-brand-700"}`} />
        <a className="min-w-0 flex-1" href={toast.clickUrl}>
          <p className="text-base font-black text-slate-950">{toast.title}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-700">{toast.body}</p>
        </a>
        <button className="rounded-md px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setToast(null)}>
          關閉
        </button>
      </div>
    </div>
  );
}
