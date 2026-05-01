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
import type { IBackofficeAdhesionsService } from "../services/IBackofficeAdhesionsService"
import {
  BACKOFFICE_ADHESION_CYCLE_LABELS,
  type BackofficeAdhesionBillingCycleKey,
  type BackofficeAdhesionCreationResult,
  type BackofficeAdhesionFormValues,
  type BackofficeAdhesionItem,
  type BackofficeAdhesionOptions,
} from "../context/BackofficeAdhesionsTypes"

const NO_SELECTION_VALUE = "__none__"
const BASE_PRICE = 59.9
const EXTRA_TEAM_PRICE = 29.9
const EXTRA_USER_PRICE = 19.9
const CYCLE_MONTHS: Record<BackofficeAdhesionBillingCycleKey, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
}

function sanitizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

function defaultValues(): BackofficeAdhesionFormValues {
  return {
    leadId: "",
    fullName: "",
    phone: "",
    cycle: "monthly",
    extraTeams: 0,
    extraUsers: 0,
    sdrBackofficeUserId: null,
    closerBackofficeUserId: null,
  }
}

function valuesFromAdhesion(adhesion: BackofficeAdhesionItem): BackofficeAdhesionFormValues {
  return {
    leadId: adhesion.leadId,
    fullName: adhesion.fullName,
    phone: adhesion.phone,
    cycle: adhesion.cycle,
    extraTeams: adhesion.extraTeams,
    extraUsers: adhesion.extraUsers,
    sdrBackofficeUserId: adhesion.sdrBackofficeUserId,
    closerBackofficeUserId: adhesion.closerBackofficeUserId,
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
  const monthlyTotal =
    BASE_PRICE + values.extraTeams * EXTRA_TEAM_PRICE + values.extraUsers * EXTRA_USER_PRICE
  const total = monthlyTotal * CYCLE_MONTHS[values.cycle]
  const canSubmit =
    values.fullName.trim().length >= 2 &&
    /^\d{10,11}$/.test(sanitizePhone(values.phone)) &&
    (mode === "edit" || Boolean(values.leadId)) &&
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
          cycle: values.cycle,
          extraTeams: values.extraTeams,
          extraUsers: values.extraUsers,
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
      })
      setResult(created)
      await onSaved?.()
    } catch (err) {
      console.error("[BackofficeAdhesionDialog][submit]", err)
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
              : "Selecione um lead elegível e gere o link público de checkout."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-2">
            <div className="rounded-md border p-4">
              <Label>Link público</Label>
              <div className="mt-2 flex gap-2">
                <Input value={result.publicUrl} readOnly />
                <Button type="button" size="icon" onClick={() => copyLink(result.publicUrl)}>
                  <Copy data-icon="inline-start" />
                  <span className="sr-only">Copiar link</span>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Expira em {new Date(result.expiresAt).toLocaleString("pt-BR")}.
              </p>
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
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lead elegível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_SELECTION_VALUE}>
                        Selecione um lead
                      </SelectItem>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="adhesion-full-name">Nome completo *</Label>
                <Input
                  id="adhesion-full-name"
                  value={values.fullName}
                  onChange={(event) => updateValue("fullName", event.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="adhesion-phone">Celular *</Label>
                <Input
                  id="adhesion-phone"
                  value={values.phone}
                  onChange={(event) => updateValue("phone", sanitizePhone(event.target.value))}
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
                    updateValue(
                      "sdrBackofficeUserId",
                      value === NO_SELECTION_VALUE ? null : value
                    )
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
                      value === NO_SELECTION_VALUE ? null : value
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
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(BACKOFFICE_ADHESION_CYCLE_LABELS).map(
                        ([cycle, label]) => (
                          <SelectItem key={cycle} value={cycle}>
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
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
                    antecipada.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total do checkout</p>
                  <p className="text-lg font-semibold">{formatCurrency(total)}</p>
                </div>
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
                  : "Gerar nova adesão"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
