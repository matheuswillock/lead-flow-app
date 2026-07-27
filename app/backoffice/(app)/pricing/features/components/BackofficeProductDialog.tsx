"use client"

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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { Plus, X } from "lucide-react"
import { useBackofficePricing } from "../context/BackofficePricingContext"
import type {
  BackofficeAdhesionBillingCycleKey,
  BackofficeProductBillingMode,
  BackofficeProductFormData,
  BackofficeProductType,
  InstallmentGroup,
} from "../context/BackofficePricingTypes"
import { flattenSchedule } from "../context/BackofficePricingTypes"

const CYCLES: { key: BackofficeAdhesionBillingCycleKey; label: string; months: number; defaultMax: number }[] = [
  { key: "monthly", label: "Mensal", months: 1, defaultMax: 1 },
  { key: "quarterly", label: "Trimestral", months: 3, defaultMax: 3 },
  { key: "semiannual", label: "Semestral", months: 6, defaultMax: 6 },
  { key: "annual", label: "Anual", months: 12, defaultMax: 12 },
]

function normalizePriceInput(value: string): string {
  return value.replace(/[^\d,]/g, "").replace(",", ".")
}

function displayCurrencyInput(raw: string): string {
  const n = parseFloat(raw.replace(",", "."))
  if (!isFinite(n) || n <= 0) return raw
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parseCurrencyInput(display: string): string {
  return normalizePriceInput(display.replace(/^R\$\s*/, ""))
}

function hasPositivePrice(value: string): boolean {
  const parsed = Number.parseFloat(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0
}

function parsePrice(value: string): number {
  return Number.parseFloat(value.replace(",", ".")) || 0
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function scheduleTotal(groups: InstallmentGroup[]): number {
  return flattenSchedule(groups).reduce((s, v) => s + v, 0)
}

function isScheduleValid(groups: InstallmentGroup[]): boolean {
  return groups.every((g) => {
    const count = parseInt(g.count, 10)
    const value = parseFloat(g.value.replace(",", "."))
    return count >= 1 && isFinite(value) && value > 0
  }) && groups.length >= 1
}

function canSubmit(formData: BackofficeProductFormData): boolean {
  if (!formData.name.trim() || !formData.featureSlug.trim()) return false
  if (formData.billingMode === "RECURRING") {
    return CYCLES.every(({ key }) => {
      const entry = formData.paymentRules[key]
      if (!hasPositivePrice(entry.pixPrice)) return false
      if (entry.installmentSplitMode === "CUSTOM") {
        return isScheduleValid(entry.installmentSchedule)
      }
      return hasPositivePrice(entry.cardPrice)
    })
  }
  return !formData.priceLifetime || hasPositivePrice(formData.priceLifetime)
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
    setPaymentRuleField,
    setInstallmentSplitMode,
    setInstallmentGroup,
    addInstallmentGroup,
    removeInstallmentGroup,
    submitForm,
  } = useBackofficePricing()
  const isRecurring = formData.billingMode === "RECURRING"
  const submitDisabled = isSaving || !canSubmit(formData)

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {dialogMode === "create" && "Novo produto"}
            {dialogMode === "duplicate" && "Duplicar produto"}
            {dialogMode === "edit" && "Editar produto"}
          </DialogTitle>
          <DialogDescription>
            {dialogMode === "duplicate"
              ? "Revise os dados copiados e ajuste o que for necessário antes de criar a nova precificação."
              : "Configure o produto usado na precificação das adesões."}
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
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-slug">Slug da funcionalidade *</Label>
              {dialogMode === "edit" ? (
                <>
                  <Input
                    id="product-slug"
                    value={formData.featureSlug}
                    disabled
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    O slug da funcionalidade não pode ser alterado após a criação.
                  </p>
                </>
              ) : (
                <>
                  <Select
                    value={formData.featureSlug}
                    disabled={isSaving}
                    onValueChange={(value) => setFormField("featureSlug", value)}
                  >
                    <SelectTrigger id="product-slug">
                      <SelectValue placeholder="Selecione a funcionalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {availableFeatureSlugs.length === 0 ? (
                          <SelectItem value="__none__" disabled>
                            Nenhuma funcionalidade disponível
                          </SelectItem>
                        ) : (
                          availableFeatureSlugs.map((slug) => (
                            <SelectItem key={slug} value={slug}>
                              {slug}
                            </SelectItem>
                          ))
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Múltiplas precificações podem usar o mesmo slug de funcionalidade.
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                disabled={isSaving}
                onValueChange={(value) =>
                  setFormField("type", value as BackofficeProductType)
                }
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
                    <SelectItem value="RECURRING">Parcelado</SelectItem>
                    <SelectItem value="LIFETIME">Vitalício</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="product-default"
                checked={formData.isDefault}
                disabled={isSaving}
                onCheckedChange={(checked) => setFormField("isDefault", checked)}
              />
              <Label htmlFor="product-default">Produto padrão</Label>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch
                id="product-active"
                checked={formData.isActive}
                disabled={isSaving}
                onCheckedChange={(checked) => setFormField("isActive", checked)}
              />
              <Label htmlFor="product-active">Produto ativo</Label>
            </div>
          </div>

          {isRecurring ? (
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Regras de Pagamento</Label>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Ciclo</th>
                      <th className="px-3 py-2 text-left font-medium">Cartão/mês *</th>
                      <th className="px-3 py-2 text-left font-medium">Total Cartão</th>
                      <th className="px-3 py-2 text-left font-medium">PIX/mês *</th>
                      <th className="px-3 py-2 text-left font-medium">Total PIX</th>
                      <th className="px-3 py-2 text-left font-medium">Desc/mês</th>
                      <th className="px-3 py-2 text-left font-medium">Desc Total</th>
                      <th className="px-3 py-2 text-left font-medium">Parcelas</th>
                      <th className="px-3 py-2 text-left font-medium">Desc %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CYCLES.map(({ key, label, months }) => {
                      const entry = formData.paymentRules[key]
                      const isCustom = entry.installmentSplitMode === "CUSTOM"
                      const pixPrice = parsePrice(entry.pixPrice)

                      const cardTotal = isCustom
                        ? scheduleTotal(entry.installmentSchedule)
                        : parsePrice(entry.cardPrice) * months
                      const cardMonthly = isCustom
                        ? (cardTotal > 0 ? cardTotal / months : 0)
                        : parsePrice(entry.cardPrice)
                      const totalPix = pixPrice * months
                      const discountMonth = cardMonthly > 0 && pixPrice > 0 ? cardMonthly - pixPrice : 0
                      const discountTotal = discountMonth * months
                      const discountPct = cardMonthly > 0 && discountMonth > 0 ? (discountMonth / cardMonthly) * 100 : 0

                      return (
                        <>
                          <tr key={key} className="border-b last:border-b-0">
                            <td className="px-3 py-2 font-medium text-muted-foreground">{label}</td>
                            <td className="px-3 py-2">
                              {isCustom ? (
                                <span className="text-xs text-muted-foreground">
                                  {cardMonthly > 0 ? formatCurrency(cardMonthly) : "—"}
                                </span>
                              ) : (
                                <Input
                                  className="h-8 w-28 text-sm"
                                  inputMode="decimal"
                                  placeholder="R$ 0,00"
                                  value={displayCurrencyInput(entry.cardPrice)}
                                  disabled={isSaving}
                                  onChange={(e) =>
                                    setPaymentRuleField(key, "cardPrice", parseCurrencyInput(e.target.value))
                                  }
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {cardTotal > 0 ? formatCurrency(cardTotal) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                className="h-8 w-28 text-sm"
                                inputMode="decimal"
                                placeholder="R$ 0,00"
                                value={displayCurrencyInput(entry.pixPrice)}
                                disabled={isSaving}
                                onChange={(e) =>
                                  setPaymentRuleField(key, "pixPrice", parseCurrencyInput(e.target.value))
                                }
                              />
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {pixPrice > 0 ? formatCurrency(totalPix) : "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {discountMonth > 0 ? formatCurrency(discountMonth) : "—"}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {discountTotal > 0 ? formatCurrency(discountTotal) : "—"}
                            </td>
                            <td className="px-3 py-2">
                              {isCustom ? (
                                <button
                                  type="button"
                                  className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                                  disabled={isSaving}
                                  onClick={() => setInstallmentSplitMode(key, "EQUAL")}
                                >
                                  Custom
                                </button>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Input
                                    className="h-8 w-16 text-sm"
                                    inputMode="numeric"
                                    placeholder="1"
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
                                  <button
                                    type="button"
                                    title="Usar parcelas com valores diferentes"
                                    className="rounded p-1 text-xs text-muted-foreground hover:text-primary"
                                    disabled={isSaving}
                                    onClick={() => setInstallmentSplitMode(key, "CUSTOM")}
                                  >
                                    ±
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {discountPct > 0 ? `${discountPct.toFixed(2)}%` : "—"}
                            </td>
                          </tr>
                          {isCustom && (
                            <tr key={`${key}-schedule`} className="border-b last:border-b-0 bg-muted/20">
                              <td colSpan={9} className="px-3 py-3">
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    Parcelas personalizadas — {label}
                                  </p>
                                  <div className="flex flex-col gap-1.5">
                                    {entry.installmentSchedule.map((group, idx) => (
                                      <div key={idx} className="flex items-center gap-2">
                                        <Input
                                          className="h-7 w-16 text-sm"
                                          inputMode="numeric"
                                          placeholder="Nº"
                                          value={group.count}
                                          disabled={isSaving}
                                          onChange={(e) =>
                                            setInstallmentGroup(key, idx, "count", e.target.value.replace(/\D/g, ""))
                                          }
                                        />
                                        <span className="text-xs text-muted-foreground">×</span>
                                        <Input
                                          className="h-7 w-28 text-sm"
                                          inputMode="decimal"
                                          placeholder="R$ 0,00"
                                          value={displayCurrencyInput(group.value)}
                                          disabled={isSaving}
                                          onChange={(e) =>
                                            setInstallmentGroup(key, idx, "value", parseCurrencyInput(e.target.value))
                                          }
                                        />
                                        <button
                                          type="button"
                                          disabled={isSaving || entry.installmentSchedule.length === 1}
                                          className={cn(
                                            "rounded p-1 text-muted-foreground transition-colors",
                                            entry.installmentSchedule.length > 1
                                              ? "hover:text-destructive"
                                              : "opacity-30 cursor-not-allowed"
                                          )}
                                          onClick={() => removeInstallmentGroup(key, idx)}
                                        >
                                          <X className="size-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <button
                                      type="button"
                                      disabled={isSaving}
                                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => addInstallmentGroup(key)}
                                    >
                                      <Plus className="size-3" />
                                      Adicionar grupo
                                    </button>
                                    <span className="text-xs text-muted-foreground">
                                      Total:{" "}
                                      <span className={cn(
                                        "font-medium",
                                        cardTotal > 0 ? "text-foreground" : "text-muted-foreground"
                                      )}>
                                        {cardTotal > 0 ? formatCurrency(cardTotal) : "—"}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="product-lifetime">Vitalício</Label>
              <Input
                id="product-lifetime"
                inputMode="decimal"
                value={formData.priceLifetime}
                disabled={isSaving}
                onChange={(event) =>
                  setFormField("priceLifetime", normalizePriceInput(event.target.value))
                }
              />
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" disabled={isSaving} onClick={closeDialog}>
            Cancelar
          </Button>
          <Button type="button" disabled={submitDisabled} onClick={submitForm}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
