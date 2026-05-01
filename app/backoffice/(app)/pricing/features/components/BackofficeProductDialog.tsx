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
  BackofficeProductBillingMode,
  BackofficeProductFormData,
  BackofficeProductType,
} from "../context/BackofficePricingTypes"

function normalizePriceInput(value: string): string {
  return value.replace(/[^\d,.]/g, "").replace(",", ".")
}

function hasPositivePrice(value: string): boolean {
  const parsed = Number.parseFloat(value.replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0
}

function canSubmit(formData: BackofficeProductFormData): boolean {
  if (!formData.name.trim() || !formData.slug.trim()) return false
  if (formData.billingMode === "RECURRING") {
    return (
      hasPositivePrice(formData.priceMonthly) &&
      hasPositivePrice(formData.priceQuarterly) &&
      hasPositivePrice(formData.priceSemiannual)
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
    submitForm,
  } = useBackofficePricing()
  const isRecurring = formData.billingMode === "RECURRING"
  const submitDisabled = isSaving || !canSubmit(formData)

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-2xl">
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
                    <SelectItem value="RECURRING">Recorrente</SelectItem>
                    <SelectItem value="LIFETIME">Vitalício</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 rounded-md border p-3">
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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-monthly">Mensal *</Label>
                <Input
                  id="product-monthly"
                  inputMode="decimal"
                  value={formData.priceMonthly}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormField("priceMonthly", normalizePriceInput(event.target.value))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-quarterly">Trimestral *</Label>
                <Input
                  id="product-quarterly"
                  inputMode="decimal"
                  value={formData.priceQuarterly}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormField("priceQuarterly", normalizePriceInput(event.target.value))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-semiannual">Semestral *</Label>
                <Input
                  id="product-semiannual"
                  inputMode="decimal"
                  value={formData.priceSemiannual}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormField("priceSemiannual", normalizePriceInput(event.target.value))
                  }
                />
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
