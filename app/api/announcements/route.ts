import { AnnouncementTargetType } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { prisma } from "@/lib/prisma";
import { canApprove } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";
import { demoMode } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (demoMode) return appRedirect("/announcements");
  if (!canApprove(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const formData = await request.formData();
  const targetType = textValue(formData, "targetType") as AnnouncementTargetType;
  const uploads = await saveUploadedFiles(formData, "attachments");

  await prisma.announcement.create({
    data: {
      title: textValue(formData, "title"),
      content: textValue(formData, "content"),
      requireConfirmation: formData.has("requireConfirmation"),
      publisherId: user.id,
      targets: {
        create: {
          type: targetType,
          departmentId: targetType === "DEPARTMENT" ? optionalTextValue(formData, "departmentId") : null,
          storeId: targetType === "STORE" ? optionalTextValue(formData, "storeId") : null
        }
      },
      attachments: {
        create: uploads.map((file) => ({ ...file, uploaderId: user.id }))
      }
    }
  });

  return appRedirect("/announcements");
}
