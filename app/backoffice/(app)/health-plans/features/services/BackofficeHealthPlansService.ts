import type {
  BackofficeHealthPlanItem,
  BackofficeHealthPlanPayload,
  BackofficeHealthPlanUpdatePayload,
  IBackofficeHealthPlansService,
} from "./IBackofficeHealthPlansService"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeHealthPlansService implements IBackofficeHealthPlansService {
  async list(includeInactive = true): Promise<BackofficeHealthPlanItem[]> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/health-plans?includeInactive=${includeInactive ? "true" : "false"}`, {
      cache: "no-store",
    })
    const data = await response.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao listar operadoras")
    return data.result ?? []
  }

  async create(payload: BackofficeHealthPlanPayload) {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/health-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    return response.json()
  }

  async update(id: string, payload: BackofficeHealthPlanUpdatePayload) {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/health-plans/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    return response.json()
  }

  async deactivate(id: string, password: string) {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/health-plans/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    return response.json()
  }

  async activate(id: string, password: string) {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/health-plans/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true, password }),
    })
    return response.json()
  }

  async uploadIcon(file: File) {
    const formData = new FormData()
    formData.append("icon", file)
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/health-plans/icon-upload`, {
      method: "POST",
      body: formData,
    })
    return response.json()
  }
}
