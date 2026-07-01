"use client";

import { useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

export function VoicePlayer({ voiceMessageId, streamUrl, durationSeconds }: { voiceMessageId: string; streamUrl: string; durationSeconds: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");

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
        setError("無法播放語音，可能是沒有權限、語音已撤回或網路暫時中斷。");
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
    void audio.play().then(() => {
      setError("");
      setPlaying(true);
    }).catch(() => setError("無法重新播放語音，請重新整理後再試一次。"));
  }

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="metadata"
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(durationSeconds);
          void markListen(true);
        }}
        onError={() => {
          setPlaying(false);
          setError("語音載入失敗。若此語音已撤回或你沒有權限，系統會阻擋播放。");
        }}
      />
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
            {[1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}x</option>)}
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
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p> : null}
    </div>
  );
}
