import { appRedirect } from "@/lib/redirect";
import { markNotificationRead } from "@/lib/notifications";
import { revalidateNotificationNavigation } from "@/lib/navigation-revalidate";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const formData = await request.formData();
  const targetUrl = String(formData.get("targetUrl") || "/notifications");
  await markNotificationRead(params.id, user.id);
  revalidateNotificationNavigation();
  return appRedirect(targetUrl);
}
