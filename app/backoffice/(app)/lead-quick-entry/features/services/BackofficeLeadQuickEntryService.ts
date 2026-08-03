import type {
  BackofficeLeadQuickEntryFormData,
  BackofficeOptInCampaignInfo,
} from "../context/BackofficeLeadQuickEntryTypes"
import type { IBackofficeLeadQuickEntryService } from "./IBackofficeLeadQuickEntryService"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface BackofficeApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as BackofficeApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json.result
}

export class BackofficeLeadQuickEntryService implements IBackofficeLeadQuickEntryService {
  async getOptInCampaign(): Promise<BackofficeOptInCampaignInfo | null> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/lead-form/opt-in-campaign`, {
      method: "GET",
      cache: "no-store",
    })
    return parseOutput<BackofficeOptInCampaignInfo | null>(response)
  }

  async submit(data: BackofficeLeadQuickEntryFormData): Promise<void> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/lead-form`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        notes: data.notes || null,
        subscribeToLiveCampaign: data.subscribeToLiveCampaign,
      }),
    })
    await parseOutput<unknown>(response)
  }
}
