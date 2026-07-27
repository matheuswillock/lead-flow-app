"use client"

import { useParams, useSearchParams } from "next/navigation"
import { BackofficeClientPublicFormEditorProvider } from "./features/context/BackofficeClientPublicFormEditorContext"
import { BackofficeClientPublicFormEditorContainer } from "./features/container/BackofficeClientPublicFormEditorContainer"

export default function BackofficeClientPublicFormNewPage() {
  const params = useParams<{ masterId: string }>()
  const searchParams = useSearchParams()
  const teamId = searchParams.get("teamId")

  return (
    <BackofficeClientPublicFormEditorProvider masterId={params.masterId} teamId={teamId}>
      <BackofficeClientPublicFormEditorContainer />
    </BackofficeClientPublicFormEditorProvider>
  )
}
