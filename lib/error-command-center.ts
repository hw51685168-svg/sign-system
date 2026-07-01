import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { Prisma, type CodexFixRequest, type ErrorReport, type ErrorSeverity, type RoleKey } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { pilotVersionLabel, getSystemCommitHash } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/rbac";
import { sendPushForNotification } from "@/lib/push";
import { normalizeErrorMessage, safeTitle, sanitizeJson, sanitizeText } from "@/lib/error-sanitizer";

export const errorAdminRoleKeys: RoleKey[] = ["SYSTEM_ADMIN", "GENERAL_MANAGER", "EXECUTIVE_ASSISTANT"];

export function canAccessErrorCommandCenter(user: CurrentUser | null | undefined) {
  return Boolean(user?.roleKey && errorAdminRoleKeys.includes(user.roleKey));
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type ErrorBreadcrumbInput = {
  timestamp?: string | Date;
  type: string;
  label: string;
  route?: string;
  metadata?: unknown;
};

export type CreateErrorReportInput = {
  severity?: ErrorSeverity;
  title?: string;
  message: string;
  module?: string;
  route?: string;
  action?: string;
  userId?: string | null;
  userRole?: string | null;
  departmentId?: string | null;
  branchId?: string | null;
  businessUnitId?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  os?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  commitHash?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  stackTrace?: string | null;
  breadcrumbs?: ErrorBreadcrumbInput[];
  context?: unknown;
  statusCode?: number;
};

function getTopStackFrame(stack?: string | null) {
  if (!stack) return "";
  return sanitizeText(stack)
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.includes(".ts") || line.includes(".tsx") || line.includes(".js") || line.includes(".mjs")) ?? "";
}

export function classifySeverity(input: Pick<CreateErrorReportInput, "severity" | "message" | "module" | "route" | "action" | "statusCode">): ErrorSeverity {
  if (input.severity) return input.severity;
  const text = `${input.message} ${input.module ?? ""} ${input.route ?? ""} ${input.action ?? ""}`.toLowerCase();
  if (input.statusCode && input.statusCode >= 500) return "P1";
  if (text.includes("login") || text.includes("auth") || text.includes("permission denied")) return "P0";
  if (text.includes("voice") || text.includes("pwa") || text.includes("push") || text.includes("pdf")) return "P1";
  if (text.includes("404") || text.includes("not found")) return "P2";
  return "P2";
}

export function makeErrorFingerprint(input: Pick<CreateErrorReportInput, "module" | "route" | "message" | "stackTrace" | "action">) {
  const normalized = [
    input.module || "unknown-module",
    input.route || "unknown-route",
    normalizeErrorMessage(input.message || "unknown-message"),
    getTopStackFrame(input.stackTrace),
    input.action || "unknown-action"
  ].join("|");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 40);
}

function detectBrowser(userAgent?: string | null) {
  const ua = userAgent || "";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/") && !ua.includes("Edg/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return undefined;
}

function detectOs(userAgent?: string | null) {
  const ua = userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  return undefined;
}

function detectDevice(userAgent?: string | null) {
  const ua = userAgent || "";
  if (/iPhone|Android.+Mobile/.test(ua)) return "手機";
  if (/iPad|Tablet/.test(ua)) return "平板";
  return "電腦";
}

export function suspectedFilesForError(error: Pick<ErrorReport, "route" | "module" | "message" | "action">) {
  const text = `${error.route ?? ""} ${error.module ?? ""} ${error.message ?? ""} ${error.action ?? ""}`.toLowerCase();
  const files = new Set<string>();
  if (text.includes("voice") || text.includes("語音")) {
    files.add("components/voice-recorder.tsx");
    files.add("components/voice-player.tsx");
    files.add("components/voice-thread.tsx");
    files.add("lib/voice.ts");
    files.add("app/api/chat/voice/[voiceMessageId]/route.ts");
  }
  if (text.includes("push") || text.includes("pwa") || text.includes("notification") || text.includes("service worker")) {
    files.add("components/push-status-panel.tsx");
    files.add("components/notification-client.tsx");
    files.add("lib/push.ts");
    files.add("public/sw.js");
  }
  if (text.includes("approval") || text.includes("簽呈")) {
    files.add("app/(app)/approvals/[id]/page.tsx");
    files.add("app/api/approvals/[id]/actions/route.ts");
    files.add("app/api/approvals/[id]/signature/route.ts");
  }
  if (text.includes("task") || text.includes("任務")) {
    files.add("app/(app)/tasks/[id]/page.tsx");
    files.add("app/api/tasks/[id]/status/route.ts");
  }
  if (text.includes("service") || text.includes("服務")) {
    files.add("app/(app)/services/requests/[id]/page.tsx");
    files.add("app/api/services/requests/[id]/actions/route.ts");
  }
  if (text.includes("pilot") || text.includes("bug") || text.includes("回報")) {
    files.add("app/(app)/pilot/bug-report/page.tsx");
    files.add("app/api/pilot/bug-report/route.ts");
  }
  if (text.includes("pdf")) files.add("app/api/approvals/[id]/export/route.ts");
  if (files.size === 0) {
    files.add("app/(app)/page.tsx");
    files.add("components/app-shell.tsx");
  }
  return Array.from(files);
}

function buildCodexPrompt(error: ErrorReport, suspectedFiles: string[]) {
  const context = sanitizeJson({
    appVersion: error.appVersion,
    commitHash: error.commitHash,
    module: error.module,
    route: error.route,
    action: error.action,
    userRole: error.userRole,
    device: error.deviceType,
    browser: error.browser,
    os: error.os,
    requestId: error.requestId,
    sessionId: error.sessionId
  });

  return sanitizeText(`# ${error.severity} Codex 修復單

Title:
[${error.severity}] ${error.title}

Context:
${context}

Problem:
${error.message}

Steps to reproduce:
1. 以對應角色登入系統。
2. 進入 route：${error.route ?? "未提供"}。
3. 執行 action：${error.action ?? "未提供"}。
4. 觀察錯誤是否重現。

Expected behavior:
流程應正常完成，並保留必要 Audit Log（稽核紀錄）。

Actual behavior:
${error.message}

Sanitized logs:
${error.stackTraceSanitized ?? "未提供 stack trace"}

Related files suspected:
${suspectedFiles.map((file) => `- ${file}`).join("\n")}

Constraints:
1. 不可刪除正式資料。
2. 不可 drop database。
3. 不可覆蓋 .env。
4. 不可輸出 token、cookie、密碼、.env、個資、薪資、財務、契約、語音內容或電子簽名。
5. 必須執行 prisma validate。
6. 必須執行 npm run build。

Acceptance criteria:
1. 錯誤可重現或已有明確保護。
2. 修復後相關流程可正常操作。
3. build 成功。
4. 權限檢查正常。
5. 手機/PWA 相關測試正常（若適用）。
6. 不新增敏感資料外洩風險。
`);
}

export async function createCodexFixRequestForError(errorReportId: string, createdByUserId?: string | null) {
  const error = await prisma.errorReport.findUnique({ where: { id: errorReportId } });
  if (!error) throw new Error("找不到錯誤回報。");

  const existing = await prisma.codexFixRequest.findUnique({ where: { errorReportId } });
  if (existing) return existing;

  const suspectedFiles = suspectedFilesForError(error);
  const prompt = buildCodexPrompt(error, suspectedFiles);
  const reproductionSteps = sanitizeText(`1. 登入測試帳號。
2. 前往 ${error.route ?? "錯誤發生頁面"}。
3. 執行 ${error.action ?? "錯誤發生動作"}。
4. 確認是否出現：${error.message}`);
  const acceptanceCriteria = sanitizeText("prisma validate 成功、npm run build 成功、錯誤流程可操作、不得輸出敏感資料。");

  let fixRequest: CodexFixRequest;
  try {
    fixRequest = await prisma.codexFixRequest.create({
      data: {
        errorReportId,
        severity: error.severity,
        title: `[${error.severity}] ${error.title}`,
        codexPrompt: prompt,
        sanitizedContextJson: error.contextJsonSanitized,
        suspectedFilesJson: sanitizeJson(suspectedFiles),
        reproductionSteps,
        acceptanceCriteria,
        status: "READY",
        createdByUserId: createdByUserId ?? null
      }
    });
  } catch (createError) {
    if (!isUniqueConstraintError(createError)) throw createError;
    const concurrentFixRequest = await prisma.codexFixRequest.findUnique({ where: { errorReportId } });
    if (!concurrentFixRequest) throw createError;
    return concurrentFixRequest;
  }

  await prisma.errorReport.update({
    where: { id: errorReportId },
    data: { status: "CODEX_REQUESTED", codexFixRequestId: fixRequest.id }
  });

  await prisma.auditLog.create({
    data: {
      actorId: createdByUserId ?? null,
      action: "CODEX_FIX_REQUEST_CREATE",
      resourceType: "CodexFixRequest",
      resourceId: fixRequest.id,
      metadata: sanitizeJson({ errorReportId, severity: error.severity })
    }
  });

  return fixRequest;
}

function slugify(value: string) {
  return sanitizeText(value, 60)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "error";
}

export async function writeCodexInboxFile(fixRequestId: string) {
  const fixRequest = await prisma.codexFixRequest.findUnique({
    where: { id: fixRequestId },
    include: { errorReport: true }
  });
  if (!fixRequest) throw new Error("找不到 Codex 修復單。");

  const inboxDir = process.env.CODEX_INBOX_DIR || path.join(process.cwd(), "CODEX_INBOX");
  await mkdir(inboxDir, { recursive: true });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const fileName = `${fixRequest.severity}-${stamp}-${slugify(fixRequest.title)}.md`;
  const filePath = path.join(inboxDir, fileName);
  await writeFile(filePath, fixRequest.codexPrompt, "utf8");

  await prisma.codexFixRequest.update({
    where: { id: fixRequest.id },
    data: { status: "SENT_TO_CODEX", sentToCodexAt: now }
  });

  await prisma.auditLog.create({
    data: {
      actorId: fixRequest.createdByUserId ?? null,
      action: "CODEX_INBOX_WRITE",
      resourceType: "CodexFixRequest",
      resourceId: fixRequest.id,
      metadata: sanitizeJson({ filePath })
    }
  });

  return filePath;
}

async function notifyErrorAdmins(error: ErrorReport, fixRequest?: CodexFixRequest | null) {
  const roleKeys: RoleKey[] = error.severity === "P0" ? ["SYSTEM_ADMIN", "EXECUTIVE_ASSISTANT", "GENERAL_MANAGER"] : ["SYSTEM_ADMIN"];
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { key: { in: roleKeys } } },
    select: { id: true }
  });

  const notifications = await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: `${error.severity} 系統錯誤回報`,
        body: `${error.title}（${error.route ?? "未提供頁面"}）`,
        type: "ERROR_REPORT",
        priority: error.severity === "P0" ? "URGENT" : error.severity === "P1" ? "HIGH" : "MEDIUM",
        targetUrl: `/admin/errors/${error.id}`,
        sourceType: "error_report",
        sourceId: error.id,
        dedupeKey: `error-report:${error.id}:${admin.id}:${error.occurrenceCount}`
      })
    )
  );

  if (error.severity === "P0") await Promise.all(notifications.map((notification) => sendPushForNotification(notification.id)));
  return { notifications, fixRequest };
}

export async function maybeCreateGitHubIssue(fixRequestId: string) {
  if (process.env.GITHUB_AUTO_CREATE_ISSUE !== "true") return { created: false, reason: "GITHUB_AUTO_CREATE_ISSUE is false" };
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) return { created: false, reason: "GitHub env vars are not configured" };

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const createdToday = await prisma.codexFixRequest.count({
    where: { githubIssueUrl: { not: null }, createdAt: { gte: start } }
  });
  if (createdToday >= 5) return { created: false, reason: "Daily GitHub issue limit reached" };

  const fixRequest = await prisma.codexFixRequest.findUnique({ where: { id: fixRequestId }, include: { errorReport: true } });
  if (!fixRequest) return { created: false, reason: "Codex fix request not found" };
  if (fixRequest.githubIssueUrl) return { created: false, reason: "GitHub issue already exists", url: fixRequest.githubIssueUrl };

  const mention = process.env.CODEX_GITHUB_MENTION === "true" ? "\n\n@codex please investigate and propose a fix." : "";
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "huangxiang-error-command-center"
    },
    body: JSON.stringify({
      title: fixRequest.title,
      body: sanitizeText(`${fixRequest.codexPrompt}${mention}`),
      labels: ["bug", "codex-ready", fixRequest.severity]
    })
  });

  if (!response.ok) {
    return { created: false, reason: sanitizeText(await response.text(), 1000) };
  }
  const payload = (await response.json()) as { html_url?: string; number?: number };
  await prisma.codexFixRequest.update({
    where: { id: fixRequest.id },
    data: {
      status: "GITHUB_ISSUE_CREATED",
      githubIssueUrl: payload.html_url ?? null,
      githubIssueNumber: payload.number ?? null
    }
  });
  await prisma.errorReport.update({
    where: { id: fixRequest.errorReportId },
    data: { githubIssueUrl: payload.html_url ?? null }
  });
  return { created: true, url: payload.html_url, number: payload.number };
}

export async function createOrUpdateErrorReport(input: CreateErrorReportInput, actor?: CurrentUser | null) {
  const userAgent = sanitizeText(input.userAgent || "", 2000);
  const severity = classifySeverity(input);
  const stackTraceSanitized = sanitizeText(input.stackTrace || "", 12000) || null;
  const contextJsonSanitized = input.context === undefined ? null : sanitizeJson(input.context);
  const breadcrumbsJson = input.breadcrumbs ? sanitizeJson(input.breadcrumbs, 12000) : null;
  const fingerprint = makeErrorFingerprint({ ...input, stackTrace: stackTraceSanitized });
  const now = new Date();

  const createData: Prisma.ErrorReportCreateInput = {
    severity,
    status: "OPEN",
    title: safeTitle(input.title || input.message),
    message: sanitizeText(input.message, 3000),
    module: sanitizeText(input.module || "unknown", 160) || "unknown",
    route: sanitizeText(input.route || "", 300) || null,
    action: sanitizeText(input.action || "", 200) || null,
    user: actor?.id ? { connect: { id: actor.id } } : undefined,
    userRole: sanitizeText(actor?.roleKey || input.userRole || "", 80) || null,
    departmentId: actor?.departmentId ?? input.departmentId ?? null,
    branchId: actor?.storeId ?? input.branchId ?? null,
    businessUnitId: actor?.businessUnitId ?? input.businessUnitId ?? null,
    deviceType: sanitizeText(input.deviceType || detectDevice(userAgent), 80),
    browser: sanitizeText(input.browser || detectBrowser(userAgent) || "", 80) || null,
    os: sanitizeText(input.os || detectOs(userAgent) || "", 80) || null,
    userAgent,
    appVersion: sanitizeText(input.appVersion || pilotVersionLabel, 120),
    commitHash: sanitizeText(input.commitHash || getSystemCommitHash(), 80),
    requestId: sanitizeText(input.requestId || "", 120) || null,
    sessionId: sanitizeText(input.sessionId || "", 120) || null,
    stackTraceSanitized,
    breadcrumbsJson,
    contextJsonSanitized,
    fingerprint,
    firstSeenAt: now,
    lastSeenAt: now
  };

  const updateExistingReport = (existingReport: ErrorReport) =>
    prisma.errorReport.update({
      where: { id: existingReport.id },
      data: {
        occurrenceCount: { increment: 1 },
        lastSeenAt: now,
        severity,
        title: createData.title,
        message: createData.message,
        module: createData.module,
        route: createData.route,
        action: createData.action,
        userRole: createData.userRole,
        departmentId: createData.departmentId,
        branchId: createData.branchId,
        businessUnitId: createData.businessUnitId,
        deviceType: createData.deviceType,
        browser: createData.browser,
        os: createData.os,
        userAgent: createData.userAgent,
        appVersion: createData.appVersion,
        commitHash: createData.commitHash,
        requestId: createData.requestId,
        sessionId: createData.sessionId,
        stackTraceSanitized,
        breadcrumbsJson,
        contextJsonSanitized,
        ...(existingReport.status === "CLOSED" || existingReport.status === "IGNORED" ? { status: "OPEN", isResolved: false, resolvedAt: null } : {})
      }
    });

  let existing = await prisma.errorReport.findUnique({ where: { fingerprint } });
  let error: ErrorReport;
  let isNew = false;
  if (existing) {
    error = await updateExistingReport(existing);
  } else {
    try {
      error = await prisma.errorReport.create({ data: createData });
      isNew = true;
    } catch (createError) {
      if (!isUniqueConstraintError(createError)) throw createError;
      existing = await prisma.errorReport.findUnique({ where: { fingerprint } });
      if (!existing) throw createError;
      error = await updateExistingReport(existing);
    }
  }

  const breadcrumbs = (input.breadcrumbs || []).slice(-20);
  if (breadcrumbs.length > 0) {
    await prisma.errorBreadcrumb.createMany({
      data: breadcrumbs.map((item) => ({
        errorReportId: error.id,
        timestamp: item.timestamp ? new Date(item.timestamp) : now,
        type: sanitizeText(item.type, 80) || "event",
        label: sanitizeText(item.label, 300) || "未命名事件",
        route: sanitizeText(item.route || input.route || "", 300) || null,
        metadataJsonSanitized: item.metadata === undefined ? null : sanitizeJson(item.metadata, 3000)
      }))
    });
  }

  let fixRequest: CodexFixRequest | null = null;
  if ((severity === "P0" || severity === "P1") && !error.codexFixRequestId) {
    fixRequest = await createCodexFixRequestForError(error.id, actor?.id ?? null);
    if (severity === "P0") {
      await writeCodexInboxFile(fixRequest.id);
      const github = await maybeCreateGitHubIssue(fixRequest.id);
      if (github.created && github.url) {
        await prisma.errorReport.update({ where: { id: error.id }, data: { githubIssueUrl: github.url } });
      }
    }
  }

  if (severity === "P0" || severity === "P1") {
    await notifyErrorAdmins(error, fixRequest);
  }

  return { errorReport: error, fixRequest, fingerprint, isNew };
}
