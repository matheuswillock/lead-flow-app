"use client"

import { useContext, type ReactNode } from "react"
import { TemplateEditorStudioContext } from "@/components/email/template-editor/TemplateEditorStudioContext"
import { backofficeClientEmailTemplateEditorService } from "../services/BackofficeClientEmailTemplateEditorService"
import { useBackofficeClientEmailTemplateEditor } from "./BackofficeClientEmailTemplateEditorHook"

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
    <TemplateEditorStudioContext.Provider value={value}>
      {children}
    </TemplateEditorStudioContext.Provider>
  )
}

export function useBackofficeClientEmailTemplateEditorContext() {
  const ctx = useContext(TemplateEditorStudioContext)
  if (!ctx) {
    throw new Error(
      "useBackofficeClientEmailTemplateEditorContext must be used within BackofficeClientEmailTemplateEditorProvider"
    )
  }
  return ctx
}
