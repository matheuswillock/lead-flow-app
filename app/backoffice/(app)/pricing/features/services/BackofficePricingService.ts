import type { IBackofficePricingService } from "./IBackofficePricingService"
import type { BackofficeProductFormData, BackofficeProductItem } from "../context/BackofficePricingTypes"

function parsePrice(value: string): number | null {
  const n = parseFloat(value.replace(",", "."))
  return isNaN(n) || n <= 0 ? null : n
}

const BILLING_CYCLES = ["monthly", "quarterly", "semiannual", "annual"] as const

function formToPayload(data: BackofficeProductFormData | Partial<BackofficeProductFormData>) {
  const payload: Record<string, unknown> = {}

  if (data.name !== undefined) payload.name = data.name
  if (data.featureSlug !== undefined) payload.featureSlug = data.featureSlug
  if ("description" in data) payload.description = data.description || null
  if (data.type !== undefined) payload.type = data.type
  if (data.billingMode !== undefined) payload.billingMode = data.billingMode
  if ("priceMonthly" in data) payload.priceMonthly = parsePrice(data.priceMonthly ?? "")
  if ("priceQuarterly" in data) payload.priceQuarterly = parsePrice(data.priceQuarterly ?? "")
  if ("priceSemiannual" in data) payload.priceSemiannual = parsePrice(data.priceSemiannual ?? "")
  if ("priceAnnual" in data) payload.priceAnnual = parsePrice(data.priceAnnual ?? "")
  if ("priceLifetime" in data) payload.priceLifetime = parsePrice(data.priceLifetime ?? "")
  if (data.isDefault !== undefined) payload.isDefault = data.isDefault
  if (data.isActive !== undefined) payload.isActive = data.isActive

  if (data.paymentRules && data.billingMode === "RECURRING") {
    const rules = []
    for (const cycle of BILLING_CYCLES) {
      const entry = data.paymentRules[cycle]
      if (!entry) continue
      const pixPrice = parsePrice(entry.pixPrice)
      const cardPrice = parsePrice(entry.cardPrice)
      const maxInstallments = Math.max(1, parseInt(entry.maxInstallments || "1", 10) || 1)
      if (pixPrice != null) {
        rules.push({
          paymentMethod: "PIX",
          billingCycle: cycle,
          price: pixPrice,
          canInstallment: false,
          maxInstallments: 1,
        })
      }
      if (cardPrice != null) {
        rules.push({
          paymentMethod: "CREDIT_CARD",
          billingCycle: cycle,
          price: cardPrice,
          canInstallment: maxInstallments > 1,
          maxInstallments,
        })
      }
    }
    if (rules.length) {
      payload.paymentRules = rules
      // keep flat prices synced with PIX rules for backward-compat (ADDON pricing)
      const pixMonthly = parsePrice(data.paymentRules.monthly?.pixPrice ?? "")
      const pixQuarterly = parsePrice(data.paymentRules.quarterly?.pixPrice ?? "")
      const pixSemiannual = parsePrice(data.paymentRules.semiannual?.pixPrice ?? "")
      const pixAnnual = parsePrice(data.paymentRules.annual?.pixPrice ?? "")
      if (pixMonthly != null) payload.priceMonthly = pixMonthly
      if (pixQuarterly != null) payload.priceQuarterly = pixQuarterly
      if (pixSemiannual != null) payload.priceSemiannual = pixSemiannual
      if (pixAnnual != null) payload.priceAnnual = pixAnnual
    }
  }

  return payload
}

export class BackofficePricingService implements IBackofficePricingService {
  async list(): Promise<BackofficeProductItem[]> {
    const res = await fetch("/api/v1/backoffice/pricing", { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar produtos")
    return data.result ?? []
  }

  async listFeatureSlugs(): Promise<string[]> {
    const res = await fetch("/api/v1/backoffice/features/slugs", { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar slugs")
    return data.result ?? []
  }

  async create(formData: BackofficeProductFormData): Promise<BackofficeProductItem> {
    const res = await fetch("/api/v1/backoffice/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(formData)),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao criar produto")
    return data.result
  }

  async update(id: string, formData: Partial<BackofficeProductFormData>): Promise<BackofficeProductItem> {
    const res = await fetch(`/api/v1/backoffice/pricing/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(formData)),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao atualizar produto")
    return data.result
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/pricing/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao excluir produto")
  }
}
