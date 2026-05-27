"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, Minus, Plus } from "lucide-react"
import { toast } from "sonner"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { IBackofficeAdhesionsService } from "../services/IBackofficeAdhesionsService"
import { BackofficeAdhesionsRequestError } from "../services/BackofficeAdhesionsService"
import {
  BACKOFFICE_ADHESION_CYCLE_LABELS,
  type BackofficeAdhesionBillingCycleKey,
  type BackofficeAdhesionCreationResult,
  type BackofficeAdhesionFormValues,
  type BackofficeAdhesionItem,
  type BackofficeAdhesionOptions,
} from "../context/BackofficeAdhesionsTypes"
import { formatDocumentInput, maskPhone } from "@/lib/masks"

const NO_SELECTION_VALUE = "__none__"
const CYCLE_MONTHS: Record<BackofficeAdhesionBillingCycleKey, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

function sanitizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11)
}

function sanitizeCpfCnpj(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14)
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function formatQuantity(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

function resolveChargeBillingType(
  billingType: BackofficeAdhesionFormValues["billingType"]
): "PIX" | "CREDIT_CARD" {
  return billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX"
}

function defaultValues(): BackofficeAdhesionFormValues {
  return {
    leadId: "",
    fullName: "",
    phone: "",
    email: "",
    cpfCnpj: "",
    cycle: "monthly",
    extraTeams: 0,
    extraUsers: 0,
    billingType: "PIX",
    sdrBackofficeUserId: null,
    closerBackofficeUserId: null,
    activationMode: "checkout",
  }
}

function valuesFromAdhesion(adhesion: BackofficeAdhesionItem): BackofficeAdhesionFormValues {
  return {
    leadId: adhesion.leadId,
    fullName: adhesion.fullName,
    phone: adhesion.phone,
    email: adhesion.email ?? "",
    cpfCnpj: adhesion.cpfCnpj ?? "",
    cycle: adhesion.cycle,
    extraTeams: adhesion.extraTeams,
    extraUsers: adhesion.extraUsers,
    billingType:
      adhesion.billingType === "CREDIT_CARD"
        ? "CREDIT_CARD"
        : adhesion.billingType === "EXTERNAL"
          ? "EXTERNAL"
          : "PIX",
    sdrBackofficeUserId: adhesion.sdrBackofficeUserId,
    closerBackofficeUserId: adhesion.closerBackofficeUserId,
    activationMode: "checkout",
  }
}

function NumberStepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(value - 1, 0))}
          aria-label={`Diminuir ${label}`}
        >
          <Minus data-icon="inline-start" />
        </Button>
        <Input
          value={value}
          inputMode="numeric"
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10)
            onChange(Number.isFinite(next) ? Math.max(next, 0) : 0)
          }}
          disabled={disabled}
          className="text-center"
          aria-label={label}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          onClick={() => onChange(value + 1)}
          aria-label={`Aumentar ${label}`}
        >
          <Plus data-icon="inline-start" />
        </Button>
      </div>
    </div>
  )
}

interface BackofficeAdhesionDialogProps {
  open: boolean
  mode: "create" | "edit"
  adhesion?: BackofficeAdhesionItem | null
  service: IBackofficeAdhesionsService
  onOpenChange: (open: boolean) => void
  onSaved?: () => Promise<void> | void
}

export function BackofficeAdhesionDialog({
  open,
  mode,
  adhesion,
  service,
  onOpenChange,
  onSaved,
}: BackofficeAdhesionDialogProps) {
  const [options, setOptions] = useState<BackofficeAdhesionOptions | null>(null)
  const [values, setValues] = useState<BackofficeAdhesionFormValues>(defaultValues)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<BackofficeAdhesionCreationResult | null>(null)

  const selectedLead = useMemo(
    () => options?.leads.find((lead) => lead.id === values.leadId) ?? null,
    [options?.leads, values.leadId]
  )
  const cyclePrices = options?.pricing.cycles[values.cycle] ?? {
    baseMonthlyPrice: 0,
    extraTeamPrice: 0,
    extraUserPrice: 0,
    pixBaseMonthlyPrice: null,
    cardBaseMonthlyPrice: null,
  }
  const extrasMonthly =
    values.extraTeams * cyclePrices.extraTeamPrice +
    values.extraUsers * cyclePrices.extraUserPrice
  const cardBaseMonthly = cyclePrices.cardBaseMonthlyPrice ?? cyclePrices.baseMonthlyPrice
  const pixBaseMonthly = cyclePrices.pixBaseMonthlyPrice ?? cyclePrices.baseMonthlyPrice
  const cardMonthlyTotal = cardBaseMonthly + extrasMonthly
  const pixMonthlyTotal = pixBaseMonthly + extrasMonthly
  const cycleMonths = CYCLE_MONTHS[values.cycle]
  const cardTotal = cardMonthlyTotal * cycleMonths
  const pixTotal = pixMonthlyTotal * cycleMonths
  const chargeBillingType = resolveChargeBillingType(values.billingType)
  const selectedBaseMonthly = chargeBillingType === "PIX" ? pixBaseMonthly : cardBaseMonthly
  const total = chargeBillingType === "PIX" ? pixTotal : cardTotal
  const commercialItems = [
    {
      key: "crm",
      name: "CRM",
      description: "Plano principal do Corretor Studio",
      quantity: "1 plano",
      monthlyUnitPrice: selectedBaseMonthly,
      monthlyTotal: selectedBaseMonthly,
    },
    ...(values.extraTeams > 0
      ? [
          {
            key: "extra-teams",
            name: "Time adicional",
            description: "Cota pré-paga para criar times além do time principal",
            quantity: formatQuantity(values.extraTeams, "time", "times"),
            monthlyUnitPrice: cyclePrices.extraTeamPrice,
            monthlyTotal: values.extraTeams * cyclePrices.extraTeamPrice,
          },
        ]
      : []),
    ...(values.extraUsers > 0
      ? [
          {
            key: "extra-users",
            name: "Usuário adicional",
            description: "Cota pré-paga para adicionar usuários na conta",
            quantity: formatQuantity(values.extraUsers, "usuário", "usuários"),
            monthlyUnitPrice: cyclePrices.extraUserPrice,
            monthlyTotal: values.extraUsers * cyclePrices.extraUserPrice,
          },
        ]
      : []),
  ]
  const isExternalPaid = values.activationMode === "external_paid"
  const isExternalBilling = mode === "edit" && values.billingType === "EXTERNAL"
  const sanitizedCpfCnpj = sanitizeCpfCnpj(values.cpfCnpj)
  const hasValidOptionalCpfCnpj =
    sanitizedCpfCnpj.length === 0 || /^\d{11}$|^\d{14}$/.test(sanitizedCpfCnpj)
  const canSubmit =
    values.fullName.trim().length >= 2 &&
    /^\d{10,11}$/.test(sanitizePhone(values.phone)) &&
    (mode === "edit" || Boolean(values.leadId)) &&
    hasValidOptionalCpfCnpj &&
    (!(isExternalPaid || isExternalBilling) || isValidEmail(values.email.trim())) &&
    (isExternalBilling || values.billingType === "PIX" || values.billingType === "CREDIT_CARD") &&
    !isSubmitting

  useEffect(() => {
    if (!open) return

    setResult(null)
    setValues(mode === "edit" && adhesion ? valuesFromAdhesion(adhesion) : defaultValues())
    setIsLoadingOptions(true)
    service
      .getOptions()
      .then(setOptions)
      .catch((err) => {
        console.error("[BackofficeAdhesionDialog][options]", err)
        toast.error(err instanceof Error ? err.message : "Erro ao carregar opções")
      })
      .finally(() => setIsLoadingOptions(false))
  }, [adhesion, mode, open, service])

  function updateValue<K extends keyof BackofficeAdhesionFormValues>(
    key: K,
    value: BackofficeAdhesionFormValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function handleLeadChange(leadId: string) {
    const lead = options?.leads.find((item) => item.id === leadId) ?? null
    setValues((current) => ({
      ...current,
      leadId,
      fullName: lead?.name ?? current.fullName,
      phone: sanitizePhone(lead?.phone ?? current.phone),
      email: lead?.email ?? current.email,
      cpfCnpj: lead?.cpfCnpj ? sanitizeCpfCnpj(lead.cpfCnpj) : current.cpfCnpj,
      sdrBackofficeUserId: lead?.sdrBackofficeUserId ?? current.sdrBackofficeUserId,
      closerBackofficeUserId: lead?.closerBackofficeUserId ?? current.closerBackofficeUserId,
    }))
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url)
    toast.success("Link copiado")
  }

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return
    setIsSubmitting(true)
    try {
      if (mode === "edit" && adhesion) {
        await service.update(adhesion.id, {
          fullName: values.fullName.trim(),
          phone: sanitizePhone(values.phone),
          email: values.email.trim().toLowerCase(),
          cpfCnpj: sanitizeCpfCnpj(values.cpfCnpj),
          cycle: values.cycle,
          extraTeams: values.extraTeams,
          extraUsers: values.extraUsers,
          billingType: values.billingType,
          activationMode: values.billingType === "EXTERNAL" ? "external_paid" : "checkout",
          sdrBackofficeUserId: values.sdrBackofficeUserId,
          closerBackofficeUserId: values.closerBackofficeUserId,
        })
        toast.success("Adesão atualizada")
        await onSaved?.()
        onOpenChange(false)
        return
      }

      const created = await service.create({
        ...values,
        fullName: values.fullName.trim(),
        phone: sanitizePhone(values.phone),
        email: values.email.trim().toLowerCase(),
        cpfCnpj: sanitizeCpfCnpj(values.cpfCnpj),
        billingType: chargeBillingType,
      })
      setResult(created)
      await onSaved?.()
    } catch (err) {
      if (!(err instanceof BackofficeAdhesionsRequestError && err.isValidationError)) {
        console.error("[BackofficeAdhesionDialog][submit]", err)
      }
      toast.error(err instanceof Error ? err.message : "Erro ao salvar adesão")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isSubmitting) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar adesão" : "Nova adesão"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Ajuste os dados comerciais enquanto a adesão ainda não foi paga."
              : "Selecione um lead elegível e escolha o tipo de ativação."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
            <div className="rounded-md border p-4">
              {result.publicUrl ? (
                <>
                  <Label>Link público</Label>
                  <div className="mt-2 flex gap-2">
                    <Input value={result.publicUrl} readOnly />
                    <Button type="button" size="icon" onClick={() => copyLink(result.publicUrl!)}>
                      <Copy data-icon="inline-start" />
                      <span className="sr-only">Copiar link</span>
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Expira em {new Date(result.expiresAt).toLocaleString("pt-BR")}.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Adesão ativada</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    O cliente recebeu o e-mail para definir senha e acessar o Corretor Studio.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="dialog-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
            {mode === "create" ? (
              <div className="flex flex-col gap-2">
                <Label>Lead *</Label>
                <Select
                  value={values.leadId || NO_SELECTION_VALUE}
                  onValueChange={(value) =>
                    handleLeadChange(value === NO_SELECTION_VALUE ? "" : value)
                  }
                  disabled={isLoadingOptions || isSubmitting}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lead elegível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_SELECTION_VALUE}>Selecione um lead</SelectItem>
                      {(options?.leads ?? []).map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Disponíveis: Nova oportunidade, Agendado e No-show.
                </p>
              </div>
            ) : null}

            {mode === "create" ? (
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <Label htmlFor="adhesion-external-paid">Pago por fora</Label>
                  <p className="text-xs text-muted-foreground">
                    Cria a conta e envia o acesso sem gerar checkout Asaas.
                  </p>
                </div>
                <Switch
                  id="adhesion-external-paid"
                  checked={isExternalPaid}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => {
                    setValues((current) => ({
                      ...current,
                      activationMode: checked ? "external_paid" : "checkout",
                      billingType: resolveChargeBillingType(current.billingType),
                    }))
                  }}
                />
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="adhesion-full-name">Nome completo *</Label>
                <Input
                  id="adhesion-full-name"
                  value={values.fullName}
                  onChange={(event) => updateValue("fullName", event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adhesion-phone">Telefone *</Label>
                <Input
                  id="adhesion-phone"
                  placeholder="(99) 99999-9999"
                  value={maskPhone(values.phone)}
                  onChange={(event) => updateValue("phone", sanitizePhone(event.target.value))}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="adhesion-email">E-mail{isExternalPaid || isExternalBilling ? " *" : ""}</Label>
                <Input
                  id="adhesion-email"
                  value={values.email}
                  onChange={(event) => updateValue("email", event.target.value)}
                  disabled={isSubmitting}
                  required={isExternalPaid || isExternalBilling}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adhesion-cpf-cnpj">Documento</Label>
                <Input
                  id="adhesion-cpf-cnpj"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={formatDocumentInput(values.cpfCnpj)}
                  onChange={(event) =>
                    updateValue("cpfCnpj", sanitizeCpfCnpj(event.target.value))
                  }
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>SDR</Label>
                <Select
                  value={values.sdrBackofficeUserId ?? NO_SELECTION_VALUE}
                  onValueChange={(value) =>
                    updateValue("sdrBackofficeUserId", value === NO_SELECTION_VALUE ? null : value)
                  }
                  disabled={isSubmitting || isLoadingOptions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o SDR" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_SELECTION_VALUE}>Sem SDR</SelectItem>
                      {(options?.sdrOptions ?? []).map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Closer</Label>
                <Select
                  value={values.closerBackofficeUserId ?? NO_SELECTION_VALUE}
                  onValueChange={(value) =>
                    updateValue(
                      "closerBackofficeUserId",
                      value === NO_SELECTION_VALUE ? null : value,
                    )
                  }
                  disabled={isSubmitting || isLoadingOptions}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o closer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_SELECTION_VALUE}>Sem closer</SelectItem>
                      {(options?.closerOptions ?? []).map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Plano</Label>
                <div className="flex h-10 items-center rounded-md border px-3">
                  <Badge variant="secondary">CRM</Badge>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Ciclo *</Label>
                <Select
                  value={values.cycle}
                  onValueChange={(value) =>
                    updateValue("cycle", value as BackofficeAdhesionBillingCycleKey)
                  }
                  disabled={isSubmitting}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(BACKOFFICE_ADHESION_CYCLE_LABELS).map(([cycle, label]) => (
                        <SelectItem key={cycle} value={cycle}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Forma de pagamento *</Label>
              <RadioGroup
                value={mode === "edit" ? (values.billingType ?? "PIX") : chargeBillingType}
                onValueChange={(value) => {
                  if (value === "EXTERNAL") {
                    updateValue("billingType", "EXTERNAL")
                    return
                  }
                  updateValue("billingType", value === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX")
                }}
                className="grid gap-3 rounded-md border p-3 sm:grid-cols-2"
                disabled={isSubmitting}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="PIX" id="adhesion-billing-pix" />
                  <Label htmlFor="adhesion-billing-pix">PIX</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="CREDIT_CARD" id="adhesion-billing-card" />
                  <Label htmlFor="adhesion-billing-card">Cartão de crédito</Label>
                </div>
                {mode === "edit" ? (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="EXTERNAL" id="adhesion-billing-external" />
                    <Label htmlFor="adhesion-billing-external">Pagamento externo</Label>
                  </div>
                ) : null}
              </RadioGroup>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <NumberStepper
                label="Mais times"
                value={values.extraTeams}
                onChange={(value) => updateValue("extraTeams", value)}
                disabled={isSubmitting}
              />
              <NumberStepper
                label="Usuários adicionais"
                value={values.extraUsers}
                onChange={(value) => updateValue("extraUsers", value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Resumo comercial</p>
                  <p className="text-xs text-muted-foreground">
                    {BACKOFFICE_ADHESION_CYCLE_LABELS[values.cycle]} com cobrança
                    {isExternalPaid ? " paga por fora." : " antecipada."}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {isExternalPaid ? "Total pago por fora" : "Total do checkout"}
                  </p>
                  <p className="text-lg font-semibold">{formatCurrency(total)}</p>
                </div>
              </div>
              <div className="mt-4 divide-y rounded-md border bg-background/60">
                {commercialItems.map((item) => (
                  <div
                    key={item.key}
                    className="grid gap-3 p-3 text-sm md:grid-cols-[minmax(0,1fr)_7rem_8rem]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{item.name}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:block md:text-right">
                      <span className="text-xs text-muted-foreground md:hidden">Qtd.</span>
                      <span>{item.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:block md:text-right">
                      <span className="text-xs text-muted-foreground md:hidden">Mensal</span>
                      <div>
                        <p className="font-medium">{formatCurrency(item.monthlyTotal)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.monthlyUnitPrice)}/mês
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>PIX: {formatCurrency(pixTotal)}</span>
                <span>Cartão: {formatCurrency(cardTotal)}</span>
                <span>
                  Ciclo: {cycleMonths}{" "}
                  {cycleMonths === 1 ? "mês" : "meses"}
                </span>
              </div>
              {selectedLead ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Lead vinculado: {selectedLead.name}
                </p>
              ) : null}
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result ? (
            <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
              {isSubmitting
                ? "Salvando..."
                : mode === "edit"
                  ? "Salvar"
                  : isExternalPaid
                    ? "Criar conta e enviar acesso"
                    : "Gerar nova adesão"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
