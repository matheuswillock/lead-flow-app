"use client"

import { useMemo } from "react"
import type { IResourceDetailService } from "../services/IResourceDetailService"
import type { ResourceDetailContextValue } from "./ResourceDetailTypes"
import { PUBLIC_RESOURCES_HUB_PATH, getPublicResourcePath } from "@/lib/seo/publicResources"

interface UseResourceDetailHookInput {
  slug: string
  service: IResourceDetailService
}

export function useResourceDetailHook({
  slug,
  service,
}: UseResourceDetailHookInput): ResourceDetailContextValue {
  const resource = service.getResourceBySlug(slug)
  if (!resource) {
    throw new Error("Resource not found")
  }

  const relatedResources = useMemo(() => service.getRelatedResources(slug, 3), [service, slug])

  const getBreadcrumbs = () => [
    { label: "Home", href: "/" },
    { label: "Recursos", href: PUBLIC_RESOURCES_HUB_PATH },
    { label: resource.intent, href: getPublicResourcePath(resource.slug) },
  ]

  return {
    resource,
    relatedResources,
    getBreadcrumbs,
  }
}
