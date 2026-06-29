import type { MetadataRoute } from "next"
import { getAbsoluteUrl } from "@/lib/metadata/share"
import {
  getPublicResourceBySlug,
  getPublicResourcePath,
  getPublicResourceSlugs,
  PUBLIC_RESOURCE_ENTRIES,
  PUBLIC_RESOURCES_HUB_PATH,
} from "@/lib/seo/publicResources"

const HOMEPAGE_MODIFIED = "2026-06-20T00:00:00.000Z"
const LEGAL_MODIFIED = "2026-04-01T00:00:00.000Z"

const HIGH_PRIORITY_SLUGS = ["crm-corretores-saude", "pipeline-planos-saude", "crm-vs-planilha"]

function getLatestResourceModified(): string {
  return PUBLIC_RESOURCE_ENTRIES.reduce((latest, entry) =>
    entry.modifiedTime > latest ? entry.modifiedTime : latest,
    PUBLIC_RESOURCE_ENTRIES[0].modifiedTime,
  )
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteUrl("/"),
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
      lastModified: getLatestResourceModified(),
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
