"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { ContactList, Template } from "../context/CampanhasTypes"

type LinkedForm = {
  id: string
  name: string
  publicId: string
} | null

type CampaignWizardSummaryPanelProps = {
  template: Template | null
  selectedLists: ContactList[]
  linkedForm: LinkedForm
  totalRecipients: number
}

export function CampaignWizardSummaryPanel({
  template,
  selectedLists,
  linkedForm,
  totalRecipients,
}: CampaignWizardSummaryPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <p className="font-medium">Resumo</p>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">Template</span>
        <span>{template?.name ?? "Não selecionado"}</span>
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">Listas</span>
        {selectedLists.length === 0 ? (
          <span>Nenhuma lista selecionada</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedLists.map((list) => (
              <Badge key={list.id} variant="secondary">
                {list.name} ({(list.activeContacts ?? list.totalContacts).toLocaleString("pt-BR")})
              </Badge>
            ))}
          </div>
        )}
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">Destinatários estimados</span>
        <span>{totalRecipients.toLocaleString("pt-BR")}</span>
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">Formulário vinculado</span>
        <span>{linkedForm ? linkedForm.name : "Nenhum formulário detectado"}</span>
      </div>
    </div>
  )
}
