import { InventoryUrgency } from "@prisma/client";
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
  if (demoMode) return appRedirect("/inventory");
  if (!hasPermission(user, "inventory.create")) {
    return NextResponse.json({ error: "權限不足，無法建立倉管補貨申請。" }, { status: 403 });
  }
  const formData = await request.formData();
  const uploads = await saveUploadedFiles(formData, "attachments");

  await prisma.inventoryRequest.create({
    data: {
      storeId: optionalTextValue(formData, "storeId") ?? user.storeId,
      applicantId: user.id,
      itemName: textValue(formData, "itemName"),
      quantity: Number(textValue(formData, "quantity")),
      purpose: textValue(formData, "purpose"),
      urgency: textValue(formData, "urgency") as InventoryUrgency,
      notes: optionalTextValue(formData, "notes"),
      attachments: {
        create: uploads.map((file) => ({ ...file, uploaderId: user.id }))
      }
    }
  });

  return appRedirect("/inventory");
}
