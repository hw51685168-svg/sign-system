import { NotificationPriority } from "@prisma/client";
import { NextResponse } from "next/server";
import { appRedirect } from "@/lib/redirect";
import { sendFallbackChannelsForNotification } from "@/lib/fallback-notifications";
import { createNotification, notifyUsers } from "@/lib/notifications";
import { sendPushForNotification } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { canManageSystem, hasPermission } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { canAccessConversation, conversationTargetUrl } from "@/lib/voice";

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") || request.headers.get("x-requested-with") === "fetch";
}

function testResponse(request: Request, data: Record<string, unknown> = {}) {
  if (wantsJson(request)) return NextResponse.json({ ok: true, ...data });
  return appRedirect("/admin/notifications-test");
}

async function findVoiceTarget(user: Awaited<ReturnType<typeof requireUser>>, testKind: string) {
  const sourceType =
    testKind === "voice-task"
      ? "task"
      : testKind === "voice-approval"
        ? "approval"
        : testKind === "voice-issue"
          ? "issue"
          : testKind === "voice-service"
            ? "service_request"
            : undefined;

  const voices = await prisma.voiceMessage.findMany({
    where: {
      isWithdrawn: false,
      message: { isDeleted: false },
      ...(sourceType ? { sourceType } : {})
    },
    include: { conversation: { include: { members: true } } },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  for (const voice of voices) {
    if (await canAccessConversation(voice.conversation, user)) {
      return {
        voiceId: voice.id,
        sourceType: "voice_message",
        sourceId: voice.id,
        targetUrl: conversationTargetUrl(voice.conversation, voice.id)
      };
    }
  }

  return {
    voiceId: null,
    sourceType: "voice_message",
    sourceId: `voice-test-${testKind}`,
    targetUrl: "/admin/notifications-test"
  };
}

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const target = String(formData.get("target") || "self");
  const testKind = String(formData.get("testKind") || "general");
  const requestedPriority = String(formData.get("priority") || "MEDIUM") as NotificationPriority;
  const priority = (testKind === "p0" || testKind === "voice-p0" ? "URGENT" : testKind === "p1" ? "HIGH" : requestedPriority) as NotificationPriority;
  const stamp = Date.now();

  const voiceTarget = testKind.startsWith("voice") ? await findVoiceTarget(user, testKind) : null;
  const title =
    testKind === "p0"
      ? "P0 緊急測試通知"
      : testKind === "p1"
        ? "P1 重要測試通知"
        : testKind.startsWith("voice")
          ? priority === "URGENT"
            ? "P0 緊急語音通知測試"
            : "語音通知測試"
          : priority === "URGENT"
            ? "緊急測試通知"
            : "測試通知";

  const body =
    testKind.startsWith("voice") && voiceTarget?.voiceId
      ? "點擊後會跳到 Voice Message（語音留言）所在頁面，請確認可以播放與定位。"
      : testKind.startsWith("voice")
        ? "目前沒有可用語音，先建立一則測試語音後再測試跳轉。"
        : `這是一則測試通知，產生時間：${new Date(stamp).toLocaleString("zh-TW")}`;

  const input = {
    title,
    body,
    type: testKind.startsWith("voice") ? "VOICE_MESSAGE" : "TEST",
    priority,
    targetUrl: voiceTarget?.targetUrl ?? "/notifications",
    sourceType: voiceTarget?.sourceType ?? "test",
    sourceId: voiceTarget?.sourceId ?? String(stamp),
    dedupeKey: testKind.startsWith("voice")
      ? `test:${user.id}:${testKind}:${priority}:${voiceTarget?.voiceId ?? "no-voice"}`
      : `test:${target}:${testKind}:${priority}:${stamp}`
  };

  if (target === "self") {
    const notification = await createNotification({
      userId: user.id,
      ...input,
      dedupeKey: testKind.startsWith("voice") ? input.dedupeKey : `test:self:${testKind}:${priority}:${stamp}`
    });
    const pushResult = await sendPushForNotification(notification.id);
    await sendFallbackChannelsForNotification(notification.id, "通知測試中心");
    return testResponse(request, { notificationId: notification.id, pushResult });
  }

  if (!canManageSystem(user) && !hasPermission(user, "notification.test_push")) {
    await createNotification({
      userId: user.id,
      title: "權限不足",
      body: "你沒有發送多人測試通知的權限，請改用發送給自己的測試通知。",
      type: "SYSTEM",
      priority: "HIGH",
      targetUrl: "/admin/notifications-test",
      sourceType: "system",
      sourceId: "permission",
      dedupeKey: `permission:notification-test:${user.id}:${stamp}`
    });
    return testResponse(request, { permissionDenied: true });
  }

  const roleKey = target === "managers" ? "MANAGER" : target === "executives" ? "GENERAL_MANAGER" : "STAFF";
  const users = await prisma.user.findMany({ where: { isActive: true, role: { key: roleKey } }, select: { id: true } });
  await notifyUsers(users.map((item) => item.id), input);
  return testResponse(request, { notifiedUsers: users.length });
}
