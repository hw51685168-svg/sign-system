import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { prisma } from "@/lib/prisma";
import { canManageSystem } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { demoMode } from "@/lib/demo";

export async function POST(request: Request) {
  const user = await requireUser();
  if (demoMode) return appRedirect("/admin/users");
  if (!canManageSystem(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const formData = await request.formData();
  await prisma.store.create({
    data: {
      name: textValue(formData, "name"),
      brand: optionalTextValue(formData, "brand"),
      departmentId: optionalTextValue(formData, "departmentId")
    }
  });
  return appRedirect("/admin/users");
}
