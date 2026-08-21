"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
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

import {
  buildCampaignWizardSubmitSchema,
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
      className="relative w-full min-w-0 overflow-hidden sm:w-auto sm:min-w-52"
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
        aria-hidden
      />
      <span className="pointer-events-none relative inline-grid place-items-center">
        <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden>
          {label}
        </span>
        <span className="col-start-1 row-start-1 whitespace-nowrap">
          {progress > 0 ? "Segure..." : label}
        </span>
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
    wizardSaveAsRadarSegment,
    wizardSaveAsRadarSegmentName,
    wizardScheduledAt,
    wizardUniformSchedule,
    wizardScheduleIntervalDays,
    wizardUniformTemplate,
    wizardSubCampaignSchedules,
    wizardSubCampaignListIds,
    wizardSubCampaignNames,
    wizardSubCampaignTemplateIds,
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
    setWizardSaveAsRadarSegment,
    setWizardSaveAsRadarSegmentName,
    setWizardScheduledAt,
    applyUniformScheduledAt,
    setWizardUniformSchedule,
    setWizardUniformTemplate,
    setWizardSubCampaignSchedule,
    setWizardSubCampaignListId,
    setWizardSubCampaignName,
    setWizardSubCampaignTemplateId,
    handleSaveCampaign,
    refreshWizardPreviewPlan,
    handleMaterializeRadarSegment,
    materializingSegment,
  } = useCampanhasContext()

  const [strategyDialogOpen, setStrategyDialogOpen] = useState(false)
  const [pendingListSelection, setPendingListSelection] = useState<string[]>([])
  const [uniformTemplateConfirmOpen, setUniformTemplateConfirmOpen] = useState(false)
  const [uniformScheduleConfirmOpen, setUniformScheduleConfirmOpen] = useState(false)
  const prevPreviewSubCountRef = useRef(0)

  const selectedTemplate = templates.find((template) => template.id === wizardTemplateId) ?? null
  const selectedLists = contactLists.filter((list) => wizardContactListIds.includes(list.id))
  const selectedSegment = radarSegments.find((segment) => segment.slug === wizardRadarSegmentSlug)
  const systemSegments = useMemo(() => radarSegments.filter((segment) => segment.isSystem), [radarSegments])
  const customSegments = useMemo(() => radarSegments.filter((segment) => !segment.isSystem), [radarSegments])

  const recipientCount = wizardPreviewPlan?.totalRecipients
    ?? (
      (selectedSegment?.count ?? 0) +
      selectedLists.reduce(
        (sum, list) => sum + (list.activeContacts ?? list.totalContacts ?? 0),
        0
      )
    )

  const hasRadarSegment = Boolean(wizardRadarSegmentSlug.trim())
  const hasContactLists = wizardContactListIds.length > 0
  const canSaveAsSegment = wizardRadarSegmentSlug.startsWith("custom:")
  const previewSubCount = wizardPreviewPlan?.subCampaigns.length ?? 0
  const needsSplit = Boolean(wizardPreviewPlan?.needsSplit)
  const summarySubCampaigns = useMemo(
    () =>
      wizardPreviewPlan?.subCampaigns.map((sub) => {
        const schedule = wizardSubCampaignSchedules.find((entry) => entry.index === sub.index)
        const templateId = wizardUniformTemplate
          ? wizardTemplateId
          : (wizardSubCampaignTemplateIds[sub.index] ?? "")
        const templateName =
          templates.find((template) => template.id === templateId)?.name ?? undefined
        return {
          ...sub,
          name: (wizardSubCampaignNames[sub.index] ?? sub.name).trim() || sub.name,
          scheduledAt: schedule?.scheduledAt.toISOString() ?? sub.scheduledAt ?? null,
          templateName,
        }
      }),
    [
      templates,
      wizardPreviewPlan?.subCampaigns,
      wizardSubCampaignNames,
      wizardSubCampaignSchedules,
      wizardSubCampaignTemplateIds,
      wizardTemplateId,
      wizardUniformTemplate,
    ]
  )

  const geralParse = campaignWizardGeralSchema.safeParse({
    name: wizardName,
    description: wizardDescription || undefined,
  })
  const templateParse = campaignWizardTemplateSchema.safeParse({ templateId: wizardTemplateId })
  const audienciaParse = campaignWizardAudienciaSchema.safeParse({
    contactListIds: wizardContactListIds,
    listStrategy: wizardListStrategy,
    radarSegmentSlug: wizardRadarSegmentSlug || undefined,
  })

  const submitSchema = useMemo(
    () =>
      buildCampaignWizardSubmitSchema({
        recipientCount: wizardPreviewPlan?.totalRecipients ?? recipientCount,
        hasRadarSegment,
        hasContactLists,
        needsSplit,
        subCampaignCount: previewSubCount,
      }),
    [
      wizardPreviewPlan?.totalRecipients,
      recipientCount,
      hasRadarSegment,
      hasContactLists,
      needsSplit,
      previewSubCount,
    ]
  )

  const submitParse = submitSchema.safeParse({
    name: wizardName,
    description: wizardDescription || undefined,
    templateId: wizardTemplateId,
    contactListIds: wizardContactListIds,
    listStrategy: wizardListStrategy,
    radarSegmentSlug: wizardRadarSegmentSlug || undefined,
    saveAsRadarSegment: wizardSaveAsRadarSegment,
    saveAsRadarSegmentName: wizardSaveAsRadarSegmentName || undefined,
    scheduledAt: wizardScheduledAt,
    uniformSchedule: wizardUniformSchedule,
    scheduleIntervalDays: wizardScheduleIntervalDays,
    subCampaignSchedules: wizardSubCampaignSchedules,
  })

  const allSubTemplatesFilled =
    wizardUniformTemplate ||
    previewSubCount <= 1 ||
    Array.from({ length: previewSubCount }, (_, i) => i + 1).every((index) =>
      Boolean(wizardSubCampaignTemplateIds[index])
    )

  const allSubSchedulesFilled =
    previewSubCount <= 1 ||
    (wizardUniformSchedule
      ? Boolean(wizardScheduledAt)
      : wizardSubCampaignSchedules.length === previewSubCount)

  const subcampanhasParseSuccess =
    (previewSubCount <= 1 || wizardUniformTemplate
      ? templateParse.success
      : allSubTemplatesFilled) &&
    allSubSchedulesFilled

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

  // Ao detectar N>1 pela primeira vez no fluxo, default = segregado
  useEffect(() => {
    if (!wizardOpen) {
      prevPreviewSubCountRef.current = 0
      return
    }
    const prev = prevPreviewSubCountRef.current
    if (previewSubCount > 1 && prev <= 1 && wizardMode === "create") {
      setWizardUniformTemplate(false)
      setWizardUniformSchedule(false)
    }
    prevPreviewSubCountRef.current = previewSubCount
  }, [
    previewSubCount,
    setWizardUniformSchedule,
    setWizardUniformTemplate,
    wizardMode,
    wizardOpen,
  ])

  function templatesDiverge(): boolean {
    if (previewSubCount <= 1) return false
    const templateIds = Array.from({ length: previewSubCount }, (_, i) =>
      wizardSubCampaignTemplateIds[i + 1] ?? ""
    )
    return templateIds.some(Boolean) && templateIds.some((id) => id !== templateIds[0])
  }

  function schedulesDiverge(): boolean {
    if (previewSubCount <= 1) return false
    const schedules = Array.from({ length: previewSubCount }, (_, i) =>
      wizardSubCampaignSchedules.find((entry) => entry.index === i + 1)?.scheduledAt.getTime() ?? null
    )
    return (
      schedules.some((value) => value != null) &&
      schedules.some((value) => value !== schedules[0])
    )
  }

  function handleUniformTemplateToggle(next: boolean) {
    if (formDisabled) return
    if (next && templatesDiverge()) {
      setUniformTemplateConfirmOpen(true)
      return
    }
    setWizardUniformTemplate(next)
  }

  function handleUniformScheduleToggle(next: boolean) {
    if (formDisabled) return
    if (next && schedulesDiverge()) {
      setUniformScheduleConfirmOpen(true)
      return
    }
    setWizardUniformSchedule(next)
  }

  function confirmUniformTemplateOverwrite() {
    const firstTemplate =
      wizardSubCampaignTemplateIds[1] ||
      Object.values(wizardSubCampaignTemplateIds)[0] ||
      wizardTemplateId
    if (firstTemplate) setWizardTemplateId(firstTemplate)
    setWizardUniformTemplate(true)
    setUniformTemplateConfirmOpen(false)
  }

  function confirmUniformScheduleOverwrite() {
    const firstSchedule =
      wizardSubCampaignSchedules.find((entry) => entry.index === 1)?.scheduledAt ||
      wizardSubCampaignSchedules[0]?.scheduledAt ||
      wizardScheduledAt
    if (firstSchedule) applyUniformScheduledAt(firstSchedule)
    setWizardUniformSchedule(true)
    setUniformScheduleConfirmOpen(false)
  }

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
                    <Field>
                      <FieldLabel>Listas de contatos</FieldLabel>
                      <FieldDescription>
                        Opcional se houver segmento Radar. Pode combinar listas e segmento (união com
                        dedupe por e-mail).
                      </FieldDescription>
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
                          {hasRadarSegment && wizardListStrategy === "per_list"
                            ? " (com segmento Radar use juntar listas)"
                            : null}
                        </FieldDescription>
                      ) : null}
                    </Field>

                    {!host ? (
                      <Field>
                        <FieldLabel>Segmento Radar</FieldLabel>
                        <FieldDescription>
                          Opcional se houver lista. Segmento sozinho acima do limite é rejeitado;
                          com lista, a união pode usar sub-campanhas.
                        </FieldDescription>
                        <Select
                          value={wizardRadarSegmentSlug || undefined}
                          onValueChange={(value) => {
                            setWizardRadarSegmentSlug(value)
                            setWizardRecipientSource("radar_segment")
                          }}
                          disabled={formDisabled || wizardMode === "edit"}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum segmento (opcional)" />
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
                        {wizardRadarSegmentSlug ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            disabled={formDisabled || wizardMode === "edit"}
                            onClick={() => {
                              setWizardRadarSegmentSlug("")
                              setWizardSaveAsRadarSegment(false)
                            }}
                          >
                            Remover segmento
                          </Button>
                        ) : null}
                        {hasRadarSegment &&
                        !hasContactLists &&
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
                    ) : null}

                    {needsSplit && previewSubCount > 1 ? (
                      <Alert>
                        <Info />
                        <AlertTitle>Sub-campanhas</AlertTitle>
                        <AlertDescription>
                          A audiência resolvida tem{" "}
                          {(wizardPreviewPlan?.totalRecipients ?? recipientCount).toLocaleString(
                            "pt-BR"
                          )}{" "}
                          destinatários e será dividida em {previewSubCount} sub-campanhas de até{" "}
                          {EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")} cada.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </FieldGroup>
                ) : null}

                {wizardActiveTab === "subcampanhas" ? (
                  <FieldGroup>
                    {previewSubCount > 1 ? (
                      <>
                        <Field orientation="horizontal">
                          <div className="flex flex-1 flex-col gap-1">
                            <FieldLabel htmlFor="wizard-uniform-template">
                              Mesmo template para todas as sub-campanhas
                            </FieldLabel>
                            <FieldDescription>
                              Desmarque para escolher um template diferente em cada sub-campanha.
                            </FieldDescription>
                          </div>
                          <Switch
                            id="wizard-uniform-template"
                            checked={wizardUniformTemplate}
                            onCheckedChange={handleUniformTemplateToggle}
                            disabled={formDisabled}
                          />
                        </Field>
                        <Field orientation="horizontal">
                          <div className="flex flex-1 flex-col gap-1">
                            <FieldLabel htmlFor="wizard-uniform-schedule">
                              Mesmo horário para todas as sub-campanhas
                            </FieldLabel>
                            <FieldDescription>
                              Desmarque para definir data e hora individualmente em cada
                              sub-campanha.
                            </FieldDescription>
                          </div>
                          <Switch
                            id="wizard-uniform-schedule"
                            checked={wizardUniformSchedule}
                            onCheckedChange={handleUniformScheduleToggle}
                            disabled={formDisabled}
                          />
                        </Field>
                      </>
                    ) : null}

                    {previewSubCount <= 1 || wizardUniformTemplate ? (
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
                    ) : null}

                    {previewSubCount <= 1 || wizardUniformSchedule ? (
                      <Field>
                        <DateTimePicker
                          date={wizardScheduledAt}
                          onDateChange={
                            previewSubCount > 1 && wizardUniformSchedule
                              ? applyUniformScheduledAt
                              : setWizardScheduledAt
                          }
                          label={
                            previewSubCount > 1 && wizardUniformSchedule
                              ? "Agendamento inicial *"
                              : "Agendamento (opcional)"
                          }
                          disabled={formDisabled}
                          disablePastDates
                          tz={tz}
                        />
                        {previewSubCount > 1 && wizardUniformSchedule ? (
                          <FieldDescription>
                            As demais sub-campanhas seguem o intervalo de{" "}
                            {wizardScheduleIntervalDays} dia
                            {wizardScheduleIntervalDays === 1 ? "" : "s"} a partir desta data.
                          </FieldDescription>
                        ) : null}
                      </Field>
                    ) : null}

                    {wizardPreviewLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Carregando prévia...
                      </div>
                    ) : null}

                    {wizardPreviewPlan && wizardPreviewPlan.subCampaigns.length > 1 ? (
                      <div className="flex flex-col gap-2">
                        <FieldLabel>Sub-campanhas</FieldLabel>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Nome</TableHead>
                              <TableHead>Destinatários</TableHead>
                              {wizardListStrategy === "per_list" ? (
                                <TableHead>Lista</TableHead>
                              ) : null}
                              {!wizardUniformTemplate ? (
                                <TableHead>Template *</TableHead>
                              ) : null}
                              {!wizardUniformSchedule ? (
                                <TableHead>Agendamento *</TableHead>
                              ) : null}
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
                                        onValueChange={(v) =>
                                          setWizardSubCampaignListId(sub.index, v)
                                        }
                                        disabled={formDisabled}
                                      >
                                        <SelectTrigger
                                          className="w-44"
                                          title={selectedListName || undefined}
                                        >
                                          <SelectValue placeholder="Mesma lista..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {contactLists.map((list) => (
                                            <SelectItem
                                              key={list.id}
                                              value={list.id}
                                              title={list.name}
                                            >
                                              <span className="block max-w-56 truncate">
                                                {list.name}
                                              </span>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                  ) : null}
                                  {!wizardUniformTemplate ? (
                                    <TableCell className="max-w-52">
                                      <Select
                                        value={wizardSubCampaignTemplateIds[sub.index] ?? ""}
                                        onValueChange={(v) =>
                                          setWizardSubCampaignTemplateId(sub.index, v)
                                        }
                                        disabled={formDisabled}
                                      >
                                        <SelectTrigger className="w-44">
                                          <SelectValue placeholder="Selecione..." />
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
                                    </TableCell>
                                  ) : null}
                                  {!wizardUniformSchedule ? (
                                    <TableCell>
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
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                        <FieldDescription>
                          {!wizardUniformTemplate && !wizardUniformSchedule
                            ? "Informe template e data/hora de envio para cada sub-campanha."
                            : !wizardUniformTemplate
                              ? "Informe o template de cada sub-campanha. O horário é compartilhado."
                              : !wizardUniformSchedule
                                ? "Informe data e hora de envio para cada sub-campanha. O template é compartilhado."
                                : "Template e horário compartilhados. Ajuste nomes (e listas, se aplicável) abaixo."}
                        </FieldDescription>
                      </div>
                    ) : null}

                    {!wizardPreviewLoading &&
                    (!wizardPreviewPlan || wizardPreviewPlan.subCampaigns.length <= 1) ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma sub-campanha necessária para a configuração atual.
                      </p>
                    ) : null}
                  </FieldGroup>
                ) : null}

                {wizardActiveTab === "revisao" ? (
                  <div className="flex flex-col gap-4">
                    <CampaignWizardSummaryPanel
                      name={wizardName}
                      description={wizardDescription || undefined}
                      template={selectedTemplate}
                      selectedLists={selectedLists}
                      selectedSegment={selectedSegment}
                      linkedForm={wizardLinkedForm}
                      totalRecipients={wizardPreviewPlan?.totalRecipients ?? recipientCount}
                      bouncedExcludedCount={wizardPreviewPlan?.bouncedExcludedCount}
                      unsubscribedExcludedCount={wizardPreviewPlan?.unsubscribedExcludedCount}
                      complainedExcludedCount={wizardPreviewPlan?.complainedExcludedCount}
                      listStrategy={wizardListStrategy}
                      subCampaigns={summarySubCampaigns}
                      uniformTemplate={wizardUniformTemplate || previewSubCount <= 1}
                      tz={tz}
                    />

                    <FieldGroup>
                      {canSaveAsSegment ? (
                        <Field>
                          <label className="flex items-start gap-2 text-sm">
                            <Checkbox
                              checked={wizardSaveAsRadarSegment}
                              onCheckedChange={(value) => {
                                const enabled = value === true
                                setWizardSaveAsRadarSegment(enabled)
                                if (enabled && !wizardSaveAsRadarSegmentName.trim()) {
                                  setWizardSaveAsRadarSegmentName(
                                    `${wizardName.trim() || "Campanha"} — segmento`
                                  )
                                }
                              }}
                              disabled={formDisabled || wizardMode === "edit"}
                            />
                            <span className="flex flex-col gap-1">
                              <span>Salvar como novo segmento Radar</span>
                              <span className="text-muted-foreground">
                                Clona as regras DSL do segmento custom selecionado em um novo
                                TeamRadarSegment e vincula a campanha a ele.
                              </span>
                            </span>
                          </label>
                          {wizardSaveAsRadarSegment ? (
                            <Input
                              className="mt-2"
                              value={wizardSaveAsRadarSegmentName}
                              onChange={(event) =>
                                setWizardSaveAsRadarSegmentName(event.target.value)
                              }
                              placeholder="Nome do novo segmento"
                              disabled={formDisabled || wizardMode === "edit"}
                              maxLength={120}
                            />
                          ) : null}
                        </Field>
                      ) : (
                        <FieldDescription>
                          {hasContactLists && !hasRadarSegment
                            ? "Salvar como segmento Radar não se aplica a audiência só de listas (sem regras DSL)."
                            : hasRadarSegment && !canSaveAsSegment
                              ? "Segmentos do sistema não possuem DSL exportável — selecione um segmento custom para salvar uma cópia."
                              : null}
                        </FieldDescription>
                      )}
                    </FieldGroup>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="order-1 flex w-full flex-col gap-2 sm:order-2 sm:w-auto sm:flex-row sm:items-center">
              {previousTab ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => setWizardActiveTab(previousTab)}
                  disabled={formDisabled}
                >
                  Anterior
                </Button>
              ) : null}
              {!isRevisao ? (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
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
            <Button
              variant="outline"
              className="order-2 w-full sm:order-1 sm:w-auto"
              onClick={closeWizard}
              disabled={wizardSaving}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CampaignListStrategyDialog
        open={strategyDialogOpen}
        onOpenChange={setStrategyDialogOpen}
        onSelectStrategy={handleStrategySelect}
      />

      <AlertDialog open={uniformTemplateConfirmOpen} onOpenChange={setUniformTemplateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unificar templates?</AlertDialogTitle>
            <AlertDialogDescription>
              As sub-campanhas têm templates diferentes. Ao unificar, o template global substitui
              as escolhas individuais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUniformTemplateOverwrite}>
              Unificar templates
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={uniformScheduleConfirmOpen} onOpenChange={setUniformScheduleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unificar horários?</AlertDialogTitle>
            <AlertDialogDescription>
              As sub-campanhas têm horários diferentes. Ao unificar, o agendamento global
              substitui as escolhas individuais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUniformScheduleOverwrite}>
              Unificar horários
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
