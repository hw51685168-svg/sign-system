import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const maxUploadBytes = 20 * 1024 * 1024;
const allowedUploadExtensions = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt"
]);

const allowedUploadMimePrefixes = ["image/"];
const allowedUploadMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain"
]);

export function uploadRoot() {
  return process.env.APPROVAL_UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

function isAllowedUpload(file: File) {
  const extension = path.extname(file.name).toLowerCase();
  const type = file.type.toLowerCase();
  const typeAllowed = allowedUploadMimeTypes.has(type) || allowedUploadMimePrefixes.some((prefix) => type.startsWith(prefix));
  return file.size <= maxUploadBytes && allowedUploadExtensions.has(extension) && (typeAllowed || type === "");
}

export async function saveUploadedFiles(formData: FormData, fieldName: string) {
  const values = formData.getAll(fieldName);
  const files = values.filter((value): value is File => value instanceof File && value.size > 0 && isAllowedUpload(value));
  if (files.length === 0) return [];

  const uploadDir = uploadRoot();
  await mkdir(uploadDir, { recursive: true });

  const saved = [];
  for (const file of files) {
    const extension = path.extname(file.name);
    const safeName = `${randomUUID()}${extension}`;
    const diskPath = path.join(uploadDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(diskPath, buffer);
    saved.push({
      fileName: file.name,
      fileUrl: `/api/uploads/${encodeURIComponent(safeName)}`,
      mimeType: file.type || null,
      size: file.size
    });
  }
  return saved;
}
