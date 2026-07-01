import { ClipboardCheck, Gauge, MessageSquareWarning, Smartphone } from "lucide-react";
import { PilotBanner } from "@/components/pilot-banner";
import { redirect } from "next/navigation";
import { LinkButton, PageHeader, Panel } from "@/components/ui";
import { canAccessPilotAdmin, getSystemCommitHash } from "@/lib/pilot";
import { requireUser } from "@/lib/session";

export default async function AdminQaPage() {
  const user = await requireUser();
  if (!canAccessPilotAdmin(user)) {
    redirect("/dashboard");
  }

  const commitHash = getSystemCommitHash();

  return (
    <>
      <PilotBanner />
      <PageHeader
        title="QA（品質測試）入口"
        description="集中進入主管實測管理、測試狀態看板、通知測試與測試教學。"
        actions={<LinkButton href="/admin/pilot">進入主管實測管理中心</LinkButton>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <a href="/admin/pilot" className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft hover:border-brand-300 hover:bg-brand-50">
          <ClipboardCheck className="h-8 w-8 text-brand-700" />
          <p className="mt-3 text-xl font-black text-slate-950">主管實測管理</p>
          <p className="mt-2 text-base text-slate-700">查看測試帳號、入口、版本與回饋。</p>
        </a>
        <a href="/admin/pilot/status" className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft hover:border-brand-300 hover:bg-brand-50">
          <Gauge className="h-8 w-8 text-brand-700" />
          <p className="mt-3 text-xl font-black text-slate-950">測試狀態看板</p>
          <p className="mt-2 text-base text-slate-700">查看登入、PWA、語音、回饋與 Bug。</p>
        </a>
        <a href="/admin/notifications-test" className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft hover:border-brand-300 hover:bg-brand-50">
          <Smartphone className="h-8 w-8 text-brand-700" />
          <p className="mt-3 text-xl font-black text-slate-950">PWA 推播測試</p>
          <p className="mt-2 text-base text-slate-700">測試 P0 / P1、語音通知與點擊跳轉。</p>
        </a>
        <a href="/pilot/feedback" className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft hover:border-brand-300 hover:bg-brand-50">
          <MessageSquareWarning className="h-8 w-8 text-brand-700" />
          <p className="mt-3 text-xl font-black text-slate-950">回饋表單</p>
          <p className="mt-2 text-base text-slate-700">模擬主管送出使用回饋。</p>
        </a>
      </div>
      <Panel className="mt-5">
        <p className="text-base font-bold text-slate-950">目前系統版本與 commit hash</p>
        <p className="mt-2 font-mono text-sm text-slate-700">{commitHash}</p>
      </Panel>
    </>
  );
}
