import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  "https://huangxiang-approval.serveousercontent.com";

const config: CapacitorConfig = {
  appId: "com.huangxiang.approval",
  appName: "JU數位管理",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: false
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;
