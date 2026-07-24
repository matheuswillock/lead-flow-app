"use client"

import { useParams, useSearchParams } from "next/navigation"
import { BackofficeClientEmailTemplateEditorProvider } from "./features/context/BackofficeClientEmailTemplateEditorContext"
import { BackofficeClientEmailTemplateEditorContainer } from "./features/container/BackofficeClientEmailTemplateEditorContainer"

export default function BackofficeClientEmailTemplateEditorPage() {
  const params = useParams<{ masterId: string; id: string }>()
  const searchParams = useSearchParams()
  const teamId = searchParams.get("teamId")

  return (
    <BackofficeClientEmailTemplateEditorProvider
      masterId={params.masterId}
      teamId={teamId}
      templateId={params.id}
    >
      <BackofficeClientEmailTemplateEditorContainer
        masterId={params.masterId}
        teamId={teamId}
      />
    </BackofficeClientEmailTemplateEditorProvider>
  )
}
