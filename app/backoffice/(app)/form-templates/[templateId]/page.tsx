"use client"

import { useParams } from "next/navigation"
import { BackofficeFormTemplateEditorProvider } from "./features/context/BackofficeFormTemplateEditorContext"
import { BackofficeFormTemplateEditorContainer } from "./features/container/BackofficeFormTemplateEditorContainer"
import { BackofficeFormTemplatesService } from "./features/services/BackofficeFormTemplatesService"

const service = new BackofficeFormTemplatesService()

export default function BackofficeFormTemplateEditorPage() {
  const params = useParams<{ templateId: string }>()
  const templateId = params.templateId === "new" ? undefined : params.templateId

  return (
    <BackofficeFormTemplateEditorProvider templateId={templateId} service={service}>
      <BackofficeFormTemplateEditorContainer />
    </BackofficeFormTemplateEditorProvider>
  )
}
