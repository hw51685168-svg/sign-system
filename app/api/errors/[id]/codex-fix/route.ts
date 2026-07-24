import { appRedirect } from "@/lib/redirect";
import { canAccessErrorCommandCenter, createCodexFixRequestForError, maybeCreateGitHubIssue, writeCodexInboxFile } from "@/lib/error-command-center";
import { requireUser } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!canAccessErrorCommandCenter(user)) {
    return new Response("你沒有建立 Codex 修復單的權限。", { status: 403 });
  }

  const formData = await request.formData().catch(() => new FormData());
  const writeInbox = String(formData.get("writeInbox") || "") === "true";
  const createGithub = String(formData.get("createGithub") || "") === "true";
  const fixRequest = await createCodexFixRequestForError(id, user.id);

  if (writeInbox) await writeCodexInboxFile(fixRequest.id);
  if (createGithub) await maybeCreateGitHubIssue(fixRequest.id);

  return appRedirect(`/admin/codex-fix-requests/${fixRequest.id}`);
}
