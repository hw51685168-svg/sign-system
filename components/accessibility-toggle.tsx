"use client";

import { useEffect, useState } from "react";

export function AccessibilityToggle() {
  const [largeText, setLargeText] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const savedLargeText = localStorage.getItem("hx-large-text") === "true";
    const savedHighContrast = localStorage.getItem("hx-high-contrast") === "true";
    setLargeText(savedLargeText);
    setHighContrast(savedHighContrast);
    document.documentElement.classList.toggle("large-text", savedLargeText);
    document.documentElement.classList.toggle("high-contrast", savedHighContrast);
  }, []);

  function toggleLargeText() {
    const next = !largeText;
    setLargeText(next);
    localStorage.setItem("hx-large-text", String(next));
    document.documentElement.classList.toggle("large-text", next);
  }

  function toggleHighContrast() {
    const next = !highContrast;
    setHighContrast(next);
    localStorage.setItem("hx-high-contrast", String(next));
    document.documentElement.classList.toggle("high-contrast", next);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className="hidden min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50 sm:inline-flex sm:items-center"
        type="button"
        onClick={toggleLargeText}
        aria-pressed={largeText}
      >
        大字體
      </button>
      <button
        className="hidden min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50 sm:inline-flex sm:items-center"
        type="button"
        onClick={toggleHighContrast}
        aria-pressed={highContrast}
      >
        高對比
      </button>
    </div>
  );
}
