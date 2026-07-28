"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronsUpDown, Copy, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import type { IBackofficeAdhesionsService } from "../services/IBackofficeAdhesionsService"
import { BackofficeAdhesionsRequestError } from "../services/BackofficeAdhesionsService"
import {
  BACKOFFICE_ADHESION_CYCLE_LABELS,
  type BackofficeAdhesionAdditionalTeam,
  type BackofficeAdhesionAdditionalUser,
  type BackofficeAdhesionBillingCycleKey,
  type BackofficeAdhesionCreationResult,
  type BackofficeAdhesionFormValues,
  type BackofficeAdhesionItem,
  type BackofficeAdhesionOptions,
} from "../context/BackofficeAdhesionsTypes"
import { formatDocumentInput, maskPhone } from "@/lib/masks"
import { scaleInstallmentScheduleToTotal } from "@/lib/backoffice-adhesions/adhesion-pricing"

const NO_SELECTION_VALUE = "__none__"
const CYCLE_MONTHS: Record<BackofficeAdhesionBillingCycleKey, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}
const CYCLE_DAYS: Record<BackofficeAdhesionBillingCycleKey, number> = {
  monthly: 30,
  quarterly: 90,
  semiannual: 180,
  annual: 365,
}
const MEMBER_PRO_MIN_DAYS = 1
const MEMBER_PRO_MAX_DAYS = 365
const MEMBER_PRO_DAY_MS = 24 * 60 * 60 * 1000

function parsePositiveInt(value: string): number | null {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
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

const ROLE_LABELS: Record<BackofficeAdhesionAdditionalUser["role"], string> = {
  manager: "Gerente",
  backoffice: "Backoffice",
  operator: "Operador",
}

function defaultAdditionalUser(): BackofficeAdhesionAdditionalUser {
  return { name: "", email: "", role: "operator", functions: [] }
}

function defaultAdditionalTeam(): BackofficeAdhesionAdditionalTeam {
  return { name: "" }
}

function syncArrayLength<T>(arr: T[], length: number, factory: () => T): T[] {
  if (arr.length === length) return arr
  if (arr.length > length) return arr.slice(0, length)
  return [...arr, ...Array.from({ length: length - arr.length }, factory)]
}

function defaultValues(): BackofficeAdhesionFormValues {
  return {
    leadId: "",
    fullName: "",
    phone: "",
    email: "",
    cpfCnpj: "",
    productId: "",
    cycle: "monthly",
    extraTeams: 0,
    extraUsers: 0,
    billingType: "PIX",
    sdrBackofficeUserId: null,
    closerBackofficeUserId: null,
    activationMode: "checkout",
    externalInstallmentIndexes: [],
    userType: "common",
    memberProAccessDays: "",
    sponsorMasterId: null,
    multiskillEnabled: false,
    hasUnlimitedUsers: false,
    additionalUsers: [],
    additionalTeams: [],
  }
}

function valuesFromAdhesion(adhesion: BackofficeAdhesionItem): BackofficeAdhesionFormValues {
  return {
    leadId: adhesion.leadId,
    fullName: adhesion.fullName,
    phone: adhesion.phone,
    email: adhesion.email ?? "",
    cpfCnpj: adhesion.cpfCnpj ?? "",
    productId: adhesion.productId ?? "",
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
    externalInstallmentIndexes: [],
    userType: "common",
    memberProAccessDays: "",
    sponsorMasterId: null,
    multiskillEnabled: adhesion.multiskillEnabled ?? false,
    hasUnlimitedUsers: adhesion.hasUnlimitedUsers === true || adhesion.cycle === "annual",
    additionalUsers: [],
    additionalTeams: [],
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

const USER_TYPE_LABELS: Record<BackofficeAdhesionFormValues["userType"], string> = {
  common: "Comum",
  member_pro: "Member PRO",
  associate: "Associado",
  guest: "Convidado",
}

type CreateDialogStep = "form" | "review"

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
  const [leadComboOpen, setLeadComboOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateDialogStep>("form")

  const selectedLead = useMemo(
    () => options?.leads.find((lead) => lead.id === values.leadId) ?? null,
    [options?.leads, values.leadId]
  )
  const selectedVariant = useMemo(() => {
    if (!options?.productVariants.length) return null
    return (
      options.productVariants.find((variant) => variant.id === values.productId) ??
      options.productVariants.find((variant) => variant.isDefault) ??
      options.productVariants[0]
    )
  }, [options?.productVariants, values.productId])

  const addonCyclePrices = options?.pricing.cycles[values.cycle] ?? {
    baseMonthlyPrice: 0,
    extraTeamPrice: 0,
    extraUserPrice: 0,
    pixBaseMonthlyPrice: null,
    cardBaseMonthlyPrice: null,
  }
  const variantCyclePrices = selectedVariant?.pricesByCycle[values.cycle]
  const availableCycles =
    selectedVariant?.availableCycles?.length
      ? selectedVariant.availableCycles
      : (Object.keys(BACKOFFICE_ADHESION_CYCLE_LABELS) as BackofficeAdhesionBillingCycleKey[])
  const installmentMeta = selectedVariant?.installmentByCycle?.[values.cycle]
  const cyclePrices = {
    baseMonthlyPrice:
      variantCyclePrices?.cardMonthlyPrice ?? addonCyclePrices.baseMonthlyPrice,
    extraTeamPrice: addonCyclePrices.extraTeamPrice,
    extraUserPrice: addonCyclePrices.extraUserPrice,
    pixBaseMonthlyPrice:
      variantCyclePrices?.pixMonthlyPrice ?? addonCyclePrices.pixBaseMonthlyPrice,
    cardBaseMonthlyPrice:
      variantCyclePrices?.cardMonthlyPrice ?? addonCyclePrices.cardBaseMonthlyPrice,
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
  const chargeTotal = chargeBillingType === "PIX" ? pixTotal : cardTotal
  const installmentPreview: number[] = (() => {
    if (installmentMeta?.splitMode === "CUSTOM" && installmentMeta.schedule.length > 0) {
      return scaleInstallmentScheduleToTotal(installmentMeta.schedule, chargeTotal)
    }
    if (installmentMeta && installmentMeta.maxInstallments > 1) {
      return scaleInstallmentScheduleToTotal(
        Array.from({ length: installmentMeta.maxInstallments }, () => 1),
        chargeTotal
      )
    }
    if (chargeTotal > 0) return [Number(chargeTotal.toFixed(2))]
    return []
  })()
  const selectedBaseMonthly = chargeBillingType === "PIX" ? pixBaseMonthly : cardBaseMonthly
  const total = chargeTotal
  const commercialItems = [
    {
      key: "crm",
      name: selectedVariant?.name ?? "CRM",
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
  const isMemberPro = values.userType === "member_pro"
  const isAssociate = values.userType === "associate"
  const isGuest = values.userType === "guest"
  const needsSponsor = isAssociate || isGuest
  const memberProAccessDaysValue = parsePositiveInt(values.memberProAccessDays)
  const memberProAccessDaysValid =
    !isMemberPro ||
    (memberProAccessDaysValue !== null &&
      memberProAccessDaysValue >= MEMBER_PRO_MIN_DAYS &&
      memberProAccessDaysValue <= MEMBER_PRO_MAX_DAYS)
  const isDocRequired = mode === "create" && !isGuest || isExternalBilling
  const canSubmit =
    values.fullName.trim().length >= 2 &&
    (sanitizePhone(values.phone).length === 0 || /^\d{10,11}$/.test(sanitizePhone(values.phone))) &&
    (mode === "edit" || Boolean(values.leadId)) &&
    (!isDocRequired ? hasValidOptionalCpfCnpj : /^\d{11}$|^\d{14}$/.test(sanitizedCpfCnpj)) &&
    (!(isExternalPaid || isExternalBilling || isGuest) || isValidEmail(values.email.trim())) &&
    (isGuest || isExternalBilling || values.billingType === "PIX" || values.billingType === "CREDIT_CARD") &&
    (mode === "edit" || memberProAccessDaysValid) &&
    (!needsSponsor || Boolean(values.sponsorMasterId)) &&
    !isSubmitting

  useEffect(() => {
    if (!open) return

    setResult(null)
    setCreateStep("form")
    setValues(mode === "edit" && adhesion ? valuesFromAdhesion(adhesion) : defaultValues())
    setIsLoadingOptions(true)
    service
      .getOptions()
      .then((loaded) => {
        setOptions(loaded)
        const defaultVariant =
          loaded.productVariants.find((variant) => variant.isDefault) ??
          loaded.productVariants[0]
        if (mode === "create" && defaultVariant) {
          setValues((current) =>
            current.productId ? current : { ...current, productId: defaultVariant.id }
          )
        } else if (mode === "edit" && adhesion && !adhesion.productId && defaultVariant) {
          setValues((current) => ({ ...current, productId: defaultVariant.id }))
        }
      })
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
    setValues((current) => {
      const next = { ...current, [key]: value }
      if (key === "extraUsers") {
        next.additionalUsers = syncArrayLength(
          current.additionalUsers,
          value as number,
          defaultAdditionalUser
        )
      }
      if (key === "extraTeams") {
        next.additionalTeams = syncArrayLength(
          current.additionalTeams,
          value as number,
          defaultAdditionalTeam
        )
      }
      if (key === "productId") {
        const variant = options?.productVariants.find((item) => item.id === value)
        const nextCycles = variant?.availableCycles ?? []
        if (nextCycles.length && !nextCycles.includes(current.cycle)) {
          next.cycle = nextCycles[0]
        }
        next.externalInstallmentIndexes = []
        next.activationMode = "checkout"
      }
      if (key === "cycle") {
        const cycle = value as BackofficeAdhesionBillingCycleKey
        if (current.userType === "member_pro") {
          next.memberProAccessDays = String(CYCLE_DAYS[cycle])
        }
        if (cycle === "annual" || current.userType === "member_pro") {
          next.hasUnlimitedUsers = true
        }
        next.externalInstallmentIndexes = []
      }
      if (key === "userType" && value === "member_pro") {
        next.memberProAccessDays = String(CYCLE_DAYS[current.cycle])
        next.hasUnlimitedUsers = true
      }
      if (key === "userType" && value !== "member_pro") {
        next.memberProAccessDays = ""
        if (current.cycle !== "annual") {
          next.hasUnlimitedUsers = current.hasUnlimitedUsers
        }
      }
      if (key === "userType" && value !== "associate" && value !== "guest") {
        next.sponsorMasterId = null
      }
      return next
    })
  }

  function updateAdditionalUser(
    index: number,
    field: keyof BackofficeAdhesionAdditionalUser,
    value: string | string[]
  ) {
    setValues((current) => {
      const users = [...current.additionalUsers]
      users[index] = { ...users[index], [field]: value }
      return { ...current, additionalUsers: users }
    })
  }

  function updateAdditionalTeam(index: number, name: string) {
    setValues((current) => {
      const teams = [...current.additionalTeams]
      teams[index] = { ...teams[index], name }
      return { ...current, additionalTeams: teams }
    })
  }

  function toggleAdditionalUserFunction(index: number, fn: "SDR" | "CLOSER") {
    setValues((current) => {
      const users = [...current.additionalUsers]
      const user = users[index]
      const has = user.functions.includes(fn)
      users[index] = {
        ...user,
        functions: has ? user.functions.filter((f) => f !== fn) : [...user.functions, fn],
      }
      return { ...current, additionalUsers: users }
    })
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

  function handleReview() {
    if (!canSubmit || isSubmitting || mode !== "create") return
    setCreateStep("review")
  }

  function handleBackToForm() {
    if (isSubmitting) return
    setCreateStep("form")
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
          productId: values.productId || undefined,
          cycle: values.cycle,
          extraTeams: values.extraTeams,
          extraUsers: values.extraUsers,
          billingType: values.billingType,
          activationMode: values.billingType === "EXTERNAL" ? "external_paid" : "checkout",
          sdrBackofficeUserId: values.sdrBackofficeUserId,
          closerBackofficeUserId: values.closerBackofficeUserId,
          hasUnlimitedUsers: values.cycle === "annual" || values.hasUnlimitedUsers,
        })
        toast.success("Adesão atualizada")
        await onSaved?.()
        onOpenChange(false)
        return
      }

      const accessExpiresAt =
        values.userType === "member_pro" && memberProAccessDaysValue !== null
          ? new Date(Date.now() + memberProAccessDaysValue * MEMBER_PRO_DAY_MS).toISOString()
          : null

      const created = await service.create({
        ...values,
        fullName: values.fullName.trim(),
        phone: sanitizePhone(values.phone),
        email: values.email.trim().toLowerCase(),
        cpfCnpj: sanitizeCpfCnpj(values.cpfCnpj),
        billingType: chargeBillingType,
        accessExpiresAt,
        activationMode:
          values.activationMode === "external_paid" ||
          values.externalInstallmentIndexes.length > 0
            ? "external_paid"
            : "checkout",
        externalInstallmentIndexes: values.externalInstallmentIndexes,
        hasUnlimitedUsers:
          values.cycle === "annual" ||
          values.userType === "member_pro" ||
          values.hasUnlimitedUsers,
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
          <DialogTitle>
            {mode === "edit"
              ? "Editar adesão"
              : createStep === "review"
                ? "Revisar nova adesão"
                : "Nova adesão"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Ajuste os dados comerciais enquanto a adesão ainda não foi paga."
              : createStep === "review"
                ? "Confira os dados e a cobrança antes de confirmar a criação."
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
        ) : mode === "create" && createStep === "review" ? (
          <div className="dialog-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Dados do cliente</p>
              <div className="grid gap-2 md:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Lead: </span>
                  {selectedLead?.name ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Nome: </span>
                  {values.fullName.trim() || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">E-mail: </span>
                  {values.email.trim() || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Telefone: </span>
                  {values.phone.trim() || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Documento: </span>
                  {values.cpfCnpj.trim() || "—"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Configuração da adesão</p>
              <div className="grid gap-2 md:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Plano: </span>
                  {selectedVariant?.name ?? "CRM"}
                </p>
                <p>
                  <span className="text-muted-foreground">Ciclo: </span>
                  {BACKOFFICE_ADHESION_CYCLE_LABELS[values.cycle]}
                </p>
                <p>
                  <span className="text-muted-foreground">Tipo de usuário: </span>
                  {USER_TYPE_LABELS[values.userType]}
                  {isMemberPro && memberProAccessDaysValue
                    ? ` (${memberProAccessDaysValue} dias)`
                    : ""}
                </p>
                <p>
                  <span className="text-muted-foreground">MultiSkill: </span>
                  {values.multiskillEnabled ? "Ativo" : "Inativo"}
                </p>
                <p>
                  <span className="text-muted-foreground">Usuários ilimitados: </span>
                  {values.cycle === "annual" ||
                  values.userType === "member_pro" ||
                  values.hasUnlimitedUsers
                    ? "Sim"
                    : "Não"}
                </p>
                <p>
                  <span className="text-muted-foreground">Pago por fora: </span>
                  {isExternalPaid ? "Sim" : "Não"}
                </p>
                {!isGuest && (
                  <p>
                    <span className="text-muted-foreground">Método: </span>
                    {chargeBillingType === "CREDIT_CARD" ? "Cartão" : "Pix"}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Cobrança</p>
              {isGuest ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Convidado: sem checkout e sem cobrança Asaas. A conta será ativada diretamente.
                </p>
              ) : isExternalPaid ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Pago por fora: sem cobrança Asaas. A conta será criada e o acesso enviado por
                  e-mail. Total comercial de referência: {formatCurrency(total)}.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Checkout: gera link público para o cliente pagar no Asaas. Total do checkout:{" "}
                  {formatCurrency(total)} ({BACKOFFICE_ADHESION_CYCLE_LABELS[values.cycle]}).
                </p>
              )}
            </div>

            {!isGuest && (
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
              </div>
            )}
          </div>
        ) : (
          <div className="dialog-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
            {mode === "create" ? (
              <div className="flex flex-col gap-2">
                <Label>Lead *</Label>
                <Popover open={leadComboOpen} onOpenChange={setLeadComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={leadComboOpen}
                      disabled={isLoadingOptions || isSubmitting}
                      className="w-full justify-between font-normal"
                    >
                      {values.leadId
                        ? (options?.leads.find((l) => l.id === values.leadId)?.name ?? "Selecione um lead elegível")
                        : "Selecione um lead elegível"}
                      <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar lead pelo nome..." />
                      <CommandList>
                        <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                        <CommandGroup>
                          {(options?.leads ?? []).map((lead) => (
                            <CommandItem
                              key={lead.id}
                              value={lead.name}
                              onSelect={() => {
                                handleLeadChange(lead.id)
                                setLeadComboOpen(false)
                              }}
                            >
                              <Check
                                className={cn("mr-2 size-4", values.leadId === lead.id ? "opacity-100" : "opacity-0")}
                              />
                              {lead.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Disponíveis: Nova oportunidade, Agendado, No-show e Nova adesão.
                </p>
              </div>
            ) : null}

            {mode === "create" && !isGuest ? (
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <Label htmlFor="adhesion-multiskill">MultiSkill (receber transferências)</Label>
                  <p className="text-xs text-muted-foreground">
                    Habilita o time padrão desta conta a receber leads transferidos pelo MultiSkill.
                  </p>
                </div>
                <Switch
                  id="adhesion-multiskill"
                  checked={values.multiskillEnabled}
                  disabled={isSubmitting}
                  onCheckedChange={(checked) => updateValue("multiskillEnabled", checked)}
                />
              </div>
            ) : null}

            {!isGuest ? (
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <Label htmlFor="adhesion-unlimited-users">Usuários ilimitados</Label>
                  <p className="text-xs text-muted-foreground">
                    Ciclo anual e Member PRO ativam automaticamente. Sem cobrança/checkout de usuários extras.
                  </p>
                </div>
                <Switch
                  id="adhesion-unlimited-users"
                  checked={values.cycle === "annual" || values.userType === "member_pro" || values.hasUnlimitedUsers}
                  disabled={
                    isSubmitting || values.cycle === "annual" || values.userType === "member_pro"
                  }
                  onCheckedChange={(checked) => updateValue("hasUnlimitedUsers", checked)}
                />
              </div>
            ) : null}

            {mode === "create" && !isGuest ? (
              <div className="flex flex-col gap-3 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="adhesion-external-paid">100% pago externamente</Label>
                    <p className="text-xs text-muted-foreground">
                      Marca todas as parcelas como pagas por fora, cria a conta e não gera checkout.
                    </p>
                  </div>
                  <Switch
                    id="adhesion-external-paid"
                    checked={
                      isExternalPaid ||
                      (installmentPreview.length > 0 &&
                        values.externalInstallmentIndexes.length === installmentPreview.length)
                    }
                    disabled={isSubmitting}
                    onCheckedChange={(checked) => {
                      setValues((current) => ({
                        ...current,
                        activationMode: checked ? "external_paid" : "checkout",
                        billingType: resolveChargeBillingType(current.billingType),
                        externalInstallmentIndexes: checked
                          ? installmentPreview.map((_, index) => index)
                          : [],
                      }))
                    }}
                  />
                </div>
                {installmentPreview.length > 0 ? (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Parcelas — marque as já pagas externamente. As demais geram cobrança Asaas e a
                      conta é ativada na criação.
                    </p>
                    <div className="flex flex-col gap-2">
                      {installmentPreview.map((amount, index) => {
                        const checked = values.externalInstallmentIndexes.includes(index)
                        return (
                          <label
                            key={index}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span>
                              Parcela {index + 1}: {formatCurrency(amount)}
                            </span>
                            <Switch
                              checked={checked}
                              disabled={isSubmitting}
                              onCheckedChange={(nextChecked) => {
                                setValues((current) => {
                                  const set = new Set(current.externalInstallmentIndexes)
                                  if (nextChecked) set.add(index)
                                  else set.delete(index)
                                  const indexes = Array.from(set).sort((a, b) => a - b)
                                  return {
                                    ...current,
                                    externalInstallmentIndexes: indexes,
                                    activationMode:
                                      indexes.length > 0 ? "external_paid" : "checkout",
                                  }
                                })
                              }}
                            />
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
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
                <Label htmlFor="adhesion-phone">Telefone</Label>
                <Input
                  id="adhesion-phone"
                  placeholder="(99) 99999-9999"
                  value={maskPhone(values.phone)}
                  onChange={(event) => updateValue("phone", sanitizePhone(event.target.value))}
                  disabled={isSubmitting}
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
                <Label htmlFor="adhesion-cpf-cnpj">Documento{isDocRequired ? " *" : ""}</Label>
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
                <Label>Plano / precificação</Label>
                {options?.productVariants.length ? (
                  <Select
                    value={values.productId}
                    onValueChange={(value) => updateValue("productId", value)}
                    disabled={isSubmitting || isLoadingOptions}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {options.productVariants.map((variant) => {
                          const prices = variant.pricesByCycle[values.cycle]
                          const displayPrice =
                            prices?.cardMonthlyPrice ?? prices?.pixMonthlyPrice ?? 0
                          return (
                            <SelectItem key={variant.id} value={variant.id}>
                              {variant.name}
                              {variant.isDefault ? " (padrão)" : ""}
                              {displayPrice > 0 ? ` — ${formatCurrency(displayPrice)}` : ""}
                            </SelectItem>
                          )
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-10 items-center rounded-md border px-3">
                    <Badge variant="secondary">CRM</Badge>
                  </div>
                )}
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
                      {availableCycles.map((cycle) => (
                        <SelectItem key={cycle} value={cycle}>
                          {BACKOFFICE_ADHESION_CYCLE_LABELS[cycle]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mode === "create" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Tipo de usuário</Label>
                  <Select
                    value={values.userType}
                    onValueChange={(value) =>
                      updateValue("userType", value as BackofficeAdhesionFormValues["userType"])
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="common">Comum</SelectItem>
                        <SelectItem value="member_pro">Member PRO</SelectItem>
                        <SelectItem value="associate">Associado</SelectItem>
                        <SelectItem value="guest">Convidado</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                {isMemberPro && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="adhesion-member-pro-days">Validade do acesso (dias) *</Label>
                    <Input
                      id="adhesion-member-pro-days"
                      type="number"
                      min={MEMBER_PRO_MIN_DAYS}
                      max={MEMBER_PRO_MAX_DAYS}
                      placeholder="Ex.: 30"
                      value={values.memberProAccessDays}
                      onChange={(event) => updateValue("memberProAccessDays", event.target.value)}
                      disabled={isSubmitting}
                    />
                    <p className="text-sm text-muted-foreground">
                      Calculado automaticamente pelo ciclo. Ajuste se necessário (entre {MEMBER_PRO_MIN_DAYS} e {MEMBER_PRO_MAX_DAYS} dias).
                    </p>
                    {values.memberProAccessDays.length > 0 && !memberProAccessDaysValid && (
                      <p className="text-sm text-destructive">Informe um número entre 1 e 365</p>
                    )}
                  </div>
                )}
                {needsSponsor && (
                  <div className="flex flex-col gap-2">
                    <Label>Patrocinador *</Label>
                    <Select
                      value={values.sponsorMasterId ?? ""}
                      onValueChange={(value) => updateValue("sponsorMasterId", value || null)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o patrocinador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(options?.sponsorOptions ?? []).map((sponsor) => (
                            <SelectItem key={sponsor.id} value={sponsor.id}>
                              {sponsor.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {mode === "create" && isGuest && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Conta gratuita — recursos ilimitados (times e usuários), sem cobrança.
              </div>
            )}

            {!isGuest && (
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
            )}

            {!isGuest && (
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
            )}

            {mode === "create" && values.extraUsers > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Usuários adicionais — dados opcionais</p>
                <p className="text-xs text-muted-foreground -mt-2">
                  Preencha para convidar os usuários já na criação da adesão.
                </p>
                {values.additionalUsers.map((user, index) => (
                  <div key={index} className="flex flex-col gap-3 rounded-md border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Usuário {index + 1}</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`add-user-name-${index}`}>Nome</Label>
                        <Input
                          id={`add-user-name-${index}`}
                          value={user.name}
                          onChange={(e) => updateAdditionalUser(index, "name", e.target.value)}
                          disabled={isSubmitting}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`add-user-email-${index}`}>E-mail</Label>
                        <Input
                          id={`add-user-email-${index}`}
                          type="email"
                          value={user.email}
                          onChange={(e) => updateAdditionalUser(index, "email", e.target.value)}
                          disabled={isSubmitting}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Papel</Label>
                      <Select
                        value={user.role}
                        onValueChange={(v) =>
                          updateAdditionalUser(
                            index,
                            "role",
                            v as BackofficeAdhesionAdditionalUser["role"]
                          )
                        }
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(Object.entries(ROLE_LABELS) as [BackofficeAdhesionAdditionalUser["role"], string][]).map(
                              ([role, label]) => (
                                <SelectItem key={role} value={role}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Atribuições</Label>
                      <div className="flex gap-4">
                        {(["SDR", "CLOSER"] as const).map((fn) => (
                          <div key={fn} className="flex items-center gap-2">
                            <Checkbox
                              id={`add-user-fn-${index}-${fn}`}
                              checked={user.functions.includes(fn)}
                              onCheckedChange={() => toggleAdditionalUserFunction(index, fn)}
                              disabled={isSubmitting}
                            />
                            <Label htmlFor={`add-user-fn-${index}-${fn}`}>{fn}</Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mode === "create" && values.extraTeams > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Times adicionais — dados opcionais</p>
                <p className="text-xs text-muted-foreground -mt-2">
                  Preencha para nomear os times já na criação da adesão.
                </p>
                {values.additionalTeams.map((team, index) => (
                  <div key={index} className="flex flex-col gap-3 rounded-md border p-3">
                    <p className="text-xs font-medium text-muted-foreground">Time {index + 1}</p>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`add-team-name-${index}`}>Nome do time</Label>
                      <Input
                        id={`add-team-name-${index}`}
                        value={team.name}
                        onChange={(e) => updateAdditionalTeam(index, e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Ex.: Time de Vendas"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isGuest && (
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
            )}
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          {result ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          ) : mode === "create" && createStep === "review" ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={handleBackToForm}
              >
                Voltar
              </Button>
              <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
                {isSubmitting
                  ? "Salvando..."
                  : isExternalPaid
                    ? "Criar conta e enviar acesso"
                    : "Gerar nova adesão"}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              {mode === "edit" ? (
                <Button type="button" disabled={!canSubmit} onClick={handleSubmit}>
                  {isSubmitting ? "Salvando..." : "Salvar"}
                </Button>
              ) : (
                <Button type="button" disabled={!canSubmit} onClick={handleReview}>
                  Revisar
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
