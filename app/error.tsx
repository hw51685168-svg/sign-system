"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportClientError } from "@/components/error-capture-client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError({
      title: "Next.js route error",
      message: error.message,
      module: "next_route",
      action: "app/error.tsx",
      stackTrace: error.stack,
      severity: "P1",
      context: { digest: error.digest }
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-soft">
        <p className="text-sm font-bold text-red-700">系統錯誤已自動回報</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">這個頁面暫時無法正常顯示</h1>
        <p className="mt-2 text-base leading-7 text-slate-700">
          系統已將錯誤送到 Error Command Center（錯誤指揮中心）。你可以重新整理，或回到首頁繼續測試。
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="min-h-11 rounded-md bg-brand-700 px-4 font-bold text-white" onClick={reset}>
            再試一次
          </button>
          <Link className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 font-bold text-slate-800" href="/">
            回首頁
          </Link>
        </div>
      </section>
    </main>
  );
}
