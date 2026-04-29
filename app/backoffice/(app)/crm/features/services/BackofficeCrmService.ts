import type {
  BackofficeLeadCreateInput,
  BackofficeLeadItem,
  BackofficeLeadStatusKey,
  BackofficeLeadUpdateInput,
} from "../context/BackofficeCrmTypes"
import type { IBackofficeCrmService } from "./IBackofficeCrmService"

interface BackofficeApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<BackofficeApiOutput<T>> {
  const json = (await response.json().catch(() => null)) as BackofficeApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json
}

export class BackofficeCrmService implements IBackofficeCrmService {
  async list(): Promise<BackofficeLeadItem[]> {
    const response = await fetch(`/api/v1/backoffice/leads`, {
      method: "GET",
      cache: "no-store",
    })
    const data = await parseOutput<BackofficeLeadItem[]>(response)
    return data.result ?? []
  }

  async create(data: BackofficeLeadCreateInput): Promise<BackofficeLeadItem> {
    const response = await fetch(`/api/v1/backoffice/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const out = await parseOutput<BackofficeLeadItem>(response)
    return out.result
  }

  async update(id: string, data: BackofficeLeadUpdateInput): Promise<BackofficeLeadItem> {
    const response = await fetch(`/api/v1/backoffice/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const out = await parseOutput<BackofficeLeadItem>(response)
    return out.result
  }

  async updateStatus(
    id: string,
    status: BackofficeLeadStatusKey
  ): Promise<BackofficeLeadItem> {
    const response = await fetch(`/api/v1/backoffice/leads/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    const out = await parseOutput<BackofficeLeadItem>(response)
    return out.result
  }

  async remove(id: string): Promise<void> {
    const response = await fetch(`/api/v1/backoffice/leads/${id}`, {
      method: "DELETE",
    })
    await parseOutput<null>(response)
  }
}
