"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarClock, UserRound } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useTimezone } from "@/app/context/TimezoneContext"
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import {
  BACKOFFICE_CRM_COLUMNS,
  BACKOFFICE_CRM_STATUS_LABELS,
  isBackofficeLeadStatusKey,
  type BackofficeLeadItem,
  type BackofficeLeadScheduleInput,
  type BackofficeLeadStatusKey,
} from "../context/BackofficeCrmTypes"
import { BackofficeLeadScheduleDialog } from "./BackofficeLeadScheduleDialog"

const NO_SELECTION_VALUE = "__none__"
const DEFAULT_STATUS: BackofficeLeadStatusKey = "new_opportunity"

const leadFormSchema = z
  .object({
    name: z.string().trim().min(2, "Informe ao menos 2 caracteres."),
    email: z
      .string()
      .trim()
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: "Informe um e-mail válido.",
      }),
    phone: z.string().trim(),
    notes: z.string().trim(),
    status: z.custom<BackofficeLeadStatusKey>(isBackofficeLeadStatusKey, {
      message: "Status inválido.",
    }),
    sdrBackofficeUserId: z.string().trim(),
    closerBackofficeUserId: z.string().trim(),
    meetingDate: z.string().trim(),
    meetingTitle: z.string().trim(),
    meetingNotes: z.string().trim(),
    meetingLink: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (data.status !== "scheduled") return

    if (!data.meetingDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meetingDate"],
        message: "Data de agendamento é obrigatória.",
      })
    }

    if (!data.closerBackofficeUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closerBackofficeUserId"],
        message: "Closer é obrigatório para leads agendados.",
      })
    }
  })

type LeadFormValues = z.infer<typeof leadFormSchema>

const EMPTY_FORM_VALUES: LeadFormValues = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  status: DEFAULT_STATUS,
  sdrBackofficeUserId: "",
  closerBackofficeUserId: "",
  meetingDate: "",
  meetingTitle: "",
  meetingNotes: "",
  meetingLink: "",
}

function toFormValues(lead: BackofficeLeadItem | null): LeadFormValues {
  if (!lead) return EMPTY_FORM_VALUES

  return {
    name: lead.name,
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    notes: lead.notes ?? "",
    status: lead.status,
    sdrBackofficeUserId: lead.sdrBackofficeUserId ?? "",
    closerBackofficeUserId: lead.closerBackofficeUserId ?? "",
    meetingDate: lead.meetingDate ?? "",
    meetingTitle: lead.meetingTitle ?? "",
    meetingNotes: lead.meetingNotes ?? "",
    meetingLink: lead.meetingLink ?? "",
  }
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseMeetingDate(value: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function buildScheduleInput(values: LeadFormValues): BackofficeLeadScheduleInput {
  return {
    closerBackofficeUserId: values.closerBackofficeUserId,
    meetingDate: values.meetingDate,
    meetingTitle: nullIfEmpty(values.meetingTitle),
    meetingNotes: nullIfEmpty(values.meetingNotes),
    meetingLink: nullIfEmpty(values.meetingLink),
  }
}

function getStatusBadgeClass(status: BackofficeLeadStatusKey): string {
  const classes: Record<BackofficeLeadStatusKey, string> = {
    new_opportunity: "border-primary/30 bg-primary/10 text-primary",
    scheduled: "border-primary/30 bg-primary text-primary-foreground",
    no_show: "border-muted bg-muted text-muted-foreground",
    lost: "border-destructive/30 bg-destructive/10 text-destructive",
    implementation: "border-border bg-secondary text-secondary-foreground",
    finalized: "border-primary/30 bg-primary/15 text-primary",
  }
  return classes[status]
}

export function BackofficeLeadFormDialog() {
  const {
    isFormDialogOpen,
    closeFormDialog,
    selectedLead,
    createLead,
    updateLead,
    updateLeadStatus,
    sdrOptions,
    closerOptions,
  } = useBackofficeCrm()
  const { tz } = useTimezone()
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const isEdit = selectedLead !== null

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
    mode: "onChange",
  })

  const watchedValues = form.watch()
  const isScheduled = watchedValues.status === "scheduled"
  const isSubmitting = form.formState.isSubmitting
  const canSubmit =
    watchedValues.name.trim().length >= 2 &&
    (!isScheduled || Boolean(watchedValues.meetingDate && watchedValues.closerBackofficeUserId))

  useEffect(() => {
    if (!isFormDialogOpen) return
    form.reset(toFormValues(selectedLead))
    setScheduleDialogOpen(false)
  }, [form, isFormDialogOpen, selectedLead])

  const scheduleLead = useMemo(
    () => ({
      name: watchedValues.name || selectedLead?.name || "Lead",
      closerBackofficeUserId: watchedValues.closerBackofficeUserId || null,
      meetingDate: watchedValues.meetingDate || null,
      meetingTitle: watchedValues.meetingTitle || null,
      meetingNotes: watchedValues.meetingNotes || null,
      meetingLink: watchedValues.meetingLink || null,
    }),
    [
      selectedLead?.name,
      watchedValues.closerBackofficeUserId,
      watchedValues.meetingDate,
      watchedValues.meetingLink,
      watchedValues.meetingNotes,
      watchedValues.meetingTitle,
      watchedValues.name,
    ]
  )

  async function handleScheduleConfirm(input: BackofficeLeadScheduleInput) {
    form.setValue("status", "scheduled", { shouldDirty: true, shouldValidate: true })
    form.setValue("closerBackofficeUserId", input.closerBackofficeUserId, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue("meetingDate", input.meetingDate, {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue("meetingTitle", input.meetingTitle ?? "", { shouldDirty: true })
    form.setValue("meetingNotes", input.meetingNotes ?? "", { shouldDirty: true })
    form.setValue("meetingLink", input.meetingLink ?? "", { shouldDirty: true })
  }

  async function handleSubmit(values: LeadFormValues) {
    try {
      const basePayload = {
        name: values.name.trim(),
        email: nullIfEmpty(values.email),
        phone: nullIfEmpty(values.phone),
        notes: nullIfEmpty(values.notes),
        sdrBackofficeUserId: nullIfEmpty(values.sdrBackofficeUserId),
        closerBackofficeUserId: nullIfEmpty(values.closerBackofficeUserId),
        meetingDate: nullIfEmpty(values.meetingDate),
        meetingTitle: nullIfEmpty(values.meetingTitle),
        meetingNotes: nullIfEmpty(values.meetingNotes),
        meetingLink: nullIfEmpty(values.meetingLink),
      }

      if (isEdit && selectedLead) {
        await updateLead(selectedLead.id, basePayload)
        if (selectedLead.status !== values.status) {
          await updateLeadStatus(
            selectedLead.id,
            values.status,
            values.status === "scheduled" ? buildScheduleInput(values) : undefined,
            { silent: true }
          )
        }
      } else {
        await createLead({
          ...basePayload,
          status: values.status,
        })
      }
      closeFormDialog()
    } catch (err) {
      console.error("[BackofficeLeadFormDialog][submit]", err)
      toast.error(err instanceof Error ? err.message : "Erro ao salvar lead")
    }
  }

  return (
    <>
      <Dialog
        open={isFormDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) closeFormDialog()
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col border-none bg-transparent p-0 shadow-none sm:max-w-4xl">
          <div className="flex max-h-[90vh] min-h-0 flex-col rounded-xl border bg-background shadow-lg">
            <DialogHeader className="border-b px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
                    <UserRound data-icon="inline-start" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle>{isEdit ? "Editar lead" : "Novo lead"}</DialogTitle>
                    <DialogDescription className="mt-1">
                      {isEdit
                        ? "Atualize os dados operacionais do lead do backoffice."
                        : "Cadastre um lead manual no pipeline do backoffice."}
                    </DialogDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn("font-medium", getStatusBadgeClass(watchedValues.status))}
                >
                  {BACKOFFICE_CRM_STATUS_LABELS[watchedValues.status]}
                </Badge>
              </div>
            </DialogHeader>

            <Form {...form}>
              <form
                id="backoffice-lead-form"
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="dialog-scrollbar flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
                  <section className="flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">Dados do lead</h3>
                      <p className="text-xs text-muted-foreground">
                        Informações principais usadas na busca e atendimento.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Nome completo"
                                disabled={isSubmitting}
                                autoFocus
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                placeholder="contato@exemplo.com"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="(00) 00000-0000"
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                const nextStatus = value as BackofficeLeadStatusKey
                                if (nextStatus === "scheduled" && field.value !== "scheduled") {
                                  setScheduleDialogOpen(true)
                                  return
                                }
                                field.onChange(nextStatus)
                              }}
                              disabled={isSubmitting}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  {BACKOFFICE_CRM_COLUMNS.map((status) => (
                                    <SelectItem key={status.key} value={status.key}>
                                      {status.title}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Anotações sobre o lead"
                              rows={4}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </section>

                  <Separator />

                  <section className="flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-semibold">Responsáveis</h3>
                      <p className="text-xs text-muted-foreground">
                        SDR e Closer são usuários backoffice ativos com a função habilitada.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="sdrBackofficeUserId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SDR</FormLabel>
                            <Select
                              value={field.value || NO_SELECTION_VALUE}
                              onValueChange={(value) =>
                                field.onChange(value === NO_SELECTION_VALUE ? "" : value)
                              }
                              disabled={isSubmitting}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o SDR" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value={NO_SELECTION_VALUE}>Sem SDR</SelectItem>
                                  {sdrOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="closerBackofficeUserId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Closer{isScheduled ? " *" : ""}</FormLabel>
                            <Select
                              value={field.value || NO_SELECTION_VALUE}
                              onValueChange={(value) =>
                                field.onChange(value === NO_SELECTION_VALUE ? "" : value)
                              }
                              disabled={isSubmitting}
                            >
                              <FormControl>
                                <SelectTrigger
                                  aria-invalid={Boolean(
                                    form.formState.errors.closerBackofficeUserId
                                  )}
                                >
                                  <SelectValue placeholder="Selecione o closer" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value={NO_SELECTION_VALUE}>Sem closer</SelectItem>
                                  {closerOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </section>

                  <Separator />

                  <section className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">Agendamento</h3>
                        <p className="text-xs text-muted-foreground">
                          Obrigatório quando o status for Agendado.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setScheduleDialogOpen(true)}
                        disabled={isSubmitting}
                      >
                        <CalendarClock data-icon="inline-start" />
                        {isScheduled ? "Editar agendamento" : "Agendar"}
                      </Button>
                    </div>

                    {isScheduled ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="meetingDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <DateTimePicker
                                  date={parseMeetingDate(field.value)}
                                  onDateChange={(date) =>
                                    field.onChange(date ? date.toISOString() : "")
                                  }
                                  label="Data do agendamento"
                                  required
                                  disabled={isSubmitting}
                                  invalid={Boolean(form.formState.errors.meetingDate)}
                                  disablePastDates
                                  tz={tz}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="meetingTitle"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Título</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Título do agendamento"
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="meetingLink"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Link</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="https://meet..."
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="meetingNotes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Notas do agendamento</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder="Notas internas do agendamento"
                                  rows={3}
                                  disabled={isSubmitting}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        O agendamento será solicitado ao mover o lead para Agendado.
                      </div>
                    )}
                  </section>
                </div>

                <DialogFooter className="border-t px-6 py-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeFormDialog}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !canSubmit}>
                    {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Criar lead"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>

      <BackofficeLeadScheduleDialog
        open={scheduleDialogOpen}
        lead={scheduleLead}
        closerOptions={closerOptions}
        onOpenChange={setScheduleDialogOpen}
        onConfirm={handleScheduleConfirm}
      />
    </>
  )
}
