import type {
  BackofficeCrmUserOption,
  BackofficeLeadItem,
  BackofficeLeadScheduleInput,
} from "@/app/backoffice/(app)/crm/features/context/BackofficeCrmTypes"
import type {
  BackofficeCalendarAvailability,
  IBackofficeCalendarService,
} from "./IBackofficeCalendarService"
import { API_CLIENT_BASE } from "@/lib/route-map";

interface ApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<ApiOutput<T>> {
  const json = (await response.json().catch(() => null)) as ApiOutput<T> | null
  if (!response.ok || !json?.isValid) {
    throw new Error(json?.errorMessages?.[0] ?? `HTTP ${response.status}`)
  }
  return json
}

export class BackofficeCalendarService implements IBackofficeCalendarService {
  async listLeads(): Promise<BackofficeLeadItem[]> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/leads`, { cache: "no-store" })
    const output = await parseOutput<BackofficeLeadItem[]>(response)
    return output.result ?? []
  }

  async listUsers(): Promise<BackofficeCrmUserOption[]> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/users`, { cache: "no-store" })
    const output = await parseOutput<
      Array<{
        id: string
        email: string
        isActive: boolean
        isSdr: boolean
        isCloser: boolean
        googleCalendarConnected?: boolean
        googleEmail?: string | null
        timezone?: string | null
        profile?: { fullName?: string | null; email?: string | null }
      }>
    >(response)

    return (output.result ?? [])
      .filter((user) => user.isActive)
      .map((user) => ({
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

  async getAvailability(input: {
    closerIds: string[]
    date: string
    timezone: string
    excludeLeadId?: string | null
  }): Promise<BackofficeCalendarAvailability> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/calendar/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const output = await parseOutput<BackofficeCalendarAvailability>(response)
    return output.result
  }

  async scheduleLead(
    leadId: string,
    input: BackofficeLeadScheduleInput
  ): Promise<BackofficeLeadItem> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/leads/${leadId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const output = await parseOutput<BackofficeLeadItem>(response)
    return output.result
  }

  async cancelSchedule(leadId: string, reason?: string | null): Promise<BackofficeLeadItem> {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/leads/${leadId}/schedule/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    })
    const output = await parseOutput<{ lead: BackofficeLeadItem }>(response)
    return output.result.lead
  }

  async getAttendees(leadId: string) {
    const response = await fetch(`${API_CLIENT_BASE}/backoffice/leads/${leadId}/schedule/attendees`, {
      cache: "no-store",
    })
    const output = await parseOutput<{
      hasGoogleData: boolean
      attendees: Array<{
        email: string
        name: string | null
        responseStatus: string
        source: string
      }>
    }>(response)
    return output.result
  }
}
