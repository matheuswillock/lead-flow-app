import { API_CLIENT_BASE } from "@/lib/route-map"

export type LeadInterview = {
  leadId: string
  scheduledAt: string
  scheduledLocal: string
  administratorName: string | null
  notes: string | null
  clientNotifiedAt: string | null
  updatedAt: string
}

export type LeadInterviewScope = { leadId: string; teamId: string; supabaseId: string }

export type SaveLeadInterviewInput = {
  scheduledAt: string
  scheduledLocal: string
  administratorName: string | null
  notes: string | null
  reminderOffsets: string[]
}

type ApiOutput<T> = { isValid?: boolean; errorMessages?: string[]; successMessages?: string[]; result?: T }

async function request<T>(scope: LeadInterviewScope, path: string, init: RequestInit = {}): Promise<ApiOutput<T>> {
  const response = await fetch(`${API_CLIENT_BASE}/leads/${scope.leadId}/administrator-interview${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-supabase-user-id": scope.supabaseId,
      "x-team-id": scope.teamId,
    },
  })
  const output = (await response.json().catch(() => null)) as ApiOutput<T> | null
  if (!response.ok || !output?.isValid) {
    throw new Error(output?.errorMessages?.[0] ?? "Não foi possível acessar a entrevista do lead.")
  }
  return output
}

type InterviewResult = { interview: LeadInterview | null; reminderOffsets?: string[] }

export const leadInterviewService = {
  get: async (scope: LeadInterviewScope) => (await request<InterviewResult>(scope, "")).result?.interview ?? null,
  save: async (scope: LeadInterviewScope, input: SaveLeadInterviewInput) =>
    (await request<InterviewResult>(scope, "", { method: "PUT", body: JSON.stringify(input) })).result ?? { interview: null },
  remove: async (scope: LeadInterviewScope) => {
    await request(scope, "", { method: "DELETE" })
  },
  /** Registra no feed que o usuário abriu o WhatsApp para avisar o cliente. */
  markClientNotified: async (scope: LeadInterviewScope) =>
    (await request<InterviewResult>(scope, "/client-notice", { method: "POST", body: JSON.stringify({ action: "sent" }) }))
      .result?.interview ?? null,
  /** Usuário escolheu não avisar agora: cria tarefa pendente para ele. */
  postponeClientNotice: async (scope: LeadInterviewScope) =>
    (await request(scope, "/client-notice", { method: "POST", body: JSON.stringify({ action: "postpone" }) }))
      .successMessages?.[0] ?? "Tarefa criada",
}
