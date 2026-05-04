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
import { useBackofficePricing } from "../context/BackofficePricingContext"
import type {
  BackofficeAdhesionBillingCycleKey,
  BackofficeProductBillingMode,
  BackofficeProductFormData,
  BackofficeProductType,
} from "../context/BackofficePricingTypes"

const CYCLES: { key: BackofficeAdhesionBillingCycleKey; label: string; months: number; defaultMax: number }[] = [
  { key: "monthly", label: "Mensal", months: 1, defaultMax: 1 },
  { key: "quarterly", label: "Trimestral", months: 3, defaultMax: 3 },
  { key: "semiannual", label: "Semestral", months: 6, defaultMax: 6 },
]

function normalizePriceInput(value: string): string {
  return value.replace(/[^\d,.]/g, "").replace(",", ".")
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

function canSubmit(formData: BackofficeProductFormData): boolean {
  if (!formData.name.trim() || !formData.slug.trim()) return false
  if (formData.billingMode === "RECURRING") {
    return CYCLES.every(
      ({ key }) =>
        hasPositivePrice(formData.paymentRules[key].pixPrice) &&
        hasPositivePrice(formData.paymentRules[key].cardPrice)
    )
  }
  return !formData.priceLifetime || hasPositivePrice(formData.priceLifetime)
}

export function BackofficeProductDialog() {
  const {
    dialogOpen,
    dialogMode,
    closeDialog,
    formData,
    isSaving,
    setFormField,
    setPaymentRuleField,
    submitForm,
  } = useBackofficePricing()
  const isRecurring = formData.billingMode === "RECURRING"
  const submitDisabled = isSaving || !canSubmit(formData)

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {dialogMode === "create" ? "Novo produto" : "Editar produto"}
          </DialogTitle>
          <DialogDescription>
            Configure o produto usado na precificação das adesões.
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
              <Label htmlFor="product-slug">Slug *</Label>
              <Input
                id="product-slug"
                value={formData.slug}
                disabled={isSaving}
                onChange={(event) => setFormField("slug", event.target.value)}
              />
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
                      <th className="px-3 py-2 text-left font-medium">Max Parcelas</th>
                      <th className="px-3 py-2 text-left font-medium">Desc %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CYCLES.map(({ key, label, months }) => {
                      const entry = formData.paymentRules[key]
                      const cardPrice = parsePrice(entry.cardPrice)
                      const pixPrice = parsePrice(entry.pixPrice)
                      const totalCard = cardPrice * months
                      const totalPix = pixPrice * months
                      const discountMonth = cardPrice > 0 && pixPrice > 0 ? cardPrice - pixPrice : 0
                      const discountTotal = discountMonth * months
                      const discountPct = cardPrice > 0 && discountMonth > 0 ? (discountMonth / cardPrice) * 100 : 0

                      return (
                        <tr key={key} className="border-b last:border-b-0">
                          <td className="px-3 py-2 font-medium text-muted-foreground">{label}</td>
                          <td className="px-3 py-2">
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
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {cardPrice > 0 ? formatCurrency(totalCard) : "—"}
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
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {discountPct > 0 ? `${discountPct.toFixed(2)}%` : "—"}
                          </td>
                        </tr>
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
