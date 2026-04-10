import type { MetadataRoute } from "next"
import { getAbsoluteUrl } from "@/lib/metadata/share"
import {
  getPublicResourcePath,
  getPublicResourceSlugs,
  PUBLIC_RESOURCES_HUB_PATH,
} from "@/lib/seo/publicResources"

const now = new Date()

export default function sitemap(): MetadataRoute.Sitemap {
  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: getAbsoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getAbsoluteUrl("/subscribe"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl("/privacy-policy"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl("/terms"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl("/cookies"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl(PUBLIC_RESOURCES_HUB_PATH),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: getAbsoluteUrl("/llms.txt"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    },
  ]

  const resourceRoutes: MetadataRoute.Sitemap = getPublicResourceSlugs().map((slug) => ({
    url: getAbsoluteUrl(getPublicResourcePath(slug)),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  return [
    ...baseRoutes,
    ...resourceRoutes,
  ]
}
