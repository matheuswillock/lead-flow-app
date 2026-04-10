import type { PublicResourceEntry } from "@/lib/seo/publicResources"

export interface IResourcesService {
  listResources(): PublicResourceEntry[]
  findResourceBySlug(slug: string): PublicResourceEntry | null
}
