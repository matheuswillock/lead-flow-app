"use client"

import { useMemo } from "react"
import type { IDocsService } from "../services/IDocsService"
import type { DocsContextValue } from "./DocsTypes"

export function useDocsHook(service: IDocsService): DocsContextValue {
  const chapters = useMemo(() => service.listChapters(), [service])

  const getChapterBySlug = useMemo(
    () => (slug: string) => service.getChapterBySlug(slug),
    [service],
  )

  return {
    chapters,
    getChapterBySlug,
  }
}
