"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { StudioEmailHostProvider } from "@/lib/email/studio-email-host"
import { TemplateEditorProvider } from "@/app/[supabaseId]/email/templates/[id]/features/context/TemplateEditorContext"
import { EditorContainer } from "@/app/[supabaseId]/email/templates/[id]/features/container/EditorContainer"
import { createStudioEmailHost } from "../../../features/emails/createStudioEmailHost"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"

export default function BackofficeClientEmailTemplateEditorPage() {
  const params = useParams<{ masterId: string; id: string }>()
  const searchParams = useSearchParams()
  const teamId = searchParams.get("teamId")
  const masterId = params.masterId
  const templateId = params.id
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator

  const host = useMemo(
    () => (teamId ? createStudioEmailHost(masterId, teamId, { canManage }) : null),
    [masterId, teamId, canManage]
  )

  if (!teamId || !host) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm text-muted-foreground">teamId é obrigatório na URL.</p>
        <Button asChild variant="outline">
          <Link href={`/backoffice/clients/${masterId}?tab=emails`}>Voltar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 py-2 text-sm text-muted-foreground">
        Editando e-mails do time ·{" "}
        <Link
          className="underline"
          href={`/backoffice/clients/${masterId}?tab=emails&teamId=${teamId}`}
        >
          Voltar à lista
        </Link>
      </div>
      <StudioEmailHostProvider key={teamId} host={host}>
        <TemplateEditorProvider supabaseId={masterId} templateId={templateId}>
          <EditorContainer />
        </TemplateEditorProvider>
      </StudioEmailHostProvider>
    </div>
  )
}
