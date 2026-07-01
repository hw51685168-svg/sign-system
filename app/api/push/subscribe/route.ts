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
};

function detectBrowser(userAgent: string | null) {
  if (!userAgent) return null;
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("CriOS") || userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Firefox")) return "Firefox";
  return "Unknown";
}

function detectOs(userAgent: string | null) {
  if (!userAgent) return null;
  if (userAgent.includes("iPhone") || userAgent.includes("iPad")) return "iOS";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS")) return "macOS";
  return "Unknown";
}

export async function POST(request: Request) {
  const user = await requireUser();
  const subscription = (await request.json()) as BrowserSubscription;
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      userId: user.id,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: request.headers.get("user-agent"),
      deviceType: request.headers.get("user-agent")?.includes("Mobile") ? "mobile" : "desktop",
      browser: detectBrowser(request.headers.get("user-agent")),
      os: detectOs(request.headers.get("user-agent")),
      isActive: true,
      lastFailedAt: null
    },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: request.headers.get("user-agent"),
      deviceType: request.headers.get("user-agent")?.includes("Mobile") ? "mobile" : "desktop",
      browser: detectBrowser(request.headers.get("user-agent")),
      os: detectOs(request.headers.get("user-agent"))
    }
  });

  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: { enablePush: true },
    create: { userId: user.id, enablePush: true }
  });

  revalidateNotificationNavigation();
  return NextResponse.json({ ok: true });
}
