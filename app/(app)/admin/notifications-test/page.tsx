import { Bell, Send, Smartphone, TimerReset } from "lucide-react";
import { PilotBanner } from "@/components/pilot-banner";
import { PushStatusPanel } from "@/components/push-status-panel";
import { Button, Field, Panel } from "@/components/ui";
import { formatDateTime } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function NotificationsTestPage() {
  const user = await requireUser();
  const recentNotifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5
  });
  const voiceNotificationTests = [
    { label: "發送一般語音通知給自己", testKind: "voice-general", priority: "MEDIUM" },
    { label: "發送任務語音通知給自己", testKind: "voice-task", priority: "MEDIUM" },
    { label: "發送簽呈語音通知給自己", testKind: "voice-approval", priority: "MEDIUM" },
    { label: "發送問題語音通知給自己", testKind: "voice-issue", priority: "MEDIUM" },
    { label: "發送服務需求語音通知給自己", testKind: "voice-service", priority: "MEDIUM" },
    { label: "發送 P0 緊急語音通知給自己", testKind: "voice-p0", priority: "URGENT" }
  ];

  return (
    <>
      <PilotBanner compact />
      <section className="mb-5 rounded-lg border border-brand-100 bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand-700">通知測試中心</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">PWA Push（手機推播）與語音通知測試</h1>
        <p className="mt-2 text-base leading-7 text-slate-700">
          用這一頁確認 P0 / P1 通知、語音通知、通知點擊跳轉、Service Worker（背景服務）與 Push Subscription（推播訂閱）是否正常。
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-950">
            <Bell className="h-5 w-5 text-brand-700" />
            一般通知測試
          </h2>
          <form action="/api/notifications/test" method="post" className="grid gap-4">
            <input type="hidden" name="testKind" value="general" />
            <Field label="發送對象">
              <select name="target">
                <option value="self">只發給我自己</option>
                <option value="managers">發給主管</option>
                <option value="executives">發給總經理</option>
                <option value="staff">發給部門人員</option>
              </select>
            </Field>
            <Field label="通知等級">
              <select name="priority">
                <option value="URGENT">P0 緊急：阻擋測試或需要立即處理</option>
                <option value="HIGH">P1 重要：嚴重但仍可繼續測試</option>
                <option value="MEDIUM">P2 一般：一般測試通知</option>
                <option value="LOW">P3 提醒：低優先提醒</option>
              </select>
            </Field>
            <Button type="submit">
              <Send className="h-4 w-4" />
              發送測試通知
            </Button>
          </form>
        </Panel>

        <Panel>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-950">
            <Smartphone className="h-5 w-5 text-brand-700" />
            PWA 裝置狀態
          </h2>
          <p className="mb-4 text-base leading-7 text-slate-700">
            如果手機沒有收到推播，先檢查 notification permission（通知權限）是否允許、service worker（背景服務）是否啟用、push subscription（推播訂閱）是否存在。
          </p>
          <PushStatusPanel />
        </Panel>
      </div>

      <Panel className="mt-5">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-950">
          <Bell className="h-5 w-5 text-brand-700" />
          Voice Message（語音留言）通知測試
        </h2>
        <p className="mb-4 text-base leading-7 text-slate-700">
          這些按鈕會建立系統內通知並嘗試推播到目前裝置。收到通知後，請點通知確認是否能跳到語音所在頁面。
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <form action="/api/notifications/test" method="post">
            <input type="hidden" name="target" value="self" />
            <input type="hidden" name="testKind" value="p0" />
            <input type="hidden" name="priority" value="URGENT" />
            <Button className="w-full" type="submit" variant="danger">測試 P0 通知</Button>
          </form>
          <form action="/api/notifications/test" method="post">
            <input type="hidden" name="target" value="self" />
            <input type="hidden" name="testKind" value="p1" />
            <input type="hidden" name="priority" value="HIGH" />
            <Button className="w-full" type="submit" variant="secondary">測試 P1 通知</Button>
          </form>
          {voiceNotificationTests.map((item) => (
            <form key={item.testKind} action="/api/notifications/test" method="post">
              <input type="hidden" name="target" value="self" />
              <input type="hidden" name="testKind" value={item.testKind} />
              <input type="hidden" name="priority" value={item.priority} />
              <Button className="w-full" type="submit" variant={item.priority === "URGENT" ? "danger" : "secondary"}>{item.label}</Button>
            </form>
          ))}
        </div>
      </Panel>

      <Panel className="mt-5">
        <h2 className="mb-4 text-xl font-bold text-slate-950">最近 5 則通知</h2>
        <div className="grid gap-3">
          {recentNotifications.map((notification) => (
            <a key={notification.id} className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50" href={`/api/notifications/${notification.id}/click`}>
              <p className="font-bold text-slate-950">{notification.title}</p>
              <p className="mt-1 text-sm text-slate-500">{notification.body}</p>
              <p className="mt-1 text-xs font-semibold text-brand-700">點擊測試跳轉：{notification.targetUrl}</p>
              <p className="mt-1 text-xs text-slate-500">建立時間：{formatDateTime(notification.createdAt)}</p>
            </a>
          ))}
        </div>
      </Panel>

      <Panel className="mt-5">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-950">
          <TimerReset className="h-5 w-5 text-brand-700" />
          Notification Escalation（通知升級）測試
        </h2>
        <p className="mb-4 text-base leading-7 text-slate-700">
          用來測試逾時未讀通知是否會進入升級流程。正式自動排程是否開啟，請以伺服器排程設定為準。
        </p>
        <div className="flex flex-wrap gap-3">
          <form action="/api/notifications/escalate" method="post">
            <input type="hidden" name="dryRun" value="true" />
            <input type="hidden" name="redirect" value="true" />
            <Button type="submit" variant="secondary">乾跑測試</Button>
          </form>
          <form action="/api/notifications/escalate" method="post">
            <input type="hidden" name="redirect" value="true" />
            <Button type="submit">執行升級測試</Button>
          </form>
        </div>
      </Panel>
    </>
  );
}
