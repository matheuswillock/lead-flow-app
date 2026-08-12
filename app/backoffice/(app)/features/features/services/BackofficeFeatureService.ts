import type { IBackofficeFeatureService } from "./IBackofficeFeatureService"
import type { BackofficeFeatureFormData, BackofficeFeatureItem } from "../context/BackofficeFeatureTypes"
import { formToPayload } from "../utils/backofficeFeatureForm"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeFeatureService implements IBackofficeFeatureService {
  async list(): Promise<BackofficeFeatureItem[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/features`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar funcionalidades")
    return data.result ?? []
  }

  async create(formData: BackofficeFeatureFormData): Promise<BackofficeFeatureItem> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(formData)),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao criar funcionalidade")
    return data.result
  }

  async update(id: string, formData: Partial<BackofficeFeatureFormData>): Promise<BackofficeFeatureItem> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/features/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(formData)),
    })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao atualizar funcionalidade")
    return data.result
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/features/${id}`, { method: "DELETE" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao excluir funcionalidade")
  }
}
