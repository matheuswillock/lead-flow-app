"use client"

import { createContext, useContext } from "react"
import type {
  Template,
  TemplateEditorDraft,
  TemplateEditorState,
  TemplateTestRequest,
  TemplateVersionItem,
} from "@/app/[supabaseId]/email/templates/[id]/features/context/TemplateEditorTypes"

export interface ITemplateEditorStudioContext extends TemplateEditorState {
  activeRole: "manager" | "backoffice" | "operator" | null
  reloadTemplate: () => Promise<void>
  saveTemplate: (patch?: Partial<TemplateEditorDraft>) => Promise<Template | null>
  publishTemplate: (id?: string) => Promise<Template | null>
  unpublishTemplate: () => Promise<Template | null>
  submitForApproval: () => Promise<void>
  approveTemplate: () => Promise<void>
  rejectTemplate: (reviewNote: string) => Promise<void>
  sendTestTemplate: (input: TemplateTestRequest) => Promise<void>
  restoreTemplateVersion: (versionId: string) => Promise<void>
  updateDraft: (patch: Partial<TemplateEditorDraft>) => void
  setHtml: (html: string) => void
  versions: TemplateVersionItem[]
  restoringVersionId: string | null
}

export const TemplateEditorStudioContext = createContext<ITemplateEditorStudioContext | undefined>(
  undefined
)

export function useTemplateEditorStudioContext(): ITemplateEditorStudioContext {
  const context = useContext(TemplateEditorStudioContext)
  if (!context) {
    throw new Error("useTemplateEditorStudioContext must be used within TemplateEditorStudioContext.Provider")
  }
  return context
}
