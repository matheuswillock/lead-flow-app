"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { ChevronDown, ExternalLink, Mail, Mails, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  RADAR_PROFILE_GENDER_LABELS,
  RADAR_PROFILE_GENDER_VALUES,
} from "@/lib/radar/radar-profile-gender"
import type { RadarGender } from "@/lib/radar/gender"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  RadarFinalizedContract,
  RadarProfileContracts,
  RadarProfileDetail,
  RadarProfileTouchpoints,
  RadarRelatedLead,
} from "../context/RadarTypes"
import type { RadarProfileFormItem } from "@/lib/radar/profile-forms"
import { getEventTypeIcon, isMilestoneEventType } from "../utils/radarSegmentBuilderUtils"
import { EligibilityBadge, SourceBadges, WhatsappBadge } from "./RadarProfileBadges"
import { PromoteRadarProfileAlertDialog } from "./PromoteRadarProfileAlertDialog"
import { isRealLeadIdentity } from "@/lib/radar/lead-identity"
import { getLeadStatusBadgeClass, getLeadStatusLabel } from "@/lib/lead-status"
import { cn } from "@/lib/utils"
import { RadarEngagementBadge } from "./RadarEngagementBadge"
import { RadarProfileFormsTab } from "./RadarProfileFormsTab"
import {
  buildLeadCrmHref,
  filterDisplayableIdentities,
  getRadarIdentityDisplayValue,
} from "../utils/radarIdentityDisplay"

function resolvePersonLabel(person: { id: string; name: string | null } | null | undefined): string | null {
  if (!person) return null
  return person.name?.trim() || null
}

const CONSENT_CHANNEL_LABEL: Record<string, string> = {
  email: "E-mail",
  whatsapp: "WhatsApp",
}

const CONSENT_STATUS_LABEL: Record<string, string> = {
  allowed: "Apto",
  blocked: "Bloqueado",
  unknown: "Indefinido",
}

const CONSENT_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  allowed: "default",
  blocked: "destructive",
  unknown: "secondary",
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

const PORTFOLIO_STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  canceled: "Cancelado",
}

const RENEWAL_STATUS_LABELS: Record<string, string> = {
  to_renew: "A renovar",
  contacted: "Contatado",
  proposal: "Proposta enviada",
  renewed: "Renovado",
  lost: "Perdido",
}

const PORTFOLIO_SOURCE_LABELS: Record<string, string> = {
  crm: "CRM",
  manual: "Manual",
  brokerage_transfer: "Transferência de corretagem",
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  individual: "PF",
  corporate: "Empresarial",
  adhesion: "Adesão",
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  return currencyFormatter.format(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR })
}

function RelatedLeadCard({ lead, supabaseId }: { lead: RadarRelatedLead; supabaseId: string }) {
  return (
    <Link
      href={buildLeadCrmHref(supabaseId, lead.leadCode)}
      className="flex flex-col gap-1 rounded-md border p-3 text-sm transition-colors hover:bg-muted/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{lead.name || "Sem nome"}</span>
        <Badge variant="outline" className={cn("font-normal", getLeadStatusBadgeClass(lead.status))}>
          {getLeadStatusLabel(lead.status)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          Lead {lead.leadCode}
          <ExternalLink className="size-3.5" />
        </span>
        <span>{formatDate(lead.createdAt)}</span>
      </div>
    </Link>
  )
}

function FinalizedContractCard({ item }: { item: RadarFinalizedContract }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{CONTRACT_TYPE_LABELS[item.contractType] ?? item.contractType}</Badge>
          {item.operadora ? <Badge variant="secondary">{item.operadora}</Badge> : null}
        </div>
        <span className="font-medium">{formatCurrency(item.amount)}</span>
      </div>
      <p className="text-muted-foreground">
        Fechado em {formatDate(item.finalizedDateAt)} · Início {formatDate(item.startDateAt)}
      </p>
      {item.productName ? <p className="text-muted-foreground">Produto: {item.productName}</p> : null}

      {item.holder ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="justify-between px-0">
              Titular: {item.holder.name}
              <ChevronDown data-icon="inline-end" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1 rounded-md bg-muted/40 p-2 text-xs">
            <p>Documento: {item.holder.document}</p>
            {item.holder.razaoSocial ? <p>Razão social: {item.holder.razaoSocial}</p> : null}
            {item.holder.cnpj ? <p>CNPJ: {item.holder.cnpj}</p> : null}
            <p>Nascimento: {formatDate(item.holder.birthDate)}</p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {item.dependents.length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="justify-between px-0">
              Dependentes ({item.dependents.length})
              <ChevronDown data-icon="inline-end" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2">
            {item.dependents.map((dependent) => (
              <div key={dependent.id} className="rounded-md bg-muted/40 p-2 text-xs">
                <p className="font-medium">{dependent.name}</p>
                <p className="text-muted-foreground">{dependent.parentesco}</p>
                <p className="text-muted-foreground">Nascimento: {formatDate(dependent.birthDate)}</p>
                {dependent.document ? (
                  <p className="text-muted-foreground">Documento: {dependent.document}</p>
                ) : (
                  <p className="text-muted-foreground">Sem documento</p>
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  )
}

type RadarProfileSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: RadarProfileDetail | null
  isLoading: boolean
  detailEvents: RadarProfileDetail["events"]
  detailEventsTotal: number
  isLoadingMoreEvents: boolean
  onLoadMoreEvents: () => void
  touchpoints: RadarProfileTouchpoints | null
  isLoadingTouchpoints: boolean
  contracts: RadarProfileContracts | null
  isLoadingContracts: boolean
  profileForms: RadarProfileFormItem[] | null
  isLoadingProfileForms: boolean
  relatedLeads: RadarRelatedLead[] | null
  isLoadingRelatedLeads: boolean
  onPromoteToLead?: () => Promise<boolean>
  onUpdateGender?: (gender: RadarGender) => Promise<boolean>
}

export function RadarProfileSheet({
  open,
  onOpenChange,
  profile,
  isLoading,
  detailEvents,
  detailEventsTotal,
  isLoadingMoreEvents,
  onLoadMoreEvents,
  touchpoints,
  isLoadingTouchpoints,
  contracts,
  isLoadingContracts,
  profileForms,
  isLoadingProfileForms,
  relatedLeads,
  isLoadingRelatedLeads,
  onPromoteToLead,
  onUpdateGender,
}: RadarProfileSheetProps) {
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false)
  const [isPromotingToLead, setIsPromotingToLead] = useState(false)
  const [genderDraft, setGenderDraft] = useState<RadarGender>("unknown")
  const [isSavingGender, setIsSavingGender] = useState(false)
  // Reserva `pending:` não é vínculo: contá-la esconderia "Promover a Lead"
  // para sempre num perfil cuja reserva ficou órfã, mesmo com o backend já
  // aceitando a retomada.
  const hasLeadIdentity = profile?.identities.some(isRealLeadIdentity) ?? false
  const displayableIdentities = profile ? filterDisplayableIdentities(profile.identities) : []
  const emailIdentities = profile
    ? profile.identities.filter((identity) => identity.type === "email")
    : []
  const emailLabels = Array.from(
    new Set(
      emailIdentities
        .map((identity) => getRadarIdentityDisplayValue(identity))
        .filter((value) => value !== "—")
    )
  )
  const headerEmails =
    emailLabels.length > 0
      ? emailLabels
      : profile?.primaryEmail
        ? [profile.primaryEmail]
        : []
  const assignees = profile?.assignees ?? []
  const leadCodeById = new Map(assignees.map((item) => [item.leadId, item.leadCode]))
  const hasAnyAssignee = assignees.some(
    (item) => resolvePersonLabel(item.assignedTo) || resolvePersonLabel(item.closer)
  )
  const baseDataEntries =
    profile?.profileData && typeof profile.profileData === "object" && !Array.isArray(profile.profileData)
      ? Object.entries(profile.profileData as Record<string, unknown>).filter(([key]) => key.startsWith("base."))
      : []

  const hasContracts =
    (contracts?.portfolios.length ?? 0) > 0 || (contracts?.finalized.length ?? 0) > 0

  const profileGender = (profile?.gender as RadarGender | null | undefined) ?? "unknown"
  const genderDirty = profile ? genderDraft !== profileGender : false

  useEffect(() => {
    if (!profile) return
    setGenderDraft((profile.gender as RadarGender | null | undefined) ?? "unknown")
  }, [profile?.id, profile?.gender])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-lg flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Detalhe do perfil</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {isLoading || !profile ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{profile.displayName}</h2>
                    <RadarEngagementBadge band={profile.engagementBand} />
                  </div>
                  {profile.primaryDocument ? (
                    <p className="text-sm text-muted-foreground">Documento: {profile.primaryDocument}</p>
                  ) : null}
                  {profile.displayPhone ? (
                    <p className="text-sm text-muted-foreground">{profile.displayPhone}</p>
                  ) : null}
                  {headerEmails.length > 1 ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mails className="size-4 shrink-0" aria-hidden />
                        <span>
                          {headerEmails.length} e-mails vinculados
                        </span>
                      </div>
                      <ul className="flex flex-col gap-0.5 pl-6">
                        {headerEmails.map((email) => (
                          <li key={email} className="text-sm text-muted-foreground">
                            {email}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : headerEmails.length === 1 ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="size-4 shrink-0" aria-hidden />
                      <span>{headerEmails[0]}</span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <EligibilityBadge profile={profile} />
                    <WhatsappBadge profile={profile} />
                  </div>
                </div>
              </div>

              {onUpdateGender ? (
                <>
                  <Separator />
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Gênero</FieldLabel>
                      <div className="flex flex-wrap items-end gap-2">
                        <Select
                          value={genderDraft}
                          onValueChange={(value) => setGenderDraft(value as RadarGender)}
                          disabled={isSavingGender}
                        >
                          <SelectTrigger className="w-full sm:w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RADAR_PROFILE_GENDER_VALUES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {RADAR_PROFILE_GENDER_LABELS[value]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={isSavingGender || !genderDirty}
                          onClick={() => {
                            setIsSavingGender(true)
                            void onUpdateGender(genderDraft).finally(() => {
                              setIsSavingGender(false)
                            })
                          }}
                        >
                          {isSavingGender ? "Salvando…" : "Salvar gênero"}
                        </Button>
                      </div>
                      {profile.genderSource ? (
                        <p className="text-xs text-muted-foreground">
                          Origem: {profile.genderSource === "manual" ? "Manual" : profile.genderSource}
                        </p>
                      ) : null}
                    </Field>
                  </FieldGroup>
                </>
              ) : null}

              {!hasLeadIdentity && onPromoteToLead ? (
                <>
                  <Separator />
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => setPromoteDialogOpen(true)}
                  >
                    <UserPlus data-icon="inline-start" />
                    Promover a Lead
                  </Button>
                  <PromoteRadarProfileAlertDialog
                    open={promoteDialogOpen}
                    onOpenChange={setPromoteDialogOpen}
                    displayName={profile.displayName}
                    primaryEmail={profile.primaryEmail}
                    isPromoting={isPromotingToLead}
                    onConfirm={async () => {
                      setIsPromotingToLead(true)
                      try {
                        const success = await onPromoteToLead()
                        if (success) setPromoteDialogOpen(false)
                      } finally {
                        setIsPromotingToLead(false)
                      }
                    }}
                  />
                </>
              ) : null}

              {hasLeadIdentity ? (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Responsáveis</p>
                    {!hasAnyAssignee ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum responsável atribuído nos leads associados.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {assignees.map((item) => {
                          const sdrName = resolvePersonLabel(item.assignedTo)
                          const closerName = resolvePersonLabel(item.closer)
                          if (!sdrName && !closerName) return null
                          return (
                            <div key={item.leadId} className="rounded-md border p-3 text-sm">
                              <p className="mb-1 text-xs text-muted-foreground">Lead {item.leadCode}</p>
                              {sdrName ? (
                                <p>
                                  <span className="text-muted-foreground">SDR: </span>
                                  {sdrName}
                                </p>
                              ) : null}
                              {closerName ? (
                                <p>
                                  <span className="text-muted-foreground">Closer: </span>
                                  {closerName}
                                </p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              <Tabs defaultValue="resumo">
                <TabsList className="flex h-auto flex-wrap gap-1">
                  <TabsTrigger value="resumo">Resumo</TabsTrigger>
                  <TabsTrigger value="leads-crm">Leads no CRM</TabsTrigger>
                  <TabsTrigger value="contatos">Contatos</TabsTrigger>
                  <TabsTrigger value="formularios">Formulários</TabsTrigger>
                  <TabsTrigger value="contratos">Contratos</TabsTrigger>
                  <TabsTrigger value="identidades">Identidades</TabsTrigger>
                  <TabsTrigger value="consentimentos">Consentimentos</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                </TabsList>

                <TabsContent value="resumo" className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-1">
                    <SourceBadges profile={profile} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">Temperatura</p>
                      <RadarEngagementBadge band={profile.engagementBand} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">Score</p>
                      <p className="text-sm font-medium tabular-nums">
                        {profile.engagementScore != null ? `${profile.engagementScore}/100` : "—"}
                      </p>
                    </div>
                  </div>
                  {baseDataEntries.length > 0 ? (
                    <>
                      <Separator />
                      <p className="text-sm font-medium">Dados da base</p>
                      <div className="flex flex-col gap-2">
                        {baseDataEntries.map(([key, value]) => (
                          <div key={key} className="rounded-md border p-2 text-sm">
                            <p className="font-medium">{key.replace(/^base\./, "")}</p>
                            <p className="text-muted-foreground">{String(value ?? "—")}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                  <Separator />
                  <p className="text-sm font-medium">Últimos eventos</p>
                  {profile.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
                  ) : (
                    profile.events.map((event) => {
                      const EventIcon = getEventTypeIcon(event.eventType)
                      return (
                        <div key={event.id} className="flex items-center gap-2 text-sm">
                          <EventIcon className="size-4 text-muted-foreground" />
                          <span className="font-medium">{event.eventType}</span>
                          {isMilestoneEventType(event.eventType) ? (
                            <Badge variant="secondary">Marco</Badge>
                          ) : null}
                          <span className="text-muted-foreground">
                            {" "}
                            — {format(new Date(event.occurredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      )
                    })
                  )}
                </TabsContent>

                <TabsContent value="leads-crm" className="flex flex-col gap-2">
                  {isLoadingRelatedLeads ? (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : !relatedLeads || relatedLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum lead vinculado a este perfil.
                    </p>
                  ) : (
                    relatedLeads.map((lead) => (
                      <RelatedLeadCard key={lead.id} lead={lead} supabaseId={supabaseId} />
                    ))
                  )}
                </TabsContent>

                <TabsContent value="contatos" className="flex flex-col gap-3">
                  {isLoadingTouchpoints ? (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : !touchpoints || touchpoints.breakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum ponto de contato registrado.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Pontos de contato</p>
                        <Badge variant="secondary">{touchpoints.total} total</Badge>
                      </div>
                      <Separator />
                      <div className="flex flex-col gap-2">
                        {touchpoints.breakdown
                          .sort((a, b) => b.count - a.count)
                          .map((channel) => (
                            <div
                              key={channel.channel}
                              className="flex flex-col gap-1 rounded-md border p-3 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{channel.channel}</span>
                                <Badge variant="outline">{channel.count}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Primeiro:{" "}
                                {format(new Date(channel.firstEventAt), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Último:{" "}
                                {format(new Date(channel.lastEventAt), "dd/MM/yyyy HH:mm", {
                                  locale: ptBR,
                                })}
                              </p>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="formularios" className="flex flex-col gap-3">
                  <RadarProfileFormsTab items={profileForms} isLoading={isLoadingProfileForms} />
                </TabsContent>

                <TabsContent value="contratos" className="flex flex-col gap-3">
                  {isLoadingContracts ? (
                    <div className="flex flex-col gap-2">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-24 w-full" />
                      <Skeleton className="h-24 w-full" />
                    </div>
                  ) : !hasContracts ? (
                    <p className="text-sm text-muted-foreground">Nenhum contrato encontrado para este perfil.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Contratos atuais</p>
                        <Badge variant="secondary">{contracts?.portfolios.length ?? 0}</Badge>
                      </div>
                      {(contracts?.portfolios.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">Sem contrato atual na carteira.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {contracts?.portfolios.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-col gap-2 rounded-md border p-3 text-sm"
                            >
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">
                                  {PORTFOLIO_STATUS_LABELS[item.portfolioStatus] ?? item.portfolioStatus}
                                </Badge>
                                <Badge variant="outline">
                                  {RENEWAL_STATUS_LABELS[item.renewalStatus] ?? item.renewalStatus}
                                </Badge>
                                <Badge variant="outline">
                                  {PORTFOLIO_SOURCE_LABELS[item.source] ?? item.source}
                                </Badge>
                              </div>
                              <p>
                                Valor de renovação:{" "}
                                <span className="font-medium">{formatCurrency(item.renewalAmount)}</span>
                              </p>
                              <p className="text-muted-foreground">
                                Último contato: {formatDate(item.lastContactAt)}
                              </p>
                              {item.note ? (
                                <p className="text-muted-foreground">{item.note}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}

                      <Separator />

                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Histórico</p>
                        <Badge variant="secondary">{contracts?.finalized.length ?? 0}</Badge>
                      </div>
                      {(contracts?.finalized.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">Sem contratos finalizados.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {contracts?.finalized.map((item) => (
                            <FinalizedContractCard key={item.id} item={item} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="identidades" className="flex flex-col gap-2">
                  {displayableIdentities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma identidade exibível.</p>
                  ) : (
                    displayableIdentities.map((identity) => {
                      const leadId = identity.normalizedValue || identity.value || ""
                      const leadCode = identity.type === "lead_id" ? leadCodeById.get(leadId) : undefined

                      return (
                        <div
                          key={identity.id}
                          className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
                        >
                          <Badge variant="outline">{identity.type}</Badge>
                          {identity.type === "lead_id" && leadCode ? (
                            <Link
                              href={buildLeadCrmHref(supabaseId, leadCode)}
                              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                            >
                              Abrir lead {leadCode}
                              <ExternalLink className="size-3.5" />
                            </Link>
                          ) : identity.type === "lead_id" ? (
                            <span className="text-muted-foreground">Lead associado</span>
                          ) : (
                            <span className="text-muted-foreground">
                              {getRadarIdentityDisplayValue(identity)}
                            </span>
                          )}
                        </div>
                      )
                    })
                  )}
                </TabsContent>

                <TabsContent value="consentimentos" className="flex flex-col gap-2">
                  {profile.consents.map((consent) => (
                    <div key={`${consent.channel}-${consent.status}`} className="rounded-md border p-2 text-sm">
                      <p className="font-medium">{CONSENT_CHANNEL_LABEL[consent.channel] ?? consent.channel}</p>
                      <Badge variant={CONSENT_STATUS_VARIANT[consent.status] ?? "secondary"}>
                        {CONSENT_STATUS_LABEL[consent.status] ?? consent.status}
                      </Badge>
                      {consent.reason ? <p className="text-muted-foreground">{consent.reason}</p> : null}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="timeline" className="flex flex-col gap-2">
                  {detailEvents.map((event) => {
                    const EventIcon = getEventTypeIcon(event.eventType)
                    return (
                      <div key={event.id} className="rounded-md border p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <EventIcon className="size-4 text-muted-foreground" />
                          <p className="font-medium">{event.eventType}</p>
                          {isMilestoneEventType(event.eventType) ? (
                            <Badge variant="secondary">Marco</Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground">
                          {format(new Date(event.occurredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })} — {event.sourceType}
                        </p>
                      </div>
                    )
                  })}
                  {detailEvents.length < detailEventsTotal ? (
                    <Button size="sm" variant="outline" disabled={isLoadingMoreEvents} onClick={onLoadMoreEvents}>
                      {isLoadingMoreEvents ? "Carregando..." : "Carregar mais"}
                    </Button>
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>

      </SheetContent>
    </Sheet>
  )
}
