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
        title="推播設定"
        description="檢查手機推播、通知權限、背景服務、推播訂閱與最後一次推播結果。一般使用者也可以到右上角「設定」操作。"
      />
      <Panel>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950">
          <Smartphone className="h-5 w-5 text-brand-700" />
          裝置推播狀態
        </h2>
        <p className="mb-4 text-base font-semibold leading-7 text-slate-700">
          Android 請用 Chrome 開啟固定網址並加入主畫面；iPhone 請用 Safari 加入主畫面後，從桌面圖示開啟 PWA（手機版 App）。
        </p>
        <PushStatusPanel />
      </Panel>
    </>
  );
}
