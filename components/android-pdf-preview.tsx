"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText } from "lucide-react";

type AndroidNativeBridge = {
  openPdf?: (url: string, fileName: string) => void;
};

type AndroidWindow = Window & { HuangxiangAndroid?: AndroidNativeBridge };

type AndroidPdfPreviewProps = {
  previewHref: string;
  downloadHref: string;
  fileName: string;
};

export function AndroidPdfPreview({ previewHref, downloadHref, fileName }: AndroidPdfPreviewProps) {
  const [isAndroidApp, setIsAndroidApp] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsAndroidApp(Boolean((window as AndroidWindow).HuangxiangAndroid?.openPdf));
  }, []);

  function openAndroidPdf() {
    const bridge = (window as AndroidWindow).HuangxiangAndroid;
    if (!bridge?.openPdf) {
      setMessage("目前 App 尚未支援原生 PDF 預覽，請先更新 Android App。");
      return;
    }

    bridge.openPdf(downloadHref, fileName);
    setMessage("正在準備 PDF。完成後會用手機內建或已安裝的 PDF 閱讀器開啟。");
  }

  if (isAndroidApp) {
    return (
      <section className="rounded-lg border border-white/80 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-center gap-2 text-lg font-black text-slate-950">
          <FileText className="h-5 w-5 text-brand-700" />
          Android App PDF 預覽
        </div>
        <p className="mt-3 text-base font-bold leading-7 text-slate-700">
          Android App 內建 WebView 不一定能直接顯示 PDF。請按下方按鈕，系統會安全下載這份簽呈 PDF，並用手機的 PDF 閱讀器開啟。
        </p>
        {message ? <p className="mt-3 rounded-md bg-brand-50 px-4 py-3 text-base font-bold text-brand-800">{message}</p> : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-700 px-4 text-base font-black text-white transition hover:bg-brand-800 active:scale-[0.98]"
            type="button"
            onClick={openAndroidPdf}
          >
            <ExternalLink className="h-5 w-5" />
            用手機預覽 PDF
          </button>
          <a
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand-700 px-4 text-base font-black text-brand-800 transition hover:bg-brand-50 active:scale-[0.98]"
            href={downloadHref}
          >
            <Download className="h-5 w-5" />
            下載 PDF
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-white/80 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-3 text-lg font-black text-slate-950">
        <FileText className="h-5 w-5 text-brand-700" />
        簽呈 PDF 預覽
      </div>
      <iframe title="簽呈 PDF" src={previewHref} className="h-[72vh] min-h-[560px] w-full bg-slate-100" />
    </section>
  );
}
