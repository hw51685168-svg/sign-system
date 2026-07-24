import { appRedirect } from "@/lib/redirect";
import { markNotificationRead } from "@/lib/notifications";
import { revalidateNotificationNavigation } from "@/lib/navigation-revalidate";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const formData = await request.formData();
  const targetUrl = String(formData.get("targetUrl") || "/notifications");
  await markNotificationRead(id, user.id);
  revalidateNotificationNavigation();
  return appRedirect(targetUrl);
}
