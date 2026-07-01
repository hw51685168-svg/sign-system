"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, RotateCcw, Send, Square, Trash2 } from "lucide-react";

const maxSeconds = 120;
const maxBytes = 10 * 1024 * 1024;
const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/mpeg"];

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

function supportedMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function VoiceRecorder({ conversationId }: { conversationId: string }) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "paused" | "preview" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [manualSummary, setManualSummary] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function startTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setSeconds((current) => {
        if (current + 1 >= maxSeconds) {
          stopRecording("語音已達 120 秒上限，已自動停止");
          return maxSeconds;
        }
        return current + 1;
      });
    }, 1000);
  }

  async function startRecording() {
    setError("");
    if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      setError("目前不是 HTTPS 安全連線，瀏覽器可能禁止錄音。請改用固定 HTTPS 網址後再試。");
      return;
    }
    if (!("mediaDevices" in navigator) || typeof MediaRecorder === "undefined") {
      setError("目前瀏覽器不支援錄音，請改用 Chrome、Safari 或手機 PWA 測試");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = supportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recording = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        if (recording.size > maxBytes) {
          setError("語音檔案超過 10MB 上限，請重新錄短一點。");
          resetRecording();
          return;
        }
        const url = URL.createObjectURL(recording);
        setBlob(recording);
        setAudioUrl(url);
        setStatus("preview");
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      recorderRef.current = recorder;
      setSeconds(0);
      recorder.start();
      setStatus("recording");
      startTimer();
    } catch (reason) {
      const message = reason instanceof DOMException && reason.name === "NotAllowedError"
        ? "請允許麥克風權限後再錄音"
        : reason instanceof DOMException && reason.name === "NotFoundError"
          ? "找不到麥克風裝置"
          : "錄音失敗，請確認麥克風權限與裝置。";
      setError(message);
    }
  }

  function pauseRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      if (timerRef.current) window.clearInterval(timerRef.current);
      setStatus("paused");
    }
  }

  function resumeRecording() {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      startTimer();
      setStatus("recording");
    }
  }

  function stopRecording(message?: string) {
    if (message) setError(message);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  function resetRecording() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setStatus("idle");
    setSeconds(0);
    setBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  }

  async function submitVoice() {
    if (!blob) {
      setError("請先錄音並預聽後再送出。");
      return;
    }
    setStatus("uploading");
    setError("");
    try {
      const formData = new FormData();
      const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("mpeg") ? "mp3" : "webm";
      formData.append("voice", new File([blob], `voice-message.${extension}`, { type: blob.type || "audio/webm" }));
      formData.append("durationSeconds", String(seconds || 1));
      formData.append("manualSummary", manualSummary);
      formData.append("waveformPeaks", JSON.stringify([20, 48, 32, 64, 42, 70, 30, 54, 38, 62]));
      const response = await fetch(`/api/chat/conversations/${conversationId}/voice`, { method: "POST", body: formData });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "上傳失敗，請重新送出");
      }
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "網路中斷，語音暫存在本機，請恢復網路後重新送出。請不要離開此頁面。");
      setStatus("preview");
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border border-brand-100 bg-brand-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-black text-slate-950">Voice Message（語音留言）</p>
          <p className="text-base text-slate-700">最長 120 秒，送出前必須先預聽確認。</p>
        </div>
        <p className="rounded-md bg-white px-4 py-2 text-2xl font-black text-brand-800">
          {status === "recording" ? `錄音中 ${formatTime(seconds)}` : status === "paused" ? `已暫停 ${formatTime(seconds)}` : formatTime(seconds)}
        </p>
      </div>

      {status === "idle" ? (
        <button className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-brand-700 px-5 text-xl font-black text-white" type="button" onClick={startRecording}>
          <Mic className="h-6 w-6" />
          錄音
        </button>
      ) : null}

      {status === "recording" || status === "paused" ? (
        <div className="grid gap-3">
          <div className="flex h-12 items-end gap-1 rounded-md bg-white p-2" aria-label="簡易音量波形">
            {[30, 62, 44, 78, 38, 70, 52, 86, 45, 64, 36, 76].map((height, index) => (
              <span key={index} className="flex-1 rounded bg-brand-600 transition-all" style={{ height: `${status === "paused" ? 20 : height}%` }} />
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {status === "recording" ? (
              <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-bold text-slate-800" type="button" onClick={pauseRecording}>
                <Pause className="h-5 w-5" />
                暫停
              </button>
            ) : (
              <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-700 px-4 text-base font-bold text-white" type="button" onClick={resumeRecording}>
                <Play className="h-5 w-5" />
                繼續
              </button>
            )}
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-800 px-4 text-base font-bold text-white" type="button" onClick={() => stopRecording()}>
              <Square className="h-5 w-5" />
              停止
            </button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-base font-bold text-red-700" type="button" onClick={resetRecording}>
              <Trash2 className="h-5 w-5" />
              取消錄音
            </button>
          </div>
        </div>
      ) : null}

      {status === "preview" || status === "uploading" ? (
        <div className="grid gap-3">
          {audioUrl ? <audio className="w-full" src={audioUrl} controls /> : null}
          <label className="grid gap-1 text-base font-bold text-slate-800">
            語音重點 / 需要誰處理
            <textarea className="min-h-24 rounded-md border border-slate-300 bg-white p-3 text-base font-medium" value={manualSummary} onChange={(event) => setManualSummary(event.target.value)} placeholder="可手動補充語音摘要，方便之後轉任務或追蹤。" />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-bold text-slate-800" type="button" onClick={resetRecording} disabled={status === "uploading"}>
              <RotateCcw className="h-5 w-5" />
              重新錄音
            </button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-700 px-4 text-base font-bold text-white disabled:opacity-60 sm:col-span-2" type="button" onClick={submitVoice} disabled={status === "uploading"}>
              <Send className="h-5 w-5" />
              {status === "uploading" ? "送出中..." : "送出語音"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-md bg-red-50 px-4 py-3 text-base font-bold text-red-700">{error}</p> : null}
    </div>
  );
}
