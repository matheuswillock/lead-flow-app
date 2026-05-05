import type { MetadataRoute } from "next"
import { getAbsoluteUrl } from "@/lib/metadata/share"

const disallowedPaths = [
  "/api/",
  "/auth/",
  "/backoffice/",
  "/sign-in",
  "/forgot-password",
  "/set-password",
  "/operator-confirmed",
  "/pix-confirmed",
  "/lead-form/",
  "/dashboard",
  "/account",
  "/crm",
  "/board",
  "/pipeline",
  "/manager-users",
  "/notifications",
  "/integrations",
  "/*/dashboard",
  "/*/account",
  "/*/crm",
  "/*/board",
  "/*/pipeline",
  "/*/manager-users",
  "/*/notifications",
  "/*/integrations",
]

export default function robots(): MetadataRoute.Robots {
  const sitemap = getAbsoluteUrl("/sitemap.xml")
  const host = new URL(getAbsoluteUrl("/")).host

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: disallowedPaths,
      },
      {
        userAgent: [
          "Googlebot",
          "Google-Extended",
          "Bingbot",
          "OAI-SearchBot",
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "ClaudeBot",
          "Claude-Web",
          "PerplexityBot",
          "Applebot-Extended",
          "Bytespider",
        ],
        allow: ["/"],
        disallow: disallowedPaths,
      },
    ],
    sitemap,
    host,
  }
}
