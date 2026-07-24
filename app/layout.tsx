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
  title: "JU數位管理｜內部流程管理與電子簽核",
  description: "JU數位管理，提供公司內部流程管理、電子簽核、安全追蹤與任務溝通。",
  applicationName: "JU數位管理",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "JU數位管理",
    statusBarStyle: "default"
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/apple-touch-icon.png"
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
