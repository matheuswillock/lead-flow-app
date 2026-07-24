"use client"

import { createContext, useContext, type ReactNode } from "react"
import { backofficeClientEmailTemplateEditorService } from "../services/BackofficeClientEmailTemplateEditorService"
import { useBackofficeClientEmailTemplateEditor } from "./BackofficeClientEmailTemplateEditorHook"
import type { BackofficeClientEmailTemplateEditorContextValue } from "./BackofficeClientEmailTemplateEditorTypes"

const BackofficeClientEmailTemplateEditorContext =
  createContext<BackofficeClientEmailTemplateEditorContextValue | null>(null)

export function BackofficeClientEmailTemplateEditorProvider({
  masterId,
  teamId,
  templateId,
  children,
}: {
  masterId: string
  teamId: string | null
  templateId: string
  children: ReactNode
}) {
  const value = useBackofficeClientEmailTemplateEditor(
    masterId,
    teamId,
    templateId,
    backofficeClientEmailTemplateEditorService
  )
  return (
    <BackofficeClientEmailTemplateEditorContext.Provider value={value}>
      {children}
    </BackofficeClientEmailTemplateEditorContext.Provider>
  )
}

export function useBackofficeClientEmailTemplateEditorContext() {
  const ctx = useContext(BackofficeClientEmailTemplateEditorContext)
  if (!ctx) {
    throw new Error(
      "useBackofficeClientEmailTemplateEditorContext must be used within provider"
    )
  }
  return ctx
}
