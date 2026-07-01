"use client";

import { useRef, useState } from "react";

export function SignaturePad({ approvalId }: { approvalId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d");
    const p = point(event);
    if (!ctx) return;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setDrawing(true);
    setHasStroke(true);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = point(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function end() {
    setDrawing(false);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  async function submit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasStroke) {
      window.alert("請先在簽名區完成手寫簽名。");
      return;
    }
    setSubmitting(true);
    const signatureDataUrl = canvas.toDataURL("image/png");
    const response = await fetch(`/api/approvals/${approvalId}/signature`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signatureDataUrl })
    });
    if (response.ok) {
      window.location.href = response.url || `/approvals/${approvalId}?signature=1`;
      return;
    }
    const error = await response.json().catch(() => ({ error: "簽名儲存失敗，請重新簽名後再送出。" }));
    window.alert(error.error || "簽名儲存失敗，請重新簽名後再送出。");
    setSubmitting(false);
  }

  return (
    <div className="grid gap-3">
      <canvas
        ref={canvasRef}
        width={720}
        height={260}
        aria-label="電子手寫簽名區"
        className="h-56 w-full touch-none rounded-lg border-2 border-slate-300 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
      />
      <div className="flex flex-wrap gap-2">
        <button className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-base font-bold text-slate-800" type="button" onClick={clear}>
          清除重簽
        </button>
        <button
          className="min-h-12 rounded-md bg-brand-700 px-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={submit}
          disabled={submitting || !hasStroke}
        >
          {submitting ? "儲存中，請稍候" : "儲存手寫簽名"}
        </button>
      </div>
      <p className="text-base font-semibold text-slate-600">電腦可用滑鼠簽名，手機可用手指簽名。簽名儲存後會與此簽呈綁定，不可任意修改。</p>
    </div>
  );
}
