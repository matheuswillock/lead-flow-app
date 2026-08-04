"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Kanban, ListChecks, ListPlus, MousePointerClick, Plus, ShieldCheck, SlidersHorizontal, TriangleAlert, User, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useActiveLeadCustomFieldDefinitions } from "@/hooks/useActiveLeadCustomFieldDefinitions"
import { useTeamClosers, useTeamSdrs } from "@/hooks/useTeamMembersByFunction"
import { EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB } from "@/lib/email/campaign-limits"
import { CUSTOM_RADAR_SEGMENT_PREFIX } from "@/lib/radar/segment-audience"
import { getLeadStatusLabel } from "@/lib/lead-status"
import type { LeadCustomFieldDefinitionDTO } from "@/lib/leadCustomFields/types"
import { LEAD_FIELD_CATALOG, PORTFOLIO_FIELD_CATALOG, RADAR_SEGMENT_LEAD_STATUSES } from "@/lib/radar/segment-dsl"
import { useTeamContext } from "@/app/context/TeamContext"
import { useParams } from "next/navigation"
import { useRadarContext } from "../context/RadarContext"
import type {
  RadarCustomSegmentListItem,
  RadarLeadCustomFieldCondition,
  RadarLeadFieldCondition,
  RadarPortfolioFieldCondition,
  RadarSegmentCondition,
  RadarSegmentRules,
} from "../context/RadarTypes"
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
] as const

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
    case "lead_field":
      return { kind: "lead_field", fieldKey: "status", operator: "eq", value: [] }
    case "portfolio_field":
      return { kind: "portfolio_field", fieldKey: "renewalStatus", operator: "eq", value: "to_renew" }
  }
}

const defaultRules: RadarSegmentRules = { match: "all", conditions: [defaultConditionForKind("profile_field")] }

/**
 * buildCustomFieldWhereFilter compara valores JSON tipados no Prisma — number/
 * boolean/multi_select precisam ser codificados com o tipo real, não string,
 * ou o segmento retorna 0 perfis (eq/neq) ou erro de query (multi_select).
 */
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

type RadarSegmentBuilderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  segment: RadarCustomSegmentListItem | null
}

export function RadarSegmentBuilderDialog({ open, onOpenChange, segment }: RadarSegmentBuilderDialogProps) {
  const {
    createCustomSegment,
    updateCustomSegment,
    previewAudienceCount,
    materializeContactList,
    isPreviewingAudience,
    mutationLock,
  } = useRadarContext()
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const { activeTeamId } = useTeamContext()
  const { definitions: customFieldDefinitions } = useActiveLeadCustomFieldDefinitions(supabaseId, activeTeamId)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [rules, setRules] = useState<RadarSegmentRules>(defaultRules)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const keyCounterRef = useRef(0)
  const [conditionKeys, setConditionKeys] = useState<string[]>(() => [`cond-${keyCounterRef.current++}`])

  useEffect(() => {
    if (!open) return
    if (segment) {
      setName(segment.name)
      setDescription(segment.description ?? "")
      setRules(segment.rulesJson)
      setConditionKeys(segment.rulesJson.conditions.map(() => `cond-${keyCounterRef.current++}`))
    } else {
      setName("")
      setDescription("")
      setRules(defaultRules)
      setConditionKeys([`cond-${keyCounterRef.current++}`])
    }
    setPreviewCount(null)
  }, [open, segment])

  const updateCondition = (index: number, next: RadarSegmentCondition) => {
    setRules((prev) => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => (i === index ? next : condition)),
    }))
    setPreviewCount(null)
  }

  const addCondition = () => {
    if (rules.conditions.length >= 10) return
    setRules((prev) => ({ ...prev, conditions: [...prev.conditions, defaultConditionForKind("profile_field")] }))
    setConditionKeys((prev) => [...prev, `cond-${keyCounterRef.current++}`])
    setPreviewCount(null)
  }

  const removeCondition = (index: number) => {
    setRules((prev) => ({ ...prev, conditions: prev.conditions.filter((_, i) => i !== index) }))
    setConditionKeys((prev) => prev.filter((_, i) => i !== index))
    setPreviewCount(null)
  }

  const handlePreview = async () => {
    const count = await previewAudienceCount(rules)
    if (count !== null) setPreviewCount(count)
  }

  const handleSubmit = async () => {
    const input = { name, description: description || null, rules }
    const ok = segment ? await updateCustomSegment(segment.id, input) : await createCustomSegment(input)
    if (ok) onOpenChange(false)
  }

  const materializeSlug = segment ? `${CUSTOM_RADAR_SEGMENT_PREFIX}${segment.id}` : null

  const canSave = name.trim().length > 0 && isRulesValidForSave(rules) && !mutationLock

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{segment ? "Editar segmento" : "Novo segmento"}</DialogTitle>
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
            <p className="text-sm font-medium">Condições</p>
            <ToggleGroup
              type="single"
              value={rules.match}
              onValueChange={(value) => {
                if (value === "all" || value === "any") {
                  setRules((prev) => ({ ...prev, match: value }))
                  setPreviewCount(null)
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
                    <Input
                      className="w-56"
                      placeholder="Ex.: whatsapp.message_received"
                      value={condition.eventType}
                      onChange={(e) => updateCondition(index, { ...condition, eventType: e.target.value })}
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

          {previewCount !== null && previewCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB ? (
            <Alert className="border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning [&>svg]:text-semantic-warning">
              <TriangleAlert />
              <AlertDescription className="text-foreground">
                Este segmento tem {previewCount} perfis, acima do limite de{" "}
                {EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB} destinatários por campanha. A campanha será dividida
                automaticamente em sub-envios ao ser usada.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={isPreviewingAudience || !isRulesValidForSave(rules)}
              onClick={() => void handlePreview()}
            >
              {isPreviewingAudience ? "Calculando..." : "Calcular audiência"}
            </Button>
            {previewCount !== null ? (
              <Badge className="border-semantic-success-border bg-semantic-success-surface text-semantic-success">
                {previewCount} perfis
              </Badge>
            ) : null}
            {materializeSlug && previewCount && previewCount > 0 ? (
              <Button
                variant="outline"
                disabled={mutationLock}
                onClick={() =>
                  void materializeContactList(materializeSlug, name.trim(), `Segmento: ${name.trim()}`)
                }
              >
                <ListPlus data-icon="inline-start" />
                Criar lista de contatos
              </Button>
            ) : null}
          </div>
          <Button disabled={!canSave} onClick={() => void handleSubmit()}>
            {segment ? "Salvar alterações" : "Criar segmento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
