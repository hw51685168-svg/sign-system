import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "JU數位管理",
    short_name: "JU數位管理",
    description: "JU數位管理，提供公司內部流程管理、電子簽核、安全追蹤與任務溝通。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8f7",
    theme_color: "#184a2f",
    orientation: "portrait",
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
