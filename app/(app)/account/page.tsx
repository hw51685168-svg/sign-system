import { Bell, Home, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { AccountSessionActions } from "@/components/account-session-actions";
import { PushStatusPanel } from "@/components/push-status-panel";
import { LinkButton, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { roleLabels, safeText } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="設定"
        description="這裡可以查看目前登入帳號、切換帳號、登出，以及開啟或關閉手機推播。"
        actions={<LinkButton href="/" variant="secondary"><Home className="h-5 w-5" />回首頁</LinkButton>}
      />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="grid gap-5">
          <Panel>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-700 text-white">
                <UserRound className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-black text-slate-950">目前登入帳號</h2>
                <p className="text-base font-semibold text-slate-600">請確認現在使用的是自己的帳號。</p>
              </div>
            </div>
            <dl className="grid gap-4 text-lg">
              <div>
                <dt className="font-black text-slate-700">姓名</dt>
                <dd className="mt-1 text-2xl font-black text-slate-950">{safeText(user.name)}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-700">角色</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-slate-800">
                  <StatusBadge label={roleLabels[user.roleKey] ?? user.roleName} tone="blue" />
                </dd>
              </div>
              <div>
                <dt className="font-black text-slate-700">部門</dt>
                <dd className="mt-1 text-xl font-bold text-slate-800">{safeText(user.departmentName, "未指定")}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-700">門市 / 館別</dt>
                <dd className="mt-1 text-xl font-bold text-slate-800">{safeText(user.storeName, "未指定")}</dd>
              </div>
              <div>
                <dt className="font-black text-slate-700">登入帳號</dt>
                <dd className="mt-1 break-all text-xl font-bold text-slate-800">{safeText(user.email)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <div className="mb-4 flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-brand-700" />
              <div>
                <h2 className="text-2xl font-black text-slate-950">帳號操作</h2>
                <p className="text-base font-semibold text-slate-600">多人共用電腦或手機測試時，請用切換帳號。</p>
              </div>
            </div>
            <AccountSessionActions />
          </Panel>

          <Panel className="border-amber-200 bg-amber-50">
            <h2 className="text-xl font-black text-amber-950">測試期間提醒</h2>
            <p className="mt-2 text-base font-semibold leading-7 text-amber-950">
              測試帳號請不要轉傳給非測試人員。正式上線前會改成每位同仁自己的帳號與密碼。
            </p>
          </Panel>
        </div>

        <Panel>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Smartphone className="h-7 w-7 text-brand-700" />
                <h2 className="text-2xl font-black text-slate-950">手機推播設定</h2>
              </div>
              <p className="mt-2 text-base font-semibold leading-7 text-slate-700">
                在這裡開啟或關閉 Push（手機推播），也可以發送一則測試通知確認手機是否會跳出提醒。
              </p>
            </div>
            <LinkButton href="/notifications" variant="secondary"><Bell className="h-5 w-5" />通知中心</LinkButton>
          </div>
          <PushStatusPanel />
        </Panel>
      </div>
    </>
  );
}
