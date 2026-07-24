"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, RefreshCcw } from "lucide-react";

type ServerSubscription = {
  id: string;
  endpointHost: string;
  endpointPreview: string;
  platform: string | null;
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  updatedAt: string;
};

type ResubscribeReason = "bad_jwt_token" | "inactive_subscription" | "no_active_subscription" | "permission_denied" | "unknown" | null;

type WebPushStatus = {
  pushAvailable: boolean;
  nativePushConfigured: boolean;
  activeSubscriptionCount: number;
  activeNativeTokenCount: number;
  needsResubscribe: boolean;
  resubscribeReason: ResubscribeReason;
  currentSubscription: ServerSubscription | null;
  latestSubscription: ServerSubscription | null;
  latestNativeToken: null | {
    id: string;
    platform: string;
    provider: string;
    deviceModel: string | null;
    osVersion: string | null;
    appVersion: string | null;
    isActive: boolean;
    lastSuccessAt: string | null;
    lastFailedAt: string | null;
    updatedAt: string;
  };
  latestPushLog: null | {
    status: string;
    errorMessage: string | null;
    sentAt: string | null;
    createdAt: string;
  };
};

type LocalStatus = {
  isIos: boolean;
  isStandalone: boolean;
  permission: string;
  serviceWorker: string;
  pushManager: string;
  subscription: string;
  endpoint: string;
  device: string;
  message: string;
  server: WebPushStatus | null;
};

type AndroidNativeBridge = {
  getNotificationPermissionStatus?: () => string;
  getFcmAvailabilityStatus?: () => string;
  requestNotificationPermission?: () => string;
  requestFcmToken?: () => void;
  showTestNotification?: (title: string, body: string) => void;
};

type NativePushTokenEvent = CustomEvent<{
  status: "registered" | "unavailable" | "error";
  token?: string;
  platform?: string;
  provider?: string;
  error?: string;
}>;

type WebPushTestPayload = {
  ok?: boolean;
  message?: string;
  error?: string;
  needsResubscribe?: boolean;
  resubscribeReason?: ResubscribeReason;
  result?: {
    sent?: number;
    failed?: number;
    reason?: string;
  };
};

declare global {
  interface Window {
    HuangxiangAndroid?: AndroidNativeBridge;
  }
}

const initialStatus: LocalStatus = {
  isIos: false,
  isStandalone: false,
  permission: "尚未檢查",
  serviceWorker: "尚未檢查",
  pushManager: "尚未檢查",
  subscription: "尚未檢查",
  endpoint: "",
  device: "尚未檢查",
  message: "",
  server: null
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

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("CriOS") || ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Firefox")) return "Firefox";
  return "未知瀏覽器";
}

function detectOs() {
  const ua = navigator.userAgent;
  if (isIosDevice()) return "iOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  return "未知作業系統";
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

function permissionText(value: string) {
  if (value === "granted") return "已允許";
  if (value === "denied") return "已拒絕";
  if (value === "default") return "尚未選擇";
  return value;
}

function containsBadJwtToken(value?: string | null) {
  return Boolean(value?.toLowerCase().includes("badjwttoken"));
}

function humanPushError(value?: string | null) {
  if (!value) return "尚無紀錄";
  if (containsBadJwtToken(value)) return "舊推播憑證已失效，請重新訂閱推播。";
  return value;
}

function resubscribeReasonText(reason?: ResubscribeReason) {
  if (reason === "bad_jwt_token") return "舊推播憑證已失效，請重新訂閱推播。";
  if (reason === "inactive_subscription") return "舊推播訂閱已失效，請重新訂閱推播。";
  if (reason === "no_active_subscription") return "目前沒有可用的推播訂閱，請重新訂閱推播。";
  if (reason === "permission_denied") return IOS_PERMISSION_HELP;
  return "舊推播訂閱已失效，請重新訂閱推播。";
}

const IOS_PERMISSION_HELP =
  "你的 iPhone 目前已關閉此 PWA 的通知權限。請到 iPhone 設定 > 通知 > JU 數位管理 / 此網站 App，開啟允許通知。完成後回到系統按「重新檢查」。";

function testDisabledReason(options: {
  isAndroidApp: boolean;
  canEnable: boolean;
  notificationGranted: boolean;
  isIos: boolean;
  needsResubscribe: boolean;
  hasServerActiveSubscription: boolean;
}) {
  if (options.isAndroidApp) return "";
  if (!options.canEnable) return "目前瀏覽器不支援 WebPush，請改用支援的瀏覽器或 PWA。";
  if (!options.notificationGranted) {
    return options.isIos
      ? `尚未允許通知，請先開啟通知權限。${IOS_PERMISSION_HELP}`
      : "尚未允許通知，請先開啟通知權限。";
  }
  if (options.needsResubscribe) return "舊推播訂閱已失效，請先重新訂閱推播。";
  if (!options.hasServerActiveSubscription) return "尚未有可用推播訂閱，請先重新訂閱推播。";
  return "";
}

function androidPermissionText(value: string) {
  if (value === "granted") return "Android App 已允許";
  if (value === "denied") return "Android App 已拒絕";
  if (value === "unknown") return "Android App 尚未確認";
  return `Android App：${value}`;
}

function latestTestResultText(server: WebPushStatus | null) {
  const latestLog = server?.latestPushLog;
  if (!latestLog) return "尚無測試紀錄";
  const time = formatDateTime(latestLog.sentAt ?? latestLog.createdAt);
  if (latestLog.status === "SENT") return `測試成功，時間：${time}`;
  if (latestLog.status === "FAILED") return `測試失敗，時間：${time}`;
  return `${latestLog.status}，時間：${time}`;
}

function StatusCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" | "warning" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "danger"
        ? "border-red-200 bg-red-50"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-slate-50";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-base font-black text-slate-900">{label}</p>
      <p className="mt-1 break-words text-base font-semibold leading-7 text-slate-700">{value}</p>
    </div>
  );
}

async function getRegistration() {
  if (!("serviceWorker" in navigator)) return undefined;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

async function getSubscription(registration: ServiceWorkerRegistration | undefined) {
  if (!registration || !("pushManager" in registration) || !registration.pushManager) return null;
  return registration.pushManager.getSubscription();
}

export function PushStatusPanel() {
  const [status, setStatus] = useState<LocalStatus>(initialStatus);
  const [busyAction, setBusyAction] = useState<"enable" | "disable" | "test" | "refresh" | null>(null);
  const enableInFlightRef = useRef(false);
  const busy = busyAction !== null;

  function androidBridge() {
    return typeof window !== "undefined" ? window.HuangxiangAndroid : undefined;
  }

  async function refresh(showFeedback = false) {
    if (showFeedback) setBusyAction("refresh");

    const ios = isIosDevice();
    const standalone = isStandaloneMode();
    const canServiceWorker = "serviceWorker" in navigator;
    const canNotification = "Notification" in window;
    const canPushManager = "PushManager" in window;
    const nativeBridge = androidBridge();
    const isAndroidApp = Boolean(nativeBridge);
    const device = `${detectBrowser()} / ${detectOs()} / ${navigator.userAgent.includes("Mobile") ? "mobile" : "desktop"}`;

    let endpoint = "";
    let server: WebPushStatus | null = null;
    let permission = canNotification ? permissionText(Notification.permission) : "此瀏覽器不支援通知權限";
    let serviceWorker = canServiceWorker ? "尚未註冊" : "此瀏覽器不支援 Service Worker";
    let pushManager = canPushManager ? "支援" : "不支援";
    let subscriptionText = canPushManager ? "尚未訂閱 Web Push" : "此瀏覽器不支援 PushManager";

    if (isAndroidApp) {
      const nativePermission = nativeBridge?.getNotificationPermissionStatus?.() ?? "unknown";
      const fcmStatus = nativeBridge?.getFcmAvailabilityStatus?.() ?? "unknown";
      permission = androidPermissionText(nativePermission);
      serviceWorker = "Android App 使用原生通知，不需要 Service Worker";
      pushManager = "Android 原生橋接可用";
      subscriptionText = fcmStatus === "configured" ? "Android FCM 可註冊" : "本機通知可用，遠端 FCM 尚未設定";
    } else if (canServiceWorker) {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => undefined);
      serviceWorker = registration?.active ? "已啟用" : registration ? "已註冊但尚未啟用" : "尚未註冊";
      const subscription = canPushManager ? await getSubscription(registration).catch(() => null) : null;
      if (subscription) {
        endpoint = subscription.endpoint;
        subscriptionText = endpoint.includes("web.push.apple.com") ? "已訂閱 Apple Web Push" : "已訂閱 Web Push";
      }
    }

    try {
      const response = await fetch(`/api/web-push/status${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`, { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as { pushAvailable?: boolean } & WebPushStatus;
        server = {
          pushAvailable: Boolean(payload.pushAvailable),
          nativePushConfigured: Boolean((payload as WebPushStatus).nativePushConfigured),
          activeSubscriptionCount: payload.activeSubscriptionCount ?? 0,
          activeNativeTokenCount: (payload as WebPushStatus).activeNativeTokenCount ?? 0,
          needsResubscribe: Boolean((payload as WebPushStatus).needsResubscribe),
          resubscribeReason: (payload as WebPushStatus).resubscribeReason ?? null,
          currentSubscription: payload.currentSubscription ?? null,
          latestSubscription: payload.latestSubscription ?? null,
          latestNativeToken: (payload as WebPushStatus).latestNativeToken ?? null,
          latestPushLog: payload.latestPushLog ?? null
        };
      }
    } catch {
      // Server status is helpful, but local device status should still be visible if it is temporarily unavailable.
    }

    setStatus((current) => ({
      isIos: ios,
      isStandalone: standalone,
      permission,
      serviceWorker,
      pushManager,
      subscription: subscriptionText,
      endpoint,
      device,
      server,
      message: showFeedback ? `已重新檢查：${new Date().toLocaleTimeString("zh-TW")}` : current.message
    }));
    if (showFeedback) setBusyAction(null);
  }

  async function enablePush() {
    if (enableInFlightRef.current) return;
    enableInFlightRef.current = true;
    setBusyAction("enable");
    try {
      const nativeBridge = androidBridge();
      if (nativeBridge?.requestNotificationPermission) {
        let tokenEventReceived = false;
        const onNativePushToken = (event: Event) => {
          tokenEventReceived = true;
          const detail = (event as NativePushTokenEvent).detail;
          if (detail?.status === "registered") {
            setStatus((current) => ({
              ...current,
              message: "Android FCM 裝置 token 已取得並送往伺服器。請重新檢查確認 Android 裝置 Token 數量。"
            }));
            window.setTimeout(() => void refresh(), 800);
            return;
          }
          setStatus((current) => ({
            ...current,
            message:
              detail?.error ||
              "Android App 目前尚未取得 FCM token。若 App 被滑掉、鎖定或未開啟，需要 Firebase FCM 設定與裝置 token 才能收到背景通知。"
          }));
          window.setTimeout(() => void refresh(), 800);
        };

        window.addEventListener("huangxiang:native-push-token", onNativePushToken, { once: true });
        const permission = nativeBridge.requestNotificationPermission();
        nativeBridge.requestFcmToken?.();
        setStatus((current) => ({
          ...current,
          permission: androidPermissionText(permission),
          message: "已呼叫 Android App 通知權限，正在確認 FCM 背景推播 token..."
        }));
        window.setTimeout(() => {
          if (tokenEventReceived) return;
          window.removeEventListener("huangxiang:native-push-token", onNativePushToken);
          setStatus((current) => ({
            ...current,
            message: "尚未收到 Android FCM token 回覆。請確認 APK 是否已放入 google-services.json，並重新開啟 App 後再試。"
          }));
        }, 3000);
        window.setTimeout(() => void refresh(), 1200);
        return;
      }

      const ios = isIosDevice();
      const standalone = isStandaloneMode();
      if (ios && !standalone) {
        setStatus((current) => ({
          ...current,
          message: "請先用 Safari 分享，選擇加入主畫面，再從桌面圖示開啟 JU數位管理，才能啟用 iPhone 推播。"
        }));
        return;
      }

      if (!("serviceWorker" in navigator) || !("Notification" in window) || !("PushManager" in window)) {
        setStatus((current) => ({ ...current, message: "此瀏覽器不支援 Web Push，請改用支援的 Chrome 或 iPhone 主畫面 PWA。" }));
        return;
      }

      const keyResponse = await fetch("/api/web-push/vapid-public-key", { cache: "no-store" });
      if (!keyResponse.ok) throw new Error("伺服器尚未提供 Web Push VAPID public key。");
      const { publicKey } = (await keyResponse.json()) as { publicKey?: string };
      if (!publicKey) throw new Error("伺服器缺少 Web Push VAPID public key。");

      if (Notification.permission === "denied") {
        setStatus((current) => ({
          ...current,
          permission: permissionText(Notification.permission),
          message: IOS_PERMISSION_HELP
        }));
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus((current) => ({
          ...current,
          permission: permissionText(permission),
          message: permission === "denied" ? IOS_PERMISSION_HELP : "尚未允許通知，無法啟用推播提醒。"
        }));
        return;
      }

      const registration = await getRegistration();
      if (!registration) throw new Error("Service Worker 註冊失敗。");
      await registration.update().catch(() => undefined);
      const existing = await getSubscription(registration);
      if (existing) {
        const endpoint = existing.endpoint;
        await existing.unsubscribe().catch(() => undefined);
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint })
        }).catch(() => undefined);
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const response = await fetch("/api/web-push/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...subscription.toJSON(),
          platformHint: ios && standalone ? "ios-pwa" : undefined
        })
      });
      if (!response.ok) throw new Error(`Web Push subscription 儲存失敗：${response.status}`);

      setStatus((current) => ({ ...current, message: "推播已重新訂閱成功。請按測試通知，確認手機或瀏覽器是否跳出提醒。" }));
      await refresh();
    } catch (error) {
      setStatus((current) => ({ ...current, message: error instanceof Error ? humanPushError(error.message) : "啟用推播失敗，請稍後再試。" }));
    } finally {
      enableInFlightRef.current = false;
      setBusyAction(null);
    }
  }

  async function disablePush() {
    setBusyAction("disable");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => undefined);
      const subscription = await getSubscription(registration);
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint })
      });
      setStatus((current) => ({ ...current, message: "已關閉 Web Push。" }));
      await refresh();
    } catch (error) {
      setStatus((current) => ({ ...current, message: error instanceof Error ? error.message : "關閉推播失敗。" }));
    } finally {
      setBusyAction(null);
    }
  }

  async function sendTestNotification() {
    setBusyAction("test");
    try {
      const nativeBridge = androidBridge();
      if (nativeBridge?.showTestNotification) {
        nativeBridge.showTestNotification("JU數位管理測試通知", "Android App 本機通知測試成功，請確認通知列、聲音或震動。");
        setStatus((current) => ({
          ...current,
          message: "已送出 Android App 本機測試通知。這只代表 App 內本機通知可用；App 關閉或鎖定背景推播仍需要 Firebase FCM。"
        }));
        window.setTimeout(() => void refresh(), 1200);
        return;
      }

      if (!canSendTestNotification) {
        setStatus((current) => ({ ...current, message: webPushTestDisabledReason || "請先完成推播訂閱後再測試。" }));
        return;
      }

      const response = await fetch("/api/web-push/test", { method: "POST", headers: { accept: "application/json" } });
      const payload = (await response.json().catch(() => null)) as WebPushTestPayload | null;
      if (!response.ok) {
        const message = payload?.message || payload?.error || `測試推播失敗：${response.status}`;
        if (response.status === 409 && payload?.needsResubscribe) {
          setStatus((current) => ({ ...current, message: humanPushError(message) }));
          window.setTimeout(() => void refresh(), 1000);
          return;
        }
        throw new Error(message);
      }
      const sent = payload?.result?.sent ?? 0;
      const failed = payload?.result?.failed ?? 0;
      setStatus((current) => ({
        ...current,
        message:
          payload?.message ??
          (sent > 0
            ? `測試送出：成功 ${sent} 筆，失敗 ${failed} 筆。請確認手機或瀏覽器通知中心。`
            : `測試失敗：${humanPushError(payload?.result?.reason ?? "請確認目前是否有 active subscription。")}`)
      }));
      window.setTimeout(() => void refresh(), 1500);
    } catch (error) {
      setStatus((current) => ({ ...current, message: error instanceof Error ? humanPushError(error.message) : "測試通知失敗。" }));
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latest = status.server?.currentSubscription ?? status.server?.latestSubscription ?? null;
  const latestTestStatus = status.server?.latestPushLog?.status;
  const latestTestTone = latestTestStatus === "SENT" ? "success" : latestTestStatus === "FAILED" ? "danger" : "warning";
  const isAndroidApp = typeof window !== "undefined" && Boolean(window.HuangxiangAndroid);
  const notificationDenied = typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied";
  const notificationGranted = isAndroidApp || (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted");
  const canEnable =
    isAndroidApp ||
    (typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window);
  const hasActiveSubscription = isAndroidApp || Boolean(latest?.isActive || status.endpoint);
  const hasServerActiveSubscription =
    isAndroidApp || Boolean(status.endpoint && status.server?.currentSubscription?.isActive);
  const needsResubscribe =
    Boolean(status.server?.needsResubscribe) || containsBadJwtToken(status.server?.currentSubscription?.lastFailureReason);
  const pushReady = notificationGranted && hasServerActiveSubscription && !needsResubscribe;
  const enableButtonText =
    busyAction === "enable" ? "啟用中..." : pushReady ? "推播已開啟" : needsResubscribe || notificationDenied ? "重新訂閱推播" : "開啟推播";
  const webPushTestDisabledReason = testDisabledReason({
    isAndroidApp,
    canEnable,
    notificationGranted,
    isIos: status.isIos,
    needsResubscribe,
    hasServerActiveSubscription
  });
  const canSendTestNotification = isAndroidApp || !webPushTestDisabledReason;

  return (
    <div className="grid gap-4">
      {status.isIos && !status.isStandalone ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base font-bold leading-7 text-amber-950">
          iPhone 推播需要從主畫面 PWA 開啟。請用 Safari 分享，選擇加入主畫面，再從桌面圖示開啟 JU數位管理。
        </div>
      ) : null}

      {needsResubscribe ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base font-bold leading-7 text-amber-950">
          {resubscribeReasonText(status.server?.resubscribeReason)}請按「重新訂閱推播」更新這台裝置的推播設定。
        </div>
      ) : null}

      {notificationDenied ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-base font-bold leading-7 text-red-950">
          {IOS_PERMISSION_HELP}
        </div>
      ) : null}

      {!canEnable ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold leading-7 text-slate-700">
          目前瀏覽器不支援 Web Push 或 Service Worker，無法在此裝置啟用推播。
        </div>
      ) : null}

      {!isAndroidApp && webPushTestDisabledReason ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base font-bold leading-7 text-amber-950">
          {webPushTestDisabledReason}
        </div>
      ) : null}

      {isAndroidApp ? (
        <div
          className={`rounded-lg border px-4 py-3 text-base font-bold leading-7 ${
            status.server?.nativePushConfigured && (status.server?.activeNativeTokenCount ?? 0) > 0
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {status.server?.nativePushConfigured && (status.server?.activeNativeTokenCount ?? 0) > 0
            ? "Android App 已具備原生背景推播通道。鎖定畫面與 App 關閉通知可用。"
            : "Android App 目前只有本機通知測試可用；App 被滑掉、鎖定或未開啟時，需要 Firebase FCM 設定與裝置 token 才能穩定收到背景通知。"}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <StatusCard label="目前裝置" value={status.device} />
        <StatusCard label="iPhone PWA 狀態" value={status.isIos ? (status.isStandalone ? "是，已從主畫面開啟" : "否，仍在 Safari 分頁") : "非 iPhone 裝置"} />
        <StatusCard label="通知權限" value={status.permission} />
        <StatusCard label="Service Worker（背景服務）" value={status.serviceWorker} />
        <StatusCard label="PushManager（推播訂閱能力）" value={status.pushManager} />
        <StatusCard label="推播訂閱" value={status.subscription} />
        <StatusCard label="伺服器 Web Push" value={status.server?.pushAvailable ? "可使用，VAPID 已設定" : "不可使用，請檢查 VAPID 設定"} />
        <StatusCard label="Active Subscription 數量" value={String(status.server?.activeSubscriptionCount ?? 0)} />
        <StatusCard label="Android FCM 後端" value={status.server?.nativePushConfigured ? "已設定，可發送原生遠端推播" : "尚未設定 Firebase，App 關閉背景通知不可用"} tone={status.server?.nativePushConfigured ? "success" : "warning"} />
        <StatusCard label="Android 裝置 Token" value={`${status.server?.activeNativeTokenCount ?? 0} 台已註冊`} tone={(status.server?.activeNativeTokenCount ?? 0) > 0 ? "success" : "warning"} />
        <StatusCard label="目前平台" value={latest?.platform ?? "尚無紀錄"} />
        <StatusCard label="Endpoint 網域" value={latest?.endpointHost ?? "尚無紀錄"} />
        <StatusCard label="最後看見裝置" value={formatDateTime(latest?.lastSeenAt)} />
        <StatusCard label="最後測試結果" value={latestTestResultText(status.server)} tone={latestTestTone} />
        <StatusCard label="最後推播成功" value={formatDateTime(latest?.lastSuccessAt)} />
        <StatusCard label="最後推播失敗" value={formatDateTime(latest?.lastFailureAt)} />
        <StatusCard label="最後失敗原因" value={humanPushError(latest?.lastFailureReason ?? status.server?.latestPushLog?.errorMessage)} />
      </div>

      {status.message ? <p className="rounded-md bg-brand-50 px-4 py-3 text-base font-semibold text-brand-800">{status.message}</p> : null}

      <div className="grid gap-2 sm:grid-cols-4">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-700 px-4 text-base font-bold text-white transition hover:bg-brand-800 active:scale-[0.98] disabled:opacity-50"
          type="button"
          onClick={enablePush}
          disabled={busy || !canEnable || pushReady}
        >
          <Bell className={`h-5 w-5 ${busyAction === "enable" ? "animate-pulse" : ""}`} />
          {enableButtonText}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-base font-bold text-red-700 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
          type="button"
          onClick={disablePush}
          disabled={busy || isAndroidApp || !hasActiveSubscription}
        >
          <BellOff className={`h-5 w-5 ${busyAction === "disable" ? "animate-pulse" : ""}`} />
          {busyAction === "disable" ? "關閉中..." : isAndroidApp ? "請到系統設定關閉" : "關閉推播"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 text-base font-bold text-amber-800 transition hover:bg-amber-100 active:scale-[0.98] disabled:opacity-50"
          type="button"
          onClick={sendTestNotification}
          disabled={busy || !canSendTestNotification}
        >
          <BellRing className={`h-5 w-5 ${busyAction === "test" ? "animate-pulse" : ""}`} />
          {busyAction === "test" ? "送出中..." : isAndroidApp ? "測試通知" : "送出測試推播"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-bold text-slate-800 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
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
