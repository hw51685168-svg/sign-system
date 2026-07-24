import { Smartphone } from "lucide-react";
import { PilotBanner } from "@/components/pilot-banner";
import { PushStatusPanel } from "@/components/push-status-panel";
import { PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/session";

export default async function NotificationSettingsPage() {
  await requireUser();

  return (
    <>
      <PilotBanner compact />
      <PageHeader
        title="推播通知設定"
        description="檢查目前裝置是否支援背景推播，並啟用 iPhone PWA、Android App 或瀏覽器通知。"
      />
      <Panel>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950">
          <Smartphone className="h-5 w-5 text-brand-700" />
          手機推播狀態
        </h2>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-base font-semibold leading-7 text-amber-950">
          <p className="font-black">iPhone 使用提醒</p>
          <p>1. 請先用 Safari 開啟固定網址，分享後選擇「加入主畫面」。</p>
          <p>2. 必須從桌面圖示開啟 JU數位管理，才是 iPhone PWA 模式。</p>
          <p>3. 點擊「開啟推播」並允許通知，再按「送出測試推播」確認鎖定畫面是否收到。</p>
        </div>
        <PushStatusPanel />
      </Panel>
    </>
  );
}
