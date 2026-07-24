import { appRedirect } from "@/lib/redirect";
import { markNotificationRead } from "@/lib/notifications";
import { revalidateNotificationNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const notification = await prisma.notification.findFirst({ where: { id: id, userId: user.id } });
  if (!notification) return appRedirect("/notifications");

  await markNotificationRead(notification.id, user.id);
  await prisma.notification.update({
    where: { id: notification.id },
    data: { clickedAt: new Date(), status: "CLICKED" }
  });

  revalidateNotificationNavigation();
  return appRedirect(notification.targetUrl || "/notifications");
}
