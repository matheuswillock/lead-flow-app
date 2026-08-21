"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { ClipboardList, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import { useTeamContext } from "@/app/context/TeamContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { buildPublicFormLinkEmailSnippet } from "@/lib/email/public-form-link-embed"
import { isApiRequestError } from "@/lib/http/api-request-error"
import { publicFormsClientService } from "@/app/[supabaseId]/forms/features/services/PublicFormsService"
import type { PublicFormListItem } from "@/app/[supabaseId]/forms/features/context/PublicFormsTypes"

function notifyFormsError(context: string, error: unknown, fallback: string) {
  if (!isApiRequestError(error)) {
    console.error(context, error)
  }
  toast.error(toUserToastMessage(error instanceof Error ? error : fallback))
}

export function EmailTemplateFormsPanel({ embedded = false }: { embedded?: boolean }) {
  const params = useParams<{ supabaseId: string }>()
  const supabaseId = params.supabaseId
  const { activeTeamId } = useTeamContext()

  const [forms, setForms] = useState<PublicFormListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const inFlightKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!activeTeamId) return
    const requestKey = `${supabaseId}:${activeTeamId}:published-forms`
    if (inFlightKeyRef.current === requestKey || lastSuccessKeyRef.current === requestKey) return
    inFlightKeyRef.current = requestKey
    setLoading(true)
    void publicFormsClientService
      .list(
        { supabaseId, teamId: activeTeamId },
        {
          page: 1,
          pageSize: 100,
          search: "",
          status: ["published"],
          approvalStatus: [],
        },
      )
      .then((page) => {
        setForms(page.items)
        lastSuccessKeyRef.current = requestKey
        setSelectedId((current) => current || page.items[0]?.id || "")
      })
      .catch((error) => {
        notifyFormsError(
          "[EmailTemplateFormsPanel] loadForms",
          error,
          "Erro ao carregar formulários",
        )
      })
      .finally(() => {
        if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = null
        setLoading(false)
      })
  }, [activeTeamId, supabaseId])

  const selected = forms.find((item) => item.id === selectedId) ?? null
  const formUrl = selected ? `${window.location.origin}/forms/${selected.publicId}` : ""

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error("Não foi possível copiar")
    }
  }, [])

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 p-4"}>
      <div>
        <h3 className="text-sm font-semibold">Formulários</h3>
        <p className="text-xs text-muted-foreground">
          Escolha um formulário publicado para copiar o link ou o botão HTML.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : forms.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Nenhum formulário publicado. Publique um formulário no CRM para usá-lo aqui.
          </p>
        </div>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email-template-form">Formulário</FieldLabel>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id="email-template-form">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {forms.map((form) => (
                  <SelectItem key={form.id} value={form.id}>
                    {form.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {selected ? (
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{selected.name}</p>
                <Badge variant="outline">Publicado</Badge>
              </div>
              <p className="break-all text-xs text-muted-foreground">{formUrl}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => void copyToClipboard(formUrl, "Link")}
                >
                  <Copy data-icon="inline-start" />
                  Copiar link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    void copyToClipboard(
                      buildPublicFormLinkEmailSnippet({
                        formName: selected.name,
                        formUrl,
                      }),
                      "HTML",
                    )
                  }
                >
                  <Copy data-icon="inline-start" />
                  Copiar HTML
                </Button>
              </div>
            </div>
          ) : null}
        </FieldGroup>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Carregando formulários...
        </div>
      ) : null}
    </div>
  )
}
