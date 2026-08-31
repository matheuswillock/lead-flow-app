import type { IBackofficePricingService } from "./IBackofficePricingService"
import type {
  BackofficeAdhesionBillingCycleKey,
  BackofficeProductFormData,
  BackofficeProductItem,
} from "../context/BackofficePricingTypes"
import { flattenSchedule } from "../context/BackofficePricingTypes"
import { API_CLIENT_BASE } from "@/lib/route-map";

function parsePrice(value: string): number | null {
  const n = parseFloat(value.replace(",", "."))
  return isNaN(n) || n <= 0 ? null : n
}

const BILLING_CYCLES: BackofficeAdhesionBillingCycleKey[] = [
  "monthly",
  "quarterly",
  "quadrimester",
  "semiannual",
  "annual",
]

function formToPayload(data: BackofficeProductFormData | Partial<BackofficeProductFormData>) {
  const payload: Record<string, unknown> = {}

  if (data.name !== undefined) payload.name = data.name
  if (data.featureSlugs !== undefined) payload.featureSlugs = data.featureSlugs
  if ("description" in data) payload.description = data.description || null
  if (data.type !== undefined) payload.type = data.type
  if (data.billingMode !== undefined) payload.billingMode = data.billingMode
  if (data.isDefault !== undefined) payload.isDefault = data.isDefault
  if (data.isActive !== undefined) payload.isActive = data.isActive
  if ("priceLifetime" in data) payload.priceLifetime = parsePrice(data.priceLifetime ?? "")

  if (data.paymentRules && data.billingMode === "RECURRING") {
    const activeCycles =
      data.activeCycles && data.activeCycles.length > 0
        ? data.activeCycles
        : BILLING_CYCLES.filter((cycle) => {
            const entry = data.paymentRules?.[cycle]
            if (!entry) return false
            return (
              parsePrice(entry.pixPrice) != null ||
              parsePrice(entry.cardPrice) != null ||
              entry.installmentSplitMode === "CUSTOM"
            )
          })

    const rules = []
    for (const cycle of activeCycles) {
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
          installmentSplitMode: "EQUAL" as const,
          installmentSchedule: [],
        })
      }
      if (cardPrice != null || entry.installmentSplitMode === "CUSTOM") {
        const splitMode = entry.installmentSplitMode ?? "EQUAL"
        if (splitMode === "CUSTOM") {
          const schedule = flattenSchedule(entry.installmentSchedule ?? [])
          const total = schedule.reduce((s, v) => s + v, 0)
          if (schedule.length > 0 && total > 0) {
            rules.push({
              paymentMethod: "CREDIT_CARD",
              billingCycle: cycle,
              price: total,
              canInstallment: schedule.length > 1,
              maxInstallments: schedule.length,
              installmentSplitMode: "CUSTOM" as const,
              installmentSchedule: schedule,
            })
          }
        } else if (cardPrice != null) {
          rules.push({
            paymentMethod: "CREDIT_CARD",
            billingCycle: cycle,
            price: cardPrice,
            canInstallment: maxInstallments > 1,
            maxInstallments,
            installmentSplitMode: "EQUAL" as const,
            installmentSchedule: [],
          })
        }
      }
    }

    payload.paymentRules = rules
    payload.priceMonthly = parsePrice(data.paymentRules.monthly?.pixPrice ?? "")
    payload.priceQuarterly = parsePrice(data.paymentRules.quarterly?.pixPrice ?? "")
    payload.priceQuadrimester = parsePrice(data.paymentRules.quadrimester?.pixPrice ?? "")
    payload.priceSemiannual = parsePrice(data.paymentRules.semiannual?.pixPrice ?? "")
    payload.priceAnnual = parsePrice(data.paymentRules.annual?.pixPrice ?? "")
    for (const cycle of BILLING_CYCLES) {
      if (!activeCycles.includes(cycle)) {
        if (cycle === "monthly") payload.priceMonthly = null
        if (cycle === "quarterly") payload.priceQuarterly = null
        if (cycle === "quadrimester") payload.priceQuadrimester = null
        if (cycle === "semiannual") payload.priceSemiannual = null
        if (cycle === "annual") payload.priceAnnual = null
      }
    }
  } else if (data.billingMode === "LIFETIME") {
    if ("priceMonthly" in data) payload.priceMonthly = null
    if ("priceQuarterly" in data) payload.priceQuarterly = null
    if ("priceQuadrimester" in data) payload.priceQuadrimester = null
    if ("priceSemiannual" in data) payload.priceSemiannual = null
    if ("priceAnnual" in data) payload.priceAnnual = null
  }

  return payload
}

export class BackofficePricingService implements IBackofficePricingService {
  async list(): Promise<BackofficeProductItem[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/pricing`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar produtos")
    return data.result ?? []
  }

  async listFeatureSlugs(): Promise<string[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/features/slugs`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar slugs")
    return data.result ?? []
  }

  async create(formData: BackofficeProductFormData): Promise<BackofficeProductItem> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/pricing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(formData)),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao criar produto")
    return data.result
  }

  async update(id: string, formData: Partial<BackofficeProductFormData>): Promise<BackofficeProductItem> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/pricing/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(formData)),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao atualizar produto")
    return data.result
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/pricing/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao excluir produto")
  }
}
