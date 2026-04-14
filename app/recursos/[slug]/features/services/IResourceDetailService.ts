import type { PublicResourceEntry } from "@/lib/seo/publicResources"

export interface IResourceDetailService {
  getResourceBySlug(slug: string): PublicResourceEntry | null
  getRelatedResources(slug: string, limit?: number): PublicResourceEntry[]
}
