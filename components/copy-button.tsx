"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyButton({ text, label = "複製給 Codex" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? "已複製" : label}
    </Button>
  );
}
