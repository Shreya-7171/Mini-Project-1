import type { MetadataRoute } from "next"

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CivicVision AI | SMKMC",
    short_name: "CivicVision",
    description:
      "AI-powered civic issue reporting for Sangli-Miraj-Kupwad Municipal Corporation.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F6F8FC",
    theme_color: "#0F2A4A",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
