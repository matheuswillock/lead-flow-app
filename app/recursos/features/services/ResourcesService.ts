import type { IResourcesService } from "./IResourcesService"
import {
  getPublicResourceBySlug,
  PUBLIC_RESOURCE_ENTRIES,
  type PublicResourceEntry,
} from "@/lib/seo/publicResources"

export class ResourcesService implements IResourcesService {
  listResources(): PublicResourceEntry[] {
    return PUBLIC_RESOURCE_ENTRIES
  }

  findResourceBySlug(slug: string): PublicResourceEntry | null {
    return getPublicResourceBySlug(slug)
  }
}
