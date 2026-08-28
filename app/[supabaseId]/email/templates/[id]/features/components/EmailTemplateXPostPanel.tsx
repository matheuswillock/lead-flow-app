"use client"

import { useCallback, useState } from "react"
import { useParams } from "next/navigation"
import { AtSign, Copy, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"
import { useTeamContext } from "@/app/context/TeamContext"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { isApiRequestError } from "@/lib/http/api-request-error"
import { createTemplateEditorService } from "../services/TemplateEditorService"
import type { XPostEmbedResult } from "../services/ITemplateEditorService"

const editorService = createTemplateEditorService()

function notifyXPostError(context: string, error: unknown, fallback: string) {
  if (!isApiRequestError(error)) {
    console.error(context, error)
  }
  toast.error(toUserToastMessage(error instanceof Error ? error : fallback))
}

export function EmailTemplateXPostPanel({ embedded = false }: { embedded?: boolean }) {
  const params = useParams<{ supabaseId: string }>()
  const supabaseId = params.supabaseId
  const { activeTeamId } = useTeamContext()

  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [embed, setEmbed] = useState<XPostEmbedResult | null>(null)

  const handleGenerateCard = useCallback(async () => {
    if (!activeTeamId || loading) return

    const trimmed = url.trim()
    if (!trimmed) {
      toast.error("Informe a URL do post")
      return
    }

    setLoading(true)
    try {
      const result = await editorService.resolveXPostEmbed(supabaseId, activeTeamId, trimmed)
      setEmbed(result)
    } catch (error) {
      setEmbed(null)
      notifyXPostError("[EmailTemplateXPostPanel] handleGenerateCard", error, "Erro ao gerar card do post")
    } finally {
      setLoading(false)
    }
  }, [activeTeamId, loading, supabaseId, url])

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
        <h3 className="text-sm font-semibold">Post do X</h3>
        <p className="text-xs text-muted-foreground">
          Cole a URL do post para gerar um card estático compatível com e-mail.
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="x-post-url">URL do post</FieldLabel>
          <Input
            id="x-post-url"
            type="url"
            placeholder="https://x.com/usuario/status/..."
            value={url}
            disabled={!activeTeamId || loading}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void handleGenerateCard()
              }
            }}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={!activeTeamId || loading}
          onClick={() => void handleGenerateCard()}
        >
          {loading ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : null}
          {loading ? "Gerando..." : "Gerar card"}
        </Button>
      </FieldGroup>

      {embed ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold">{embed.authorName}</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{embed.text}</p>
            <a
              href={embed.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary"
            >
              Ver post no X
            </a>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 self-start px-2 text-xs"
            onClick={() => void copyToClipboard(embed.htmlSnippet, "HTML")}
          >
            <Copy data-icon="inline-start" />
            Copiar HTML
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <AtSign className="size-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Cole uma URL do X para gerar o card.</p>
        </div>
      )}
    </div>
  )
}
