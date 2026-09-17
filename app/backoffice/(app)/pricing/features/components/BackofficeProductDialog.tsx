"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { Plus, Trash2 } from "lucide-react"
import { useBackofficePricing } from "../context/BackofficePricingContext"
import type {
  BackofficeAdhesionBillingCycleKey,
  BackofficeProductBillingMode,
  BackofficeProductFormData,
  BackofficeProductType,
  InstallmentGroup,
} from "../context/BackofficePricingTypes"
import { BILLING_CYCLE_META, flattenSchedule } from "../context/BackofficePricingTypes"
import { parseBrazilianCurrency } from "../utils/currencyInput"
import { CurrencyField } from "./CurrencyField"

function hasPositivePrice(value: string): boolean {
  const parsed = parseBrazilianCurrency(value)
  return parsed != null && parsed > 0
}

function parsePrice(value: string): number {
  return parseBrazilianCurrency(value) ?? 0
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function scheduleTotal(groups: InstallmentGroup[]): number {
  return flattenSchedule(groups).reduce((s, v) => s + v, 0)
}

function isScheduleValid(groups: InstallmentGroup[]): boolean {
  return (
    groups.length >= 1 &&
    groups.every((g) => {
      const count = parseInt(g.count, 10)
      const value = parseBrazilianCurrency(g.value)
      return count >= 1 && value != null && value > 0
    })
  )
}

function isCycleValid(
  formData: BackofficeProductFormData,
  key: BackofficeAdhesionBillingCycleKey
): boolean {
  const entry = formData.paymentRules[key]
  if (!hasPositivePrice(entry.pixPrice)) return false
  if (entry.installmentSplitMode === "CUSTOM") {
    return isScheduleValid(entry.installmentSchedule)
  }
  return hasPositivePrice(entry.cardPrice)
}

function canSubmit(formData: BackofficeProductFormData): boolean {
  if (!formData.name.trim() || formData.featureSlugs.length === 0) return false
  if (formData.billingMode === "RECURRING") {
    if (formData.activeCycles.length === 0) return false
    return formData.activeCycles.every((key) => isCycleValid(formData, key))
  }
  return !formData.priceLifetime || hasPositivePrice(formData.priceLifetime)
}

function submitBlockedReason(formData: BackofficeProductFormData): string | null {
  if (!formData.name.trim()) return "Informe o nome da precificação."
  if (formData.featureSlugs.length === 0) return "Selecione ao menos uma funcionalidade."
  if (formData.billingMode === "LIFETIME") {
    if (formData.priceLifetime && !hasPositivePrice(formData.priceLifetime)) {
      return "Informe um preço vitalício válido ou deixe em branco."
    }
    return null
  }
  if (formData.activeCycles.length === 0) {
    return "Adicione ao menos um ciclo com preço."
  }
  for (const key of formData.activeCycles) {
    const entry = formData.paymentRules[key]
    const label = BILLING_CYCLE_META.find((c) => c.key === key)?.label ?? key
    if (!hasPositivePrice(entry.pixPrice)) {
      return `Complete o PIX do ciclo ${label}.`
    }
    if (entry.installmentSplitMode === "CUSTOM") {
      if (!isScheduleValid(entry.installmentSchedule)) {
        return `Complete o cronograma de parcelas do ciclo ${label}.`
      }
    } else if (!hasPositivePrice(entry.cardPrice)) {
      return `Complete o valor no cartão do ciclo ${label}.`
    }
  }
  return null
}

export function BackofficeProductDialog() {
  const {
    dialogOpen,
    dialogMode,
    closeDialog,
    formData,
    availableFeatureSlugs,
    isSaving,
    setFormField,
    toggleFeatureSlug,
    setPaymentRuleField,
    setInstallmentSplitMode,
    setInstallmentGroup,
    addInstallmentGroup,
    removeInstallmentGroup,
    addActiveCycle,
    removeActiveCycle,
    submitForm,
  } = useBackofficePricing()
  const isRecurring = formData.billingMode === "RECURRING"
  const submitDisabled = isSaving || !canSubmit(formData)
  const blockedReason = submitDisabled && !isSaving ? submitBlockedReason(formData) : null
  const availableToAdd = BILLING_CYCLE_META.filter(
    (cycle) => !formData.activeCycles.includes(cycle.key)
  )

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {dialogMode === "create" && "Nova precificação"}
            {dialogMode === "duplicate" && "Duplicar precificação"}
            {dialogMode === "edit" && "Editar precificação"}
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-1">
            <span>Defina nome, funcionalidade e pelo menos um ciclo com preço.</span>
            <span>Ciclos sem preço não entram na adesão.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="dialog-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-name">Nome *</Label>
              <Input
                id="product-name"
                value={formData.name}
                disabled={isSaving}
                onChange={(event) => setFormField("name", event.target.value)}
                placeholder="Ex.: CRM - Radar"
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label>Slugs da funcionalidade *</Label>
              {dialogMode === "edit" ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {formData.featureSlugs.map((slug) => (
                      <Badge key={slug} variant="outline" className="font-mono text-xs">
                        {slug}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Os slugs não podem ser alterados após a criação.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-md border p-3">
                    {availableFeatureSlugs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma funcionalidade disponível</p>
                    ) : (
                      availableFeatureSlugs.map((slug) => {
                        const checked = formData.featureSlugs.includes(slug)
                        return (
                          <label
                            key={slug}
                            htmlFor={`feature-slug-${slug}`}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              id={`feature-slug-${slug}`}
                              checked={checked}
                              disabled={isSaving}
                              onCheckedChange={() => toggleFeatureSlug(slug)}
                            />
                            <span className="font-mono text-xs">{slug}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Um pacote pode liberar vários slugs (ex.: CRM + Radar). Várias precificações
                    podem incluir o mesmo slug.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="product-description">Descrição</Label>
            <Textarea
              id="product-description"
              value={formData.description}
              disabled={isSaving}
              onChange={(event) => setFormField("description", event.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                disabled={isSaving}
                onValueChange={(value) => setFormField("type", value as BackofficeProductType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="PLAN">Plano</SelectItem>
                    <SelectItem value="ADDON">Add-on</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Modo</Label>
              <Select
                value={formData.billingMode}
                disabled={isSaving}
                onValueChange={(value) =>
                  setFormField("billingMode", value as BackofficeProductBillingMode)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="RECURRING">Parcelado / recorrente</SelectItem>
                    <SelectItem value="LIFETIME">Vitalício</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="product-default"
                checked={formData.isDefault}
                disabled={isSaving}
                onCheckedChange={(checked) => setFormField("isDefault", checked)}
              />
              <Label htmlFor="product-default">Precificação padrão do slug</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="product-active"
                checked={formData.isActive}
                disabled={isSaving}
                onCheckedChange={(checked) => setFormField("isActive", checked)}
              />
              <Label htmlFor="product-active">Precificação ativa</Label>
            </div>
          </div>

          {isRecurring ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-sm font-medium">Ciclos desta precificação</Label>
                <p className="text-xs text-muted-foreground">
                  Adicione só os ciclos que farão parte desta tabela. Exemplo: apenas trimestral.
                </p>
              </div>

              {availableToAdd.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableToAdd.map((cycle) => (
                    <Button
                      key={cycle.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => addActiveCycle(cycle.key)}
                    >
                      <Plus data-icon="inline-start" />
                      {cycle.label}
                    </Button>
                  ))}
                </div>
              ) : null}

              {formData.activeCycles.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum ciclo adicionado. Use os botões acima para incluir Mensal, Trimestral,
                  Quadrimestral, Semestral ou Anual.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {BILLING_CYCLE_META.filter((cycle) =>
                    formData.activeCycles.includes(cycle.key)
                  ).map(({ key, label, months }) => {
                    const entry = formData.paymentRules[key]
                    const isCustom = entry.installmentSplitMode === "CUSTOM"
                    const pixPrice = parsePrice(entry.pixPrice)
                    const cardTotal = isCustom
                      ? scheduleTotal(entry.installmentSchedule)
                      : parsePrice(entry.cardPrice) * months
                    const cardMonthly = isCustom
                      ? cardTotal > 0
                        ? cardTotal / months
                        : 0
                      : parsePrice(entry.cardPrice)
                    const totalPix = pixPrice * months

                    return (
                      <div key={key} className="flex flex-col gap-3 rounded-md border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{label}</p>
                            {isCustom ? <Badge variant="secondary">Valores diferentes</Badge> : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isSaving}
                            onClick={() => removeActiveCycle(key)}
                          >
                            <Trash2 data-icon="inline-start" />
                            Remover ciclo
                          </Button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor={`${key}-pix`}>Valor no PIX (por mês) *</Label>
                            <CurrencyField
                              id={`${key}-pix`}
                              placeholder="R$ 0,00"
                              value={entry.pixPrice}
                              disabled={isSaving}
                              onValueChange={(value) => setPaymentRuleField(key, "pixPrice", value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Total PIX: {totalPix > 0 ? formatCurrency(totalPix) : "—"}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Parcelamento no cartão</Label>
                            <ToggleGroup
                              type="single"
                              variant="outline"
                              size="sm"
                              className="justify-start"
                              value={entry.installmentSplitMode}
                              disabled={isSaving}
                              onValueChange={(value) => {
                                if (value === "EQUAL" || value === "CUSTOM") {
                                  setInstallmentSplitMode(key, value)
                                }
                              }}
                            >
                              <ToggleGroupItem value="EQUAL">Parcelas iguais</ToggleGroupItem>
                              <ToggleGroupItem value="CUSTOM">Valores diferentes</ToggleGroupItem>
                            </ToggleGroup>
                            <p className="text-xs text-muted-foreground">
                              {isCustom
                                ? "Cliente só pode pagar à vista ou exatamente este cronograma."
                                : "Cliente escolhe de 1 até N parcelas de mesmo valor."}
                            </p>
                          </div>
                        </div>

                        {!isCustom ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                              <Label htmlFor={`${key}-card`}>Valor no cartão (por mês do ciclo) *</Label>
                              <CurrencyField
                                id={`${key}-card`}
                                placeholder="R$ 0,00"
                                value={entry.cardPrice}
                                disabled={isSaving}
                                onValueChange={(value) =>
                                  setPaymentRuleField(key, "cardPrice", value)
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                Total no cartão: {cardTotal > 0 ? formatCurrency(cardTotal) : "—"}
                              </p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor={`${key}-max`}>Máximo de parcelas</Label>
                              <Input
                                id={`${key}-max`}
                                inputMode="numeric"
                                value={entry.maxInstallments}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPaymentRuleField(
                                    key,
                                    "maxInstallments",
                                    e.target.value.replace(/\D/g, "")
                                  )
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 rounded-md bg-muted/30 p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              Cronograma de parcelas — {label}
                            </p>
                            <div className="flex flex-col gap-2">
                              {entry.installmentSchedule.map((group, idx) => (
                                <div key={idx} className="flex flex-wrap items-center gap-2">
                                  <Input
                                    className="h-8 w-16"
                                    inputMode="numeric"
                                    placeholder="Nº"
                                    aria-label={`Quantidade do grupo ${idx + 1}`}
                                    value={group.count}
                                    disabled={isSaving}
                                    onChange={(e) =>
                                      setInstallmentGroup(
                                        key,
                                        idx,
                                        "count",
                                        e.target.value.replace(/\D/g, "")
                                      )
                                    }
                                  />
                                  <span className="text-xs text-muted-foreground">×</span>
                                  <CurrencyField
                                    className="h-8 w-28"
                                    placeholder="R$ 0,00"
                                    aria-label={`Valor do grupo ${idx + 1}`}
                                    value={group.value}
                                    disabled={isSaving}
                                    onValueChange={(value) =>
                                      setInstallmentGroup(key, idx, "value", value)
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={isSaving || entry.installmentSchedule.length === 1}
                                    aria-label={`Remover grupo ${idx + 1}`}
                                    onClick={() => removeInstallmentGroup(key, idx)}
                                  >
                                    <Trash2 />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isSaving}
                                onClick={() => addInstallmentGroup(key)}
                              >
                                <Plus data-icon="inline-start" />
                                Adicionar grupo
                              </Button>
                              <p className="text-xs text-muted-foreground">
                                Total no cartão:{" "}
                                <span
                                  className={cn(
                                    "font-medium",
                                    cardTotal > 0 ? "text-foreground" : "text-muted-foreground"
                                  )}
                                >
                                  {cardTotal > 0 ? formatCurrency(cardTotal) : "—"}
                                </span>
                                {cardMonthly > 0 ? ` (${formatCurrency(cardMonthly)}/mês)` : null}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-lifetime">Preço vitalício</Label>
              <CurrencyField
                id="product-lifetime"
                placeholder="R$ 0,00"
                value={formData.priceLifetime}
                disabled={isSaving}
                onValueChange={(value) => setFormField("priceLifetime", value)}
              />
            </div>
          )}
        </div>

        <Separator />
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col">
          {blockedReason ? (
            <p className="text-xs text-muted-foreground">{blockedReason}</p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={isSaving} onClick={closeDialog}>
              Cancelar
            </Button>
            <Button type="button" disabled={submitDisabled} onClick={submitForm}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
