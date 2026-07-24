import { Download, Eye, FileText, ImageIcon } from "lucide-react";

type AttachmentItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  size?: number | null;
};

function formatFileSize(size?: number | null) {
  if (!size) return "大小未記錄";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(attachment: AttachmentItem) {
  return Boolean(attachment.mimeType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(attachment.fileName));
}

function previewText(attachment: AttachmentItem) {
  if (isImage(attachment)) return "預覽圖片";
  if (attachment.mimeType === "application/pdf" || /\.pdf$/i.test(attachment.fileName)) return "預覽 PDF";
  return "開啟檔案";
}

export function AttachmentPreviewList({
  attachments,
  emptyText = "目前沒有附件。"
}: {
  attachments: AttachmentItem[];
  emptyText?: string;
}) {
  if (attachments.length === 0) {
    return <p className="text-lg font-semibold text-slate-600">{emptyText}</p>;
  }

  return (
    <div className="grid gap-3">
      {attachments.map((attachment) => {
        const image = isImage(attachment);
        return (
          <div
            key={attachment.id}
            className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[84px_1fr_auto] md:items-center"
          >
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-slate-100">
              {image ? (
                <img alt={attachment.fileName} className="h-full w-full object-cover" src={attachment.fileUrl} />
              ) : (
                <FileText className="h-8 w-8 text-brand-700" />
              )}
            </div>
            <div className="min-w-0">
              <p className="break-words text-base font-black text-slate-950">{attachment.fileName}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {attachment.mimeType || "未知格式"} / {formatFileSize(attachment.size)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-brand-700 bg-white px-3 text-sm font-black text-brand-800 hover:bg-brand-50"
                href={attachment.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {image ? <ImageIcon className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {previewText(attachment)}
              </a>
              <a
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand-700 px-3 text-sm font-black text-white hover:bg-brand-800"
                href={attachment.fileUrl}
                download
              >
                <Download className="h-4 w-4" />
                下載
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
