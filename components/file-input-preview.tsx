"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, FileText, ImageIcon, X } from "lucide-react";

type SelectedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
};

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function previewLabel(type: string) {
  if (type.startsWith("image/")) return "預覽圖片";
  if (type === "application/pdf") return "預覽 PDF";
  return "預覽檔案";
}

export function FileInputPreview({
  name,
  accept,
  multiple = true,
  note = "送出前可在這裡確認檔名、大小，照片可先預覽。"
}: {
  name: string;
  accept?: string;
  multiple?: boolean;
  note?: string;
}) {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const inputId = useMemo(() => `${name}-${Math.random().toString(36).slice(2)}`, [name]);

  useEffect(() => {
    return () => {
      files.forEach((file) => URL.revokeObjectURL(file.url));
    };
  }, [files]);

  return (
    <div className="grid gap-3">
      <input
        id={inputId}
        name={name}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={(event) => {
          files.forEach((file) => URL.revokeObjectURL(file.url));
          const nextFiles = Array.from(event.currentTarget.files ?? []).map((file, index) => ({
            id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
            name: file.name,
            size: file.size,
            type: file.type,
            url: URL.createObjectURL(file)
          }));
          setFiles(nextFiles);
        }}
      />
      <p className="text-sm font-bold text-slate-500">{note}</p>
      {files.length > 0 ? (
        <div className="grid gap-2 rounded-lg border border-brand-100 bg-brand-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-black text-brand-900">已選擇 {files.length} 個檔案</p>
            <label
              className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-md border border-brand-700 bg-white px-3 text-sm font-black text-brand-800 hover:bg-brand-50"
              htmlFor={inputId}
            >
              重新選擇
            </label>
          </div>
          <div className="grid gap-2">
            {files.map((file) => {
              const isImage = file.type.startsWith("image/");
              return (
                <div
                  key={file.id}
                  className="grid gap-3 rounded-lg border border-white bg-white p-3 shadow-sm md:grid-cols-[72px_1fr_auto] md:items-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-slate-100">
                    {isImage ? (
                      <img alt={file.name} className="h-full w-full object-cover" src={file.url} />
                    ) : (
                      <FileText className="h-7 w-7 text-brand-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-base font-black text-slate-950">{file.name}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {file.type || "未知格式"} / {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-brand-700 bg-white px-3 text-sm font-black text-brand-800 hover:bg-brand-50"
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {isImage ? <ImageIcon className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {previewLabel(file.type)}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-500">
          <X className="h-4 w-4" />
          尚未選擇檔案
        </div>
      )}
    </div>
  );
}
