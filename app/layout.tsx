import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const notoSansTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "皇享企業電子簽呈與協作雲端系統",
  description: "內部簽呈、公告、任務、問題回報與稽核追蹤系統",
  applicationName: "皇享簽呈",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "皇享簽呈",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/app-icon.svg",
    apple: "/app-icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#184a2f"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className={notoSansTc.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
