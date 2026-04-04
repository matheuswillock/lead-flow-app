import type { MetadataRoute } from "next"
import { getAbsoluteUrl } from "@/lib/metadata/share"

const disallowedPaths = [
  "/api/",
  "/auth/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/set-password",
  "/checkout-return",
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
        allow: ["/", "/subscribe", "/privacy-policy", "/terms", "/cookies"],
        disallow: disallowedPaths,
      },
      {
        userAgent: [
          "Googlebot",
          "Bingbot",
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "ClaudeBot",
          "PerplexityBot",
        ],
        allow: ["/", "/subscribe", "/privacy-policy", "/terms", "/cookies"],
        disallow: disallowedPaths,
      },
    ],
    sitemap,
    host,
  }
}
