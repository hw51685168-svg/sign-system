import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { announcementVisibleWhere } from "@/lib/rbac";
import { appRedirect } from "@/lib/redirect";
import { requireUser } from "@/lib/session";
import { demoMode } from "@/lib/demo";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (demoMode) return appRedirect("/announcements");
  const announcement = await prisma.announcement.findFirst({
    where: { AND: [{ id: params.id }, announcementVisibleWhere(user)] }
  });
  if (!announcement) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: announcement.id, userId: user.id } },
    update: { readAt: new Date() },
    create: { announcementId: announcement.id, userId: user.id }
  });
  return appRedirect("/announcements");
}
