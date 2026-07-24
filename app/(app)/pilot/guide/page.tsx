import { PilotBanner } from "@/components/pilot-banner";
import { redirect } from "next/navigation";
import { LinkButton, PageHeader, Panel } from "@/components/ui";
import { canAccessPilot } from "@/lib/pilot";
import { requireUser } from "@/lib/session";

const guideSections = [
  {
    title: "1. 如何登入",
    steps: ["開啟固定測試網址", "輸入主管測試帳號與密碼", "登入後先確認首頁上方顯示主管測試版 v0.1"]
  },
  {
    title: "2. 如何加到手機主畫面",
    steps: ["Android：用 Chrome 開啟固定網址，點右上角選單，選擇加到主畫面", "iPhone：用 Safari 開啟固定網址，點分享，選擇加入主畫面", "從手機桌面圖示重新打開系統"]
  },
  {
    title: "3. 如何開啟 PWA Push（手機推播）",
    steps: ["進入 PWA 推播設定", "確認 notification permission（通知權限）為允許", "點選開啟推播", "回到通知測試頁發送 P0 或 P1 測試通知"]
  },
  {
    title: "4. 如何測試通知",
    steps: ["進入通知測試頁", "按測試 P0 通知或測試 P1 通知", "手機收到通知後點開", "確認會跳到正確頁面"]
  },
  {
    title: "5. 如何錄音",
    steps: ["進入任務詳情、簽呈詳情、問題詳情或服務需求詳情", "找到語音留言區", "按錄音", "允許麥克風權限", "錄完後先預聽，再送出"]
  },
  {
    title: "6. 如何播放語音",
    steps: ["在語音留言區找到剛送出的語音", "按播放", "確認秒數有前進", "播放完成後確認已聽狀態"]
  },
  {
    title: "7. 如何送出簽呈",
    steps: ["進入電子簽呈", "點新增簽呈", "填寫類型、主旨、內容、金額與附件", "選擇簽核模式", "按送出簽呈"]
  },
  {
    title: "8. 如何審核簽呈",
    steps: ["進入簽呈詳情", "確認內容與附件", "可選核准、駁回、退回補件或留言", "若需電子手寫簽名，請在簽名區簽名後送出"]
  },
  {
    title: "9. 如何建立任務",
    steps: ["進入任務追蹤", "點新增任務", "確認建立人、接收部門與接收人", "填寫截止日期、優先程度與內容", "送出後到任務詳情測試留言或語音"]
  },
  {
    title: "10. 如何回報問題",
    steps: ["進入問題回報", "選擇問題類型與嚴重程度", "填寫描述並上傳照片", "送出後確認可以在清單中看到"]
  },
  {
    title: "11. 如何送出回饋",
    steps: ["進入主管測試區的回饋表單", "每項打 1 到 5 分", "填寫卡住的地方與建議", "按送出回饋"]
  },
  {
    title: "12. 遇到錯誤如何回報",
    steps: ["進入 Bug 回報", "選擇問題類型與嚴重程度", "描述當時操作步驟", "上傳截圖後送出；P0 會通知系統管理員"]
  }
];

export default async function PilotGuidePage() {
  const user = await requireUser();
  if (!canAccessPilot(user)) {
    redirect("/dashboard");
  }

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="主管測試教學"
        description="請主管照這份順序測試，測完回到測試清單標記完成，最後送出回饋。"
        actions={<LinkButton href="/pilot/checklist">回到測試清單</LinkButton>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {guideSections.map((section) => (
          <Panel key={section.title}>
            <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
            <ol className="mt-3 grid gap-2 text-base leading-7 text-slate-700">
              {section.steps.map((step, index) => (
                <li key={step}>
                  <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </Panel>
        ))}
      </div>
    </>
  );
}
