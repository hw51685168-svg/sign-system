import { AlertTriangle, Bell, CheckCircle2, Info, Megaphone } from "lucide-react";
import { EmptyState, LinkButton, Panel, StatusBadge } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { notificationPriorityLabels, notificationPriorityStyle } from "@/lib/notifications";
import { formatDateTime } from "@/lib/labels";
import { requireUser } from "@/lib/session";

const priorityIcon = {
  URGENT: AlertTriangle,
  HIGH: Megaphone,
  MEDIUM: Info,
  LOW: CheckCircle2
} as const;

const sourceTypeLabels: Record<string, string> = {
  approval: "簽呈通知",
  task: "交辦任務",
  issue: "問題回報",
  service_request: "服務需求",
  announcement: "公告",
  web_push_test: "推播測試",
  native_push_test: "手機通知測試",
  notification_escalation: "催辦提醒",
  system: "系統通知"
};

function sourceTypeLabel(sourceType?: string | null) {
  if (!sourceType) return sourceTypeLabels.system;
  return sourceTypeLabels[sourceType] ?? sourceType;
}

export default async function NotificationsPage({
  searchParams
}: {
  searchParams?: Promise<{ priority?: string; unread?: string; type?: string }>;
}) {
  const parsedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();
  const priority = ["URGENT", "HIGH", "MEDIUM", "LOW"].includes(parsedSearchParams.priority ?? "") ? parsedSearchParams.priority : undefined;
  const unreadOnly = parsedSearchParams.unread === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(priority ? { priority: priority as "URGENT" | "HIGH" | "MEDIUM" | "LOW" } : {}),
      ...(unreadOnly ? { isRead: false } : {}),
      ...(parsedSearchParams.type ? { type: parsedSearchParams.type } : {})
    },
    orderBy: [{ isRead: "asc" }, { priority: "asc" }, { createdAt: "desc" }],
    take: 80
  });

  const unreadCount = await prisma.notification.count({ where: { userId: user.id, isRead: false } });

  return (
    <>
      <section className="mb-5 rounded-xl border border-brand-100 bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-700">通知中心</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">所有通知與提醒</h1>
            <p className="mt-1 text-sm text-slate-500">未讀 {unreadCount} 則，點擊通知會前往對應案件或頁面。</p>
          </div>
          <form action="/api/notifications/read-all" method="post">
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/settings/notifications" variant="secondary">通知設定</LinkButton>
              <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-700 px-4 text-base font-semibold text-white" type="submit">
                全部標記已讀
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        <LinkButton href="/notifications" variant="secondary">全部</LinkButton>
        <LinkButton href="/notifications?unread=true" variant="secondary">只看未讀</LinkButton>
        <LinkButton href="/notifications?priority=URGENT" variant="secondary">緊急</LinkButton>
        <LinkButton href="/notifications?priority=HIGH" variant="secondary">高優先</LinkButton>
        <LinkButton href="/notifications?priority=MEDIUM" variant="secondary">中優先</LinkButton>
        <LinkButton href="/notifications?priority=LOW" variant="secondary">低優先</LinkButton>
      </div>

      <Panel>
        {notifications.length === 0 ? (
          <EmptyState title="目前沒有通知" description="新任務、簽呈、公告或系統提醒會出現在這裡。" />
        ) : (
          <div className="grid gap-3">
            {notifications.map((notification) => {
              const Icon = priorityIcon[notification.priority];
              const style = notificationPriorityStyle[notification.priority];
              return (
                <form key={notification.id} action={`/api/notifications/${notification.id}/read`} method="post">
                  <input name="targetUrl" type="hidden" value={notification.targetUrl} />
                  <button
                    className={`w-full rounded-xl border p-4 text-left transition hover:shadow-soft ${style.className} ${
                      notification.isRead ? "opacity-60" : ""
                    }`}
                    type="submit"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-6 w-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold">{notification.title}</p>
                          <StatusBadge label={notificationPriorityLabels[notification.priority]} tone={notification.priority === "URGENT" ? "red" : notification.priority === "HIGH" ? "amber" : notification.priority === "LOW" ? "green" : "blue"} />
                          {!notification.isRead ? <StatusBadge label="未讀" tone="red" /> : null}
                        </div>
                        <p className="mt-1 text-base leading-7">{notification.body}</p>
                        <p className="mt-2 text-sm opacity-75">
                          {formatDateTime(notification.createdAt)} · {sourceTypeLabel(notification.sourceType)}
                        </p>
                      </div>
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
