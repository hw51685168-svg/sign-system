import type { Prisma } from "@prisma/client";
import { Trash2, Volume2 } from "lucide-react";
import { Button, StatusBadge } from "@/components/ui";
import { VoicePlayer } from "@/components/voice-player";
import { VoiceRecorder } from "@/components/voice-recorder";
import { formatDateTime, safeText } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertConversationAccess, formatSeconds } from "@/lib/voice";

export async function VoiceThread({ conversationId, readOnly = false }: { conversationId: string; readOnly?: boolean }) {
  const user = await requireUser();
  const conversation = await assertConversationAccess(conversationId, user);
  if (!conversation) return null;
  const voiceVisibilityClauses: Prisma.VoiceMessageWhereInput[] = [{ conversationId: conversation.id }];
  if (conversation.type === "APPROVAL" && conversation.sourceId) {
    voiceVisibilityClauses.push({ attachedApprovalId: conversation.sourceId });
  }

  const voices = await prisma.voiceMessage.findMany({
    where: {
      OR: voiceVisibilityClauses,
      isWithdrawn: false,
      message: { isDeleted: false }
    },
    include: {
      sender: { include: { department: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <section id="voice-thread" className="grid gap-5 rounded-lg border border-brand-100 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black text-brand-700">語音留言</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-950">
            <Volume2 className="h-6 w-6 text-brand-700" />
            簽呈語音補充
          </h2>
          <p className="mt-2 text-base leading-7 text-slate-700">
            可錄製語音補充說明或回覆問題。語音目前只保留播放與撤回，不再顯示轉任務、轉問題或轉服務需求等閉環操作。
          </p>
        </div>
        <StatusBadge label={`${voices.length} 則語音`} tone={voices.length > 0 ? "blue" : "slate"} />
      </div>

      {readOnly ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-base font-semibold leading-7 text-slate-700">
          此案件目前為總經理旁觀模式，可查看既有語音紀錄，不開放新增語音。
        </div>
      ) : (
        <VoiceRecorder conversationId={conversation.id} />
      )}

      <div className="grid gap-4">
        {voices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-lg font-bold text-slate-900">目前沒有語音留言</p>
            <p className="mt-1 text-base text-slate-600">需要補充說明時，可以錄一段語音讓相關人員快速了解狀況。</p>
          </div>
        ) : null}

        {voices.map((voice) => {
          const canWithdraw = !readOnly && (voice.senderId === user.id || user.roleKey === "GENERAL_MANAGER" || user.roleKey === "SYSTEM_ADMIN");
          return (
            <article key={voice.id} id={`voice-${voice.id}`} className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-lg font-black text-slate-950">{voice.sender.name}</p>
                  <p className="text-sm font-semibold text-slate-600">
                    {safeText(voice.sender.department?.name, "未指定部門")} · {formatDateTime(voice.createdAt)} · {formatSeconds(voice.durationSeconds)}
                  </p>
                </div>
                {canWithdraw ? (
                  <form action={`/api/chat/voice/${voice.id}/withdraw`} method="post">
                    <Button type="submit" variant="danger" className="min-h-10 px-3 text-sm">
                      <Trash2 className="h-4 w-4" />
                      撤回
                    </Button>
                  </form>
                ) : null}
              </div>

              <VoicePlayer
                voiceMessageId={voice.id}
                streamUrl={`/api/chat/voice/${voice.id}/stream`}
                durationSeconds={voice.durationSeconds}
                mimeType={voice.mimeType}
              />

              {voice.manualSummary ? (
                <div className="rounded-md bg-white p-3 text-base leading-7 text-slate-800">
                  <p className="mb-1 font-bold text-slate-950">語音備註</p>
                  <p className="whitespace-pre-wrap">{voice.manualSummary}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
