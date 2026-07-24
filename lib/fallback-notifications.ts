import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

function enabled(value?: string) {
  return value === "true" || value === "1" || value === "yes";
}

function absoluteUrl(path: string) {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  if (path.startsWith("http")) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendEmailFallback(notificationId: string, reason = "fallback") {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { user: true }
  });
  if (!notification) return { sent: false, reason: "Notification not found" };
  if (!enabled(process.env.EMAIL_FALLBACK_ENABLED)) return { sent: false, reason: "Email fallback disabled" };

  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) {
    await prisma.notificationLog.create({
      data: {
        notificationId,
        userId: notification.userId,
        channel: "EMAIL",
        status: "FAILED",
        errorMessage: "SMTP_HOST 或 SMTP_FROM 尚未設定"
      }
    });
    return { sent: false, reason: "SMTP not configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: enabled(process.env.SMTP_SECURE),
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });

    const targetEmail = process.env.FALLBACK_EMAIL_TO || notification.user.email;
    const result = await transporter.sendMail({
      from,
      to: targetEmail,
      subject: `[JU數位管理] ${notification.title}`,
      text: `${notification.body}\n\n原因：${reason}\n連結：${absoluteUrl(notification.targetUrl)}`
    });

    await prisma.notificationLog.create({
      data: {
        notificationId,
        userId: notification.userId,
        channel: "EMAIL",
        status: "SENT",
        sentAt: new Date(),
        responsePayload: JSON.stringify({ messageId: result.messageId, to: targetEmail })
      }
    });
    return { sent: true };
  } catch (error) {
    await prisma.notificationLog.create({
      data: {
        notificationId,
        userId: notification.userId,
        channel: "EMAIL",
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendLineFallback(notificationId: string, reason = "fallback") {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { user: true }
  });
  if (!notification) return { sent: false, reason: "Notification not found" };
  if (!enabled(process.env.LINE_FALLBACK_ENABLED)) return { sent: false, reason: "LINE fallback disabled" };

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_TARGET_ID;
  if (!token || !to) {
    await prisma.notificationLog.create({
      data: {
        notificationId,
        userId: notification.userId,
        channel: "LINE",
        status: "FAILED",
        errorMessage: "LINE_CHANNEL_ACCESS_TOKEN 或 LINE_TARGET_ID 尚未設定"
      }
    });
    return { sent: false, reason: "LINE not configured" };
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        to,
        messages: [
          {
            type: "text",
            text: `【JU數位管理】${notification.title}\n${notification.body}\n原因：${reason}\n${absoluteUrl(notification.targetUrl)}`
          }
        ]
      })
    });

    const payload = await response.text();
    await prisma.notificationLog.create({
      data: {
        notificationId,
        userId: notification.userId,
        channel: "LINE",
        status: response.ok ? "SENT" : "FAILED",
        sentAt: response.ok ? new Date() : undefined,
        errorMessage: response.ok ? undefined : payload,
        responsePayload: payload
      }
    });
    return { sent: response.ok, reason: response.ok ? undefined : payload };
  } catch (error) {
    await prisma.notificationLog.create({
      data: {
        notificationId,
        userId: notification.userId,
        channel: "LINE",
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendFallbackChannelsForNotification(notificationId: string, reason = "fallback") {
  const [email, line] = await Promise.all([
    sendEmailFallback(notificationId, reason),
    sendLineFallback(notificationId, reason)
  ]);
  return { email, line };
}
