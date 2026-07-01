import { execSync } from "child_process";
import fs from "fs";
import type { RoleKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/rbac";
import { isApprovalLiteMode } from "@/lib/app-mode";

export const pilotVersionLabel = "Supervisor Pilot v0.1";
export const pilotWarning = "目前為主管測試版 v0.1，請勿輸入正式敏感資料。";

export const pilotDataProtectionWarnings = [
  "請勿輸入真實薪資",
  "請勿輸入正式個資",
  "請勿輸入正式財務資料",
  "請勿上傳正式契約",
  "測試語音請不要錄入真實敏感內容"
];

export const pilotAdminRoleKeys: RoleKey[] = ["SYSTEM_ADMIN", "GENERAL_MANAGER", "EXECUTIVE_ASSISTANT"];

export const pilotAllowedRoleKeys: RoleKey[] = [
  "SYSTEM_ADMIN",
  "GENERAL_MANAGER",
  "EXECUTIVE_ASSISTANT",
  "ADMIN_MANAGER",
  "ACCOUNTING_MANAGER",
  "DESIGN_MANAGER",
  "SOCIAL_MEDIA_MANAGER",
  "HR_MANAGER",
  "CONSTRUCTION_MANAGER",
  "BRANCH_MANAGER",
  "MANAGER"
];

export type PilotChecklistDefinition = {
  key: string;
  label: string;
  category: string;
  roleKey?: RoleKey;
};

const commonChecklist: PilotChecklistDefinition[] = [
  ["login", "登入系統"],
  ["home", "查看自己的首頁工作台"],
  ["today_todo", "查看今日待辦"],
  ["active_tasks", "查看進行中任務"],
  ["overdue_tasks", "查看逾期任務"],
  ["notifications", "查看通知中心"],
  ["enable_pwa", "開啟 PWA Push（手機推播）"],
  ["receive_notification", "測試收到通知"],
  ["record_task_voice", "進任務詳情錄一則語音"],
  ["play_voice", "播放語音"],
  ["voice_listen_record", "確認語音已聽紀錄"],
  ["submit_issue", "送出問題回報"],
  ["view_approvals", "查看電子簽呈"],
  ["approval_action", "測試簽核或查看簽呈"],
  ["submit_feedback", "回報使用問題"]
].map(([key, label]) => ({ key: `common_${key}`, label, category: "共通測試" }));

const roleChecklistMap: Partial<Record<RoleKey, PilotChecklistDefinition[]>> = {
  GENERAL_MANAGER: [
    "查看全公司總覽",
    "查看待總經理核准簽呈",
    "查看全公司逾期任務",
    "查看各部門完成率",
    "查看各館別異常",
    "核准一筆簽呈",
    "駁回一筆簽呈",
    "測試電子手寫簽名",
    "查看緊急 P0 通知",
    "點通知跳轉",
    "確認大字體模式是否清楚"
  ].map((label, index) => ({ key: `gm_${index + 1}`, label, category: "總經理測試", roleKey: "GENERAL_MANAGER" })),
  EXECUTIVE_ASSISTANT: [
    "查看跨部門卡關事項",
    "查看主管未回覆事項",
    "建立一筆追蹤任務",
    "指派跨部門協作任務",
    "測試催辦通知",
    "查看 P0 / P1 通知",
    "查看服務需求流程",
    "回報主管使用問題"
  ].map((label, index) => ({ key: `assistant_${index + 1}`, label, category: "總經理特助測試", roleKey: "EXECUTIVE_ASSISTANT" })),
  ADMIN_MANAGER: [
    "查看行政待辦",
    "建立行政任務",
    "處理設備或庶務需求",
    "回覆一筆服務需求",
    "錄一則語音回覆",
    "測試語音轉任務",
    "查看通知"
  ].map((label, index) => ({ key: `admin_${index + 1}`, label, category: "行政主管測試", roleKey: "ADMIN_MANAGER" })),
  ACCOUNTING_MANAGER: [
    "查看待審請款",
    "查看缺件單據",
    "退回一筆請款",
    "要求補附件",
    "測試會計類簽呈",
    "確認看不到人事敏感資料",
    "確認匯出或查看敏感資料有 Audit Log（稽核紀錄）"
  ].map((label, index) => ({ key: `accounting_${index + 1}`, label, category: "會計主管測試", roleKey: "ACCOUNTING_MANAGER" })),
  DESIGN_MANAGER: [
    "查看設計需求",
    "查看缺素材案件",
    "接收一筆設計需求",
    "要求補素材",
    "錄語音說明修改需求",
    "將語音轉成任務",
    "完成一筆設計服務需求"
  ].map((label, index) => ({ key: `design_${index + 1}`, label, category: "美工主管測試", roleKey: "DESIGN_MANAGER" })),
  SOCIAL_MEDIA_MANAGER: [
    "查看本週拍攝任務",
    "查看待剪輯",
    "查看待發布",
    "建立拍攝任務",
    "要求門市提供素材",
    "錄語音補充企劃說明",
    "測試通知與任務跳轉"
  ].map((label, index) => ({ key: `social_${index + 1}`, label, category: "自媒體主管測試", roleKey: "SOCIAL_MEDIA_MANAGER" })),
  HR_MANAGER: [
    "查看新人訓練進度",
    "查看試用期提醒",
    "查看課程完成率",
    "建立一筆訓練任務",
    "測試人事資料權限",
    "確認其他主管看不到人事敏感資料"
  ].map((label, index) => ({ key: `hr_${index + 1}`, label, category: "人事主管測試", roleKey: "HR_MANAGER" })),
  CONSTRUCTION_MANAGER: [
    "查看工程進度",
    "建立工程任務",
    "上傳現場照片",
    "錄一則現場語音",
    "將語音轉成服務需求",
    "建立缺失改善",
    "測試請款簽呈"
  ].map((label, index) => ({ key: `construction_${index + 1}`, label, category: "建設主管測試", roleKey: "CONSTRUCTION_MANAGER" }))
};

const footMassageBranchChecklist: PilotChecklistDefinition[] = [
  "查看自己館別今日任務",
  "查看客訴或異常",
  "回報現場問題",
  "錄語音說明現場狀況",
  "將語音轉問題回報",
  "查看館別通知",
  "確認看不到其他館別資料"
].map((label, index) => ({ key: `branch_foot_${index + 1}`, label, category: "好腳舍館別主管測試", roleKey: "BRANCH_MANAGER" }));

const efsBranchChecklist: PilotChecklistDefinition[] = [
  "查看自己門市任務",
  "查看商品異常",
  "查看庫存盤點",
  "回報退換貨",
  "錄語音說明商品問題",
  "將語音轉成服務需求",
  "確認看不到其他館別資料"
].map((label, index) => ({ key: `branch_efs_${index + 1}`, label, category: "EFS 館別主管測試", roleKey: "BRANCH_MANAGER" }));

export function canAccessPilot(user: CurrentUser | null | undefined) {
  if (isApprovalLiteMode()) return canAccessPilotAdmin(user);
  return Boolean(user?.roleKey && pilotAllowedRoleKeys.includes(user.roleKey));
}

export function canAccessPilotAdmin(user: CurrentUser | null | undefined) {
  return Boolean(user?.roleKey && pilotAdminRoleKeys.includes(user.roleKey));
}

export function getPilotChecklistForUser(user: CurrentUser): PilotChecklistDefinition[] {
  if (user.roleKey === "BRANCH_MANAGER") {
    const isEfs = `${user.storeName ?? ""} ${user.departmentName ?? ""}`.toUpperCase().includes("EFS");
    return [...commonChecklist, ...(isEfs ? efsBranchChecklist : footMassageBranchChecklist)];
  }
  if (user.roleKey === "MANAGER" || user.roleKey === "SYSTEM_ADMIN") {
    return [
      ...commonChecklist,
      ...[
        "查看所屬部門資料",
        "建立一筆主管測試任務",
        "確認權限範圍正確",
        "回報主管測試問題"
      ].map((label, index) => ({ key: `manager_${index + 1}`, label, category: "主管測試", roleKey: user.roleKey }))
    ];
  }
  return [...commonChecklist, ...(roleChecklistMap[user.roleKey] ?? [])];
}

export async function ensurePilotChecklist(user: CurrentUser) {
  const definitions = getPilotChecklistForUser(user);
  await Promise.all(
    definitions.map((item) =>
      prisma.pilotChecklistItem.upsert({
        where: { userId_itemKey: { userId: user.id, itemKey: item.key } },
        update: {
          label: item.label,
          category: item.category,
          roleKey: item.roleKey ?? null
        },
        create: {
          userId: user.id,
          itemKey: item.key,
          label: item.label,
          category: item.category,
          roleKey: item.roleKey ?? null
        }
      })
    )
  );
  return prisma.pilotChecklistItem.findMany({
    where: { userId: user.id },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }]
  });
}

export function scoreLabel(score: number) {
  return `${score} 分`;
}

export function getSystemCommitHash() {
  const bundledGit = "C:\\Users\\User\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\git\\cmd\\git.exe";
  const commands = ["git rev-parse --short HEAD"];
  if (fs.existsSync(bundledGit)) commands.push(`"${bundledGit}" rev-parse --short HEAD`);

  for (const command of commands) {
    try {
      return execSync(command, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      // Keep trying fallbacks.
    }
  }
  return "unknown";
}
