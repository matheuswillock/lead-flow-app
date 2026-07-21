import type {
  BackofficeCrmUserOption,
  BackofficeLeadCreateInput,
  BackofficeLeadItem,
  BackofficeLeadOfferCreateInput,
  BackofficeLeadOfferCreateResult,
  BackofficeLeadOfferListItem,
  BackofficeLeadScheduleInput,
  BackofficeLeadStatusKey,
  BackofficeLeadUpdateInput,
  BackofficeOfferProductOption,
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

  async listUsers(): Promise<BackofficeCrmUserOption[]> {
    const response = await fetch(`/api/v1/backoffice/users`, {
      method: "GET",
      cache: "no-store",
    })
    const data = await parseOutput<
      {
        id: string
        email: string
        isActive: boolean
        isSdr: boolean
        isCloser: boolean
        googleCalendarConnected?: boolean
        googleEmail?: string | null
        timezone?: string | null
        profile?: { fullName?: string | null; email?: string | null }
      }[]
    >(response)

    return (data.result ?? []).map((user) => ({
      id: user.id,
      name: user.profile?.fullName ?? user.email,
      email: user.email || user.profile?.email || "",
      isActive: user.isActive,
      isSdr: user.isSdr,
      isCloser: user.isCloser,
      googleCalendarConnected: user.googleCalendarConnected ?? false,
      googleEmail: user.googleEmail ?? null,
      timezone: user.timezone ?? "America/Sao_Paulo",
    }))
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
    status: BackofficeLeadStatusKey,
    schedule?: BackofficeLeadScheduleInput
  ): Promise<BackofficeLeadItem> {
    const response = await fetch(`/api/v1/backoffice/leads/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(schedule ?? {}) }),
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

  async listActiveProducts(): Promise<BackofficeOfferProductOption[]> {
    const response = await fetch(`/api/v1/backoffice/pricing`, {
      method: "GET",
      cache: "no-store",
    })
    const data = await parseOutput<BackofficeOfferProductOption[]>(response)
    return (data.result ?? []).filter((product) => product.isActive)
  }

  async listOffers(leadId: string): Promise<BackofficeLeadOfferListItem[]> {
    const response = await fetch(`/api/v1/backoffice/leads/${leadId}/offers`, {
      method: "GET",
      cache: "no-store",
    })
    const data = await parseOutput<{ offers: BackofficeLeadOfferListItem[] }>(response)
    return data.result?.offers ?? []
  }

  async createOffer(
    leadId: string,
    data: BackofficeLeadOfferCreateInput
  ): Promise<BackofficeLeadOfferCreateResult> {
    const response = await fetch(`/api/v1/backoffice/leads/${leadId}/offers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const out = await parseOutput<BackofficeLeadOfferCreateResult>(response)
    return out.result
  }

  async revokeOffer(leadId: string, offerId: string): Promise<BackofficeLeadOfferListItem> {
    const response = await fetch(`/api/v1/backoffice/leads/${leadId}/offers/${offerId}`, {
      method: "DELETE",
    })
    const out = await parseOutput<BackofficeLeadOfferListItem>(response)
    return out.result
  }
}
