import { appRedirect } from "@/lib/redirect";
import { markAllNotificationsRead } from "@/lib/notifications";
import { revalidateNotificationNavigation } from "@/lib/navigation-revalidate";
import { requireUser } from "@/lib/session";

export async function POST() {
  const user = await requireUser();
  await markAllNotificationsRead(user.id);
  revalidateNotificationNavigation();
  return appRedirect("/notifications");
}
