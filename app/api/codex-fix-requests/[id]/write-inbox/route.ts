import { appRedirect } from "@/lib/redirect";
import { canAccessErrorCommandCenter, writeCodexInboxFile } from "@/lib/error-command-center";
import { requireUser } from "@/lib/session";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!canAccessErrorCommandCenter(user)) {
    return new Response("你沒有寫入 CODEX_INBOX 的權限。", { status: 403 });
  }
  await writeCodexInboxFile(params.id);
  return appRedirect(`/admin/codex-fix-requests/${params.id}`);
}
