"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export function CampaignWizardDialog() {
  const { tz } = useTimezone()
  const host = useOptionalStudioEmailHost()
  const {
    wizardOpen,
    wizardMode,
    wizardActiveTab,
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
    wizardPreviewPlan,
    wizardPreviewLoading,
    wizardLinkedForm,
    wizardSaving,
    templates,
    contactLists,
    radarSegments,
    closeWizard,
    setWizardActiveTab,
    setWizardName,
    setWizardTemplateId,
    toggleWizardContactListId,
    setWizardListStrategy,
    setWizardRecipientSource,
    setWizardRadarSegmentSlug,
    setWizardScheduledAt,
    setWizardUniformSchedule,
    setWizardScheduleIntervalDays,
    setWizardSubCampaignSchedule,
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

  const geralParse = campaignWizardGeralSchema.safeParse({ name: wizardName })
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

  const tabStates = useMemo<Record<WizardTabId, WizardTabState>>(() => {
    const submitIssues = submitParse.success ? [] : submitParse.error.issues
    const hasSubmitIssue = (prefix: string) =>
      submitIssues.some((issue) => String(issue.path[0] ?? "").startsWith(prefix))

    return {
      geral: geralParse.success ? "valid" : hasSubmitIssue("name") ? "error" : "incomplete",
      template: templateParse.success ? "valid" : hasSubmitIssue("templateId") ? "error" : "incomplete",
      audiencia: audienciaParse.success
        ? "valid"
        : hasSubmitIssue("contactListIds") || hasSubmitIssue("radarSegmentSlug")
          ? "error"
          : "incomplete",
      agendamento: agendamentoParse.success
        ? "valid"
        : hasSubmitIssue("scheduledAt") || hasSubmitIssue("scheduleIntervalDays")
          ? "error"
          : "incomplete",
      subcampanhas:
        previewSubCount > 1 && submitParse.success
          ? "valid"
          : hasSubmitIssue("subCampaignSchedules")
            ? "error"
            : previewSubCount > 1
              ? "incomplete"
              : "valid",
    }
  }, [
    agendamentoParse.success,
    audienciaParse.success,
    geralParse.success,
    previewSubCount,
    submitParse,
    templateParse.success,
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
          />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2">
            <CampaignWizardSummaryPanel
              template={selectedTemplate}
              selectedLists={selectedLists}
              linkedForm={wizardLinkedForm}
              totalRecipients={wizardPreviewPlan?.totalRecipients ?? recipientCount}
            />

            {wizardActiveTab === "geral" ? (
              <FieldGroup>
                <Field data-invalid={Boolean(fieldErrorMessage(geralParse.success ? [] : geralParse.error.issues, "name")) || undefined}>
                  <FieldLabel htmlFor="wizard-name">Nome da campanha *</FieldLabel>
                  <Input
                    id="wizard-name"
                    value={wizardName}
                    onChange={(event) => setWizardName(event.target.value)}
                    disabled={wizardSaving}
                  />
                  {fieldErrorMessage(geralParse.success ? [] : geralParse.error.issues, "name") ? (
                    <FieldError>
                      {fieldErrorMessage(geralParse.success ? [] : geralParse.error.issues, "name")}
                    </FieldError>
                  ) : null}
                </Field>
              </FieldGroup>
            ) : null}

            {wizardActiveTab === "template" ? (
              <FieldGroup>
                <Field>
                  <FieldLabel>Template *</FieldLabel>
                  <Select value={wizardTemplateId} onValueChange={setWizardTemplateId} disabled={wizardSaving}>
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
                      disabled={wizardSaving || wizardMode === "edit"}
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
                                onCheckedChange={(value) => handleListToggle(list.id, value === true)}
                                disabled={wizardSaving || wizardMode === "edit"}
                              />
                              <span>{formatContactListLabel(list)}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                    {wizardContactListIds.length > 1 && wizardListStrategy ? (
                      <FieldDescription>
                        Estratégia: {wizardListStrategy === "merge" ? "Juntar listas" : "Uma sub-campanha por lista"}
                      </FieldDescription>
                    ) : null}
                  </Field>
                ) : (
                  <Field>
                    <FieldLabel>Segmento Radar *</FieldLabel>
                    <Select
                      value={wizardRadarSegmentSlug}
                      onValueChange={setWizardRadarSegmentSlug}
                      disabled={wizardSaving || wizardMode === "edit"}
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
                            Este segmento tem mais de {EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")}{" "}
                            destinatários. Crie uma lista de contatos para usar sub-campanhas.
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

            {wizardActiveTab === "agendamento" ? (
              <FieldGroup>
                <Field>
                  <DateTimePicker
                    date={wizardScheduledAt}
                    onDateChange={setWizardScheduledAt}
                    label={needsSplit || previewSubCount > 1 ? "Início do agendamento *" : "Agendamento"}
                    disabled={wizardSaving}
                    disablePastDates
                    tz={tz}
                  />
                </Field>
                {previewSubCount > 1 ? (
                  <Field>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={wizardUniformSchedule}
                        onCheckedChange={(value) => setWizardUniformSchedule(value === true)}
                        disabled={wizardSaving}
                      />
                      Mesmo intervalo para todas as sub-campanhas
                    </label>
                  </Field>
                ) : null}
                {wizardUniformSchedule && previewSubCount > 1 ? (
                  <Field>
                    <FieldLabel htmlFor="wizard-interval-days">Intervalo entre sub-campanhas (dias) *</FieldLabel>
                    <Input
                      id="wizard-interval-days"
                      type="number"
                      min={1}
                      value={wizardScheduleIntervalDays}
                      onChange={(event) => {
                        const next = Number.parseInt(event.target.value, 10)
                        setWizardScheduleIntervalDays(Number.isFinite(next) ? next : 1)
                      }}
                      disabled={wizardSaving}
                    />
                  </Field>
                ) : null}
              </FieldGroup>
            ) : null}

            {wizardActiveTab === "subcampanhas" ? (
              <FieldGroup>
                {wizardPreviewLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Carregando prévia...
                  </div>
                ) : null}
                {wizardPreviewPlan && wizardPreviewPlan.subCampaigns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Destinatários</TableHead>
                        <TableHead>Agendamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wizardPreviewPlan.subCampaigns.map((sub) => (
                        <TableRow key={sub.index}>
                          <TableCell>{sub.index}</TableCell>
                          <TableCell>{sub.name}</TableCell>
                          <TableCell>{sub.totalRecipients.toLocaleString("pt-BR")}</TableCell>
                          <TableCell>
                            {!wizardUniformSchedule && wizardPreviewPlan.subCampaigns.length > 1 ? (
                              <DateTimePicker
                                date={
                                  wizardSubCampaignSchedules.find((entry) => entry.index === sub.index)
                                    ?.scheduledAt
                                }
                                onDateChange={(date) => setWizardSubCampaignSchedule(sub.index, date)}
                                label=""
                                disabled={wizardSaving}
                                disablePastDates
                                tz={tz}
                              />
                            ) : sub.scheduledAt ? (
                              formatIntimezone(new Date(sub.scheduledAt), "dd/MM/yyyy HH:mm", tz)
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma sub-campanha necessária para a configuração atual.
                  </p>
                )}
              </FieldGroup>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeWizard} disabled={wizardSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveCampaign()} disabled={!submitParse.success || wizardSaving}>
              {wizardSaving ? "Salvando..." : wizardMode === "edit" ? "Salvar alterações" : "Criar campanha"}
            </Button>
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
