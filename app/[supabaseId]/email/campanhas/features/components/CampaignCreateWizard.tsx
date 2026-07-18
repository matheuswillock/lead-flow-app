"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { CircleHelp, Info } from "lucide-react"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { useCampanhasContext } from "../context/CampanhasContext"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates"
import {
  buildSubCampaignScheduledAts,
  estimateSubCampaignCount,
} from "@/lib/email/campaign-sub-campaigns"
import {
  buildCampaignCreateWizardSubmitSchema,
  campaignCreateWizardStep1Schema,
  campaignCreateWizardStep2Schema,
  EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
} from "../validation/campaignCreateWizardSchema"
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

export function CampaignCreateWizard() {
  const { tz } = useTimezone()
  const {
    wizardOpen,
    wizardStep,
    wizardName,
    wizardTemplateId,
    wizardContactListId,
    wizardRecipientSource,
    wizardCdpSegmentSlug,
    wizardScheduledAt,
    wizardScheduleIntervalDays,
    wizardCreating,
    templates,
    contactLists,
    cdpSegments,
    closeWizard,
    setWizardStep,
    setWizardName,
    setWizardTemplateId,
    setWizardContactListId,
    setWizardRecipientSource,
    setWizardCdpSegmentSlug,
    setWizardScheduledAt,
    setWizardScheduleIntervalDays,
    handleCreateCampaign,
  } = useCampanhasContext()

  const selectedList = contactLists.find((list) => list.id === wizardContactListId)
  const selectedSegment = cdpSegments.find((segment) => segment.slug === wizardCdpSegmentSlug)
  const recipientCount =
    wizardRecipientSource === "cdp_segment"
      ? selectedSegment?.count ?? 0
      : selectedList?.activeContacts ?? selectedList?.totalContacts ?? 0

  const needsSplit =
    wizardRecipientSource === "contact_list" &&
    recipientCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB

  const step1Parse = campaignCreateWizardStep1Schema.safeParse({
    name: wizardName,
    templateId: wizardTemplateId,
  })
  const step2Parse = campaignCreateWizardStep2Schema.safeParse({
    recipientSource: wizardRecipientSource,
    contactListId: wizardContactListId || undefined,
    cdpSegmentSlug: wizardCdpSegmentSlug || undefined,
  })
  const submitSchema = useMemo(
    () =>
      buildCampaignCreateWizardSubmitSchema({
        recipientCount,
        recipientSource: wizardRecipientSource,
      }),
    [recipientCount, wizardRecipientSource]
  )
  const submitParse = submitSchema.safeParse({
    name: wizardName,
    templateId: wizardTemplateId,
    recipientSource: wizardRecipientSource,
    contactListId: wizardContactListId || undefined,
    cdpSegmentSlug: wizardCdpSegmentSlug || undefined,
    scheduledAt: wizardScheduledAt,
    scheduleIntervalDays: wizardScheduleIntervalDays,
  })

  const subCampaignCount = needsSplit ? estimateSubCampaignCount(recipientCount) : 0
  const previewDates =
    needsSplit && wizardScheduledAt && wizardScheduleIntervalDays >= 1
      ? buildSubCampaignScheduledAts(
          wizardScheduledAt,
          Math.min(subCampaignCount, 5),
          wizardScheduleIntervalDays
        )
      : []

  const step1Issues = step1Parse.success ? [] : step1Parse.error.issues
  const step2Issues = step2Parse.success ? [] : step2Parse.error.issues
  const submitIssues = submitParse.success ? [] : submitParse.error.issues

  return (
    <Dialog open={wizardOpen} onOpenChange={(open) => { if (!open) closeWizard() }}>
      <DialogContent className="max-h-[90vh] flex flex-col max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Campanha — Passo {wizardStep} de 3</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {wizardStep === 1 && (
            <FieldGroup>
              <Field data-invalid={Boolean(fieldErrorMessage(step1Issues, "name")) || undefined}>
                <FieldLabel htmlFor="wizard-name">Nome da campanha *</FieldLabel>
                <Input
                  id="wizard-name"
                  placeholder="Ex: Newsletter Maio 2026"
                  value={wizardName}
                  onChange={(e) => setWizardName(e.target.value)}
                  disabled={wizardCreating}
                  aria-invalid={Boolean(fieldErrorMessage(step1Issues, "name")) || undefined}
                />
                {fieldErrorMessage(step1Issues, "name") ? (
                  <FieldError>{fieldErrorMessage(step1Issues, "name")}</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel>Template *</FieldLabel>
                <Select value={wizardTemplateId} onValueChange={setWizardTemplateId} disabled={wizardCreating}>
                  <SelectTrigger aria-invalid={Boolean(fieldErrorMessage(step1Issues, "templateId")) || undefined}>
                    <SelectValue placeholder="Selecione um template..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {templates.length === 0 ? (
                        <SelectItem value="__none" disabled>Nenhum template publicado disponível</SelectItem>
                      ) : (
                        templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex justify-end">
                <Button
                  onClick={() => setWizardStep(2)}
                  disabled={!step1Parse.success || wizardCreating}
                >
                  Próximo →
                </Button>
              </div>
            </FieldGroup>
          )}

          {wizardStep === 2 && (
            <FieldGroup>
              <Field>
                <FieldLabel>Origem dos destinatários *</FieldLabel>
                <Select
                  value={wizardRecipientSource}
                  onValueChange={(value) =>
                    setWizardRecipientSource(value as "contact_list" | "cdp_segment")
                  }
                  disabled={wizardCreating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="contact_list">Lista de contatos</SelectItem>
                      <SelectItem value="cdp_segment">Segmento CDP</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {wizardRecipientSource === "contact_list" ? (
                <Field data-invalid={Boolean(fieldErrorMessage(step2Issues, "contactListId")) || undefined}>
                  <FieldLabel>Lista de contatos *</FieldLabel>
                  <Select value={wizardContactListId} onValueChange={setWizardContactListId} disabled={wizardCreating}>
                    <SelectTrigger aria-invalid={Boolean(fieldErrorMessage(step2Issues, "contactListId")) || undefined}>
                      <SelectValue placeholder="Selecione uma lista..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {contactLists.length === 0 ? (
                          <SelectItem value="__none" disabled>Nenhuma lista disponível</SelectItem>
                        ) : (
                          contactLists.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {formatContactListLabel(l)}
                            </SelectItem>
                          ))
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldErrorMessage(step2Issues, "contactListId") ? (
                    <FieldError>{fieldErrorMessage(step2Issues, "contactListId")}</FieldError>
                  ) : null}
                </Field>
              ) : (
                <Field data-invalid={Boolean(fieldErrorMessage(step2Issues, "cdpSegmentSlug")) || undefined}>
                  <div className="flex items-center gap-1.5">
                    <FieldLabel>Segmento CDP *</FieldLabel>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="O que é segmento CDP?"
                          >
                            <CircleHelp />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          Segmento dinâmico do Customer Data Platform: contatos filtrados por
                          regras (ex.: leads ativos, inativos). Atualiza automaticamente antes
                          de cada disparo.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select value={wizardCdpSegmentSlug} onValueChange={setWizardCdpSegmentSlug} disabled={wizardCreating}>
                    <SelectTrigger aria-invalid={Boolean(fieldErrorMessage(step2Issues, "cdpSegmentSlug")) || undefined}>
                      <SelectValue placeholder="Selecione um segmento..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {cdpSegments.length === 0 ? (
                          <SelectItem value="__none" disabled>Nenhum segmento disponível</SelectItem>
                        ) : (
                          cdpSegments.map((segment) => (
                            <SelectItem key={segment.slug} value={segment.slug}>
                              {segment.name} ({segment.count})
                            </SelectItem>
                          ))
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldErrorMessage(step2Issues, "cdpSegmentSlug") ? (
                    <FieldError>{fieldErrorMessage(step2Issues, "cdpSegmentSlug")}</FieldError>
                  ) : null}
                  {wizardRecipientSource === "cdp_segment" &&
                  recipientCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB ? (
                    <FieldError>
                      Segmentos CDP com mais de {EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")}{" "}
                      destinatários não são suportados. Use uma lista de contatos ou reduza o segmento.
                    </FieldError>
                  ) : null}
                </Field>
              )}

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setWizardStep(1)}
                  disabled={wizardCreating}
                >
                  ← Voltar
                </Button>
                <Button
                  onClick={() => setWizardStep(3)}
                  disabled={
                    !step2Parse.success ||
                    wizardCreating ||
                    (wizardRecipientSource === "cdp_segment" &&
                      recipientCount > EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB)
                  }
                >
                  Próximo →
                </Button>
              </div>
            </FieldGroup>
          )}

          {wizardStep === 3 && (
            <FieldGroup>
              <Alert>
                <Info />
                <AlertTitle>Destinatários</AlertTitle>
                <AlertDescription>
                  A campanha será enviada para{" "}
                  <strong>{recipientCount.toLocaleString("pt-BR")}</strong> destinatário(s){" "}
                  {wizardRecipientSource === "cdp_segment" ? (
                    <>
                      do segmento <strong>{selectedSegment?.name ?? "selecionado"}</strong>
                    </>
                  ) : (
                    <>
                      da lista <strong>{selectedList?.name ?? "selecionada"}</strong>
                    </>
                  )}
                  .
                </AlertDescription>
              </Alert>

              {needsSplit ? (
                <Alert>
                  <Info />
                  <AlertTitle>Sub-campanhas</AlertTitle>
                  <AlertDescription>
                    Limite de {EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")} e-mails
                    por dia — no pico, 1 sub-campanha por dia. Serão criadas{" "}
                    <strong>{subCampaignCount}</strong> sub-campanhas de até{" "}
                    {EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB.toLocaleString("pt-BR")} contatos.
                  </AlertDescription>
                </Alert>
              ) : null}

              <Field data-invalid={Boolean(fieldErrorMessage(submitIssues, "scheduledAt")) || undefined}>
                <DateTimePicker
                  date={wizardScheduledAt}
                  onDateChange={setWizardScheduledAt}
                  label={needsSplit ? "Início do agendamento *" : "Agendamento"}
                  disabled={wizardCreating}
                  disablePastDates
                  required={needsSplit}
                  invalid={Boolean(fieldErrorMessage(submitIssues, "scheduledAt"))}
                  tz={tz}
                />
                {fieldErrorMessage(submitIssues, "scheduledAt") ? (
                  <FieldError>{fieldErrorMessage(submitIssues, "scheduledAt")}</FieldError>
                ) : (
                  <FieldDescription>
                    {wizardScheduledAt
                      ? `Primeiro disparo em ${formatIntimezone(
                          wizardScheduledAt,
                          "dd/MM/yyyy HH:mm",
                          tz
                        )}`
                      : needsSplit
                        ? "Obrigatório para listas com mais de 2.000 contatos"
                        : "Sem data → disparo imediato ao clicar em Disparar"}
                  </FieldDescription>
                )}
              </Field>

              {needsSplit ? (
                <Field data-invalid={Boolean(fieldErrorMessage(submitIssues, "scheduleIntervalDays")) || undefined}>
                  <FieldLabel htmlFor="wizard-interval-days">Intervalo entre sub-campanhas (dias) *</FieldLabel>
                  <Input
                    id="wizard-interval-days"
                    type="number"
                    min={1}
                    step={1}
                    value={wizardScheduleIntervalDays}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10)
                      setWizardScheduleIntervalDays(Number.isFinite(next) ? next : 1)
                    }}
                    disabled={wizardCreating}
                    aria-invalid={Boolean(fieldErrorMessage(submitIssues, "scheduleIntervalDays")) || undefined}
                  />
                  {fieldErrorMessage(submitIssues, "scheduleIntervalDays") ? (
                    <FieldError>{fieldErrorMessage(submitIssues, "scheduleIntervalDays")}</FieldError>
                  ) : (
                    <FieldDescription>Mínimo 1 dia entre cada lote de até 2.000 e-mails.</FieldDescription>
                  )}
                </Field>
              ) : null}

              {previewDates.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Prévia dos primeiros agendamentos</p>
                  <div className="flex flex-wrap gap-2">
                    {previewDates.map((date, index) => (
                      <Badge key={date.toISOString()} variant="secondary">
                        Parte {index + 1}: {formatIntimezone(date, "dd/MM/yyyy HH:mm", tz)}
                      </Badge>
                    ))}
                    {subCampaignCount > previewDates.length ? (
                      <Badge variant="outline">+{subCampaignCount - previewDates.length} partes</Badge>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setWizardStep(2)} disabled={wizardCreating}>
                  ← Voltar
                </Button>
                <Button
                  onClick={() => void handleCreateCampaign()}
                  disabled={!submitParse.success || wizardCreating}
                >
                  {wizardCreating ? "Criando..." : "Criar Campanha"}
                </Button>
              </div>
            </FieldGroup>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
