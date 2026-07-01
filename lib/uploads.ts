import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export function uploadRoot() {
  return process.env.APPROVAL_UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
}

export async function saveUploadedFiles(formData: FormData, fieldName: string) {
  const values = formData.getAll(fieldName);
  const files = values.filter((value): value is File => value instanceof File && value.size > 0);
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
