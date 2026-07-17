"use client"

import { Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmailUnsubscribePageView } from "@/components/email/EmailUnsubscribePageView"
import { useDescadastroContext } from "../context/DescadastroContext"
import { descadastroService } from "../services/DescadastroService"

export function DescadastroContainer() {
  const { previewMode, setPreviewMode } = useDescadastroContext()
  const label = descadastroService.getPreviewLabel()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Mail className="size-6" />
          <h1 className="text-2xl font-semibold">Descadastro</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {label}. A customização por time estará disponível em breve.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={previewMode === "confirm" ? "default" : "outline"}
          onClick={() => setPreviewMode("confirm")}
        >
          Confirmação
        </Button>
        <Button
          size="sm"
          variant={previewMode === "success" ? "default" : "outline"}
          onClick={() => setPreviewMode("success")}
        >
          Sucesso
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="max-h-[70vh] overflow-y-auto">
          <EmailUnsubscribePageView
            mode={previewMode}
            maskedEmail="m•••@exemplo.com"
            teamName="Seu time"
            removeFromCampaign
            removeFromAll={false}
            interactive={false}
          />
        </div>
      </div>
    </div>
  )
}
