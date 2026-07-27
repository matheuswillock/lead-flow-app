"use client"

import Link from "next/link"
import { PublicFormWizard } from "@/app/[supabaseId]/forms/features/container/PublicFormWizard"
import { Button } from "@/components/ui/button"
import { useBackofficeClientPublicFormEditorContext } from "../context/BackofficeClientPublicFormEditorContext"

export function BackofficeClientPublicFormEditorContainer() {
  const { masterId, teamId, formId, host, error } = useBackofficeClientPublicFormEditorContext()

  if (error || !host) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm text-muted-foreground">{error ?? "Time inválido"}</p>
        <Button asChild variant="outline">
          <Link href={`/backoffice/clients/${masterId}?tab=forms`}>Voltar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 py-2 text-sm text-muted-foreground">
        Editando formulários do time ·{" "}
        <Link
          className="underline"
          href={`/backoffice/clients/${masterId}?tab=forms&teamId=${teamId}`}
        >
          Voltar à lista
        </Link>
      </div>
      <PublicFormWizard formId={formId} host={host} />
    </div>
  )
}
