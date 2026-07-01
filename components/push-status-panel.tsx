"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, RefreshCcw } from "lucide-react";

type PushStatus = {
  permission: string;
  serviceWorker: string;
  subscription: string;
  standalone: string;
  serverPush: string;
  deviceName: string;
  browser: string;
  os: string;
  lastSuccessAt: string;
  lastFailedAt: string;
  latestPushResult: string;
  isSubscribed: boolean;
  needsResubscribe: boolean;
  canPush: boolean;
  message: string;
};

type ServerPushStatus = {
  pushAvailable: boolean;
  activeSubscriptionCount: number;
  currentSubscription: null | {
    deviceName: string;
    browser: string;
    os: string;
    deviceType: string;
    isActive: boolean;
    lastSuccessAt: string | null;
    lastFailedAt: string | null;
  };
  latestSubscription: null | {
    deviceName: string;
    browser: string;
    os: string;
    deviceType: string;
    isActive: boolean;
    lastSuccessAt: string | null;
    lastFailedAt: string | null;
  };
  latestPushLog: null | {
    status: string;
    errorMessage: string | null;
    createdAt: string;
  };
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function detectBrowser(userAgent: string) {
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("CriOS") || userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Firefox")) return "Firefox";
  return "未知瀏覽器";
}

function detectOs(userAgent: string) {
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS")) return "macOS";
  return "未知系統";
}

function formatDateTime(value?: string | null) {
  if (!value) return "尚無紀錄";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPermission(permission: string) {
  if (permission === "granted") return "granted（已允許）";
  if (permission === "denied") return "denied（已封鎖）";
  if (permission === "default") return "default（尚未選擇）";
  return permission;
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-base font-black text-slate-900">{label}</p>
      <p className="mt-1 break-words text-base font-semibold leading-7 text-slate-700">{value}</p>
    </div>
  );
}

const initialStatus: PushStatus = {
  permission: "檢查中",
  serviceWorker: "檢查中",
  subscription: "檢查中",
  standalone: "檢查中",
  serverPush: "檢查中",
  deviceName: "檢查中",
  browser: "檢查中",
  os: "檢查中",
  lastSuccessAt: "檢查中",
  lastFailedAt: "檢查中",
  latestPushResult: "檢查中",
  isSubscribed: false,
  needsResubscribe: false,
  canPush: false,
  message: ""
};

export function PushStatusPanel() {
  const [status, setStatus] = useState<PushStatus>(initialStatus);
  const [busyAction, setBusyAction] = useState<"enable" | "disable" | "test" | "refresh" | null>(null);
  const busy = busyAction !== null;

  async function refresh(showFeedback = false) {
    if (showFeedback) {
      setBusyAction("refresh");
      setStatus((current) => ({ ...current, message: "正在重新檢查推播狀態，請稍候..." }));
    }

    const permission = "Notification" in window ? formatPermission(Notification.permission) : "此瀏覽器不支援通知";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone ? "已用 PWA / App 模式開啟" : "仍在瀏覽器分頁中";
    let serviceWorker = "此瀏覽器不支援 Service Worker";
    let subscription = "尚未訂閱";
    let endpoint = "";
    let isSubscribed = false;
    let needsResubscribe = false;
    let localHasSubscription = false;
    let serverSubscriptionActive: boolean | null = null;
    const canPush = "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
    const browser = detectBrowser(navigator.userAgent);
    const os = detectOs(navigator.userAgent);
    let serverPush = "尚未檢查";
    let deviceName = `${browser} / ${os} / ${navigator.userAgent.includes("Mobile") ? "手機" : "電腦"}`;
    let lastSuccessAt = "尚無紀錄";
    let lastFailedAt = "尚無紀錄";
    let latestPushResult = "尚無測試紀錄";

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      serviceWorker = registration?.active ? "已啟用" : registration ? "已註冊，等待啟用" : "尚未註冊";
      const pushSubscription = await registration?.pushManager.getSubscription();
      localHasSubscription = Boolean(pushSubscription);
      isSubscribed = localHasSubscription;
      subscription = pushSubscription ? "本機已訂閱推播" : "尚未訂閱推播";
      endpoint = pushSubscription?.endpoint ?? "";
    }

    try {
      const response = await fetch(`/api/push/status${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`, { cache: "no-store" });
      if (response.ok) {
        const server = (await response.json()) as ServerPushStatus;
        const matched = server.currentSubscription ?? server.latestSubscription;
        serverPush = server.pushAvailable ? `伺服器可推播，已啟用裝置 ${server.activeSubscriptionCount} 台` : "尚未設定 VAPID Key，推播無法送出";
        if (matched) {
          deviceName = matched.deviceName;
          lastSuccessAt = formatDateTime(matched.lastSuccessAt);
          lastFailedAt = formatDateTime(matched.lastFailedAt);
          if (server.currentSubscription) {
            serverSubscriptionActive = server.currentSubscription.isActive;
            if (localHasSubscription && !serverSubscriptionActive) {
              subscription = "本機有訂閱，但伺服器已停用，請重新開啟推播";
              isSubscribed = false;
              needsResubscribe = true;
            }
          }
        }
        if (server.currentSubscription?.lastSuccessAt || server.currentSubscription?.lastFailedAt) {
          const successAt = server.currentSubscription.lastSuccessAt ? new Date(server.currentSubscription.lastSuccessAt).getTime() : 0;
          const failedAt = server.currentSubscription.lastFailedAt ? new Date(server.currentSubscription.lastFailedAt).getTime() : 0;
          latestPushResult =
            successAt >= failedAt
              ? `目前裝置成功：${formatDateTime(server.currentSubscription.lastSuccessAt)}`
              : `目前裝置失敗：${formatDateTime(server.currentSubscription.lastFailedAt)}，請關閉後重新開啟推播`;
        } else if (server.latestPushLog) {
          latestPushResult =
            server.latestPushLog.status === "SENT"
              ? `成功：${formatDateTime(server.latestPushLog.createdAt)}`
              : `失敗：${formatDateTime(server.latestPushLog.createdAt)}${server.latestPushLog.errorMessage ? ` / ${server.latestPushLog.errorMessage.slice(0, 90)}` : ""}`;
        }
      }
    } catch {
      serverPush = "無法讀取伺服器推播狀態，請稍後再試";
    }

    setStatus((current) => ({
      ...current,
      permission,
      serviceWorker,
      subscription,
      standalone,
      serverPush,
      deviceName,
      browser,
      os,
      lastSuccessAt,
      lastFailedAt,
      latestPushResult,
      isSubscribed,
      needsResubscribe,
      canPush,
      message: showFeedback ? `重新檢查完成：${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : current.message
    }));

    if (showFeedback) setBusyAction(null);
  }

  async function enablePush() {
    setBusyAction("enable");
    try {
      if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
        setStatus((current) => ({ ...current, message: "這個瀏覽器目前不支援 Push 推播，請改用支援 PWA Push 的瀏覽器測試。" }));
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus((current) => ({ ...current, permission: formatPermission(permission), message: "尚未允許通知權限。請到瀏覽器或手機設定中允許通知。" }));
        return;
      }

      const registered = await navigator.serviceWorker.register("/sw.js");
      await registered.update().catch(() => undefined);
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing && status.needsResubscribe) {
        await existing.unsubscribe();
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setStatus((current) => ({ ...current, message: "系統尚未設定 VAPID Key，請先由系統管理員完成推播環境設定。" }));
        return;
      }

      const pushSubscription =
        !status.needsResubscribe && existing
          ? existing
          :
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        }));

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pushSubscription)
      });

      try {
        registration.showNotification("推播通知已開啟", {
          body: "Push 推播測試已完成。",
          icon: "/app-icon.svg",
          data: { url: "/notifications" }
        });
      } catch {
        // Some iOS versions do not allow immediate local notifications here.
      }

      setStatus((current) => ({ ...current, message: "已開啟 Push 推播。" }));
      await refresh();
    } finally {
      setBusyAction(null);
    }
  }

  async function sendTestNotification() {
    setBusyAction("test");
    try {
      setStatus((current) => ({ ...current, message: "正在送出測試通知，請稍候..." }));
      const formData = new FormData();
      formData.set("target", "self");
      formData.set("testKind", "general");
      formData.set("priority", "HIGH");
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        body: formData,
        headers: { accept: "application/json", "x-requested-with": "fetch" }
      });
      const result = response.ok ? ((await response.json().catch(() => null)) as { pushResult?: { sent?: number; failed?: number; reason?: string } } | null) : null;
      if (response.ok && result) {
        const sent = result.pushResult?.sent ?? 0;
        const failed = result.pushResult?.failed ?? 0;
        const reason = result.pushResult?.reason;
        const message =
          sent > 0
            ? "測試通知已送出，伺服器推播成功。"
            : failed > 0
              ? "系統通知已建立，但部分裝置推播失敗，請按重新檢查查看詳細狀態。"
              : reason
                ? `系統通知已建立，但未送出手機推播：${reason}`
                : "測試通知已送出，請觀察手機或瀏覽器是否跳出通知。";
        setStatus((current) => ({ ...current, message }));
        window.setTimeout(() => void refresh(), 1800);
      } else {
        setStatus((current) => ({ ...current, message: `測試通知送出失敗（${response.status || "無回應"}），請查看錯誤中心或推播設定。` }));
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function disablePush() {
    setBusyAction("disable");
    try {
      setStatus((current) => ({ ...current, message: "正在關閉推播，請稍候..." }));
      let endpoint: string | undefined;
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const pushSubscription = await registration?.pushManager.getSubscription();
        endpoint = pushSubscription?.endpoint;
        await pushSubscription?.unsubscribe();
      }
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint })
      });
      setStatus((current) => ({ ...current, message: "已關閉 Push 推播。系統內通知仍可在通知中心查看。" }));
      await refresh();
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    const handleFocus = () => {
      void refresh();
    };

    void refresh();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatusCard label="Notification Permission（通知權限）" value={status.permission} />
        <StatusCard label="Service Worker（背景服務）" value={status.serviceWorker} />
        <StatusCard label="Push Subscription（推播訂閱）" value={status.subscription} />
        <StatusCard label="PWA（手機 App 模式）" value={status.standalone} />
        <StatusCard label="Server Push（伺服器推播）" value={status.serverPush} />
        <StatusCard label="目前裝置" value={status.deviceName} />
        <StatusCard label="瀏覽器" value={status.browser} />
        <StatusCard label="作業系統" value={status.os} />
        <StatusCard label="最後推播成功" value={status.lastSuccessAt} />
        <StatusCard label="最後推播失敗" value={status.lastFailedAt} />
        <div className="sm:col-span-2">
          <StatusCard label="最後測試結果" value={status.latestPushResult} />
        </div>
      </div>

      {status.message ? <p className="rounded-md bg-brand-50 px-4 py-3 text-base font-semibold text-brand-800">{status.message}</p> : null}

      <div className="grid gap-2 sm:grid-cols-4">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-700 px-4 text-base font-bold text-white disabled:opacity-50"
          type="button"
          onClick={enablePush}
          disabled={busy || !status.canPush || status.isSubscribed}
        >
          <Bell className={`h-5 w-5 ${busyAction === "enable" ? "animate-pulse" : ""}`} />
          {busyAction === "enable" ? "開啟中..." : status.needsResubscribe ? "重新開啟推播" : "開啟推播"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-base font-bold text-red-700 disabled:opacity-50"
          type="button"
          onClick={disablePush}
          disabled={busy || !status.isSubscribed}
        >
          <BellOff className={`h-5 w-5 ${busyAction === "disable" ? "animate-pulse" : ""}`} />
          {busyAction === "disable" ? "關閉中..." : "關閉推播"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 text-base font-bold text-amber-800 disabled:opacity-50"
          type="button"
          onClick={sendTestNotification}
          disabled={busy || !status.isSubscribed}
        >
          <BellRing className={`h-5 w-5 ${busyAction === "test" ? "animate-pulse" : ""}`} />
          {busyAction === "test" ? "送出中..." : "測試通知"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 disabled:opacity-50"
          type="button"
          onClick={() => void refresh(true)}
          disabled={busy}
        >
          <RefreshCcw className={`h-5 w-5 ${busyAction === "refresh" ? "animate-spin" : ""}`} />
          {busyAction === "refresh" ? "檢查中..." : "重新檢查"}
        </button>
      </div>
    </div>
  );
}
