"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.update().catch(() => undefined))
        .catch(() => undefined);
    }

    const dismissed = localStorage.getItem("hx-pwa-install-dismissed") === "true";
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      if (!dismissed && !isStandalone) {
        setInstallEvent(event as BeforeInstallPromptEvent);
        setIsVisible(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!isVisible || !installEvent) return null;

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setIsVisible(false);
      setInstallEvent(null);
    }
  }

  function dismiss() {
    localStorage.setItem("hx-pwa-install-dismissed", "true");
    setIsVisible(false);
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 rounded-lg border border-brand-200 bg-white p-3 shadow-soft md:bottom-3 md:inset-x-auto md:right-5 md:w-96">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-700 text-white">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-950">安裝成手機 APP</p>
          <p className="mt-1 text-sm text-slate-600">安裝後可從手機桌面開啟，登入狀態也會保留較久。</p>
          <div className="mt-3 flex gap-2">
            <button className="rounded-md bg-brand-700 px-3 py-2 text-sm font-semibold text-white" type="button" onClick={installApp}>
              安裝
            </button>
            <button className="rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={dismiss}>
              稍後
            </button>
          </div>
        </div>
        <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" type="button" aria-label="關閉安裝提示" onClick={dismiss}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
