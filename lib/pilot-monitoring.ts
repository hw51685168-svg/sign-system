import type { CodexFixRequestStatus, ErrorReportStatus } from "@prisma/client";
import { pilotAllowedRoleKeys } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";

export const activeErrorStatuses: ErrorReportStatus[] = ["OPEN", "TRIAGED", "CODEX_REQUESTED", "IN_PROGRESS", "FIXED"];
export const activeCodexStatuses: CodexFixRequestStatus[] = ["DRAFT", "READY", "SENT_TO_CODEX", "GITHUB_ISSUE_CREATED", "IN_PROGRESS", "FIX_PROPOSED"];

export function getTodayRange() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  return { todayStart, todayEnd };
}

function percent(total: number, value: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export async function getPilotMonitoringData() {
  const { todayStart, todayEnd } = getTodayRange();

  const [
    accounts,
    p0BugCount,
    p1BugCount,
    p0ErrorCount,
    p1ErrorCount,
    todayErrorCount,
    unresolvedErrorCount,
    codexFixCount,
    githubIssueCount,
    todayCompletedChecklistCount,
    todayFeedbackCount,
    todayBugCount,
    todayP0ErrorCount,
    todayP1ErrorCount,
    todayCodexFixCount,
    todayPushSubscriptions,
    todayPushPreferences,
    todayVoiceMessages,
    todayVoiceListens,
    pendingCodexFixRequests,
    todayHighPriorityErrors
  ] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, role: { key: { in: pilotAllowedRoleKeys } } },
      include: {
        role: true,
        department: true,
        store: true,
        notificationPreferences: true,
        pushSubscriptions: { where: { isActive: true }, take: 1 },
        pilotChecklistItems: true,
        pilotFeedbacks: true,
        pilotBugReports: true,
        voiceMessagesSent: { select: { id: true }, take: 1 },
        voiceMessageListens: { select: { id: true }, take: 1 }
      },
      orderBy: [{ role: { key: "asc" } }, { name: "asc" }]
    }),
    prisma.pilotBugReport.count({ where: { severity: "P0", status: { not: "DONE" } } }),
    prisma.pilotBugReport.count({ where: { severity: "P1", status: { not: "DONE" } } }),
    prisma.errorReport.count({ where: { severity: "P0", status: { in: activeErrorStatuses } } }),
    prisma.errorReport.count({ where: { severity: "P1", status: { in: activeErrorStatuses } } }),
    prisma.errorReport.count({ where: { lastSeenAt: { gte: todayStart }, status: { not: "IGNORED" } } }),
    prisma.errorReport.count({ where: { isResolved: false, status: { not: "IGNORED" } } }),
    prisma.codexFixRequest.count(),
    prisma.errorReport.count({ where: { githubIssueUrl: { not: null }, status: { not: "IGNORED" } } }),
    prisma.pilotChecklistItem.count({
      where: { isCompleted: true, completedAt: { gte: todayStart }, user: { isActive: true, role: { key: { in: pilotAllowedRoleKeys } } } }
    }),
    prisma.pilotFeedback.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.pilotBugReport.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.errorReport.count({ where: { severity: "P0", lastSeenAt: { gte: todayStart }, status: { not: "IGNORED" } } }),
    prisma.errorReport.count({ where: { severity: "P1", lastSeenAt: { gte: todayStart }, status: { not: "IGNORED" } } }),
    prisma.codexFixRequest.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.pushSubscription.findMany({
      where: { isActive: true, updatedAt: { gte: todayStart }, user: { isActive: true, role: { key: { in: pilotAllowedRoleKeys } } } },
      distinct: ["userId"],
      select: { userId: true }
    }),
    prisma.notificationPreference.findMany({
      where: { enablePush: true, updatedAt: { gte: todayStart }, user: { isActive: true, role: { key: { in: pilotAllowedRoleKeys } } } },
      distinct: ["userId"],
      select: { userId: true }
    }),
    prisma.voiceMessage.findMany({
      where: { createdAt: { gte: todayStart }, sender: { isActive: true, role: { key: { in: pilotAllowedRoleKeys } } } },
      distinct: ["senderId"],
      select: { senderId: true }
    }),
    prisma.voiceMessageListen.findMany({
      where: {
        OR: [{ startedAt: { gte: todayStart } }, { updatedAt: { gte: todayStart } }],
        user: { isActive: true, role: { key: { in: pilotAllowedRoleKeys } } }
      },
      distinct: ["userId"],
      select: { userId: true }
    }),
    prisma.codexFixRequest.findMany({
      where: { status: { in: activeCodexStatuses } },
      include: { errorReport: true },
      orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
      take: 20
    }),
    prisma.errorReport.findMany({
      where: { severity: { in: ["P0", "P1"] }, lastSeenAt: { gte: todayStart }, status: { not: "IGNORED" } },
      orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
      take: 20
    })
  ]);

  const loggedInCount = accounts.filter((account) => account.lastLoginAt).length;
  const todayLoggedInCount = accounts.filter((account) => account.lastLoginAt && account.lastLoginAt >= todayStart).length;
  const pushReadyCount = accounts.filter((account) => account.pushSubscriptions.length > 0 || account.notificationPreferences?.enablePush).length;
  const voiceReadyCount = accounts.filter((account) => account.voiceMessagesSent.length > 0 || account.voiceMessageListens.length > 0).length;
  const feedbackCount = accounts.filter((account) => account.pilotFeedbacks.length > 0).length;
  const bugReporterCount = accounts.filter((account) => account.pilotBugReports.length > 0).length;
  const completedChecklistCount = accounts.filter(
    (account) => account.pilotChecklistItems.length > 0 && account.pilotChecklistItems.every((item) => item.isCompleted)
  ).length;
  const todayPushUserIds = new Set([...todayPushSubscriptions.map((item) => item.userId), ...todayPushPreferences.map((item) => item.userId)]);
  const todayVoiceUserIds = new Set([...todayVoiceMessages.map((item) => item.senderId), ...todayVoiceListens.map((item) => item.userId)]);

  const dailySummary = {
    todayStart,
    todayEnd,
    todayLoggedInSupervisorCount: todayLoggedInCount,
    notLoggedInTodaySupervisorCount: accounts.length - todayLoggedInCount,
    todayCompletedChecklistCount,
    todayFeedbackCount,
    todayBugCount,
    todayP0ErrorCount,
    todayP1ErrorCount,
    todayCodexFixCount,
    todayPushEnabledUserCount: todayPushUserIds.size,
    todayVoiceTestCompletedUserCount: todayVoiceUserIds.size
  };

  const completion = {
    totalSupervisors: accounts.length,
    loggedInCount,
    notLoggedInCount: accounts.length - loggedInCount,
    completedChecklistCount,
    pushReadyCount,
    voiceReadyCount,
    feedbackCount,
    bugReporterCount,
    pushReadyRate: percent(accounts.length, pushReadyCount),
    voiceReadyRate: percent(accounts.length, voiceReadyCount)
  };

  return {
    accounts,
    dailySummary,
    completion,
    p0BugCount,
    p1BugCount,
    p0ErrorCount,
    p1ErrorCount,
    todayErrorCount,
    unresolvedErrorCount,
    codexFixCount,
    githubIssueCount,
    pendingCodexFixRequests,
    todayHighPriorityErrors
  };
}

export function buildPilotDailyReport(data: Awaited<ReturnType<typeof getPilotMonitoringData>>) {
  const loggedInSupervisors = data.accounts.filter((account) => account.lastLoginAt);
  const notLoggedInSupervisors = data.accounts.filter((account) => !account.lastLoginAt);

  return {
    date: data.dailySummary.todayStart.toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    summary: {
      totalSupervisors: data.completion.totalSupervisors,
      todayLoggedInSupervisorCount: data.dailySummary.todayLoggedInSupervisorCount,
      notLoggedInTodaySupervisorCount: data.dailySummary.notLoggedInTodaySupervisorCount,
      loggedInSupervisorCount: data.completion.loggedInCount,
      neverLoggedInSupervisorCount: data.completion.notLoggedInCount,
      completedChecklistSupervisorCount: data.completion.completedChecklistCount,
      todayCompletedChecklistItemCount: data.dailySummary.todayCompletedChecklistCount,
      todayFeedbackCount: data.dailySummary.todayFeedbackCount,
      todayBugCount: data.dailySummary.todayBugCount,
      todayP0ErrorCount: data.dailySummary.todayP0ErrorCount,
      todayP1ErrorCount: data.dailySummary.todayP1ErrorCount,
      todayCodexFixRequestCount: data.dailySummary.todayCodexFixCount,
      pushReadyRate: `${data.completion.pushReadyRate}%`,
      voiceReadyRate: `${data.completion.voiceReadyRate}%`
    },
    loggedInSupervisors: loggedInSupervisors.map((account) => ({
      name: account.name,
      email: account.email,
      role: account.role.name,
      departmentOrStore: account.store?.name ?? account.department?.name ?? null,
      lastLoginAt: account.lastLoginAt?.toISOString() ?? null
    })),
    notLoggedInSupervisors: notLoggedInSupervisors.map((account) => ({
      name: account.name,
      email: account.email,
      role: account.role.name,
      departmentOrStore: account.store?.name ?? account.department?.name ?? null
    })),
    todayHighPriorityErrors: data.todayHighPriorityErrors.map((error) => ({
      id: error.id,
      severity: error.severity,
      title: error.title,
      route: error.route,
      status: error.status,
      lastSeenAt: error.lastSeenAt.toISOString()
    })),
    pendingCodexFixRequests: data.pendingCodexFixRequests.map((request) => ({
      id: request.id,
      severity: request.severity,
      title: request.title,
      sourceError: request.errorReport.title,
      status: request.status,
      wroteCodexInbox: Boolean(request.sentToCodexAt),
      githubIssueUrl: request.githubIssueUrl,
      createdAt: request.createdAt.toISOString()
    })),
    pendingActions: {
      unresolvedSystemErrors: data.unresolvedErrorCount,
      p0p1Bugs: data.p0BugCount + data.p1BugCount,
      pendingCodexFixRequests: data.pendingCodexFixRequests.length
    }
  };
}
