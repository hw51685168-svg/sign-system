"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Pause, Play, RotateCcw } from "lucide-react";

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

export function VoicePlayer({
  voiceMessageId,
  streamUrl,
  durationSeconds,
  mimeType
}: {
  voiceMessageId: string;
  streamUrl: string;
  durationSeconds: number;
  mimeType?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");
  const [isAppleDevice, setIsAppleDevice] = useState(false);

  useEffect(() => {
    setIsAppleDevice(/iPad|iPhone|iPod|Macintosh/i.test(navigator.userAgent));
  }, []);

  async function markListen(completed = false) {
    await fetch(`/api/chat/voice/${voiceMessageId}/listen`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ positionSeconds: current, completed })
    }).catch(() => undefined);
  }

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.playbackRate = speed;
      try {
        await audio.play();
        setError("");
        setPlaying(true);
        void markListen(false);
      } catch {
        setError("無法播放語音，請確認瀏覽器允許播放音訊。");
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  }

  function replay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrent(0);
    void audio.play()
      .then(() => {
        setError("");
        setPlaying(true);
      })
      .catch(() => setError("無法重新播放語音，請重新整理後再試。"));
  }

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="metadata"
        controls
        className="w-full"
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(durationSeconds);
          void markListen(true);
        }}
        onError={() => {
          setPlaying(false);
          setError("語音載入失敗，可能已撤回、沒有播放權限，或目前手機不支援此音訊格式。");
        }}
      />
      {isAppleDevice && mimeType?.toLowerCase().includes("webm") ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
          這則語音是 WebM 格式，部分 iPhone 可能無法播放。若播放失敗，請請對方用 iPhone 重新錄音，或改用電腦播放。
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button className="inline-flex min-h-12 min-w-24 items-center justify-center gap-2 rounded-md bg-brand-700 px-4 text-lg font-black text-white" type="button" onClick={toggle}>
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {playing ? "暫停" : "播放"}
        </button>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-base font-bold text-slate-800" type="button" onClick={replay}>
          <RotateCcw className="h-5 w-5" />
          重新播放
        </button>
        <p className="text-xl font-black text-slate-900">{formatTime(current)} / {formatTime(durationSeconds)}</p>
        <label className="ml-auto flex items-center gap-2 text-base font-bold text-slate-800">
          速度
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1"
            value={speed}
            onChange={(event) => {
              const next = Number(event.target.value);
              setSpeed(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
          >
            {[1, 1.25, 1.5, 2].map((value) => (
              <option key={value} value={value}>{value}x</option>
            ))}
          </select>
        </label>
      </div>
      <input
        aria-label="語音播放進度"
        className="h-3 w-full accent-brand-700"
        type="range"
        min="0"
        max={Math.max(durationSeconds, current, 1)}
        value={Math.min(current, Math.max(durationSeconds, current, 1))}
        onChange={(event) => seek(Number(event.target.value))}
      />
      {error ? (
        <div className="grid gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          <p>{error}</p>
          <a className="inline-flex items-center gap-1 underline" href={streamUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            另開語音檔測試播放
          </a>
        </div>
      ) : null}
    </div>
  );
}
