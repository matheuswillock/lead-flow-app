"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { IBackofficeFormTemplatesService } from "../services/IBackofficeFormTemplatesService"
import type { BackofficeFormTemplateEditorContextValue } from "./BackofficeFormTemplateEditorTypes"
import { useBackofficeFormTemplateEditor } from "./BackofficeFormTemplateEditorHook"

const BackofficeFormTemplateEditorContext = createContext<
  BackofficeFormTemplateEditorContextValue | undefined
>(undefined)

export function BackofficeFormTemplateEditorProvider({
  children,
  templateId,
  service,
}: {
  children: ReactNode
  templateId?: string
  service: IBackofficeFormTemplatesService
}) {
  const value = useBackofficeFormTemplateEditor(templateId, service)
  return (
    <BackofficeFormTemplateEditorContext.Provider value={value}>
      {children}
    </BackofficeFormTemplateEditorContext.Provider>
  )
}

export function useBackofficeFormTemplateEditorContext() {
  const context = useContext(BackofficeFormTemplateEditorContext)
  if (!context) {
    throw new Error(
      "useBackofficeFormTemplateEditorContext must be used within BackofficeFormTemplateEditorProvider",
    )
  }
  return context
}
