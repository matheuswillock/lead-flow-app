"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { formatIntimezone } from "@/lib/dates"
import type { ContactList, RadarSegmentOption, Template } from "../context/CampanhasTypes"

type LinkedForm = {
  id: string
  name: string
  publicId: string
} | null

type SummarySubCampaign = {
  index: number
  name: string
  totalRecipients: number
  scheduledAt?: string | null
  templateName?: string
}

type CampaignWizardSummaryPanelProps = {
  name: string
  description?: string
  template: Template | null
  selectedLists: ContactList[]
  selectedSegment?: RadarSegmentOption | null
  linkedForm: LinkedForm
  totalRecipients: number
  listStrategy?: "single" | "merge" | "per_list"
  subCampaigns?: SummarySubCampaign[]
  uniformTemplate?: boolean
  tz: string
}

const LIST_STRATEGY_LABELS: Record<"single" | "merge" | "per_list", string> = {
  single: "Lista única",
  merge: "Juntar listas (dedup)",
  per_list: "Uma sub-campanha por lista",
}

export function CampaignWizardSummaryPanel({
  name,
  description,
  template,
  selectedLists,
  selectedSegment = null,
  linkedForm,
  totalRecipients,
  listStrategy,
  subCampaigns = [],
  uniformTemplate = true,
  tz,
}: CampaignWizardSummaryPanelProps) {
  const hasAudience =
    selectedLists.length > 0 || Boolean(selectedSegment)

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <p className="font-medium">Resumo</p>

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">Campanha</span>
        <span>{name.trim() || "Sem nome"}</span>
        {description?.trim() ? (
          <span className="text-muted-foreground">{description.trim()}</span>
        ) : null}
      </div>

      <Separator />

      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground">
          {uniformTemplate || subCampaigns.length <= 1 ? "Template" : "Templates"}
        </span>
        {uniformTemplate || subCampaigns.length <= 1 ? (
          <>
            <span>{template?.name ?? "Não selecionado"}</span>
            {template?.subject ? (
              <span className="text-muted-foreground">Assunto: {template.subject}</span>
            ) : null}
            <span className="text-muted-foreground">
              Formulário: {linkedForm ? linkedForm.name : "Nenhum formulário detectado"}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            Definido por sub-campanha (veja a lista abaixo)
          </span>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground">Audiência</span>
        {!hasAudience ? (
          <span>Nenhuma audiência selecionada</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selectedSegment ? (
              <Badge variant="secondary">
                {selectedSegment.name} ({selectedSegment.count.toLocaleString("pt-BR")})
              </Badge>
            ) : null}
            {selectedLists.map((list) => (
              <Badge key={list.id} variant="secondary">
                {list.name} ({(list.activeContacts ?? list.totalContacts).toLocaleString("pt-BR")})
              </Badge>
            ))}
          </div>
        )}
        <span>
          Total: {totalRecipients.toLocaleString("pt-BR")} destinatários
          {listStrategy ? ` · Estratégia: ${LIST_STRATEGY_LABELS[listStrategy]}` : null}
        </span>
      </div>

      {subCampaigns.length > 1 ? (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground">
              Sub-campanhas ({subCampaigns.length})
              {uniformTemplate ? " · mesmo template e agendamento" : " · configuradas individualmente"}
            </span>
            <div className="flex flex-col gap-1">
              {subCampaigns.map((sub) => (
                <span key={sub.index}>
                  #{sub.index} {sub.name} — {sub.totalRecipients.toLocaleString("pt-BR")}
                  {!uniformTemplate && sub.templateName ? ` — ${sub.templateName}` : null}
                  {sub.scheduledAt
                    ? ` — ${formatIntimezone(new Date(sub.scheduledAt), "dd/MM HH:mm", tz)}`
                    : null}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
