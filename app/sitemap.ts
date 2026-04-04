import type { MetadataRoute } from "next"
import { getAbsoluteUrl } from "@/lib/metadata/share"

const now = new Date()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
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
  ]
}
