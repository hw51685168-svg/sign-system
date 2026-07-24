"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Breadcrumb = {
  timestamp: string;
  type: string;
  label: string;
  route?: string;
  metadata?: Record<string, unknown>;
};

type ClientErrorSeverity = "P0" | "P1" | "P2" | "P3";

const MAX_BREADCRUMBS = 25;
const BREADCRUMB_KEY = "huangxiang_error_breadcrumbs";
const SESSION_KEY = "huangxiang_error_session_id";
const TRANSIENT_FETCH_ENDPOINTS = ["/api/notifications/recent", "/api/push/status", "/api/auth/session"];

function getSessionId() {
  if (typeof window === "undefined") return "";
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

function readBreadcrumbs(): Breadcrumb[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(BREADCRUMB_KEY) || "[]") as Breadcrumb[];
  } catch {
    return [];
  }
}

export function addErrorBreadcrumb(type: string, label: string, metadata?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const breadcrumbs = readBreadcrumbs();
  breadcrumbs.push({
    timestamp: new Date().toISOString(),
    type,
    label: label.slice(0, 240),
    route: window.location.pathname,
    metadata
  });
  window.sessionStorage.setItem(BREADCRUMB_KEY, JSON.stringify(breadcrumbs.slice(-MAX_BREADCRUMBS)));
}

function detectDevice() {
  const ua = navigator.userAgent;
  if (/iPhone|Android.+Mobile/.test(ua)) return "手機";
  if (/iPad|Tablet/.test(ua)) return "平板";
  return "電腦";
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return "未知瀏覽器";
}

function detectOs() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  return "未知系統";
}

function isTransientFetchFailure(url: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const name = error instanceof Error ? error.name : "";
  const normalizedMessage = message.toLowerCase();
  const isTransientMessage =
    name === "AbortError" ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("cancelled");
  return isTransientMessage && TRANSIENT_FETCH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

function severityForApiStatus(url: string, status: number): ClientErrorSeverity {
  if (TRANSIENT_FETCH_ENDPOINTS.some((endpoint) => url.includes(endpoint))) return "P3";
  if (status >= 500) return "P1";
  return "P2";
}

export async function reportClientError(input: {
  title?: string;
  message: string;
  module?: string;
  action?: string;
  stackTrace?: string;
  severity?: ClientErrorSeverity;
  statusCode?: number;
  context?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;
  const payload = {
    ...input,
    module: input.module || "client",
    route: window.location.pathname,
    userAgent: navigator.userAgent,
    deviceType: detectDevice(),
    browser: detectBrowser(),
    os: detectOs(),
    sessionId: getSessionId(),
    breadcrumbs: readBreadcrumbs(),
    context: {
      online: navigator.onLine,
      notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
      serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      ...input.context
    }
  };

  try {
    await fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {
    // Reporting must never interrupt the user workflow.
  }
}

export function ErrorCaptureClient() {
  const pathname = usePathname();

  useEffect(() => {
    addErrorBreadcrumb("route", `進入頁面 ${pathname}`);
  }, [pathname]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientError({
        title: "JavaScript error",
        message: event.message || "未知 JavaScript 錯誤",
        module: "client",
        action: "window.onerror",
        stackTrace: event.error?.stack,
        severity: "P1",
        context: { filename: event.filename, lineno: event.lineno, colno: event.colno }
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Unhandled promise rejection"));
      if (reason.message.includes("pushManager") || reason.message.includes("getSubscription")) {
        reportClientError({
          title: "Push support check failed",
          message: reason.message,
          module: "pwa",
          action: "window.onunhandledrejection",
          stackTrace: reason.stack,
          severity: "P3"
        });
        return;
      }
      reportClientError({
        title: "Unhandled promise rejection",
        message: reason.message,
        module: "client",
        action: "window.onunhandledrejection",
        stackTrace: reason.stack,
        severity: "P1"
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button,a,[role='button']") : null;
      if (!target) return;
      const label = (target.textContent || target.getAttribute("aria-label") || target.getAttribute("href") || "未命名操作").trim();
      addErrorBreadcrumb("click", label, {
        tag: target.tagName,
        href: target.getAttribute("href")
      });
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      addErrorBreadcrumb("submit", form?.getAttribute("action") || "表單送出", {
        method: form?.method,
        action: form?.getAttribute("action")
      });
    };

    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "SW_ERROR") return;
      reportClientError({
        title: "Service Worker error",
        message: String(event.data.message || "Service Worker 錯誤"),
        module: "pwa",
        action: String(event.data.action || "service-worker"),
        severity: "P1",
        context: event.data
      });
    };

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      try {
        const response = await originalFetch(input, init);
        if (url.includes("/api/") && response.status >= 500 && !url.includes("/api/errors/report")) {
          const severity = severityForApiStatus(url, response.status);
          reportClientError({
            title: `API ${response.status} error`,
            message: `API 回應 ${response.status}`,
            module: "api",
            action: `${init?.method || "GET"} ${url}`,
            severity,
            statusCode: response.status,
            context: { url, status: response.status, transient: severity === "P3" }
          });
        }
        return response;
      } catch (error) {
        if (!url.includes("/api/errors/report") && !isTransientFetchFailure(url, error)) {
          reportClientError({
            title: "Fetch failed",
            message: error instanceof Error ? error.message : "網路請求失敗",
            module: "api",
            action: `${init?.method || "GET"} ${url}`,
            stackTrace: error instanceof Error ? error.stack : undefined,
            severity: "P1",
            context: { url }
          });
        }
        throw error;
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    return () => {
      window.fetch = originalFetch;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
    };
  }, []);

  return null;
}
