"use client"

import { useMemo } from "react"
import type { IResourcesService } from "../services/IResourcesService"
import type { ResourcesContextValue } from "./ResourcesTypes"

export function useResourcesHook(service: IResourcesService): ResourcesContextValue {
  const resources = useMemo(() => service.listResources(), [service])

  const getBySlug = useMemo(
    () => (slug: string) => service.findResourceBySlug(slug),
    [service],
  )

  return {
    resources,
    getBySlug,
  }
}
