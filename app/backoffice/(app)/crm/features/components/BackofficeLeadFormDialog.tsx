"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CalendarClock, UserRound } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
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
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import {
  BACKOFFICE_CRM_STATUS_LABELS,
  isBackofficeLeadStatusKey,
  type BackofficeAdhesionStatusKey,
  type BackofficeLeadItem,
  type BackofficeLeadScheduleInput,
  type BackofficeLeadStatusKey,
} from "../context/BackofficeCrmTypes"
import { BackofficeLeadScheduleDialog } from "./BackofficeLeadScheduleDialog"
import { formatDocumentInput, maskPhone, normalizeLeadPhoneDigits } from "@/lib/masks"

const NO_SELECTION_VALUE = "__none__"
const DEFAULT_STATUS: BackofficeLeadStatusKey = "new_opportunity"

function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "")
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number.parseInt(cpf.charAt(i), 10) * (len + 1 - i)
    const rem = (sum * 10) % 11
    return rem === 10 ? 0 : rem
  }
  return (
    calc(9) === Number.parseInt(cpf.charAt(9), 10) &&
    calc(10) === Number.parseInt(cpf.charAt(10), 10)
  )
}

function isValidCnpj(value: string): boolean {
  const cnpj = value.replace(/\D/g, "")
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false
  const calcDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((acc, d, i) => acc + Number.parseInt(d, 10) * (weights[i] ?? 0), 0)
    const rem = sum % 11
    return rem < 2 ? 0 : 11 - rem
  }
  return (
    calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
      Number.parseInt(cnpj.charAt(12), 10) &&
    calcDigit(cnpj.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
      Number.parseInt(cnpj.charAt(13), 10)
  )
}

function isValidCpfOrCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  if (digits.length <= 11) return isValidCpf(digits)
  return isValidCnpj(digits)
}

const leadFormSchema = z
  .object({
    name: z.string().trim().min(2, "Informe ao menos 2 caracteres."),
    email: z
      .string()
      .trim()
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: "Informe um e-mail válido.",
      }),
    phone: z
      .string()
      .trim()
      .refine(
        (value) => {
          if (!value) return true
          return /^\d{10,11}$/.test(normalizeLeadPhoneDigits(value))
        },
        { message: "Telefone deve conter 10 ou 11 dígitos." },
      ),
    cpfCnpj: z
      .string()
      .trim()
      .refine(
        (value) => {
          if (!value) return true
          return isValidCpfOrCnpj(value)
        },
        { message: "CPF ou CNPJ inválido." },
      ),
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
    meetingType: z.enum(["online", "call", "whatsapp"]),
    meetingExtraGuests: z.array(z.string().email()),
    qualificationLeadOrganization: z.string().trim(),
    qualificationAvgUsers: z.string().trim(),
    qualificationProfileFit: z.string().trim(),
  })
  .superRefine((data, ctx) => {
    if (!data.sdrBackofficeUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sdrBackofficeUserId"],
        message: "SDR é obrigatório para salvar o lead.",
      })
    }

    if (!data.closerBackofficeUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closerBackofficeUserId"],
        message: "Closer é obrigatório para salvar o lead.",
      })
    }

    if (data.status !== "scheduled") return

    if (!data.meetingDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meetingDate"],
        message: "Data de agendamento é obrigatória.",
      })
    }

    if (data.meetingLink && !z.string().url().safeParse(data.meetingLink).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meetingLink"],
        message: "Informe um link válido.",
      })
    }
  })

type LeadFormValues = z.infer<typeof leadFormSchema>

const EMPTY_FORM_VALUES: LeadFormValues = {
  name: "",
  email: "",
  phone: "",
  cpfCnpj: "",
  notes: "",
  status: DEFAULT_STATUS,
  sdrBackofficeUserId: "",
  closerBackofficeUserId: "",
  meetingDate: "",
  meetingTitle: "",
  meetingNotes: "",
  meetingLink: "",
  meetingType: "online",
  meetingExtraGuests: [],
  qualificationLeadOrganization: "",
  qualificationAvgUsers: "",
  qualificationProfileFit: "",
}

function toFormValues(lead: BackofficeLeadItem | null): LeadFormValues {
  if (!lead) return EMPTY_FORM_VALUES

  return {
    name: lead.name,
    email: lead.email ?? "",
    phone: maskPhone(normalizeLeadPhoneDigits(lead.phone ?? "")),
    cpfCnpj: formatDocumentInput(lead.cpfCnpj ?? ""),
    notes: lead.notes ?? "",
    status: lead.status,
    sdrBackofficeUserId: lead.sdrBackofficeUserId ?? "",
    closerBackofficeUserId: lead.closerBackofficeUserId ?? "",
    meetingDate: lead.meetingDate ?? "",
    meetingTitle: lead.meetingTitle ?? "",
    meetingNotes: lead.meetingNotes ?? "",
    meetingLink: lead.meetingLink ?? "",
    meetingType:
      lead.meetingType === "call" || lead.meetingType === "whatsapp"
        ? lead.meetingType
        : "online",
    meetingExtraGuests: lead.meetingExtraGuests ?? [],
    qualificationLeadOrganization: lead.qualificationLeadOrganization ?? "",
    qualificationAvgUsers: lead.qualificationAvgUsers ?? "",
    qualificationProfileFit: lead.qualificationProfileFit ?? "",
  }
}

function nullIfEmpty(value?: string | null): string | null {
  const trimmed = (value ?? "").trim()
  return trimmed ? trimmed : null
}

function parseMeetingDate(value?: string | null): Date | undefined {
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
    meetingType: values.meetingType,
    extraGuests: values.meetingExtraGuests,
  }
}

function formatMeetingTypeLabel(value?: string | null): string {
  if (value === "call") return "Ligação"
  if (value === "whatsapp") return "WhatsApp"
  return "Online"
}

function getStatusBadgeClass(status: BackofficeLeadStatusKey): string {
  const classes: Record<BackofficeLeadStatusKey, string> = {
    new_opportunity: "border-primary/30 bg-primary/10 text-primary",
    scheduled: "border-primary/30 bg-primary text-primary-foreground",
    no_show: "border-muted bg-muted text-muted-foreground",
    new_adhesion: "border-primary/30 bg-primary/15 text-primary",
    lost: "border-destructive/30 bg-destructive/10 text-destructive",
    implementation: "border-border bg-secondary text-secondary-foreground",
    finalized: "border-primary/30 bg-primary/15 text-primary",
    proposal: "border-primary/30 bg-primary/10 text-primary",
    future_contact: "border-border bg-secondary text-secondary-foreground",
    deal_closed: "border-primary/30 bg-primary/15 text-primary",
    disqualified: "border-destructive/30 bg-destructive/10 text-destructive",
  }
  return classes[status]
}

const ADHESION_STATUS_LABELS: Record<BackofficeAdhesionStatusKey, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  expired: "Expirado",
  canceled: "Cancelado",
}

function getAdhesionStatusBadgeClass(status: BackofficeAdhesionStatusKey): string {
  const classes: Record<BackofficeAdhesionStatusKey, string> = {
    pending: "border-primary/30 bg-primary/10 text-primary",
    paid: "border-primary/30 bg-primary/15 text-primary",
    overdue: "border-destructive/30 bg-destructive/10 text-destructive",
    expired: "border-muted bg-muted text-muted-foreground",
    canceled: "border-muted bg-muted text-muted-foreground",
  }
  return classes[status]
}

export function BackofficeLeadFormDialog() {
  const {
    isFormDialogOpen,
    closeFormDialog,
    openEditDialog,
    selectedLead,
    createLead,
    updateLead,
    updateLeadStatus,
    users,
    sdrOptions,
    closerOptions,
  } = useBackofficeCrm()
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const isEdit = selectedLead !== null

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: EMPTY_FORM_VALUES,
    mode: "onChange",
  })

  const watchedValues = form.watch()
  const isScheduled = watchedValues.status === "scheduled"
  const isSubmitting = form.formState.isSubmitting
  const canSubmit = form.formState.isValid && !isSubmitting

  useEffect(() => {
    if (!isFormDialogOpen) return
    form.reset(toFormValues(selectedLead))
    void form.trigger()
    setScheduleDialogOpen(false)
  }, [form, isFormDialogOpen, selectedLead])

  const scheduleLead = useMemo(
    () => ({
      id: selectedLead?.id ?? null,
      name: watchedValues.name || selectedLead?.name || "Lead",
      email: watchedValues.email || selectedLead?.email || null,
      closerBackofficeUserId: watchedValues.closerBackofficeUserId || null,
      meetingDate: watchedValues.meetingDate || null,
      meetingTitle: watchedValues.meetingTitle || null,
      meetingNotes: watchedValues.meetingNotes || null,
      meetingLink: watchedValues.meetingLink || null,
      meetingType: watchedValues.meetingType || null,
      meetingExtraGuests: watchedValues.meetingExtraGuests,
    }),
    [
      selectedLead?.id,
      selectedLead?.name,
      selectedLead?.email,
      watchedValues.closerBackofficeUserId,
      watchedValues.email,
      watchedValues.meetingDate,
      watchedValues.meetingLink,
      watchedValues.meetingNotes,
      watchedValues.meetingTitle,
      watchedValues.meetingType,
      watchedValues.meetingExtraGuests,
      watchedValues.name,
    ],
  )

  async function handleShareSchedule() {
    if (!selectedLead) return
    setShareLoading(true)
    try {
      const response = await fetch(
        `/api/v1/backoffice/leads/${selectedLead.id}/schedule/share`,
        { method: "POST" }
      )
      const output = await response.json()
      if (!response.ok || !output?.isValid || !output?.result?.publicUrl) {
        throw new Error(
          Array.isArray(output?.errorMessages)
            ? output.errorMessages.join(", ")
            : "Não foi possível gerar o link público"
        )
      }
      await navigator.clipboard.writeText(output.result.publicUrl)
      toast.success("Link público copiado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar link público")
    } finally {
      setShareLoading(false)
    }
  }

  async function handleResendInvite() {
    if (!selectedLead) return
    setResendLoading(true)
    try {
      const response = await fetch(
        `/api/v1/backoffice/leads/${selectedLead.id}/schedule/resend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: "all" }),
        }
      )
      const output = await response.json()
      if (!response.ok || !output?.isValid) {
        throw new Error(
          Array.isArray(output?.errorMessages)
            ? output.errorMessages.join(", ")
            : "Não foi possível reenviar o convite"
        )
      }
      toast.success("Convite reenviado")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao reenviar convite")
    } finally {
      setResendLoading(false)
    }
  }

  async function handleScheduleConfirm(input: BackofficeLeadScheduleInput) {
    if (isEdit && selectedLead) {
      if (input.leadEmail && input.leadEmail !== selectedLead.email) {
        await updateLead(selectedLead.id, { email: input.leadEmail })
      }
      await updateLeadStatus(selectedLead.id, "scheduled", {
        closerBackofficeUserId: input.closerBackofficeUserId,
        meetingDate: input.meetingDate,
        meetingTitle: input.meetingTitle,
        meetingNotes: input.meetingNotes,
        meetingLink: input.meetingLink,
        meetingType: input.meetingType,
        extraGuests: input.extraGuests,
      })
      return
    }

    // Lead ainda não persistido: mantém no form até o submit
    form.setValue("status", "scheduled", { shouldDirty: true, shouldValidate: true })
    form.setValue("closerBackofficeUserId", input.closerBackofficeUserId ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue("meetingDate", input.meetingDate ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    })
    form.setValue("meetingTitle", input.meetingTitle ?? "", { shouldDirty: true })
    form.setValue("meetingNotes", input.meetingNotes ?? "", { shouldDirty: true })
    form.setValue("meetingLink", input.meetingLink ?? "", { shouldDirty: true })
    form.setValue("meetingType", input.meetingType ?? "online", { shouldDirty: true })
    form.setValue("meetingExtraGuests", input.extraGuests ?? [], { shouldDirty: true })
    if (input.leadEmail) {
      form.setValue("email", input.leadEmail, { shouldDirty: true })
    }
  }

  async function handleSubmit(values: LeadFormValues) {
    try {
      const basePayload = {
        name: values.name.trim(),
        email: nullIfEmpty(values.email),
        phone: nullIfEmpty(normalizeLeadPhoneDigits(values.phone)),
        cpfCnpj: nullIfEmpty(formatDocumentInput(values.cpfCnpj)),
        notes: nullIfEmpty(values.notes),
        sdrBackofficeUserId: nullIfEmpty(values.sdrBackofficeUserId),
        closerBackofficeUserId: nullIfEmpty(values.closerBackofficeUserId),
        meetingDate: nullIfEmpty(values.meetingDate),
        meetingTitle: nullIfEmpty(values.meetingTitle),
        meetingNotes: nullIfEmpty(values.meetingNotes),
        meetingLink: nullIfEmpty(values.meetingLink),
        meetingExtraGuests: values.meetingExtraGuests,
        qualificationLeadOrganization: nullIfEmpty(values.qualificationLeadOrganization),
        qualificationAvgUsers: nullIfEmpty(values.qualificationAvgUsers),
        qualificationProfileFit: nullIfEmpty(values.qualificationProfileFit),
      }

      if (isEdit && selectedLead) {
        await updateLead(selectedLead.id, basePayload)
        if (selectedLead.status !== values.status) {
          await updateLeadStatus(
            selectedLead.id,
            values.status,
            values.status === "scheduled" ? buildScheduleInput(values) : undefined,
            { silent: true },
          )
        }
        // Mantém o dialog aberto no modo edição com os dados atualizados
      } else {
        const created = await createLead({
          ...basePayload,
          status: values.status,
        })
        // Transiciona para modo edição sem fechar o dialog,
        // habilitando o botão de agendamento
        openEditDialog(created)
      }
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
              <div className="flex min-w-0 items-start gap-3 pr-8">
                <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
                  <UserRound data-icon="inline-start" />
                </div>
                <div className="flex min-w-0 items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle>{isEdit ? "Editar lead" : "Novo lead"}</DialogTitle>
                      <Badge
                        variant="outline"
                        className={cn("font-medium", getStatusBadgeClass(watchedValues.status))}
                      >
                        {BACKOFFICE_CRM_STATUS_LABELS[watchedValues.status]}
                      </Badge>
                      {selectedLead?.adhesion ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            getAdhesionStatusBadgeClass(selectedLead.adhesion.status),
                          )}
                        >
                          Adesão {ADHESION_STATUS_LABELS[selectedLead.adhesion.status]}
                        </Badge>
                      ) : null}
                    </div>
                    <DialogDescription className="mt-1">
                      {isEdit
                        ? "Atualize os dados operacionais do lead do backoffice."
                        : "Cadastre um lead manual no pipeline do backoffice."}
                    </DialogDescription>
                  </div>
                </div>
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
                                onChange={(event) =>
                                  field.onChange(
                                    maskPhone(normalizeLeadPhoneDigits(event.target.value)),
                                  )
                                }
                                disabled={isSubmitting}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cpfCnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Documento</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="CPF ou CNPJ"
                                value={formatDocumentInput(field.value ?? "")}
                                onChange={(event) =>
                                  field.onChange(formatDocumentInput(event.target.value))
                                }
                                maxLength={18}
                                disabled={isSubmitting}
                              />
                            </FormControl>
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
                      <h3 className="text-sm font-semibold">Qualificação</h3>
                      <p className="text-xs text-muted-foreground">
                        Respostas do lead sobre seu perfil e necessidades.
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name="qualificationLeadOrganization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Como você organiza seus leads e carteira?</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Ex: Uso planilha, WhatsApp, CRM..."
                              rows={2}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="qualificationAvgUsers"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantos usuários em média você precisa?</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Ex: 1 a 5 usuários"
                              rows={2}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="qualificationProfileFit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Qual perfil se enquadra no seu momento?</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Ex: Corretor autônomo, pequena equipe..."
                              rows={2}
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
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>SDR *</FormLabel>
                            <Select
                              value={field.value || NO_SELECTION_VALUE}
                              onValueChange={(value) =>
                                field.onChange(value === NO_SELECTION_VALUE ? "" : value)
                              }
                              disabled={isSubmitting}
                            >
                              <FormControl>
                                <SelectTrigger
                                  aria-invalid={Boolean(fieldState.error || !field.value)}
                                >
                                  <SelectValue placeholder="Selecione o SDR" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value={NO_SELECTION_VALUE}>
                                    Selecione o SDR
                                  </SelectItem>
                                  {sdrOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                            {!field.value && !fieldState.error ? (
                              <p className="text-xs font-medium text-destructive">
                                Selecione um SDR para salvar o lead.
                              </p>
                            ) : null}
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="closerBackofficeUserId"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>Closer *</FormLabel>
                            <Select
                              value={field.value || NO_SELECTION_VALUE}
                              onValueChange={(value) =>
                                field.onChange(value === NO_SELECTION_VALUE ? "" : value)
                              }
                              disabled={isSubmitting}
                            >
                              <FormControl>
                                <SelectTrigger
                                  aria-invalid={Boolean(fieldState.error || !field.value)}
                                >
                                  <SelectValue placeholder="Selecione o closer" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value={NO_SELECTION_VALUE}>
                                    Selecione o closer
                                  </SelectItem>
                                  {closerOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                      {option.name}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                            {!field.value && !fieldState.error ? (
                              <p className="text-xs font-medium text-destructive">
                                Selecione um closer para salvar o lead.
                              </p>
                            ) : null}
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
                          Resumo do agendamento. Use o modal para criar ou alterar.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setScheduleDialogOpen(true)}
                          disabled={isSubmitting || !isEdit}
                          title={!isEdit ? "Salve o lead primeiro para agendar" : undefined}
                        >
                          <CalendarClock data-icon="inline-start" />
                          {isScheduled ? "Editar agendamento" : "Agendar lead"}
                        </Button>
                      </div>
                    </div>

                    {isScheduled && watchedValues.meetingDate ? (
                      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
                        <div className="grid gap-1">
                          <span className="text-muted-foreground">Data/hora</span>
                          <span>
                            {parseMeetingDate(watchedValues.meetingDate)?.toLocaleString("pt-BR") ??
                              watchedValues.meetingDate}
                          </span>
                        </div>
                        <div className="grid gap-1">
                          <span className="text-muted-foreground">Closer</span>
                          <span>
                            {closerOptions.find((c) => c.id === watchedValues.closerBackofficeUserId)
                              ?.name ?? "Não atribuído"}
                          </span>
                        </div>
                        <div className="grid gap-1">
                          <span className="text-muted-foreground">Tipo</span>
                          <span>{formatMeetingTypeLabel(watchedValues.meetingType)}</span>
                        </div>
                        {watchedValues.meetingTitle ? (
                          <div className="grid gap-1">
                            <span className="text-muted-foreground">Título</span>
                            <span>{watchedValues.meetingTitle}</span>
                          </div>
                        ) : null}
                        {watchedValues.meetingLink ? (
                          <div className="grid gap-1">
                            <span className="text-muted-foreground">Link</span>
                            <a
                              href={watchedValues.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-primary underline-offset-2 hover:underline"
                            >
                              {watchedValues.meetingLink}
                            </a>
                          </div>
                        ) : null}
                        {isEdit && selectedLead ? (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSubmitting || shareLoading || resendLoading}
                              onClick={() => void handleShareSchedule()}
                            >
                              {shareLoading ? "Gerando link..." : "Copiar link público"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSubmitting || shareLoading || resendLoading}
                              onClick={() => void handleResendInvite()}
                            >
                              {resendLoading ? "Reenviando..." : "Reenviar convite"}
                            </Button>
                          </div>
                        ) : null}
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
        guestOptions={users}
        onOpenChange={setScheduleDialogOpen}
        onConfirm={handleScheduleConfirm}
        isReschedule={isEdit && isScheduled}
        onResendInvite={
          isEdit && selectedLead
            ? async () => {
                await handleResendInvite()
              }
            : undefined
        }
      />
    </>
  )
}
