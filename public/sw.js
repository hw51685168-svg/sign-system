const CACHE_NAME = "ju-digital-management-v14";
const APP_SHELL = ["/manifest.webmanifest", "/app-icon-192.png", "/app-icon-512.png"];
const FALLBACK_TITLE = "JU數位管理通知";
const FALLBACK_BODY = "你有一筆待處理項目，請進入 JU數位管理查看。";
const OFFLINE_HTML = `<!doctype html>
<html lang="zh-Hant">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>JU數位管理暫時無法連線</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f8f7; color: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(520px, calc(100vw - 32px)); border: 1px solid #dce7df; border-radius: 16px; background: white; padding: 28px; box-shadow: 0 16px 45px rgba(15, 23, 42, 0.1); }
      img { width: 72px; height: 72px; border-radius: 18px; }
      h1 { margin: 18px 0 8px; font-size: 28px; }
      p { margin: 8px 0; font-size: 17px; line-height: 1.7; color: #475569; }
      button { margin-top: 18px; width: 100%; border: 0; border-radius: 12px; background: #17633c; color: white; padding: 14px 18px; font-size: 18px; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <img src="/app-icon-192.png" alt="JU數位管理" />
      <h1>JU數位管理暫時無法連線</h1>
      <p>目前網路或伺服器暫時無法連線，請確認網路後重新整理。</p>
      <p>如果你正在使用手機 App，請稍後重新開啟 JU數位管理。</p>
      <button onclick="location.reload()">重新載入</button>
    </main>
  </body>
</html>`;

async function broadcastSwError(action, error) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({
      type: "SW_ERROR",
      action,
      message: error && error.message ? error.message : String(error || "Service Worker error")
    });
  }
}

function safeText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const questionCount = (trimmed.match(/\?/g) || []).length;
  const looksGarbled =
    questionCount >= Math.max(3, Math.floor(trimmed.length / 3)) ||
    trimmed.includes("\uFFFD") ||
    /[\u747C\u64A0\u875F\u929D\u7507\u5697]/.test(trimmed);
  return trimmed && !looksGarbled ? trimmed : fallback;
}

function normalizeUrl(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/notifications";
  return value;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && ["image", "font"].includes(event.request.destination)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch((error) => {
        broadcastSwError("fetch", error);
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate" || event.request.destination === "document") {
            return new Response(OFFLINE_HTML, {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" }
            });
          }
          if (event.request.destination === "image") return caches.match("/app-icon-192.png");
          if (event.request.destination === "manifest") return caches.match("/manifest.webmanifest");
          return new Response("", { status: 503, statusText: "Service unavailable" });
        });
      })
  );
});

self.addEventListener("push", (event) => {
  const fallbackPayload = {
    title: FALLBACK_TITLE,
    body: FALLBACK_BODY,
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    priority: "MEDIUM",
    tag: `ju-digital-management-${Date.now()}`,
    data: { url: "/notifications" }
  };

  let payload = fallbackPayload;
  if (event.data) {
    try {
      payload = { ...fallbackPayload, ...event.data.json() };
    } catch (error) {
      broadcastSwError("push-parse", error);
      payload = { ...fallbackPayload, body: FALLBACK_BODY };
    }
  }

  const title = safeText(payload.title, fallbackPayload.title);
  const body = safeText(payload.body, fallbackPayload.body);
  const targetUrl = normalizeUrl(payload.data?.url || payload.targetUrl);
  const isUrgent = payload.priority === "URGENT" || payload.priority === "HIGH" || title.includes("P0");
  const isApplePush = payload.data?.platform === "ios-pwa";
  const notificationOptions = {
    body,
    icon: payload.icon || "/app-icon-192.png",
    badge: payload.badge || "/app-icon-192.png",
    data: {
      ...(payload.data || {}),
      url: targetUrl
    },
    tag: payload.tag || payload.data?.dedupeKey || `ju-digital-management-${Date.now()}`,
    renotify: Boolean(payload.tag || payload.data?.dedupeKey),
    silent: false,
    timestamp: payload.timestamp || Date.now()
  };

  if (!isApplePush) {
    notificationOptions.requireInteraction = isUrgent;
    notificationOptions.vibrate = isUrgent ? [300, 120, 300, 120, 450] : [220, 100, 220];
    notificationOptions.actions = [{ action: "open", title: "開啟" }];
  }

  event.waitUntil(self.registration.showNotification(title, notificationOptions));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = normalizeUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
