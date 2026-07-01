import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "皇享企業簽呈協作系統",
    short_name: "皇享簽呈",
    description: "皇享企業內部簽呈、公告、任務與問題回報系統",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8f7",
    theme_color: "#184a2f",
    orientation: "portrait",
    icons: [
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
