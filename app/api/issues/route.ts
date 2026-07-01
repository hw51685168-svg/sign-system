import { IssueSeverity, IssueType } from "@prisma/client";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { saveUploadedFiles } from "@/lib/uploads";
import { demoMode } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
  if (demoMode) return appRedirect("/issues");
  if (!hasPermission(user, "issue.create")) {
    return NextResponse.json({ error: "權限不足，無法建立問題回報。" }, { status: 403 });
  }
  const formData = await request.formData();
  const uploads = await saveUploadedFiles(formData, "attachments");
  const assignedDepartmentId = optionalTextValue(formData, "assignedDepartmentId");

  await prisma.issueReport.create({
    data: {
      storeId: optionalTextValue(formData, "storeId") ?? user.storeId,
      reporterId: user.id,
      type: textValue(formData, "type") as IssueType,
      description: textValue(formData, "description"),
      occurredAt: new Date(textValue(formData, "occurredAt")),
      severity: textValue(formData, "severity") as IssueSeverity,
      assignedDepartmentId,
      status: assignedDepartmentId ? "ASSIGNED" : "OPEN",
      logs: {
        create: {
          actorId: user.id,
          toStatus: assignedDepartmentId ? "ASSIGNED" : "OPEN",
          comment: "建立問題回報"
        }
      },
      attachments: {
        create: uploads.map((file) => ({ ...file, uploaderId: user.id }))
      }
    }
  });

  return appRedirect("/issues");
}
