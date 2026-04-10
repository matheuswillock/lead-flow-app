import type { PublicResourceEntry } from "@/lib/seo/publicResources"

export interface ResourceDetailState {
  resource: PublicResourceEntry
  relatedResources: PublicResourceEntry[]
}

export interface ResourceDetailActions {
  getBreadcrumbs: () => Array<{ label: string; href: string }>
}

export type ResourceDetailContextValue = ResourceDetailState & ResourceDetailActions
