import { PilotBanner } from "@/components/pilot-banner";
import { redirect } from "next/navigation";
import { Button, Field, PageHeader, Panel } from "@/components/ui";
import { roleLabels } from "@/lib/labels";
import { canAccessPilot } from "@/lib/pilot";
import { requireUser } from "@/lib/session";

function ScoreSelect({ name }: { name: string }) {
  return (
    <select name={name} defaultValue="3">
      <option value="5">5 分：非常好用</option>
      <option value="4">4 分：大致好用</option>
      <option value="3">3 分：普通，可以再調整</option>
      <option value="2">2 分：不好找或不好用</option>
      <option value="1">1 分：很卡，需要優先改善</option>
    </select>
  );
}

export default async function PilotFeedbackPage({
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
        title="主管實測回饋表"
        description="請用主管實測角度填寫，分數與文字都會進入管理中心，系統管理員可轉成改善任務。"
      />
      {parsedSearchParams.submitted ? (
        <Panel className="mb-5 border-emerald-200 bg-emerald-50">
          <p className="font-bold text-emerald-800">已收到你的回饋，謝謝。系統管理員會在主管實測管理中心查看。</p>
        </Panel>
      ) : null}

      <form action="/api/pilot/feedback" method="post" className="grid gap-5">
        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">測試人資訊</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="測試人">
              <input name="testerName" defaultValue={user.name ?? "未命名使用者"} readOnly />
            </Field>
            <Field label="角色">
              <input name="roleName" defaultValue={roleLabels[user.roleKey] ?? user.roleName ?? user.roleKey} readOnly />
            </Field>
            <Field label="部門／館別">
              <input name="departmentOrStore" defaultValue={user.storeName ?? user.departmentName ?? ""} placeholder="例如：行政部／屏東瑞光館" />
            </Field>
            <Field label="使用裝置">
              <select name="deviceType" defaultValue="DESKTOP">
                <option value="PHONE">手機</option>
                <option value="DESKTOP">電腦</option>
                <option value="TABLET">平板</option>
              </select>
            </Field>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">操作評分</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="系統是否好上手">
              <ScoreSelect name="easeScore" />
            </Field>
            <Field label="首頁是否看得懂">
              <ScoreSelect name="homeScore" />
            </Field>
            <Field label="任務是否好找">
              <ScoreSelect name="taskScore" />
            </Field>
            <Field label="通知是否清楚">
              <ScoreSelect name="notificationScore" />
            </Field>
            <Field label="語音是否好用">
              <ScoreSelect name="voiceScore" />
            </Field>
            <Field label="簽呈是否好用">
              <ScoreSelect name="approvalScore" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">卡住的地方</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="哪個地方最卡">
              <textarea name="stuckPoint" rows={4} placeholder="例如：不知道下一步要點哪裡" />
            </Field>
            <Field label="哪個按鈕找不到">
              <textarea name="missingButton" rows={4} placeholder="例如：找不到已讀確認或送出按鈕" />
            </Field>
            <Field label="哪個字太小">
              <textarea name="smallText" rows={4} placeholder="例如：手機版任務文字太小" />
            </Field>
            <Field label="哪個流程不順">
              <textarea name="badFlow" rows={4} placeholder="例如：簽呈退回後不知道在哪補件" />
            </Field>
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-4 text-2xl font-black text-slate-950">關鍵功能是否成功</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 font-semibold">
              <input type="checkbox" name="receivedPush" />
              是否有收到手機推播
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 font-semibold">
              <input type="checkbox" name="recordedVoice" />
              是否成功錄音
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 font-semibold">
              <input type="checkbox" name="playedVoice" />
              是否成功播放語音
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 font-semibold">
              <input type="checkbox" name="hadError" />
              是否有遇到錯誤
            </label>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px]">
            <Field label="建議修改內容">
              <textarea name="suggestions" rows={5} placeholder="請寫你希望調整的內容，例如首頁重點、按鈕名稱、流程順序。" />
            </Field>
            <Field label="建議優先級">
              <select name="priority" defaultValue="P2">
                <option value="P0">P0 阻擋測試</option>
                <option value="P1">P1 嚴重</option>
                <option value="P2">P2 一般</option>
                <option value="P3">P3 建議</option>
              </select>
            </Field>
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button type="submit">送出回饋</Button>
        </div>
      </form>
    </>
  );
}
