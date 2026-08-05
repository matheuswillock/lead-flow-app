"use client"

import { PublicFormWizard } from "@/app/[supabaseId]/forms/features/container/PublicFormWizard"
import { useBackofficeFormTemplateEditorContext } from "../context/BackofficeFormTemplateEditorContext"

export function BackofficeFormTemplateEditorContainer() {
  const { templateId, host } = useBackofficeFormTemplateEditorContext()
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PublicFormWizard formId={templateId} host={host} />
    </div>
  )
}
