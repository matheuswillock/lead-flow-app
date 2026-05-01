import type { IBackofficePricingService } from "./IBackofficePricingService"
import type { BackofficeProductFormData, BackofficeProductItem } from "../context/BackofficePricingTypes"

function parsePrice(value: string): number | null {
  const n = parseFloat(value.replace(",", "."))
  return isNaN(n) || n <= 0 ? null : n
}

function formToPayload(data: BackofficeProductFormData | Partial<BackofficeProductFormData>) {
  const payload: Record<string, unknown> = {}

  if (data.name !== undefined) payload.name = data.name
  if (data.slug !== undefined) payload.slug = data.slug
  if ("description" in data) payload.description = data.description || null
  if (data.type !== undefined) payload.type = data.type
  if (data.billingMode !== undefined) payload.billingMode = data.billingMode
  if ("priceMonthly" in data) payload.priceMonthly = parsePrice(data.priceMonthly ?? "")
  if ("priceQuarterly" in data) payload.priceQuarterly = parsePrice(data.priceQuarterly ?? "")
  if ("priceSemiannual" in data) payload.priceSemiannual = parsePrice(data.priceSemiannual ?? "")
  if ("priceLifetime" in data) payload.priceLifetime = parsePrice(data.priceLifetime ?? "")
  if (data.isActive !== undefined) payload.isActive = data.isActive

  return payload
}

export class BackofficePricingService implements IBackofficePricingService {
  async list(): Promise<BackofficeProductItem[]> {
    const res = await fetch("/api/v1/backoffice/pricing", { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar produtos")
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
