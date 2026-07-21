"use client"

import { useState } from "react"
import { Check, Copy, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getFullUrl } from "@/lib/utils/app-url"

export function BackofficeLeadQuickEntryIntegrationCard() {
  const [copied, setCopied] = useState(false)
  const url = getFullUrl("/backoffice/lead-quick-entry")

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("URL copiada")
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error("[BackofficeLeadQuickEntryIntegrationCard][copy]", err)
      toast.error("Não foi possível copiar")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Cadastro rápido de leads (3CPlus)</CardTitle>
            <Badge variant="secondary">Autenticado</Badge>
          </div>
          <CardDescription>
            Link para configurar como screen-pop na 3CPlus. O SDR precisa estar logado no
            Backoffice para usar — não é um formulário público.
          </CardDescription>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <UserPlus className="size-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label htmlFor="backoffice-lead-quick-entry-url">URL do formulário</Label>
        <div className="flex items-center gap-2">
          <Input
            id="backoffice-lead-quick-entry-url"
            value={url}
            readOnly
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void handleCopy()}
            title="Copiar URL"
          >
            {copied ? <Check data-icon /> : <Copy data-icon />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
