"use client"

import { useCallback } from "react"
import { Copy, MailX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  buildUnsubscribeLinkEmailSnippet,
  EMAIL_UNSUBSCRIBE_LINK_TOKEN,
} from "@/lib/email/unsubscribe-link-embed"

export function EmailTemplateUnsubscribePanel({ embedded = false }: { embedded?: boolean }) {
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
        <h3 className="text-sm font-semibold">Descadastro</h3>
        <p className="text-xs text-muted-foreground">
          Use a variável abaixo para inserir o link personalizado de descadastro de cada destinatário no
          envio da campanha.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <MailX className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Link de descadastro</p>
        </div>
        <p className="break-all font-mono text-xs text-muted-foreground">{EMAIL_UNSUBSCRIBE_LINK_TOKEN}</p>
        <p className="text-xs text-muted-foreground">
          No envio, o sistema substitui automaticamente essa variável pelo link exclusivo do contato.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void copyToClipboard(EMAIL_UNSUBSCRIBE_LINK_TOKEN, "Variável")}
          >
            <Copy data-icon="inline-start" />
            Copiar variável
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              void copyToClipboard(buildUnsubscribeLinkEmailSnippet(), "HTML")
            }
          >
            <Copy data-icon="inline-start" />
            Copiar HTML
          </Button>
        </div>
      </div>
    </div>
  )
}
