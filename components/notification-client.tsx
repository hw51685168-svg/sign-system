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

function isIosDevice() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await registration.update().catch(() => undefined);
  return navigator.serviceWorker.ready;
}

function canUsePushManager(registration: ServiceWorkerRegistration | null) {
  return Boolean(registration && "pushManager" in registration && registration.pushManager);
}

export function NotificationClient() {
  const [toast, setToast] = useState<RecentNotification | null>(null);

  useEffect(() => {
    const seenStorageKey = "ju-seen-notification-ids";

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
      if (isIosDevice() && !isStandaloneMode()) {
        window.alert("請先用 Safari 分享 → 加入主畫面，再從桌面圖示開啟 JU數位管理，才能啟用 iPhone 推播。");
        return;
      }

      if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
        window.alert("此瀏覽器不支援 Web Push。iPhone 請使用 Safari 加入主畫面後再開啟。");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        window.alert("尚未允許通知權限，無法啟用背景推播。");
        return;
      }

      const keyResponse = await fetch("/api/web-push/vapid-public-key", { cache: "no-store" });
      if (!keyResponse.ok) {
        window.alert("伺服器尚未設定 Web Push VAPID public key。");
        return;
      }
      const { publicKey } = (await keyResponse.json()) as { publicKey?: string };
      if (!publicKey) {
        window.alert("伺服器沒有提供 Web Push VAPID public key。");
        return;
      }

      const registration = await registerServiceWorker();
      if (!registration) return;
      if (!canUsePushManager(registration)) {
        window.alert("目前瀏覽器無法建立 Web Push subscription，請確認是否從 iPhone 主畫面 PWA 開啟。");
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe().catch(() => undefined);
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      await fetch("/api/web-push/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...subscription.toJSON(),
          platformHint: isIosDevice() && isStandaloneMode() ? "ios-pwa" : undefined
        })
      });

      await registration.showNotification("JU數位管理推播已啟用", {
        body: "本裝置已完成推播訂閱，請用測試通知確認鎖定畫面是否收到。",
        icon: "/app-icon-192.png",
        badge: "/app-icon-192.png",
        data: { url: "/notifications" },
        vibrate: [180, 80, 180]
      } as NotificationOptions & { vibrate?: number[] });
    }

    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("[data-enable-push]");
      if (!button) return;
      void enablePush().catch(() => undefined);
    }

    let initialized = false;
    async function pollRecentNotifications() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notifications/recent", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { notifications?: RecentNotification[] };
        const notifications = payload.notifications ?? [];
        window.dispatchEvent(new CustomEvent("ju:notification-count", { detail: { count: Number((payload as { unreadCount?: number }).unreadCount ?? 0) } }));
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
        // Route changes, offline moments, and tunnel reconnects can fail silently.
      }
    }

    void registerServiceWorker().catch(() => undefined);
    void pollRecentNotifications();
    const interval = window.setInterval(pollRecentNotifications, 20000);
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
