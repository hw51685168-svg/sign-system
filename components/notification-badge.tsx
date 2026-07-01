"use client";

import { useEffect, useState } from "react";

type NotificationBadgeProps = {
  initialCount: number;
  variant?: "number" | "dot";
};

async function fetchUnreadCount() {
  const response = await fetch("/api/notifications/recent", { cache: "no-store" });
  if (!response.ok) return null;
  const payload = (await response.json()) as { unreadCount?: number };
  return Number(payload.unreadCount ?? 0);
}

export function NotificationBadge({ initialCount, variant = "number" }: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        const nextCount = await fetchUnreadCount();
        if (alive && nextCount !== null) setCount(nextCount);
      } catch {
        // Keep the last known count; notification polling is best effort.
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  if (count <= 0) return null;

  if (variant === "dot") {
    return <span className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" aria-label={`${count} 則未讀通知`} />;
  }

  return (
    <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white ring-2 ring-white" aria-label={`${count} 則未讀通知`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}
