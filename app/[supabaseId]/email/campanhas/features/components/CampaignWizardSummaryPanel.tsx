"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Thermometer, ShieldCheck } from "lucide-react"
import { formatIntimezone } from "@/lib/dates"
import {
  formatPermanentBounceAlert,
  formatSuppressedAudienceSummary,
} from "@/lib/email/campaign-audience-copy"
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
  bouncedExcludedCount?: number
  unsubscribedExcludedCount?: number
  complainedExcludedCount?: number
  listStrategy?: "single" | "merge" | "per_list"
  subCampaigns?: SummarySubCampaign[]
  uniformTemplate?: boolean
  tz: string
  warmup?: {
    status: "warming" | "established" | "paused"
    stage: number
    limit: number | null
    used: number
    reserved: number
    remaining: number | null
    temperature: "warming" | "stable"
    health: "healthy" | "attention" | "paused"
    reason: string | null
    nextEvaluationAt: string
  } | null
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
  bouncedExcludedCount = 0,
  unsubscribedExcludedCount = 0,
  complainedExcludedCount = 0,
  listStrategy,
  subCampaigns = [],
  uniformTemplate = true,
  tz,
  warmup = null,
}: CampaignWizardSummaryPanelProps) {
  const hasAudience =
    selectedLists.length > 0 || Boolean(selectedSegment)
  const suppressedSummary = formatSuppressedAudienceSummary({
    bounced: bouncedExcludedCount,
    unsubscribed: unsubscribedExcludedCount,
    complained: complainedExcludedCount,
  })
  const availableToday = Math.max(0, warmup?.remaining ?? totalRecipients)
  const deferredToday = warmup?.status === "warming"
    ? Math.max(0, totalRecipients - availableToday)
    : 0

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <p className="font-medium">Resumo</p>

      {warmup ? (
        <Alert variant={warmup.health === "paused" ? "destructive" : "default"}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={warmup.temperature === "warming" ? "secondary" : "outline"}>
              <Thermometer data-icon="inline-start" />
              Temperatura: {warmup.temperature === "warming" ? "aquecendo" : "estável"}
            </Badge>
            <Badge variant={warmup.health === "healthy" ? "outline" : "secondary"}>
              <ShieldCheck data-icon="inline-start" />
              Saúde: {warmup.health === "healthy" ? "saudável" : warmup.health === "attention" ? "atenção" : "pausada"}
            </Badge>
          </div>
          <AlertDescription>
            <span className="flex flex-col gap-1">
              <span>
                {warmup.reason ??
                  `Este domínio está em aquecimento. O envio desta campanha respeitará o limite de ${(warmup.limit ?? 0).toLocaleString("pt-BR")} e-mails hoje.`}
              </span>
              <span>
                Estágio {warmup.stage + 1} · {warmup.used.toLocaleString("pt-BR")} usados · {warmup.reserved.toLocaleString("pt-BR")} reservados · {(warmup.remaining ?? 0).toLocaleString("pt-BR")} disponíveis.
              </span>
              {deferredToday > 0 ? (
                <span>
                  Esta campanha tem {totalRecipients.toLocaleString("pt-BR")} destinatários, mas ainda há espaço para {availableToday.toLocaleString("pt-BR")} hoje. Os {deferredToday.toLocaleString("pt-BR")} restantes serão enviados nas próximas janelas.
                </span>
              ) : null}
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

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
          {suppressedSummary ? ` · ${suppressedSummary}` : null}
          {listStrategy ? ` · Estratégia: ${LIST_STRATEGY_LABELS[listStrategy]}` : null}
        </span>
        {bouncedExcludedCount > 0 ? (
          <Alert>
            <AlertDescription>
              {formatPermanentBounceAlert(bouncedExcludedCount)}
            </AlertDescription>
          </Alert>
        ) : null}
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
