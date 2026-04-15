import type { IResourceDetailService } from "./IResourceDetailService"
import {
  getPublicResourceBySlug,
  PUBLIC_RESOURCE_ENTRIES,
  type PublicResourceEntry,
} from "@/lib/seo/publicResources"

export class ResourceDetailService implements IResourceDetailService {
  getResourceBySlug(slug: string): PublicResourceEntry | null {
    return getPublicResourceBySlug(slug)
  }

  getRelatedResources(slug: string, limit = 3): PublicResourceEntry[] {
    return PUBLIC_RESOURCE_ENTRIES.filter((entry) => entry.slug !== slug).slice(0, limit)
  }
}
