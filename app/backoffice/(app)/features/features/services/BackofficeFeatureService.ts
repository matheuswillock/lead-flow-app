import type { IBackofficeFeatureService } from "./IBackofficeFeatureService"
import type { BackofficeFeatureFormData, BackofficeFeatureItem } from "../context/BackofficeFeatureTypes"

function formToPayload(data: BackofficeFeatureFormData | Partial<BackofficeFeatureFormData>) {
  const payload: Record<string, unknown> = {}

  if (data.name !== undefined) payload.name = data.name
  if ("description" in data) payload.description = data.description || null
  if (data.accessMode !== undefined) payload.accessMode = data.accessMode
  if (data.defaultAccessLevel !== undefined) payload.defaultAccessLevel = data.defaultAccessLevel
  if (data.betaEnabled !== undefined) payload.betaEnabled = data.betaEnabled
  if (data.isActive !== undefined) payload.isActive = data.isActive
  if ("sortOrder" in data) payload.sortOrder = parseInt(data.sortOrder ?? "0", 10) || 0
  if ("productSlug" in data) payload.productSlug = data.productSlug || null
  if ("parentId" in data) payload.parentId = data.parentId || null
  if ("accessRules" in data) payload.accessRules = data.accessRules ?? []

  return payload
}

export class BackofficeFeatureService implements IBackofficeFeatureService {
  async list(): Promise<BackofficeFeatureItem[]> {
    const res = await fetch("/api/v1/backoffice/features", { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar funcionalidades")
    return data.result ?? []
  }

  async create(formData: BackofficeFeatureFormData): Promise<BackofficeFeatureItem> {
    const res = await fetch("/api/v1/backoffice/features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(formData)),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao criar funcionalidade")
    return data.result
  }

  async update(id: string, formData: Partial<BackofficeFeatureFormData>): Promise<BackofficeFeatureItem> {
    const res = await fetch(`/api/v1/backoffice/features/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(formData)),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao atualizar funcionalidade")
    return data.result
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`/api/v1/backoffice/features/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao excluir funcionalidade")
  }
}
