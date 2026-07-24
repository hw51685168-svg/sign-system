import { createSign } from "crypto";
import { prisma } from "@/lib/prisma";

type AccessTokenCache = {
  token: string;
  expiresAt: number;
};

type NativePushResult = {
  sent: number;
  failed: number;
  skipped: number;
  reason?: string;
};

let firebaseAccessToken: AccessTokenCache | null = null;

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function normalizedPrivateKey(value?: string) {
  return value?.replace(/\\n/g, "\n");
}

export function nativePushConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

function signFirebaseJwt(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string) {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  return `${data}.${base64url(signer.sign(privateKey))}`;
}

async function getFirebaseAccessToken() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizedPrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) return null;
  if (firebaseAccessToken && firebaseAccessToken.expiresAt > Date.now() + 60_000) return firebaseAccessToken.token;

  const now = Math.floor(Date.now() / 1000);
  const assertion = signFirebaseJwt(
    { alg: "RS256", typ: "JWT" },
    {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    },
    privateKey
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) throw new Error(`Firebase OAuth failed: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  firebaseAccessToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return firebaseAccessToken.token;
}

function absoluteTargetUrl(targetUrl: string) {
  const base = process.env.NEXTAUTH_URL || process.env.CAPACITOR_SERVER_URL || "https://huangxiang-approval.serveousercontent.com";
  try {
    return new URL(targetUrl, base).toString();
  } catch {
    return new URL("/notifications", base).toString();
  }
}

async function sendFcm(input: { token: string; title: string; body: string; targetUrl: string; notificationId: string }) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const accessToken = await getFirebaseAccessToken();
  if (!projectId || !accessToken) return { skipped: true, reason: "Firebase credentials not configured" };

  const targetUrl = `/api/notifications/${input.notificationId}/click`;
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token: input.token,
        data: {
          title: input.title,
          body: input.body,
          targetUrl,
          notificationId: input.notificationId
        },
        android: {
          priority: "HIGH"
        }
      }
    })
  });

  const responseText = await response.text();
  if (!response.ok) {
    const error = new Error(`FCM send failed: ${response.status} ${responseText}`);
    (error as Error & { responseText?: string }).responseText = responseText;
    throw error;
  }

  return responseText ? JSON.parse(responseText) : { ok: true };
}

function isInvalidFcmTokenError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes("UNREGISTERED") ||
    text.includes("INVALID_ARGUMENT") ||
    text.includes("registration-token-not-registered") ||
    text.includes("Requested entity was not found")
  );
}

export async function sendNativePushForNotification(notificationId: string): Promise<NativePushResult> {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) return { sent: 0, failed: 0, skipped: 0, reason: "Notification not found" };

  const tokens = await prisma.nativeDeviceToken.findMany({
    where: { userId: notification.userId, isActive: true, provider: "fcm" }
  });

  if (tokens.length === 0) return { sent: 0, failed: 0, skipped: 0, reason: "No active Android FCM token" };

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let skippedReason = "";

  for (const token of tokens) {
    try {
      const result = await sendFcm({
        token: token.token,
        title: notification.title,
        body: notification.body,
        targetUrl: notification.targetUrl,
        notificationId
      });

      if ((result as { skipped?: boolean }).skipped) {
        skipped += 1;
        skippedReason = (result as { reason?: string }).reason || "Skipped";
      } else {
        sent += 1;
      }

      await prisma.nativeDeviceToken.update({
        where: { id: token.id },
        data: (result as { skipped?: boolean }).skipped ? {} : { lastSuccessAt: new Date(), lastFailedAt: null }
      });
      await prisma.notificationLog.create({
        data: {
          notificationId,
          userId: notification.userId,
          channel: "PUSH",
          status: (result as { skipped?: boolean }).skipped ? "PENDING" : "SENT",
          sentAt: (result as { skipped?: boolean }).skipped ? null : new Date(),
          responsePayload: JSON.stringify({ native: true, provider: "fcm", platform: token.platform, result })
        }
      });
    } catch (error) {
      failed += 1;
      const deactivateToken = isInvalidFcmTokenError(error);
      await prisma.nativeDeviceToken.update({
        where: { id: token.id },
        data: { lastFailedAt: new Date(), ...(deactivateToken ? { isActive: false } : {}) }
      });
      await prisma.notificationLog.create({
        data: {
          notificationId,
          userId: notification.userId,
          channel: "PUSH",
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
          responsePayload: JSON.stringify({ native: true, provider: "fcm", platform: token.platform, deactivated: deactivateToken })
        }
      });
    }
  }

  return { sent, failed, skipped, reason: skippedReason || undefined };
}
