"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Info, Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useCampanhasContext } from "../context/CampanhasContext"
import { useOptionalStudioEmailHost } from "@/lib/email/studio-email-host"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import {
  buildCampaignWizardSubmitSchema,
  campaignWizardAgendamentoSchema,
  campaignWizardAudienciaSchema,
  campaignWizardGeralSchema,
  campaignWizardTemplateSchema,
  EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
  type WizardTabId,
} from "../validation/campaignWizardSchema"
import { CampaignWizardBrowserTabs, type WizardTabState } from "./CampaignWizardBrowserTabs"
import { CampaignWizardSummaryPanel } from "./CampaignWizardSummaryPanel"
import { CampaignListStrategyDialog } from "./CampaignListStrategyDialog"
import type { ContactList } from "../context/CampanhasTypes"

const TAB_ORDER: WizardTabId[] = ["geral", "audiencia", "subcampanhas", "revisao"]

function formatContactListLabel(list: ContactList): string {
  const activeCount = list.activeContacts ?? list.totalContacts
  return `${list.name} (${activeCount.toLocaleString("pt-BR")} ativos)`
}

function fieldErrorMessage(
  issues: Array<{ path: PropertyKey[]; message: string }>,
  path: string
): string | undefined {
  return issues.find((issue) => issue.path[0] === path)?.message
}

function HoldToConfirmButton({
  onConfirm,
  disabled,
  label,
}: {
  onConfirm: () => void
  disabled: boolean
  label: string
}) {
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdingKeyRef = useRef<string | null>(null)

  function clearHold() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  function startHold() {
    if (disabled) return
    clearHold()
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / 2000) * 100, 100)
      setProgress(pct)
      if (pct >= 100) {
        clearHold()
        holdingKeyRef.current = null
        setProgress(0)
        onConfirm()
      }
    }, 16)
  }

  function cancelHold() {
    clearHold()
    holdingKeyRef.current = null
    setProgress(0)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (event.key !== " " && event.key !== "Enter") return
    event.preventDefault()
    if (holdingKeyRef.current) return
    holdingKeyRef.current = event.key
    startHold()
  }

  function handleKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return
    event.preventDefault()
    if (holdingKeyRef.current === event.key) {
      cancelHold()
    }
  }

  return (
    <Button
      type="button"
      className="relative overflow-hidden"
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={cancelHold}
      disabled={disabled}
      aria-keyshortcuts="Space Enter"
      aria-description="Mantenha Space ou Enter pressionado por 2 segundos para confirmar"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-primary-foreground/20"
        style={{ width: `${progress}%` }}
      />
      <span className="pointer-events-none relative">
        {progress > 0 ? "Segure..." : label}
      </span>
    </Button>
  )
}

export function CampaignWizardDialog() {
  const { tz } = useTimezone()
  const host = useOptionalStudioEmailHost()
  const {
    wizardOpen,
    wizardMode,
    wizardActiveTab,
    wizardName,
    wizardDescription,
    wizardTemplateId,
    wizardContactListIds,
    wizardListStrategy,
    wizardRecipientSource,
    wizardRadarSegmentSlug,
    wizardScheduledAt,
    wizardUniformSchedule,
    wizardScheduleIntervalDays,
    wizardSubCampaignSchedules,
    wizardSubCampaignListIds,
    wizardSubCampaignNames,
    wizardPreviewPlan,
    wizardPreviewLoading,
    wizardLinkedForm,
    wizardSaving,
    wizardHydrating,
    templates,
    contactLists,
    radarSegments,
    closeWizard,
    setWizardActiveTab,
    setWizardName,
    setWizardDescription,
    setWizardTemplateId,
    toggleWizardContactListId,
    setWizardListStrategy,
    setWizardRecipientSource,
    setWizardRadarSegmentSlug,
    setWizardScheduledAt,
    setWizardUniformSchedule,
    setWizardScheduleIntervalDays,
    setWizardSubCampaignSchedule,
    setWizardSubCampaignListId,
    setWizardSubCampaignName,
    handleSaveCampaign,
    refreshWizardPreviewPlan,
    handleMaterializeRadarSegment,
    materializingSegment,
  } = useCampanhasContext()

  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false)
  const [pendingListSelection, setPendingListSelection] = useState<string[]>([])

  const selectedTemplate = templates.find((template) => template.id === wizardTemplateId) ?? null
  const selectedLists = contactLists.filter((list) => wizardContactListIds.includes(list.id))
  const selectedSegment = radarSegments.find((segment) => segment.slug === wizardRadarSegmentSlug)
  const systemSegments = useMemo(() => radarSegments.filter((segment) => segment.isSystem), [radarSegments])
  const customSegments = useMemo(() => radarSegments.filter((segment) => !segment.isSystem), [radarSegments])

  const recipientCount =
    wizardRecipientSource === "radar_segment"
      ? selectedSegment?.count ?? 0
      : selectedLists.reduce(
          (sum, list) => sum + (list.activeContacts ?? list.totalContacts ?? 0),
          0
        )

  const previewSubCount = wizardPreviewPlan?.subCampaigns.length ?? 0
  const needsSplit = Boolean(wizardPreviewPlan?.needsSplit)
  const summarySubCampaigns = useMemo(
    () =>
      wizardPreviewPlan?.subCampaigns.map((sub) => ({
        ...sub,
        name: (wizardSubCampaignNames[sub.index] ?? sub.name).trim() || sub.name,
      })),
    [wizardPreviewPlan?.subCampaigns, wizardSubCampaignNames]
  )

  const geralParse = campaignWizardGeralSchema.safeParse({
    name: wizardName,
    description: wizardDescription || undefined,
  })
  const templateParse = campaignWizardTemplateSchema.safeParse({ templateId: wizardTemplateId })
  const audienciaParse = campaignWizardAudienciaSchema.safeParse({
    recipientSource: wizardRecipientSource,
    contactListIds: wizardContactListIds,
    listStrategy: wizardListStrategy,
    radarSegmentSlug: wizardRadarSegmentSlug || undefined,
  })
  const agendamentoParse = campaignWizardAgendamentoSchema.safeParse({
    scheduledAt: wizardScheduledAt,
    uniformSchedule: wizardUniformSchedule,
    scheduleIntervalDays: wizardScheduleIntervalDays,
  })

  const submitSchema = useMemo(
    () =>
      buildCampaignWizardSubmitSchema({
        recipientCount: wizardPreviewPlan?.totalRecipients ?? recipientCount,
        recipientSource: wizardRecipientSource,
        needsSplit,
        uniformSchedule: wizardUniformSchedule,
        subCampaignCount: previewSubCount,
      }),
    [
      wizardPreviewPlan?.totalRecipients,
      recipientCount,
      wizardRecipientSource,
      needsSplit,
      wizardUniformSchedule,
      previewSubCount,
    ]
  )

  const submitParse = submitSchema.safeParse({
    name: wizardName,
    description: wizardDescription || undefined,
    templateId: wizardTemplateId,
    recipientSource: wizardRecipientSource,
    contactListIds: wizardContactListIds,
    listStrategy: wizardListStrategy,
    radarSegmentSlug: wizardRadarSegmentSlug || undefined,
    scheduledAt: wizardScheduledAt,
    uniformSchedule: wizardUniformSchedule,
    scheduleIntervalDays: wizardScheduleIntervalDays,
    subCampaignSchedules: wizardSubCampaignSchedules,
  })

  const subcampanhasParseSuccess =
    templateParse.success &&
    agendamentoParse.success &&
    !(
      previewSubCount > 1 &&
      !wizardUniformSchedule &&
      wizardSubCampaignSchedules.length !== previewSubCount
    )

  const lockedTabs = useMemo<WizardTabId[]>(() => {
    const locked: WizardTabId[] = []
    if (!geralParse.success) locked.push("audiencia", "subcampanhas", "revisao")
    else if (!audienciaParse.success) locked.push("subcampanhas", "revisao")
    else if (!subcampanhasParseSuccess) locked.push("revisao")
    return locked
  }, [audienciaParse.success, geralParse.success, subcampanhasParseSuccess])

  const tabStates = useMemo<Record<WizardTabId, WizardTabState>>(() => {
    const submitIssues = submitParse.success ? [] : submitParse.error.issues
    const hasSubmitIssue = (prefix: string) =>
      submitIssues.some((issue) => String(issue.path[0] ?? "").startsWith(prefix))

    return {
      geral: geralParse.success ? "valid" : hasSubmitIssue("name") ? "error" : "incomplete",
      audiencia: audienciaParse.success
        ? "valid"
        : hasSubmitIssue("contactListIds") || hasSubmitIssue("radarSegmentSlug")
          ? "error"
          : "incomplete",
      subcampanhas: subcampanhasParseSuccess
        ? "valid"
        : hasSubmitIssue("templateId") ||
            hasSubmitIssue("scheduledAt") ||
            hasSubmitIssue("scheduleIntervalDays") ||
            hasSubmitIssue("subCampaignSchedules")
          ? "error"
          : "incomplete",
      revisao: submitParse.success ? "valid" : "incomplete",
    }
  }, [
    audienciaParse.success,
    geralParse.success,
    submitParse,
    subcampanhasParseSuccess,
  ])

  useEffect(() => {
    if (!wizardOpen) return
    void refreshWizardPreviewPlan()
  }, [
    wizardOpen,
    wizardName,
    wizardTemplateId,
    wizardContactListIds,
    wizardListStrategy,
    wizardRecipientSource,
    wizardRadarSegmentSlug,
    wizardScheduledAt,
    wizardUniformSchedule,
    wizardScheduleIntervalDays,
    wizardSubCampaignSchedules,
    refreshWizardPreviewPlan,
  ])

  function handleListToggle(listId: string, checked: boolean) {
    const next = checked
      ? Array.from(new Set([...wizardContactListIds, listId]))
      : wizardContactListIds.filter((id) => id !== listId)

    if (next.length <= 1) {
      setWizardListStrategy("single")
      toggleWizardContactListId(listId, checked)
      return
    }

    if (!wizardListStrategy || wizardListStrategy === "single") {
      setPendingListSelection(next)
      setStrategyDialogOpen(true)
      return
    }

    toggleWizardContactListId(listId, checked)
  }

  function handleStrategySelect(strategy: "merge" | "per_list") {
    setWizardListStrategy(strategy)
    for (const listId of pendingListSelection) {
      if (!wizardContactListIds.includes(listId)) {
        toggleWizardContactListId(listId, true)
      }
    }
    for (const listId of wizardContactListIds) {
      if (!pendingListSelection.includes(listId)) {
        toggleWizardContactListId(listId, false)
      }
    }
    setStrategyDialogOpen(false)
    setPendingListSelection([])
  }

  const title = wizardMode === "edit" ? "Editar campanha" : "Nova campanha"
  const isEditHydrating = wizardMode === "edit" && wizardHydrating
  const formDisabled = wizardSaving || isEditHydrating
  const currentIndex = TAB_ORDER.indexOf(wizardActiveTab)
  const previousTab = currentIndex > 0 ? TAB_ORDER[currentIndex - 1] : null
  const nextTab = currentIndex < TAB_ORDER.length - 1 ? TAB_ORDER[currentIndex + 1] : null
  const canGoNext = Boolean(nextTab && !lockedTabs.includes(nextTab) && !isEditHydrating)
  const isRevisao = wizardActiveTab === "revisao"

  return (
    <>
      <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) closeWizard() }}>
        <DialogContent className="max-h-[90vh] flex max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <CampaignWizardBrowserTabs
            activeTab={wizardActiveTab}
            tabStates={tabStates}
            onTabChange={setWizardActiveTab}
            lockedTabs={lockedTabs}
            disabled={isEditHydrating}
          />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2">
            {isEditHydrating ? (
              <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
                <p className="text-sm text-muted-foreground">Carregando dados da campanha...</p>
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            ) : (
              <>
                {wizardActiveTab === "geral" ? (
                  <FieldGroup>
                    <Field
                      data-invalid={
                        Boolean(
                          fieldErrorMessage(geralParse.success ? [] : geralParse.error.issues, "name")
                        ) || undefined
                      }
                    >
                      <FieldLabel htmlFor="wizard-name">Nome da campanha *</FieldLabel>
                      <Input
                        id="wizard-name"
                        value={wizardName}
                        onChange={(event) => setWizardName(event.target.value)}
                        disabled={formDisabled}
                      />
                      {fieldErrorMessage(geralParse.success ? [] : geralParse.error.issues, "name") ? (
                        <FieldError>
                          {fieldErrorMessage(geralParse.success ? [] : geralParse.error.issues, "name")}
                        </FieldError>
                      ) : null}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="wizard-description">Descrição (opcional)</FieldLabel>
                      <Textarea
                        id="wizard-description"
                        value={wizardDescription}
                        onChange={(event) => setWizardDescription(event.target.value)}
                        disabled={formDisabled}
                        maxLength={500}
                        rows={3}
                      />
                    </Field>
                  </FieldGroup>
                ) : null}

                {wizardActiveTab === "audiencia" ? (
                  <FieldGroup>
                    {!host ? (
                      <Field>
                        <FieldLabel>Origem dos destinatários *</FieldLabel>
                        <Select
                          value={wizardRecipientSource}
                          onValueChange={(value) =>
                            setWizardRecipientSource(value as "contact_list" | "radar_segment")
                          }
                          disabled={formDisabled || wizardMode === "edit"}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contact_list">Lista de contatos</SelectItem>
                            <SelectItem value="radar_segment">Segmento Radar</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    ) : null}

                    {wizardRecipientSource === "contact_list" || host ? (
                      <Field>
                        <FieldLabel>Listas de contatos *</FieldLabel>
                        <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border p-3">
                          {contactLists.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma lista disponível</p>
                          ) : (
                            contactLists.map((list) => {
                              const checked = wizardContactListIds.includes(list.id)
                              return (
                                <label key={list.id} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(value) =>
                                      handleListToggle(list.id, value === true)
                                    }
                                    disabled={formDisabled || wizardMode === "edit"}
                                  />
                                  <span>{formatContactListLabel(list)}</span>
                                </label>
                              )
                            })
                          )}
                        </div>
                        {wizardContactListIds.length > 1 && wizardListStrategy ? (
                          <FieldDescription>
                            Estratégia:{" "}
                            {wizardListStrategy === "merge"
                              ? "Juntar listas"
                              : "Uma sub-campanha por lista"}
                          </FieldDescription>
                        ) : null}
                      </Field>
                    ) : (
                      <Field>
                        <FieldLabel>Segmento Radar *</FieldLabel>
                        <Select
                          value={wizardRadarSegmentSlug}
                          onValueChange={setWizardRadarSegmentSlug}
                          disabled={formDisabled || wizardMode === "edit"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um segmento..." />
                          </SelectTrigger>
                          <SelectContent>
                            {systemSegments.length > 0 ? (
                              <SelectGroup>
                                <SelectLabel>Segmentos do sistema</SelectLabel>
                                {systemSegments.map((segment) => (
                                  <SelectItem key={segment.slug} value={segment.slug}>
                                    {segment.name} ({segment.count})
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ) : null}
                            {customSegments.length > 0 ? (
                              <SelectGroup>
                                <SelectLabel>Meus segmentos</SelectLabel>
                                {customSegments.map((segment) => (
                                  <SelectItem key={segment.slug} value={segment.slug}>
                                    {segment.name} ({segment.count})
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ) : null}
                          </SelectContent>
                        </Select>
                        {wizardRecipientSource === "radar_segment" &&
                        recipientCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB ? (
                          <Alert className="mt-2">
                            <Info />
                            <AlertTitle>Segmento grande</AlertTitle>
                            <AlertDescription className="flex flex-col gap-2">
                              <span>
                                Audiência excede o limite de{" "}
                                {EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")}{" "}
                                destinatários por campanha de segmento. Refine as condições ou
                                materialize em lista de contatos — listas podem usar sub-campanhas.
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={materializingSegment}
                                onClick={() => void handleMaterializeRadarSegment()}
                              >
                                {materializingSegment ? (
                                  <>
                                    <Loader2 className="animate-spin" data-icon="inline-start" />
                                    Criando lista...
                                  </>
                                ) : (
                                  "Criar lista de contatos a partir deste segmento"
                                )}
                              </Button>
                            </AlertDescription>
                          </Alert>
                        ) : null}
                      </Field>
                    )}
                  </FieldGroup>
                ) : null}

                {wizardActiveTab === "subcampanhas" ? (
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Template *</FieldLabel>
                      <Select
                        value={wizardTemplateId}
                        onValueChange={setWizardTemplateId}
                        disabled={formDisabled}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {selectedTemplate ? (
                        <FieldDescription>Assunto: {selectedTemplate.subject}</FieldDescription>
                      ) : null}
                      <FieldDescription>
                        Formulário vinculado:{" "}
                        {wizardLinkedForm
                          ? wizardLinkedForm.name
                          : "Nenhum formulário detectado"}
                      </FieldDescription>
                    </Field>

                    {previewSubCount <= 1 || wizardUniformSchedule ? (
                      <Field>
                        <DateTimePicker
                          date={wizardScheduledAt}
                          onDateChange={setWizardScheduledAt}
                          label={
                            needsSplit || previewSubCount > 1
                              ? "Início do agendamento *"
                              : "Agendamento (opcional)"
                          }
                          disabled={formDisabled}
                          disablePastDates
                          tz={tz}
                        />
                      </Field>
                    ) : null}
                    {previewSubCount > 1 ? (
                      <Field>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={wizardUniformSchedule}
                            onCheckedChange={(value) => setWizardUniformSchedule(value === true)}
                            disabled={formDisabled}
                          />
                          Mesmo intervalo para todas as sub-campanhas
                        </label>
                        <FieldDescription>
                          Marque para calcular as datas automaticamente a partir do início e do
                          intervalo em dias. Desmarque para definir data e hora em cada
                          sub-campanha na tabela abaixo.
                        </FieldDescription>
                      </Field>
                    ) : null}
                    {wizardUniformSchedule && previewSubCount > 1 ? (
                      <Field>
                        <FieldLabel htmlFor="wizard-interval-days">
                          Intervalo entre sub-campanhas (dias) *
                        </FieldLabel>
                        <Input
                          id="wizard-interval-days"
                          type="number"
                          min={1}
                          value={wizardScheduleIntervalDays}
                          onChange={(event) => {
                            const next = Number.parseInt(event.target.value, 10)
                            setWizardScheduleIntervalDays(Number.isFinite(next) ? next : 1)
                          }}
                          disabled={formDisabled}
                        />
                        <FieldDescription>
                          Cada sub-campanha será agendada {wizardScheduleIntervalDays}{" "}
                          {wizardScheduleIntervalDays === 1 ? "dia" : "dias"} após a anterior.
                        </FieldDescription>
                      </Field>
                    ) : null}

                    {wizardPreviewLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Carregando prévia...
                      </div>
                    ) : null}
                    {wizardPreviewPlan && wizardPreviewPlan.subCampaigns.length > 1 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Destinatários</TableHead>
                            {wizardListStrategy === "per_list" ? (
                              <TableHead>Lista</TableHead>
                            ) : null}
                            <TableHead>
                              {wizardUniformSchedule ? "Agendamento" : "Agendamento *"}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {wizardPreviewPlan.subCampaigns.map((sub) => {
                            const resolvedName =
                              wizardSubCampaignNames[sub.index] ?? sub.name
                            const selectedListId =
                              wizardSubCampaignListIds[sub.index] ??
                              sub.contactListId ??
                              ""
                            const selectedListName =
                              contactLists.find((list) => list.id === selectedListId)?.name ??
                              sub.listName ??
                              ""

                            return (
                            <TableRow key={sub.index}>
                              <TableCell className="w-10 tabular-nums text-muted-foreground">
                                {sub.index}
                              </TableCell>
                              <TableCell className="min-w-48 max-w-72">
                                <Input
                                  value={resolvedName}
                                  onChange={(event) =>
                                    setWizardSubCampaignName(sub.index, event.target.value)
                                  }
                                  disabled={formDisabled}
                                  aria-label={`Nome da sub-campanha ${sub.index}`}
                                  title={resolvedName}
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {sub.totalRecipients.toLocaleString("pt-BR")}
                              </TableCell>
                              {wizardListStrategy === "per_list" ? (
                                <TableCell className="max-w-52">
                                  <Select
                                    value={selectedListId}
                                    onValueChange={(v) => setWizardSubCampaignListId(sub.index, v)}
                                    disabled={formDisabled}
                                  >
                                    <SelectTrigger className="w-44" title={selectedListName || undefined}>
                                      <SelectValue placeholder="Mesma lista..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {contactLists.map((list) => (
                                        <SelectItem key={list.id} value={list.id} title={list.name}>
                                          <span className="block max-w-56 truncate">{list.name}</span>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              ) : null}
                              <TableCell>
                                {!wizardUniformSchedule ? (
                                  <DateTimePicker
                                    date={
                                      wizardSubCampaignSchedules.find(
                                        (entry) => entry.index === sub.index
                                      )?.scheduledAt
                                    }
                                    onDateChange={(date) =>
                                      setWizardSubCampaignSchedule(sub.index, date)
                                    }
                                    label=""
                                    disabled={formDisabled}
                                    disablePastDates
                                    tz={tz}
                                  />
                                ) : sub.scheduledAt ? (
                                  formatIntimezone(
                                    new Date(sub.scheduledAt),
                                    "dd/MM/yyyy HH:mm",
                                    tz
                                  )
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma sub-campanha necessária para a configuração atual.
                      </p>
                    )}
                    {!wizardUniformSchedule &&
                    wizardPreviewPlan &&
                    wizardPreviewPlan.subCampaigns.length > 1 ? (
                      <FieldDescription>
                        Informe data e hora de envio para cada sub-campanha. Todas as datas são
                        obrigatórias.
                      </FieldDescription>
                    ) : null}
                  </FieldGroup>
                ) : null}

                {wizardActiveTab === "revisao" ? (
                  <CampaignWizardSummaryPanel
                    name={wizardName}
                    description={wizardDescription || undefined}
                    template={selectedTemplate}
                    selectedLists={selectedLists}
                    selectedSegment={selectedSegment}
                    linkedForm={wizardLinkedForm}
                    totalRecipients={wizardPreviewPlan?.totalRecipients ?? recipientCount}
                    listStrategy={wizardListStrategy}
                    subCampaigns={summarySubCampaigns}
                    tz={tz}
                  />
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between">
            <Button variant="outline" onClick={closeWizard} disabled={wizardSaving}>
              Cancelar
            </Button>
            <div className="flex items-center gap-2">
              {previousTab ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setWizardActiveTab(previousTab)}
                  disabled={formDisabled}
                >
                  Anterior
                </Button>
              ) : null}
              {!isRevisao ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (nextTab && canGoNext) setWizardActiveTab(nextTab)
                  }}
                  disabled={!canGoNext || formDisabled}
                >
                  Próxima
                </Button>
              ) : (
                <HoldToConfirmButton
                  onConfirm={() => void handleSaveCampaign()}
                  disabled={!submitParse.success || formDisabled}
                  label={
                    wizardSaving
                      ? "Salvando..."
                      : wizardMode === "edit"
                        ? "Segure para salvar"
                        : "Segure para confirmar"
                  }
                />
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignListStrategyDialog
        open={strategyDialogOpen}
        onOpenChange={setStrategyDialogOpen}
        onSelectStrategy={handleStrategySelect}
      />
    </>
  )
}
