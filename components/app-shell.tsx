import {
  Bell,
  BookOpenCheck,
  Bug,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  Flag,
  Gauge,
  MessageSquareWarning,
  PackageCheck,
  Settings,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
  Wrench
} from "lucide-react";
import type { RoleKey } from "@prisma/client";
import type { ComponentType } from "react";
import { AccessibilityToggle } from "@/components/accessibility-toggle";
import { NotificationBadge } from "@/components/notification-badge";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { isApprovalLiteMode } from "@/lib/app-mode";
import { roleLabels } from "@/lib/labels";
import { pilotAdminRoleKeys, pilotAllowedRoleKeys, pilotVersionLabel } from "@/lib/pilot";
import { prisma } from "@/lib/prisma";
import { headOfficeRoleKeys, storeScopedRoleKeys } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/session";

type NavGroup = "main" | "work" | "pilot" | "manage";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: NavGroup;
  roles?: RoleKey[];
};

const managerLikeRoles: RoleKey[] = [
  "GENERAL_MANAGER",
  "EXECUTIVE_ASSISTANT",
  "ADMIN_MANAGER",
  "ACCOUNTING_MANAGER",
  "DESIGN_MANAGER",
  "SOCIAL_MEDIA_MANAGER",
  "HR_MANAGER",
  "CONSTRUCTION_MANAGER",
  "BRANCH_MANAGER",
  "MANAGER",
  "SYSTEM_ADMIN"
];

const navItems: NavItem[] = [
  { href: "/", label: "首頁工作台", icon: Gauge, group: "main" },
  { href: "/approvals", label: "電子簽呈", icon: FileCheck2, group: "main" },
  { href: "/tasks", label: "任務追蹤", icon: ClipboardList, group: "main" },
  {
    href: "/issues",
    label: "問題回報",
    icon: Store,
    group: "main",
    roles: ["EXECUTIVE_ASSISTANT", "ADMIN_MANAGER", "ACCOUNTING_MANAGER", "DESIGN_MANAGER", "SOCIAL_MEDIA_MANAGER", "HR_MANAGER", "CONSTRUCTION_MANAGER", "BRANCH_MANAGER", "MANAGER", "STAFF", "STORE_STAFF", "SYSTEM_ADMIN"]
  },
  { href: "/services", label: "服務需求", icon: Wrench, group: "main" },
  { href: "/notifications", label: "通知中心", icon: Bell, group: "main" },
  { href: "/announcements", label: "公告確認", icon: Bell, group: "work" },
  {
    href: "/inventory",
    label: "倉管補貨",
    icon: PackageCheck,
    group: "work",
    roles: ["GENERAL_MANAGER", "EXECUTIVE_ASSISTANT", "ADMIN_MANAGER", "ACCOUNTING_MANAGER", "BRANCH_MANAGER", "MANAGER", "STAFF", "STORE_STAFF", "SYSTEM_ADMIN"]
  },
  {
    href: "/audits",
    label: "稽核表單",
    icon: ClipboardCheck,
    group: "work",
    roles: ["GENERAL_MANAGER", "EXECUTIVE_ASSISTANT", "ADMIN_MANAGER", "HR_MANAGER", "BRANCH_MANAGER", "MANAGER", "SYSTEM_ADMIN"]
  },
  { href: "/pilot/checklist", label: "測試清單", icon: BookOpenCheck, group: "pilot", roles: pilotAllowedRoleKeys },
  { href: "/pilot/guide", label: "測試教學", icon: ClipboardCheck, group: "pilot", roles: pilotAllowedRoleKeys },
  { href: "/pilot/feedback", label: "回饋表單", icon: MessageSquareWarning, group: "pilot", roles: pilotAllowedRoleKeys },
  { href: "/pilot/bug-report", label: "Bug 回報", icon: Flag, group: "pilot", roles: pilotAllowedRoleKeys },
  { href: "/settings/notifications", label: "PWA 推播設定", icon: Smartphone, group: "pilot", roles: pilotAllowedRoleKeys },
  { href: "/admin/pilot", label: "主管實測管理", icon: ShieldCheck, group: "pilot", roles: pilotAdminRoleKeys },
  { href: "/admin/pilot/status", label: "測試狀態看板", icon: Gauge, group: "pilot", roles: pilotAdminRoleKeys },
  { href: "/admin/users", label: "使用者與權限", icon: Users, group: "manage", roles: ["SYSTEM_ADMIN"] },
  { href: "/admin/errors", label: "錯誤中心", icon: Bug, group: "manage", roles: ["SYSTEM_ADMIN", "GENERAL_MANAGER", "EXECUTIVE_ASSISTANT"] },
  { href: "/settings/roles-permissions", label: "角色權限表", icon: ShieldCheck, group: "manage", roles: ["SYSTEM_ADMIN", "GENERAL_MANAGER"] },
  { href: "/admin/notifications-test", label: "通知測試", icon: Bell, group: "manage", roles: ["SYSTEM_ADMIN", "GENERAL_MANAGER", "EXECUTIVE_ASSISTANT"] },
  { href: "/admin/qa", label: "QA 測試入口", icon: ClipboardCheck, group: "manage", roles: pilotAdminRoleKeys }
];

const groupLabels: Record<NavGroup, string> = {
  main: "主要功能",
  work: "工作表單",
  pilot: "主管測試區",
  manage: "系統管理"
};

function liteNavItems(roleKey: RoleKey | undefined, storeId?: string | null): NavItem[] {
  if (roleKey === "SYSTEM_ADMIN") {
    return [
      { href: "/", label: "首頁", icon: Gauge, group: "main" },
      { href: "/approvals", label: "簽呈管理", icon: FileCheck2, group: "main" },
      { href: "/admin/users", label: "使用者管理", icon: Users, group: "manage" },
      { href: "/settings/roles-permissions", label: "權限管理", icon: ShieldCheck, group: "manage" },
      { href: "/settings/notifications", label: "系統設定", icon: Smartphone, group: "manage" },
      { href: "/admin/errors", label: "錯誤中心", icon: Bug, group: "manage" },
      { href: "/admin/pilot", label: "測試管理", icon: ClipboardCheck, group: "manage" },
      { href: "/tasks", label: "派發任務", icon: ClipboardList, group: "manage" }
    ];
  }

  if (roleKey === "GENERAL_MANAGER") {
    return [
      { href: "/", label: "首頁", icon: Gauge, group: "main" },
      { href: "/approvals/progress?view=pending", label: "待我簽核", icon: FileCheck2, group: "main" },
      { href: "/approvals/progress", label: "全部簽呈", icon: ClipboardCheck, group: "main" },
      { href: "/gm/tasks", label: "總經理交辦", icon: ClipboardList, group: "main" },
      { href: "/notifications", label: "通知", icon: Bell, group: "main" },
      { href: "/account", label: "設定", icon: Settings, group: "main" }
    ];
  }

  if (roleKey && (headOfficeRoleKeys.includes(roleKey) || (roleKey === "STAFF" && !storeId))) {
    return [
      { href: "/", label: "首頁", icon: Gauge, group: "main" },
      { href: "/approvals/progress?view=pending", label: "待審核簽呈", icon: FileCheck2, group: "main" },
      { href: "/approvals/progress", label: "全部簽呈進度", icon: ClipboardCheck, group: "main" },
      { href: "/tasks", label: "全部任務", icon: ClipboardList, group: "main" },
      { href: "/notifications", label: "通知", icon: Bell, group: "main" },
      { href: "/account", label: "設定", icon: Settings, group: "main" }
    ];
  }

  if (roleKey && (storeScopedRoleKeys.includes(roleKey) || storeId)) {
    return [
      { href: "/", label: "首頁", icon: Gauge, group: "main" },
      { href: "/approvals/new", label: "填寫簽呈", icon: FileCheck2, group: "main" },
      { href: "/approvals/progress", label: "門市簽呈進度", icon: ClipboardCheck, group: "main" },
      { href: "/tasks", label: "門市任務", icon: ClipboardList, group: "main" },
      { href: "/notifications", label: "通知", icon: Bell, group: "main" },
      { href: "/account", label: "設定", icon: Settings, group: "main" }
    ];
  }

  return [
    { href: "/", label: "首頁", icon: Gauge, group: "main" },
    { href: "/approvals/new", label: "填寫簽呈", icon: FileCheck2, group: "main" },
    { href: "/approvals/progress", label: "我的簽呈進度", icon: ClipboardCheck, group: "main" },
    { href: "/notifications", label: "通知", icon: Bell, group: "main" },
    { href: "/account", label: "設定", icon: Settings, group: "main" }
  ];
}

function liteMobileItems(roleKey: RoleKey | undefined, storeId?: string | null): NavItem[] {
  if (roleKey === "GENERAL_MANAGER") {
    return [
      { href: "/", label: "首頁", icon: Gauge, group: "main" },
      { href: "/approvals/progress?view=pending", label: "簽核", icon: FileCheck2, group: "main" },
      { href: "/gm/tasks", label: "交辦", icon: ClipboardList, group: "main" },
      { href: "/approvals/progress", label: "進度", icon: ClipboardCheck, group: "main" },
      { href: "/account", label: "設定", icon: Settings, group: "main" }
    ];
  }

  if (roleKey === "SYSTEM_ADMIN") {
    return [
      { href: "/", label: "首頁", icon: Gauge, group: "main" },
      { href: "/approvals", label: "簽呈", icon: FileCheck2, group: "main" },
      { href: "/admin/users", label: "帳號", icon: Users, group: "main" },
      { href: "/admin/errors", label: "錯誤", icon: Bug, group: "main" },
      { href: "/account", label: "設定", icon: Settings, group: "main" }
    ];
  }

  if (roleKey && (headOfficeRoleKeys.includes(roleKey) || (roleKey === "STAFF" && !storeId))) {
    return [
      { href: "/", label: "首頁", icon: Gauge, group: "main" },
      { href: "/approvals/progress?view=pending", label: "審核", icon: FileCheck2, group: "main" },
      { href: "/approvals/progress", label: "簽呈", icon: ClipboardCheck, group: "main" },
      { href: "/tasks", label: "任務", icon: ClipboardList, group: "main" },
      { href: "/account", label: "設定", icon: Settings, group: "main" }
    ];
  }

  if (roleKey && (storeScopedRoleKeys.includes(roleKey) || storeId)) {
    return [
      { href: "/", label: "首頁", icon: Gauge, group: "main" },
      { href: "/approvals/new", label: "填寫", icon: FileCheck2, group: "main" },
      { href: "/approvals/progress", label: "簽呈", icon: ClipboardCheck, group: "main" },
      { href: "/tasks", label: "任務", icon: ClipboardList, group: "main" },
      { href: "/account", label: "設定", icon: Settings, group: "main" }
    ];
  }

  return [
    { href: "/", label: "首頁", icon: Gauge, group: "main" },
    { href: "/approvals/new", label: "填寫", icon: FileCheck2, group: "main" },
    { href: "/approvals/progress", label: "進度", icon: ClipboardCheck, group: "main" },
    { href: "/notifications", label: "通知", icon: Bell, group: "main" },
    { href: "/account", label: "設定", icon: Settings, group: "main" }
  ];
}

function canSeeItem(roleKey: RoleKey | undefined, item: NavItem) {
  return !item.roles || Boolean(roleKey && item.roles.includes(roleKey));
}

function navLabel(item: NavItem) {
  return item.label;
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const liteMode = isApprovalLiteMode();
  const visibleNavItems = liteMode ? liteNavItems(user?.roleKey, user?.storeId) : navItems.filter((item) => canSeeItem(user?.roleKey, item));
  const desktopWidth = liteMode ? "lg:pl-64" : "lg:pl-72";
  const sidebarWidth = liteMode ? "w-64" : "w-72";
  const mobileItems: NavItem[] = liteMode ? liteMobileItems(user?.roleKey, user?.storeId) : [
    { href: "/", label: "首頁", icon: Gauge, group: "main" },
    { href: "/tasks", label: "任務", icon: ClipboardList, group: "main" },
    { href: "/approvals", label: "簽呈", icon: FileCheck2, group: "main" },
    { href: "/notifications", label: "通知", icon: Bell, group: "main" },
    {
      href: user?.roleKey && managerLikeRoles.includes(user.roleKey) ? "/pilot/checklist" : "/issues",
      label: user?.roleKey && managerLikeRoles.includes(user.roleKey) ? "測試" : "回報",
      icon: user?.roleKey && managerLikeRoles.includes(user.roleKey) ? BookOpenCheck : Store,
      group: "main"
    }
  ];
  const unreadNotifications = user
    ? await prisma.notification.count({ where: { userId: user.id, isRead: false } })
    : 0;

  return (
    <div className="min-h-screen bg-transparent">
      <aside className={`fixed inset-y-0 left-0 hidden ${sidebarWidth} border-r border-white/10 bg-gradient-to-b from-brand-800 via-brand-700 to-[#123827] text-white shadow-[18px_0_40px_rgba(23,75,53,0.16)] lg:block`}>
        <div className="flex h-20 items-center gap-4 border-b border-white/10 px-5">
          <img className="h-12 w-12 rounded-xl bg-white object-cover shadow-sm ring-1 ring-white/30" src="/app-icon-192.png" alt="JU數位管理" />
          <div>
            <p className="text-xl font-black text-white">JU數位管理</p>
            <p className="text-sm font-semibold text-white/65">{liteMode ? "流程管理 × 核准簽署" : pilotVersionLabel}</p>
          </div>
        </div>
        <nav className="grid gap-4 p-4">
          {(["main", "work", "pilot", "manage"] as const).map((group) => {
            const items = visibleNavItems.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                {!liteMode || group === "manage" ? <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-white/45">{liteMode ? "系統管理" : groupLabels[group]}</p> : null}
                <div className="grid gap-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        className="flex min-h-14 items-center gap-3 rounded-lg px-3 text-lg font-black text-white/85 transition hover:bg-white/12 hover:text-white"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white/75 ring-1 ring-white/10">
                          <Icon className="h-5 w-5" />
                        </span>
                        {navLabel(item)}
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className={desktopWidth}>
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-white/70 bg-white/90 px-4 shadow-sm backdrop-blur md:px-8">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-slate-900">{user?.name ?? "未登入使用者"}</p>
            <p className="truncate text-sm text-slate-500">
              {user?.roleKey ? roleLabels[user.roleKey] : user?.roleName ?? "-"} · {user?.departmentName ?? "未設定部門"}
              {user?.storeName ? ` · ${user.storeName}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AccessibilityToggle />
            <a className="relative inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black text-slate-600 hover:bg-brand-50 hover:text-brand-800" href="/notifications">
              <Bell className="h-5 w-5" />
              <span className="hidden sm:inline">通知</span>
              <NotificationBadge initialCount={unreadNotifications} />
            </a>
            <a className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-black text-slate-600 hover:bg-brand-50 hover:text-brand-800" href="/account">
              <Settings className="h-4 w-4" />
              設定
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:px-8 lg:pb-10">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/80 bg-white/95 px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_32px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-black text-slate-700 hover:bg-brand-50 hover:text-brand-800"
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.href === "/notifications" ? <NotificationBadge initialCount={unreadNotifications} variant="dot" /> : null}
                </span>
                <span className="max-w-full truncate">{navLabel(item)}</span>
              </a>
            );
          })}
        </nav>
      </div>
      <PwaInstallPrompt />
    </div>
  );
}
