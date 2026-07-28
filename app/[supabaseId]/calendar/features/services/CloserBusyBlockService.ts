import type {
  CloserBusyBlockItem,
  ICloserBusyBlockService,
  UpsertCloserBusyBlockPayload,
} from "./ICloserBusyBlockService"

type ApiOutput<T> = {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as ApiOutput<T> | null
  if (!response.ok || !json?.isValid) {
    throw new Error(json?.errorMessages?.join(", ") || "Falha na operação de ocupação.")
  }
  return json.result as T
}

export class CloserBusyBlockService implements ICloserBusyBlockService {
  async list(params: {
    supabaseId: string
    teamId: string
    from: string
    to: string
    closerId?: string
  }): Promise<CloserBusyBlockItem[]> {
    const search = new URLSearchParams({
      from: params.from,
      to: params.to,
    })
    if (params.closerId) search.set("closerId", params.closerId)

    const response = await fetch(`/api/v1/calendar/busy-blocks?${search.toString()}`, {
      headers: {
        "x-supabase-user-id": params.supabaseId,
        "x-team-id": params.teamId,
      },
    })

    const result = await parseOutput<CloserBusyBlockItem[]>(response)
    return Array.isArray(result) ? result : []
  }

  async create(params: {
    supabaseId: string
    teamId: string
    payload: UpsertCloserBusyBlockPayload
  }): Promise<CloserBusyBlockItem> {
    const response = await fetch("/api/v1/calendar/busy-blocks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": params.supabaseId,
        "x-team-id": params.teamId,
      },
      body: JSON.stringify(params.payload),
    })
    return parseOutput<CloserBusyBlockItem>(response)
  }

  async update(params: {
    supabaseId: string
    teamId: string
    id: string
    payload: UpsertCloserBusyBlockPayload
  }): Promise<CloserBusyBlockItem> {
    const response = await fetch(`/api/v1/calendar/busy-blocks/${params.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": params.supabaseId,
        "x-team-id": params.teamId,
      },
      body: JSON.stringify(params.payload),
    })
    return parseOutput<CloserBusyBlockItem>(response)
  }

  async remove(params: {
    supabaseId: string
    teamId: string
    id: string
  }): Promise<void> {
    const response = await fetch(`/api/v1/calendar/busy-blocks/${params.id}`, {
      method: "DELETE",
      headers: {
        "x-supabase-user-id": params.supabaseId,
        "x-team-id": params.teamId,
      },
    })
    await parseOutput<{ id: string }>(response)
  }
}

export const closerBusyBlockService = new CloserBusyBlockService()
