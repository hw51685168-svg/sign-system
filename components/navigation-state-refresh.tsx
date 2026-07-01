"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const refreshablePrefixes = [
  "/",
  "/approvals",
  "/gm/tasks",
  "/notifications",
  "/account",
  "/settings/notifications",
  "/tasks",
  "/issues",
  "/services"
];

function shouldRefresh(pathname: string) {
  if (pathname === "/login") return false;
  return refreshablePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function NavigationStateRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastHiddenAt = useRef<number | null>(null);
  const lastRefreshKey = useRef("");

  useEffect(() => {
    const routeKey = `${pathname}?${searchParams.toString()}`;
    lastRefreshKey.current = routeKey;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!shouldRefresh(pathname)) return;

    function refreshOnce(reason: string) {
      const routeKey = `${pathname}?${searchParams.toString()}:${reason}`;
      if (lastRefreshKey.current === routeKey) return;
      lastRefreshKey.current = routeKey;
      router.refresh();
    }

    function handlePageShow(event: PageTransitionEvent) {
      const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (event.persisted || navigationEntry?.type === "back_forward") {
        refreshOnce("pageshow");
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        lastHiddenAt.current = Date.now();
        return;
      }

      if (document.visibilityState === "visible" && lastHiddenAt.current && Date.now() - lastHiddenAt.current > 1500) {
        refreshOnce("visible");
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, router, searchParams]);

  return null;
}
