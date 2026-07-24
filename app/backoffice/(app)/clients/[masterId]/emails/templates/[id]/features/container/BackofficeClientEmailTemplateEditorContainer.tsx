"use client"

import Link from "next/link"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { ManagedByCorretorStudioBadge } from "@/components/email/ManagedByCorretorStudioBadge"
import { useBackofficeClientEmailTemplateEditorContext } from "../context/BackofficeClientEmailTemplateEditorContext"

export function BackofficeClientEmailTemplateEditorContainer({
  masterId,
  teamId,
}: {
  masterId: string
  teamId: string | null
}) {
  const {
    loading,
    saving,
    template,
    name,
    subject,
    html,
    error,
    save,
    setName,
    setSubject,
    setHtml,
  } = useBackofficeClientEmailTemplateEditorContext()

  if (!teamId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">teamId é obrigatório na URL.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link href={`/backoffice/clients/${masterId}?tab=emails`}>Voltar</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/backoffice/clients/${masterId}?tab=emails&teamId=${teamId}`}>
            <ArrowLeft data-icon="inline-start" />
            Voltar ao cliente
          </Link>
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving || loading}>
          {saving ? (
            <Loader2 className="animate-spin" data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          Salvar
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Editor de template</CardTitle>
          {template?.managedByCorretorStudio ? <ManagedByCorretorStudioBadge /> : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <FieldGroup>
              <Field>
                <FieldLabel>Nome</FieldLabel>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>Assunto</FieldLabel>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel>HTML</FieldLabel>
                <Textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  className="min-h-64 font-mono text-xs"
                />
              </Field>
            </FieldGroup>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
