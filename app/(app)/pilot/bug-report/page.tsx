import { PilotBanner } from "@/components/pilot-banner";
import { redirect } from "next/navigation";
import { Button, Field, PageHeader, Panel } from "@/components/ui";
import { roleLabels } from "@/lib/labels";
import { canAccessPilot } from "@/lib/pilot";
import { requireUser } from "@/lib/session";

export default async function PilotBugReportPage({
  searchParams
}: {
  searchParams?: Promise<{ submitted?: string }>;
}) {
  const parsedSearchParams = (await searchParams) ?? {};
  const user = await requireUser();
  if (!canAccessPilot(user)) {
    redirect("/dashboard");
  }

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="測試問題回報"
        description="遇到任何卡住、按鈕不能點、權限不對、手機推播或語音問題，請在這裡回報。P0 會直接通知 system_admin（系統管理員）。"
      />
      {parsedSearchParams.submitted ? (
        <Panel className="mb-5 border-emerald-200 bg-emerald-50">
          <p className="font-bold text-emerald-800">已送出測試問題回報。若為 P0，系統已嘗試發送 PWA Push（手機推播）給系統管理員。</p>
        </Panel>
      ) : null}

      <form action="/api/pilot/bug-report" method="post" encType="multipart/form-data" className="grid gap-5">
        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">問題基本資料</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="問題標題">
              <input name="title" required placeholder="例如：新增簽呈送出後沒有反應" />
            </Field>
            <Field label="問題類型">
              <select name="type" defaultValue="UI">
                <option value="UI">UI 顯示問題</option>
                <option value="PERMISSION">權限問題</option>
                <option value="NOTIFICATION">通知問題</option>
                <option value="VOICE">語音問題</option>
                <option value="APPROVAL">簽呈問題</option>
                <option value="TASK">任務問題</option>
                <option value="MOBILE">手機問題</option>
                <option value="OTHER">其他</option>
              </select>
            </Field>
            <Field label="發生頁面">
              <input name="pageUrl" placeholder="例如：/approvals/new 或目前網址" />
            </Field>
            <Field label="發生角色">
              <input name="roleName" defaultValue={roleLabels[user.roleKey] ?? user.roleName ?? user.roleKey} />
            </Field>
            <Field label="發生裝置">
              <input name="deviceType" placeholder="例如：iPhone Safari、Android Chrome、Windows Chrome" />
            </Field>
            <Field label="嚴重程度">
              <select name="severity" defaultValue="P2">
                <option value="P0">P0 阻擋測試</option>
                <option value="P1">P1 嚴重</option>
                <option value="P2">P2 一般</option>
                <option value="P3">P3 建議</option>
              </select>
            </Field>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">問題描述與截圖</h2>
          <div className="grid gap-4">
            <Field label="問題描述">
              <textarea name="description" rows={6} required placeholder="請寫下你點了哪個按鈕、看到什麼畫面、預期應該發生什麼。" />
            </Field>
            <Field label="截圖上傳">
              <input name="screenshot" type="file" accept="image/*" />
            </Field>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 font-semibold">
              <input type="checkbox" name="blocksTesting" />
              是否影響測試，導致無法繼續
            </label>
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button type="submit">送出測試問題</Button>
        </div>
      </form>
    </>
  );
}
