import { NextResponse } from "next/server";
import { revalidateNotificationNavigation } from "@/lib/navigation-revalidate";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

type BrowserSubscription = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  platformHint?: string;
};

function detectBrowser(userAgent: string | null) {
  if (!userAgent) return "Unknown";
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("CriOS") || userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Firefox")) return "Firefox";
  return "Unknown";
}

function detectOs(userAgent: string | null) {
  if (!userAgent) return "Unknown";
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS")) return "macOS";
  return "Unknown";
}

function detectPlatform(userAgent: string | null, endpoint: string, platformHint?: string) {
  if (platformHint) return platformHint;
  const os = detectOs(userAgent);
  if (os === "iOS" && endpoint.includes("web.push.apple.com")) return "ios-pwa";
  if (os === "Android") return "android-web";
  if (endpoint.includes("fcm.googleapis.com")) return "chrome-web";
  return "web-push";
}

function endpointPreview(endpoint: string) {
  try {
    const host = new URL(endpoint).host;
    return `${host}/...${endpoint.slice(-8)}`;
  } catch {
    return `invalid/...${endpoint.slice(-8)}`;
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  const subscription = (await request.json()) as BrowserSubscription;
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
    return NextResponse.json({ ok: false, error: "Invalid Web Push subscription." }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent");
  const platform = detectPlatform(userAgent, subscription.endpoint, subscription.platformHint);
  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId: user.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      platform,
      userAgent,
      deviceType: userAgent?.includes("Mobile") ? "mobile" : "desktop",
      browser: detectBrowser(userAgent),
      os: detectOs(userAgent),
      isActive: true,
      lastSeenAt: new Date(),
      lastFailedAt: null,
      lastFailureReason: null
    },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      platform,
      userAgent,
      deviceType: userAgent?.includes("Mobile") ? "mobile" : "desktop",
      browser: detectBrowser(userAgent),
      os: detectOs(userAgent),
      lastSeenAt: new Date()
    }
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: { enablePush: true },
    create: { userId: user.id, enablePush: true }
  });

  revalidateNotificationNavigation();
  return NextResponse.json({
    ok: true,
    subscription: {
      id: saved.id,
      platform: saved.platform,
      endpointPreview: endpointPreview(saved.endpoint),
      browser: saved.browser,
      os: saved.os,
      deviceType: saved.deviceType,
      isActive: saved.isActive,
      lastSeenAt: saved.lastSeenAt
    }
  });
}
