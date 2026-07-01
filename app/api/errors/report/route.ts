import { NextResponse } from "next/server";
import type { ErrorSeverity } from "@prisma/client";
import { createOrUpdateErrorReport } from "@/lib/error-command-center";
import { sanitizeJson, sanitizeText } from "@/lib/error-sanitizer";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  try {
    const payload = await request.json();
    const result = await createOrUpdateErrorReport(
      {
        severity: payload.severity as ErrorSeverity | undefined,
        title: payload.title,
        message: sanitizeText(payload.message || "未知錯誤", 3000),
        module: payload.module,
        route: payload.route,
        action: payload.action,
        deviceType: payload.deviceType,
        browser: payload.browser,
        os: payload.os,
        userAgent: payload.userAgent || request.headers.get("user-agent") || "",
        appVersion: payload.appVersion,
        commitHash: payload.commitHash,
        requestId: payload.requestId || request.headers.get("x-request-id") || undefined,
        sessionId: payload.sessionId,
        stackTrace: payload.stackTrace,
        breadcrumbs: Array.isArray(payload.breadcrumbs) ? payload.breadcrumbs : [],
        context: payload.context,
        statusCode: Number(payload.statusCode) || undefined
      },
      user
    );

    return NextResponse.json({
      ok: true,
      id: result.errorReport.id,
      severity: result.errorReport.severity,
      status: result.errorReport.status,
      fingerprint: result.fingerprint,
      isNew: result.isNew,
      codexFixRequestId: result.fixRequest?.id ?? result.errorReport.codexFixRequestId ?? null
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "錯誤回報建立失敗。",
        detail: sanitizeJson(error, 1000)
      },
      { status: 500 }
    );
  }
}
