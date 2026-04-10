import type { PublicResourceEntry } from "@/lib/seo/publicResources"

export interface ResourcesState {
  resources: PublicResourceEntry[]
}

export interface ResourcesActions {
  getBySlug: (slug: string) => PublicResourceEntry | null
}

export type ResourcesContextValue = ResourcesState & ResourcesActions
