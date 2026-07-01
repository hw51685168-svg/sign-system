import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { uploadRoot } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { fileName: string } }) {
  await requireUser();
  const safeName = path.basename(decodeURIComponent(params.fileName));
  const filePath = path.join(uploadRoot(), safeName);

  try {
    const file = await readFile(filePath);
    return new Response(file);
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
