"use client";

import { ArrowLeft, X } from "lucide-react";

export function PdfReturnActions({ fallbackHref }: { fallbackHref: string }) {
  function closeOrReturn() {
    if (window.opener) {
      window.close();
      window.setTimeout(() => {
        window.location.href = fallbackHref;
      }, 250);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.href = fallbackHref;
  }

  return (
    <button
      type="button"
      onClick={closeOrReturn}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-base font-black text-white shadow-sm transition duration-150 ease-out hover:-translate-y-0.5 hover:bg-brand-800 active:translate-y-px"
    >
      <X className="h-5 w-5" />
      結束返回
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}
