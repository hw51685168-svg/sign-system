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

function isMobileLike() {
  const userAgent = navigator.userAgent.toLowerCase();
  const userAgentMobile = /android|iphone|ipad|ipod|mobile/.test(userAgent);
  const narrowScreen = window.matchMedia("(max-width: 768px)").matches;
  const touchPrimary = window.matchMedia("(pointer: coarse)").matches;
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return standalone || userAgentMobile || (narrowScreen && touchPrimary);
}

export function NavigationStateRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastHiddenAt = useRef<number | null>(null);
  const lastRefreshKey = useRef("");
  const lastRefreshAt = useRef(0);
  const lastRouteRefreshKey = useRef("");

  useEffect(() => {
    const routeKey = `${pathname}?${searchParams.toString()}`;
    lastRefreshKey.current = routeKey;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!shouldRefresh(pathname)) return;

    const routeKey = `${pathname}?${searchParams.toString()}`;
    if (lastRouteRefreshKey.current === routeKey) return;
    lastRouteRefreshKey.current = routeKey;

    const timeout = window.setTimeout(() => {
      router.refresh();
    }, 80);

    return () => window.clearTimeout(timeout);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!shouldRefresh(pathname)) return;

    function refreshOnce(reason: string) {
      const now = Date.now();
      if (now - lastRefreshAt.current < 800) return;
      lastRefreshAt.current = now;
      const routeKey = `${pathname}?${searchParams.toString()}:${reason}`;
      if (lastRefreshKey.current === routeKey) return;
      lastRefreshKey.current = routeKey;
      router.refresh();
    }

    function refreshMobileForeground(reason: string) {
      if (!isMobileLike()) return;
      refreshOnce(reason);
    }

    function handlePageShow(event: PageTransitionEvent) {
      const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (event.persisted || navigationEntry?.type === "back_forward") {
        refreshOnce("pageshow");
        return;
      }
      refreshMobileForeground("mobile-pageshow");
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        lastHiddenAt.current = Date.now();
        return;
      }

      if (document.visibilityState === "visible" && lastHiddenAt.current && isMobileLike()) {
        refreshOnce("mobile-visible");
        return;
      }

      if (document.visibilityState === "visible" && lastHiddenAt.current && Date.now() - lastHiddenAt.current > 1500) {
        refreshOnce("visible");
      }
    }

    function handleFocus() {
      if (lastHiddenAt.current) refreshMobileForeground("mobile-focus");
    }

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, router, searchParams]);

  return null;
}
