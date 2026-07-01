"use client";

import React from "react";
import { reportClientError } from "@/components/error-capture-client";

type State = { hasError: boolean; message: string };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportClientError({
      title: "React Error Boundary",
      message: error.message,
      module: "react",
      action: "componentDidCatch",
      stackTrace: `${error.stack || ""}\n${errorInfo.componentStack || ""}`,
      severity: "P1"
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <section className="max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-soft">
            <p className="text-sm font-bold text-red-700">系統偵測到畫面錯誤</p>
            <h1 className="mt-2 text-2xl font-black text-slate-950">請重新整理或回到首頁</h1>
            <p className="mt-2 text-base leading-7 text-slate-700">
              系統已自動建立錯誤回報，管理員可以在 Error Command Center（錯誤指揮中心）查看。
            </p>
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{this.state.message}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="min-h-11 rounded-md bg-brand-700 px-4 font-bold text-white" onClick={() => window.location.reload()}>
                重新整理
              </button>
              <a className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 font-bold text-slate-800" href="/">
                回首頁
              </a>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
