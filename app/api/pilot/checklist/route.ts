import { appRedirect } from "@/lib/redirect";
import { canAccessPilot, getPilotChecklistForUser } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canAccessPilot(user)) {
    return new Response("你沒有使用主管測試清單的權限。", { status: 403 });
  }

  const formData = await request.formData();
  const itemKey = String(formData.get("itemKey") || "");
  const isCompleted = String(formData.get("isCompleted") || "") === "true";
  const notes = String(formData.get("notes") || "").trim() || null;
  const definition = getPilotChecklistForUser(user).find((item) => item.key === itemKey);

  if (!definition) {
    return new Response("找不到這個測試項目。", { status: 400 });
  }

  await prisma.pilotChecklistItem.upsert({
    where: { userId_itemKey: { userId: user.id, itemKey } },
    update: {
      label: definition.label,
      category: definition.category,
      roleKey: definition.roleKey ?? null,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      notes
    },
    create: {
      userId: user.id,
      itemKey,
      label: definition.label,
      category: definition.category,
      roleKey: definition.roleKey ?? null,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
      notes
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: isCompleted ? "PILOT_CHECKLIST_COMPLETE" : "PILOT_CHECKLIST_REOPEN",
      resourceType: "PilotChecklistItem",
      resourceId: itemKey,
      metadata: JSON.stringify({ label: definition.label, notes })
    }
  });

  return appRedirect("/pilot/checklist");
}
