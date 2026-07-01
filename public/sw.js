const CACHE_NAME = "huangxiang-approval-v3";
const APP_SHELL = ["/manifest.webmanifest", "/app-icon.svg"];

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
        if (response.ok && ["style", "script", "image", "font"].includes(event.request.destination)) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch((error) => {
        broadcastSwError("fetch", error);
        return caches.match(event.request).then((cached) => cached || caches.match("/app-icon.svg"));
      })
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "皇享企業通知",
    body: "你有新的系統通知。",
    icon: "/app-icon.svg",
    badge: "/app-icon.svg",
    priority: "MEDIUM",
    data: { url: "/notifications" }
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch (error) {
      broadcastSwError("push-parse", error);
      payload.body = event.data.text();
    }
  }

  const isUrgent = payload.priority === "URGENT" || payload.title.includes("P0") || payload.title.includes("緊急");

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/app-icon.svg",
      badge: payload.badge || "/app-icon.svg",
      data: payload.data || { url: "/notifications" },
      tag: payload.tag || payload.data?.dedupeKey || "huangxiang-notification",
      renotify: true,
      requireInteraction: isUrgent,
      silent: false,
      timestamp: payload.timestamp || Date.now(),
      vibrate: isUrgent ? [250, 120, 250, 120, 350] : [180, 80, 180],
      actions: [
        { action: "open", title: "查看" }
      ]
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
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
