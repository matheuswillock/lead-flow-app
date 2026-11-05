import type { MetadataRoute } from "next"
import { getAbsoluteUrl } from "@/lib/metadata/share"
import {
  getPublicResourceBySlug,
  getPublicResourcePath,
  getPublicResourceSlugs,
  PUBLIC_RESOURCES_HUB_PATH,
} from "@/lib/seo/publicResources"

const HOMEPAGE_MODIFIED = "2026-11-05T00:00:00.000Z"
const LEGAL_MODIFIED = "2026-04-01T00:00:00.000Z"
const RESOURCES_HUB_MODIFIED = "2026-11-05T00:00:00.000Z"

const HIGH_PRIORITY_SLUGS = ["crm-corretores-saude", "pipeline-planos-saude", "crm-vs-planilha"]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteUrl("/").replace(/\/$/, ""),
      lastModified: HOMEPAGE_MODIFIED,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getAbsoluteUrl("/privacy-policy"),
      lastModified: LEGAL_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl("/terms"),
      lastModified: LEGAL_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl("/cookies"),
      lastModified: LEGAL_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl(PUBLIC_RESOURCES_HUB_PATH),
      lastModified: RESOURCES_HUB_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.85,
    },
  ]

  const resourceRoutes: MetadataRoute.Sitemap = getPublicResourceSlugs().map((slug) => {
    const resource = getPublicResourceBySlug(slug)
    return {
      url: getAbsoluteUrl(getPublicResourcePath(slug)),
      lastModified: resource?.modifiedTime ?? HOMEPAGE_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: HIGH_PRIORITY_SLUGS.includes(slug) ? 0.8 : 0.7,
    }
  })

  return [
    ...baseRoutes,
    ...resourceRoutes,
  ]
}
