import { NotificationPriority } from "@prisma/client";
import { NextResponse } from "next/server";

import { appRedirect } from "@/lib/redirect";
import { sendFallbackChannelsForNotification } from "@/lib/fallback-notifications";
import { sendNativePushForNotification } from "@/lib/native-push";
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

async function safeWebPush(notificationId: string) {
  try {
    return await sendPushForNotification(notificationId);
  } catch (error) {
    return { sent: 0, failed: 1, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function safeNativePush(notificationId: string) {
  try {
    return await sendNativePushForNotification(notificationId);
  } catch (error) {
    return { sent: 0, failed: 1, skipped: 0, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function safeFallback(notificationId: string) {
  try {
    return await sendFallbackChannelsForNotification(notificationId, "通知測試");
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
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

function notificationText(testKind: string, priority: NotificationPriority, stamp: number, hasVoiceTarget: boolean) {
  const timeText = new Date(stamp).toLocaleString("zh-TW");

  if (testKind === "p0") {
    return {
      title: "P0 緊急測試通知",
      body: `這是一則 P0 緊急測試通知，產生時間：${timeText}`
    };
  }

  if (testKind === "p1") {
    return {
      title: "P1 重要測試通知",
      body: `這是一則 P1 重要測試通知，產生時間：${timeText}`
    };
  }

  if (testKind.startsWith("voice")) {
    return {
      title: priority === "URGENT" ? "P0 緊急語音通知測試" : "語音留言通知測試",
      body: hasVoiceTarget ? "你有一則語音留言測試通知，請點擊查看。" : "目前沒有可用語音留言，這是一則語音通知流程測試。"
    };
  }

  return {
    title: priority === "URGENT" ? "緊急測試通知" : "JU數位管理測試通知",
    body: `這是一則系統通知測試，產生時間：${timeText}`
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
  const text = notificationText(testKind, priority, stamp, Boolean(voiceTarget?.voiceId));

  const input = {
    title: text.title,
    body: text.body,
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
    const [pushResult, nativePushResult, fallbackResult] = await Promise.all([
      safeWebPush(notification.id),
      safeNativePush(notification.id),
      safeFallback(notification.id)
    ]);
    return testResponse(request, { notificationId: notification.id, pushResult, nativePushResult, fallbackResult });
  }

  if (!canManageSystem(user) && !hasPermission(user, "notification.test_push")) {
    await createNotification({
      userId: user.id,
      title: "權限不足",
      body: "你沒有發送多人測試通知的權限。",
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
  const notifications = await notifyUsers(users.map((item) => item.id), input);
  const nativeResults = await Promise.all(notifications.map((notification) => safeNativePush(notification.id)));
  const pushResults = await Promise.all(notifications.map((notification) => safeWebPush(notification.id)));
  return testResponse(request, { notifiedUsers: users.length, nativeResults, pushResults });
}
