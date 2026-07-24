"use client";

import { useEffect } from "react";

export function AccessibilityToggle() {
  useEffect(() => {
    const savedLargeText = localStorage.getItem("hx-large-text") === "true";
    const savedHighContrast = localStorage.getItem("hx-high-contrast") === "true";
    document.documentElement.classList.toggle("large-text", savedLargeText);
    document.documentElement.classList.toggle("high-contrast", savedHighContrast);
  }, []);

  return null;
}
