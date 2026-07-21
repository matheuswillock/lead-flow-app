"use client"

import { useState } from "react"
import { Check, Copy, ExternalLink, FileText } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getFullUrl } from "@/lib/utils/app-url"

export function BackofficePublicLeadFormIntegrationCard() {
  const [copied, setCopied] = useState(false)
  const url = getFullUrl("/backoffice-lead-form")

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("URL copiada")
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error("[BackofficePublicLeadFormIntegrationCard][copy]", err)
      toast.error("Não foi possível copiar")
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Formulário público de leads</CardTitle>
            <Badge variant="secondary">Público</Badge>
          </div>
          <CardDescription>
            Compartilhe este link para receber leads diretamente no CRM do backoffice. Não exige
            login — diferente do cadastro rápido (3CPlus).
          </CardDescription>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <FileText className="size-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label htmlFor="backoffice-public-lead-form-url">URL do formulário</Label>
        <div className="flex items-center gap-2">
          <Input
            id="backoffice-public-lead-form-url"
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
          <Button type="button" variant="outline" size="icon" asChild title="Abrir formulário">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink data-icon />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
