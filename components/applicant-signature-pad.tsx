"use client";

import { useEffect, useRef, useState } from "react";

export function ApplicantSignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);

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
    if (hiddenInputRef.current) hiddenInputRef.current.value = "";
  }

  useEffect(() => {
    const input = hiddenInputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const signatureInput = input;

    function handleSubmit(event: SubmitEvent) {
      const canvas = canvasRef.current;
      if (!canvas || !hasStroke) {
        event.preventDefault();
        window.alert("送出簽呈前，請先完成申請人手寫簽名。");
        canvas?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      signatureInput.value = canvas.toDataURL("image/png");
    }

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [hasStroke]);

  return (
    <div className="grid gap-3">
      <input ref={hiddenInputRef} type="hidden" name="applicantSignatureDataUrl" />
      <canvas
        ref={canvasRef}
        width={720}
        height={260}
        aria-label="申請人手寫簽名區"
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
      </div>
      <p className="text-base font-semibold text-slate-600">送出前需由申請人簽名，簽名會與此簽呈內容一起保存。</p>
    </div>
  );
}
