import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { optionalTextValue, textValue } from "@/lib/form";
import { prisma } from "@/lib/prisma";
import { canManageSystem } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { demoMode } from "@/lib/demo";

const defaultPassword = "aaaa8888";

function redirectWithStatus(status: string) {
  return appRedirect(`/admin/users?status=${status}`);
}

export async function POST(request: Request) {
  const currentUser = await requireUser();
  if (demoMode) return appRedirect("/admin/users");
  if (!canManageSystem(currentUser)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await request.formData();
  const action = textValue(formData, "action") || "CREATE";

  if (action === "CREATE") {
    const email = textValue(formData, "email").toLowerCase();
    const password = textValue(formData, "password") || defaultPassword;

    await prisma.user.upsert({
      where: { email },
      update: {
        name: textValue(formData, "name"),
        passwordHash: await bcrypt.hash(password, 10),
        roleId: textValue(formData, "roleId"),
        departmentId: optionalTextValue(formData, "departmentId"),
        storeId: optionalTextValue(formData, "storeId"),
        isActive: true
      },
      create: {
        name: textValue(formData, "name"),
        email,
        passwordHash: await bcrypt.hash(password, 10),
        roleId: textValue(formData, "roleId"),
        departmentId: optionalTextValue(formData, "departmentId"),
        storeId: optionalTextValue(formData, "storeId"),
        isActive: true
      }
    });

    return redirectWithStatus("created");
  }

  const userId = textValue(formData, "userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  if (action === "UPDATE") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: textValue(formData, "name"),
        roleId: textValue(formData, "roleId"),
        departmentId: optionalTextValue(formData, "departmentId"),
        storeId: optionalTextValue(formData, "storeId")
      }
    });
    return redirectWithStatus("updated");
  }

  if (action === "DEACTIVATE") {
    if (userId === currentUser.id) return redirectWithStatus("cannot-deactivate-self");
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    return redirectWithStatus("deactivated");
  }

  if (action === "REACTIVATE") {
    await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    return redirectWithStatus("reactivated");
  }

  if (action === "RESET_PASSWORD") {
    const password = textValue(formData, "password") || defaultPassword;
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 10) }
    });
    return redirectWithStatus("password-reset");
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
