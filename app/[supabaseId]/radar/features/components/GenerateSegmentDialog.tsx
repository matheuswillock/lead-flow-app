"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronsUpDown, FileText, Flame, Kanban, ListChecks, MousePointerClick, Plus, ShieldCheck, Snowflake, SlidersHorizontal, Thermometer, ThermometerSun, TriangleAlert, User, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { useActiveLeadCustomFieldDefinitions } from "@/hooks/useActiveLeadCustomFieldDefinitions"
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction"
import { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB } from "@/lib/email/campaign-limits"
import { getLeadStatusLabel } from "@/lib/lead-status"
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types"
import { LEAD_FIELD_CATALOG, PORTFOLIO_FIELD_CATALOG, RADAR_SEGMENT_LEAD_STATUSES } from "@/lib/radar/segment-dsl"
import { useTeamContext } from "@/app/context/TeamContext"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import type {
  RadarLeadCustomFieldCondition,
  RadarLeadFieldCondition,
  RadarPortfolioFieldCondition,
  RadarSegmentCondition,
  RadarSegmentRules,
  RadarProfileListItem,
} from "../context/RadarTypes"
import { radarFrontendService } from "../services/RadarService"
import {
  OPERATORS_BY_CUSTOM_FIELD_TYPE,
  OPERATORS_BY_LAST_SEEN,
  OPERATORS_BY_PROFILE_FIELD,
  conditionNeedsValueInput,
  isRulesValidForSave,
} from "../utils/radarSegmentBuilderUtils"

const OPERATOR_LABELS: Record<string, string> = {
  eq: "é igual a",
  neq: "é diferente de",
  contains: "contém",
  is_empty: "está vazio",
  not_empty: "não está vazio",
  before: "antes de",
  after: "depois de",
  within_days: "nos últimos X dias",
  gt: "maior que",
  gte: "maior ou igual a",
  lt: "menor que",
  lte: "menor ou igual a",
}

const LEAD_FIELD_LABELS: Record<keyof typeof LEAD_FIELD_CATALOG, string> = {
  status: "Status",
  currentHealthPlan: "Plano atual",
  currentValue: "Valor atual (R$)",
  ticket: "Ticket (R$)",
  meetingDate: "Data de reunião",
  followUpAt: "Próximo contato",
  contractDueDate: "Vencimento do contrato",
  soldPlan: "Plano vendido",
  isReferral: "É indicação",
  assignedTo: "SDR responsável",
  closerId: "Closer responsável",
}

const PORTFOLIO_FIELD_LABELS: Record<keyof typeof PORTFOLIO_FIELD_CATALOG, string> = {
  portfolioStatus: "Status da carteira",
  renewalStatus: "Status de renovação",
  renewalAmount: "Valor de renovação (R$)",
  source: "Origem da carteira",
  lastContactAt: "Último contato (carteira)",
  finalizedDateAt: "Data de fechamento",
  amount: "Valor do contrato (R$)",
  contractType: "Tipo de contrato",
  operadora: "Operadora",
  productName: "Produto",
}

const PORTFOLIO_ENUM_LABELS: Record<string, Record<string, string>> = {
  portfolioStatus: {
    active: "Ativo",
    pending: "Pendente",
    canceled: "Cancelado",
  },
  renewalStatus: {
    to_renew: "A renovar",
    contacted: "Contatado",
    proposal: "Proposta enviada",
    renewed: "Renovado",
    lost: "Perdido",
  },
  source: {
    crm: "CRM",
    manual: "Manual",
    brokerage_transfer: "Transferência de corretagem",
  },
  contractType: {
    individual: "PF",
    corporate: "Empresarial",
    adhesion: "Adesão",
  },
}

const KIND_OPTIONS = [
  { value: "profile_field", label: "Campo do perfil", icon: User },
  { value: "event", label: "Evento", icon: MousePointerClick },
  { value: "consent", label: "Consentimento", icon: ShieldCheck },
  { value: "lead_custom_field", label: "Campo personalizado do lead", icon: ListChecks },
  { value: "lead_status", label: "Status do lead (CRM)", icon: Kanban },
  { value: "lead_field", label: "Campo nativo do lead (CRM)", icon: SlidersHorizontal },
  { value: "portfolio_field", label: "Campo de contrato/carteira", icon: FileText },
  { value: "engagement_band", label: "Temperatura", icon: Thermometer },
] as const

const ENGAGEMENT_BAND_OPTIONS = [
  { value: "hot" as const, label: "Quente", icon: Flame },
  { value: "warm" as const, label: "Morno", icon: ThermometerSun },
  { value: "lukewarm" as const, label: "Morno-frio", icon: Thermometer },
  { value: "cold" as const, label: "Frio", icon: Snowflake },
]

function defaultConditionForKind(kind: RadarSegmentCondition["kind"]): RadarSegmentCondition {
  switch (kind) {
    case "profile_field":
      return { kind: "profile_field", field: "primaryEmail", operator: "eq" }
    case "consent":
      return { kind: "consent", channel: "email", status: "allowed" }
    case "event":
      return { kind: "event", eventType: "", occurrence: "occurred" }
    case "lead_custom_field":
      return { kind: "lead_custom_field", definitionId: "", operator: "eq" }
    case "lead_status":
      return { kind: "lead_status", statuses: [] }
    case "engagement_band":
      return { kind: "engagement_band", bands: [] }
    case "lead_field":
      return { kind: "lead_field", fieldKey: "status", operator: "eq", value: [] }
    case "portfolio_field":
      return { kind: "portfolio_field", fieldKey: "renewalStatus", operator: "eq", value: "to_renew" }
  }
}

const defaultRules: RadarSegmentRules = { match: "all", conditions: [defaultConditionForKind("profile_field")] }

function LeadCustomFieldValueInput({
  condition,
  definition,
  onChange,
}: {
  condition: RadarLeadCustomFieldCondition
  definition: LeadCustomFieldDefinitionDTO | undefined
  onChange: (value: unknown) => void
}) {
  const fieldType = definition?.type ?? "text"

  if (fieldType === "select") {
    return (
      <Select value={typeof condition.value === "string" ? condition.value : ""} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Valor" />
        </SelectTrigger>
        <SelectContent>
          {(definition?.options ?? []).map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (fieldType === "multi_select") {
    const selected = Array.isArray(condition.value) ? (condition.value as string[]) : []
    return (
      <div className="flex flex-wrap gap-1.5">
        {(definition?.options ?? []).map((option) => {
          const isSelected = selected.includes(option.value)
          return (
            <Badge
              key={option.value}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                onChange(isSelected ? selected.filter((v) => v !== option.value) : [...selected, option.value])
              }
            >
              {option.label}
            </Badge>
          )
        })}
      </div>
    )
  }

  if (fieldType === "boolean") {
    return (
      <Select
        value={typeof condition.value === "boolean" ? String(condition.value) : ""}
        onValueChange={(value) => onChange(value === "true")}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Valor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Sim</SelectItem>
          <SelectItem value="false">Não</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (fieldType === "number") {
    return (
      <Input
        className="w-40"
        type="number"
        value={typeof condition.value === "number" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
    )
  }

  return (
    <Input
      className="w-40"
      type={fieldType === "date" ? "date" : "text"}
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

const CANONICAL_RADAR_EVENT_TYPES = [
  "email.sent",
  "email.opened",
  "email.clicked",
  "whatsapp.message_received",
  "whatsapp.message_sent",
  "portfolio.renewal_due",
  "portfolio.renewed",
  "portfolio.brokerage_transfer",
  "lead.created",
  "lead.status_changed",
  "lead.milestone.new_opportunity",
  "lead.milestone.invoice_payment",
  "lead.milestone.future_sale",
  "lead.milestone.contract_finalized",
  "profile.first_contact",
  "form.viewed",
  "form.started",
  "form.completed",
  "pixel.pageview",
  "pixel.click",
] as const

function EventTypeSelect({
  value,
  onChange,
  supabaseId,
  teamId,
}: {
  value: string
  onChange: (eventType: string) => void
  supabaseId: string
  teamId: string | null
}) {
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const requestKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!supabaseId || !teamId) {
      setEventTypes([])
      setError(null)
      return
    }

    const requestKey = `${supabaseId}:${teamId}`
    if (lastSuccessKeyRef.current === requestKey) return
    if (requestKeyRef.current === requestKey) return
    requestKeyRef.current = requestKey

    let cancelled = false
    setLoading(true)
    setError(null)

    void radarFrontendService
      .listAvailableEventTypes(supabaseId, teamId)
      .then((types) => {
        if (cancelled) return
        setEventTypes(types)
        lastSuccessKeyRef.current = requestKey
      })
      .catch((loadError) => {
        if (cancelled) return
        console.error("[EventTypeSelect]", loadError)
        setError("Não foi possível carregar os tipos de evento")
        requestKeyRef.current = null
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (requestKeyRef.current === requestKey) {
        requestKeyRef.current = null
      }
    }
  }, [supabaseId, teamId])

  const options = Array.from(
    new Set<string>([
      ...CANONICAL_RADAR_EVENT_TYPES,
      ...eventTypes,
      ...(value ? [value] : []),
    ])
  ).sort((a, b) => a.localeCompare(b))

  const trimmed = search.trim()
  const filtered = trimmed
    ? options.filter((eventType) => eventType.toLowerCase().includes(trimmed.toLowerCase()))
    : options
  const canUseCustom = trimmed.length > 0 && !options.some((eventType) => eventType === trimmed)

  const placeholder = loading
    ? "Carregando eventos…"
    : error
      ? "Erro ao carregar"
      : "Tipo de evento"

  const selectEventType = (eventType: string) => {
    onChange(eventType)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-56 justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown data-icon="inline-end" className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="start"
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar ou digitar evento…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList
            className="max-h-[min(300px,50vh)] overflow-y-auto"
            onWheel={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
          >
            {canUseCustom ? (
              <CommandGroup heading="Valor personalizado">
                <CommandItem value={`custom:${trimmed}`} onSelect={() => selectEventType(trimmed)}>
                  Usar &quot;{trimmed}&quot;
                </CommandItem>
              </CommandGroup>
            ) : null}
            <CommandGroup heading={eventTypes.length > 0 ? "Eventos do time e catálogo" : "Catálogo de eventos"}>
              {filtered.length === 0 && !canUseCustom ? (
                <CommandEmpty>
                  {loading ? "Carregando…" : "Nenhum tipo encontrado — digite para usar um valor customizado"}
                </CommandEmpty>
              ) : (
                filtered.map((eventType) => (
                  <CommandItem
                    key={eventType}
                    value={eventType}
                    onSelect={() => selectEventType(eventType)}
                  >
                    <Check className={cn("opacity-0", value === eventType && "opacity-100")} />
                    {eventType}
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CampaignSelect({
  value,
  onChange,
  supabaseId,
  teamId,
}: {
  value: string | undefined
  onChange: (campaignId: string | undefined) => void
  supabaseId: string
  teamId: string | null
}) {
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const requestKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!supabaseId || !teamId) {
      setCampaigns([])
      return
    }

    const requestKey = `${supabaseId}:${teamId}`
    if (lastSuccessKeyRef.current === requestKey) return
    if (requestKeyRef.current === requestKey) return
    requestKeyRef.current = requestKey

    let cancelled = false
    setLoading(true)

    void radarFrontendService
      .listAvailableCampaigns(supabaseId, teamId)
      .then((items) => {
        if (cancelled) return
        setCampaigns(items)
        lastSuccessKeyRef.current = requestKey
      })
      .catch((loadError) => {
        if (cancelled) return
        console.error("[CampaignSelect]", loadError)
        requestKeyRef.current = null
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (requestKeyRef.current === requestKey) {
        requestKeyRef.current = null
      }
    }
  }, [supabaseId, teamId])

  return (
    <Select
      value={value ?? "__any__"}
      onValueChange={(next) => onChange(next === "__any__" ? undefined : next)}
      disabled={loading || campaigns.length === 0}
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder={loading ? "Carregando campanhas…" : "Qualquer campanha"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__any__">Qualquer campanha</SelectItem>
        {campaigns.map((campaign) => (
          <SelectItem key={campaign.id} value={campaign.id}>
            {campaign.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TeamMemberSelect({
  fieldKey,
  value,
  onChange,
  supabaseId,
  teamId,
}: {
  fieldKey: "assignedTo" | "closerId"
  value: unknown
  onChange: (value: unknown) => void
  supabaseId: string
  teamId: string | null
}) {
  const sdrs = useTeamSdrs(supabaseId, teamId)
  const closers = useTeamClosers(supabaseId, teamId)
  const { members, loading } = fieldKey === "assignedTo" ? sdrs : closers

  return (
    <Select
      value={typeof value === "string" ? value : ""}
      onValueChange={onChange}
      disabled={loading}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder={loading ? "Carregando…" : "Selecionar membro"} />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function LeadFieldValueInput({
  condition,
  onChange,
  supabaseId,
  teamId,
}: {
  condition: RadarLeadFieldCondition
  onChange: (value: unknown) => void
  supabaseId: string
  teamId: string | null
}) {
  const entry = LEAD_FIELD_CATALOG[condition.fieldKey]

  if (entry.valueKind === "lead_status_multi") {
    const selected = Array.isArray(condition.value) ? (condition.value as string[]) : []
    return (
      <div className="flex flex-wrap gap-1.5">
        {RADAR_SEGMENT_LEAD_STATUSES.map((status) => {
          const isSelected = selected.includes(status)
          return (
            <Badge
              key={status}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() =>
                onChange(isSelected ? selected.filter((s) => s !== status) : [...selected, status])
              }
            >
              {getLeadStatusLabel(status)}
            </Badge>
          )
        })}
      </div>
    )
  }

  if (entry.valueKind === "boolean") {
    return (
      <Select
        value={typeof condition.value === "boolean" ? String(condition.value) : ""}
        onValueChange={(v) => onChange(v === "true")}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Valor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Sim</SelectItem>
          <SelectItem value="false">Não</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  if (entry.valueKind === "number") {
    return (
      <Input
        className="w-40"
        type="number"
        value={typeof condition.value === "number" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
    )
  }

  if (entry.valueKind === "date") {
    if (condition.operator === "within_days") {
      return (
        <Input
          className="w-36"
          type="number"
          placeholder="Dias"
          value={typeof condition.value === "number" ? condition.value : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
      )
    }
    return (
      <Input
        className="w-40"
        type="date"
        value={typeof condition.value === "string" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if (condition.fieldKey === "assignedTo" || condition.fieldKey === "closerId") {
    return (
      <TeamMemberSelect
        fieldKey={condition.fieldKey}
        value={condition.value}
        onChange={onChange}
        supabaseId={supabaseId}
        teamId={teamId}
      />
    )
  }

  return (
    <Input
      className="w-40"
      type="text"
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function PortfolioFieldValueInput({
  condition,
  onChange,
}: {
  condition: RadarPortfolioFieldCondition
  onChange: (value: unknown) => void
}) {
  const entry = PORTFOLIO_FIELD_CATALOG[condition.fieldKey]

  if (entry.valueKind === "enum") {
    const labels = PORTFOLIO_ENUM_LABELS[condition.fieldKey] ?? {}
    return (
      <Select value={typeof condition.value === "string" ? condition.value : ""} onValueChange={onChange}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Valor" />
        </SelectTrigger>
        <SelectContent>
          {entry.enumValues.map((enumValue) => (
            <SelectItem key={enumValue} value={enumValue}>
              {labels[enumValue] ?? enumValue}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (entry.valueKind === "number") {
    return (
      <Input
        className="w-40"
        type="number"
        value={typeof condition.value === "number" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
    )
  }

  if (entry.valueKind === "date") {
    if (condition.operator === "within_days") {
      return (
        <Input
          className="w-36"
          type="number"
          placeholder="Dias"
          value={typeof condition.value === "number" ? condition.value : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
      )
    }
    return (
      <Input
        className="w-40"
        type="date"
        value={typeof condition.value === "string" ? condition.value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <Input
      className="w-40"
      type="text"
      value={typeof condition.value === "string" ? condition.value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

type GenerateSegmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceType: "campaign" | "segment"
  sourceName: string
  campaignId?: string
  parentSegmentId?: string
  initialRules?: RadarSegmentRules
  onSuccess?: () => void | Promise<void>
}

export function GenerateSegmentDialog({
  open,
  onOpenChange,
  sourceType,
  sourceName,
  campaignId,
  parentSegmentId,
  initialRules,
  onSuccess,
}: GenerateSegmentDialogProps) {
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const { activeTeamId } = useTeamContext()
  const { definitions: customFieldDefinitions } = useActiveLeadCustomFieldDefinitions(supabaseId, activeTeamId)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [rules, setRules] = useState<RadarSegmentRules>(initialRules ?? defaultRules)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewProfiles, setPreviewProfiles] = useState<RadarProfileListItem[]>([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [mutationLock, setMutationLock] = useState(false)
  const keyCounterRef = useRef(0)
  const [conditionKeys, setConditionKeys] = useState<string[]>(() =>
    (initialRules?.conditions ?? [defaultConditionForKind("profile_field")]).map(() => `cond-${keyCounterRef.current++}`)
  )
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!open) return
    setName("")
    setDescription("")
    setRules(initialRules ?? defaultRules)
    setConditionKeys((initialRules?.conditions ?? [defaultConditionForKind("profile_field")]).map(() => `cond-${keyCounterRef.current++}`))
    setPreviewCount(null)
    setPreviewProfiles([])
    setMutationLock(false)
  }, [open, initialRules])

  const updateCondition = (index: number, next: RadarSegmentCondition) => {
    setRules((prev) => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => (i === index ? next : condition)),
    }))
    setPreviewCount(null)
    setPreviewProfiles([])
  }

  const addCondition = () => {
    if (rules.conditions.length >= 10) return
    setRules((prev) => ({ ...prev, conditions: [...prev.conditions, defaultConditionForKind("profile_field")] }))
    setConditionKeys((prev) => [...prev, `cond-${keyCounterRef.current++}`])
    setPreviewCount(null)
    setPreviewProfiles([])
  }

  const removeCondition = (index: number) => {
    setRules((prev) => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== index) }))
    setConditionKeys((prev) => prev.filter((_, i) => i !== index))
    setPreviewCount(null)
    setPreviewProfiles([])
  }

  useEffect(() => {
    if (!open || !isRulesValidForSave(rules) || !activeTeamId) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      setIsLoadingPreview(true)
      radarFrontendService
        .previewSegmentWithHierarchy(supabaseId, activeTeamId, {
          rules,
          ...(sourceType === "campaign" && campaignId ? { campaignId } : {}),
          ...(sourceType === "segment" && parentSegmentId ? { parentSegmentId } : {}),
        })
        .then((result) => {
          setPreviewCount(result.count)
          setPreviewProfiles(
            (result.previewProfiles ?? []).map((profile) => ({
              id: profile.id,
              displayName: profile.displayName,
              displayPhone: profile.displayPhone,
              primaryEmail: profile.primaryEmail,
              lastSeenAt: profile.lastSeenAt,
              engagementScore: profile.engagementScore,
              engagementBand: profile.engagementBand,
              primarySegment: profile.primarySegment,
              primarySegmentName: profile.primarySegmentName,
              consents: profile.consents,
              sourceLinks: profile.sourceLinks,
            }))
          )
        })
        .catch((error) => {
          console.error("[GenerateSegmentDialog] Preview error:", error)
          setPreviewCount(0)
          setPreviewProfiles([])
        })
        .finally(() => {
          setIsLoadingPreview(false)
        })
    }, 500)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [open, rules, supabaseId, activeTeamId, sourceType, campaignId, parentSegmentId])

  const handleSubmit = async () => {
    if (!activeTeamId || mutationLock) return
    if (sourceType === "campaign" && !campaignId) return
    if (sourceType === "segment" && !parentSegmentId) return

    setMutationLock(true)
    try {
      if (sourceType === "campaign" && campaignId) {
        await radarFrontendService.createSegmentFromCampaign(supabaseId, activeTeamId, {
          campaignId,
          name: name.trim(),
          description: description.trim() || null,
          additionalRules: rules,
        })
      } else if (sourceType === "segment" && parentSegmentId) {
        await radarFrontendService.createChildSegment(supabaseId, activeTeamId, {
          parentSegmentId,
          name: name.trim(),
          description: description.trim() || null,
          childRules: rules,
        })
      }
      toast.success("Segmento criado com sucesso")
      await onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[GenerateSegmentDialog][handleSubmit]", error)
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o segmento.")
    } finally {
      setMutationLock(false)
    }
  }

  const canSave =
    name.trim().length > 0 &&
    isRulesValidForSave(rules) &&
    previewCount !== null &&
    previewCount > 0 &&
    !mutationLock &&
    (sourceType === "campaign" ? Boolean(campaignId) : Boolean(parentSegmentId))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Gerar segmento {sourceType === "campaign" ? "da campanha" : "derivado"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {sourceType === "campaign"
              ? `Criar segmento baseado na campanha "${sourceName}"`
              : `Criar segmento filho de "${sourceName}"`}
          </p>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-1">
          <FieldGroup>
            <Field>
              <FieldLabel>Nome</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Clientes VIP" />
            </Field>
            <Field>
              <FieldLabel>Descrição</FieldLabel>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </FieldGroup>

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Condições adicionais</p>
            <ToggleGroup
              type="single"
              value={rules.match}
              onValueChange={(value) => {
                if (value === "all" || value === "any") {
                  setRules((prev) => ({ ...prev, match: value }))
                  setPreviewCount(null)
                  setPreviewProfiles([])
                }
              }}
              variant="outline"
              size="sm"
              aria-label="Combinar condições"
            >
              <ToggleGroupItem value="all" aria-label="Todas as condições">
                Todas
              </ToggleGroupItem>
              <ToggleGroupItem value="any" aria-label="Qualquer condição">
                Qualquer
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-3">
            {rules.conditions.map((condition, index) => (
              <div key={conditionKeys[index]} className="flex flex-col gap-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Select
                    value={condition.kind}
                    onValueChange={(value) =>
                      updateCondition(index, defaultConditionForKind(value as RadarSegmentCondition["kind"]))
                    }
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <option.icon className="size-4" data-icon="inline-start" />
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    disabled={rules.conditions.length <= 1}
                    onClick={() => removeCondition(index)}
                  >
                    <X />
                  </Button>
                </div>

                {condition.kind === "profile_field" ? (
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={condition.field}
                      onValueChange={(value) =>
                        updateCondition(index, {
                          kind: "profile_field",
                          field: value as "primaryEmail" | "primaryDocument" | "lastSeenAt",
                          operator: value === "lastSeenAt" ? "before" : "eq",
                        })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primaryEmail">E-mail</SelectItem>
                        <SelectItem value="primaryDocument">Documento</SelectItem>
                        <SelectItem value="lastSeenAt">Última interação</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        updateCondition(index, {
                          ...condition,
                          operator: value as typeof condition.operator,
                          value: undefined,
                        })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(condition.field === "lastSeenAt"
                          ? OPERATORS_BY_LAST_SEEN
                          : OPERATORS_BY_PROFILE_FIELD[condition.field]
                        ).map((operator) => (
                          <SelectItem key={operator} value={operator}>
                            {OPERATOR_LABELS[operator]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {conditionNeedsValueInput(condition) ? (
                      <Input
                        className="w-40"
                        type={
                          condition.field === "lastSeenAt"
                            ? condition.operator === "within_days"
                              ? "number"
                              : "date"
                            : "text"
                        }
                        value={typeof condition.value === "string" || typeof condition.value === "number" ? condition.value : ""}
                        onChange={(e) =>
                          updateCondition(index, {
                            ...condition,
                            value:
                              condition.field === "lastSeenAt" && condition.operator === "within_days"
                                ? e.target.value
                                  ? Number(e.target.value)
                                  : undefined
                                : e.target.value,
                          })
                        }
                      />
                    ) : null}
                  </div>
                ) : null}

                {condition.kind === "consent" ? (
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={condition.channel}
                      onValueChange={(value) =>
                        updateCondition(index, { ...condition, channel: value as "email" | "whatsapp" })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.status}
                      onValueChange={(value) =>
                        updateCondition(index, {
                          ...condition,
                          status: value as "allowed" | "blocked" | "unknown",
                        })
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allowed">Apto</SelectItem>
                        <SelectItem value="blocked">Bloqueado</SelectItem>
                        <SelectItem value="unknown">Indefinido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {condition.kind === "event" ? (
                  <div className="flex flex-wrap gap-2">
                    <EventTypeSelect
                      value={condition.eventType}
                      onChange={(eventType) =>
                        updateCondition(index, {
                          ...condition,
                          eventType,
                          ...(eventType.startsWith("email.")
                            ? {}
                            : { campaignId: undefined }),
                        })
                      }
                      supabaseId={supabaseId}
                      teamId={activeTeamId}
                    />
                    <Select
                      value={condition.occurrence}
                      onValueChange={(value) =>
                        updateCondition(index, { ...condition, occurrence: value as "occurred" | "not_occurred" })
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="occurred">Ocorreu</SelectItem>
                        <SelectItem value="not_occurred">Não ocorreu</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="w-36"
                      type="number"
                      placeholder="Janela (dias)"
                      value={condition.windowDays ?? ""}
                      onChange={(e) =>
                        updateCondition(index, {
                          ...condition,
                          windowDays: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                    {condition.eventType.startsWith("email.") ? (
                      <CampaignSelect
                        value={condition.campaignId}
                        onChange={(campaignId) =>
                          updateCondition(index, { ...condition, campaignId })
                        }
                        supabaseId={supabaseId}
                        teamId={activeTeamId}
                      />
                    ) : null}
                  </div>
                ) : null}

                {condition.kind === "lead_custom_field" ? (
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={condition.definitionId}
                      onValueChange={(value) =>
                        updateCondition(index, {
                          kind: "lead_custom_field",
                          definitionId: value,
                          operator: "eq",
                        })
                      }
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue placeholder="Campo" />
                      </SelectTrigger>
                      <SelectContent>
                        {customFieldDefinitions.map((def) => (
                          <SelectItem key={def.id} value={def.id}>
                            {def.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        updateCondition(index, {
                          ...condition,
                          operator: value as typeof condition.operator,
                          value: undefined,
                        })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(OPERATORS_BY_CUSTOM_FIELD_TYPE[
                          customFieldDefinitions.find((d) => d.id === condition.definitionId)?.type ?? "text"
                        ]).map((operator) => (
                          <SelectItem key={operator} value={operator}>
                            {OPERATOR_LABELS[operator]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {conditionNeedsValueInput(condition) ? (
                      <LeadCustomFieldValueInput
                        condition={condition}
                        definition={customFieldDefinitions.find((d) => d.id === condition.definitionId)}
                        onChange={(value) => updateCondition(index, { ...condition, value })}
                      />
                    ) : null}
                  </div>
                ) : null}

                {condition.kind === "lead_status" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {RADAR_SEGMENT_LEAD_STATUSES.map((status) => {
                      const isSelected = condition.statuses.includes(status)
                      return (
                        <Badge
                          key={status}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() =>
                            updateCondition(index, {
                              ...condition,
                              statuses: isSelected
                                ? condition.statuses.filter((s) => s !== status)
                                : [...condition.statuses, status],
                            })
                          }
                        >
                          {getLeadStatusLabel(status)}
                        </Badge>
                      )
                    })}
                  </div>
                ) : null}

                {condition.kind === "engagement_band" ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ENGAGEMENT_BAND_OPTIONS.map((band) => {
                      const BandIcon = band.icon
                      const isSelected = condition.bands.includes(band.value)
                      return (
                        <Badge
                          key={band.value}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer gap-1"
                          onClick={() =>
                            updateCondition(index, {
                              ...condition,
                              bands: isSelected
                                ? condition.bands.filter((b) => b !== band.value)
                                : [...condition.bands, band.value],
                            })
                          }
                        >
                          <BandIcon className="size-3.5" aria-hidden />
                          {band.label}
                        </Badge>
                      )
                    })}
                  </div>
                ) : null}

                {condition.kind === "lead_field" ? (
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={condition.fieldKey}
                      onValueChange={(value) => {
                        const key = value as RadarLeadFieldCondition["fieldKey"]
                        const entry = LEAD_FIELD_CATALOG[key]
                        updateCondition(index, {
                          kind: "lead_field",
                          fieldKey: key,
                          operator: entry.operators[0],
                          value: entry.valueKind === "lead_status_multi" ? [] : undefined,
                        })
                      }}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(LEAD_FIELD_CATALOG) as (keyof typeof LEAD_FIELD_CATALOG)[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            {LEAD_FIELD_LABELS[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        updateCondition(index, {
                          ...condition,
                          operator: value,
                          value: undefined,
                        })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_FIELD_CATALOG[condition.fieldKey].operators.map((op) => (
                          <SelectItem key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {conditionNeedsValueInput(condition) ? (
                      <LeadFieldValueInput
                        condition={condition}
                        onChange={(value) => updateCondition(index, { ...condition, value })}
                        supabaseId={supabaseId}
                        teamId={activeTeamId}
                      />
                    ) : null}
                  </div>
                ) : null}

                {condition.kind === "portfolio_field" ? (
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={condition.fieldKey}
                      onValueChange={(value) => {
                        const key = value as RadarPortfolioFieldCondition["fieldKey"]
                        const entry = PORTFOLIO_FIELD_CATALOG[key]
                        updateCondition(index, {
                          kind: "portfolio_field",
                          fieldKey: key,
                          operator: entry.operators[0],
                          value: undefined,
                        })
                      }}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PORTFOLIO_FIELD_CATALOG) as (keyof typeof PORTFOLIO_FIELD_CATALOG)[]).map(
                          (key) => (
                            <SelectItem key={key} value={key}>
                              {PORTFOLIO_FIELD_LABELS[key]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.operator}
                      onValueChange={(value) =>
                        updateCondition(index, {
                          ...condition,
                          operator: value,
                          value: undefined,
                        })
                      }
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PORTFOLIO_FIELD_CATALOG[condition.fieldKey].operators.map((op) => (
                          <SelectItem key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {conditionNeedsValueInput(condition) ? (
                      <PortfolioFieldValueInput
                        condition={condition}
                        onChange={(value) => updateCondition(index, { ...condition, value })}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={rules.conditions.length >= 10}
            onClick={addCondition}
          >
            <Plus data-icon="inline-start" />
            Adicionar condição
          </Button>

          <Separator />

          <div>
            <p className="mb-2 text-sm font-medium">Preview da audiência</p>
            {isLoadingPreview ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : previewCount !== null ? (
              <div className="flex flex-col gap-2">
                <Badge className="w-fit border-semantic-success-border bg-semantic-success-surface text-semantic-success">
                  {previewCount.toLocaleString("pt-BR")} perfis
                </Badge>
                {previewProfiles.length > 0 ? (
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-xs text-muted-foreground">Primeiros 10 perfis:</p>
                    <div className="flex flex-col gap-1">
                      {previewProfiles.map((profile) => (
                        <div key={profile.id} className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{profile.displayName}</span>
                          {profile.primaryEmail ? (
                            <span className="text-muted-foreground">({profile.primaryEmail})</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {previewCount !== null && previewCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB ? (
            <Alert className="border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning [&>svg]:text-semantic-warning">
              <TriangleAlert />
              <AlertDescription className="text-foreground">
                Audiência excede o limite de{" "}
                {EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")} destinatários por
                campanha de segmento ({previewCount.toLocaleString("pt-BR")} perfis). Refine as
                condições ou materialize em lista de contatos — listas podem usar sub-campanhas.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={() => void handleSubmit()}>
            Criar segmento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
