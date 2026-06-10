import type {
  IBackofficeEmailTemplatesService,
  TemplateListItem,
  TemplateDetail,
  CreateTemplateFormData,
  UpdateTemplateFormData,
  OperationResult,
} from "./IBackofficeEmailTemplatesService"

const BASE = "/api/v1/backoffice/email-templates"

export class BackofficeEmailTemplatesService implements IBackofficeEmailTemplatesService {
  async list(): Promise<TemplateListItem[]> {
    const res = await fetch(BASE, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar templates")
    return data.result ?? []
  }

  async get(id: string): Promise<TemplateDetail> {
    const res = await fetch(`${BASE}/${id}`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar template")
    return data.result
  }

  async create(body: CreateTemplateFormData): Promise<OperationResult> {
    const res = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async update(id: string, body: UpdateTemplateFormData): Promise<OperationResult> {
    const res = await fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async remove(id: string): Promise<OperationResult> {
    const res = await fetch(`${BASE}/${id}`, { method: "DELETE" })
    return res.json()
  }

  async publish(id: string): Promise<OperationResult> {
    const res = await fetch(`${BASE}/${id}/publish`, { method: "POST" })
    return res.json()
  }

  async duplicate(id: string): Promise<OperationResult> {
    const res = await fetch(`${BASE}/${id}/duplicate`, { method: "POST" })
    return res.json()
  }
}
