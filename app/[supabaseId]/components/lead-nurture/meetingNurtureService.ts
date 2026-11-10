import { API_CLIENT_BASE } from "@/lib/route-map"
import type { NurtureStep } from "@/lib/lead-follow-up/meeting-nurture-playbook"

export type NurtureContact = {
  id: string
  step: NurtureStep
  title: string
  tip: string
  whenLabel: string
  dueAt: string
  done: boolean
  isCustom: boolean
}

export type NurturePlan = { meetingAt: string | null; contacts: NurtureContact[] }

export type NurtureScope = { leadId: string; teamId: string; supabaseId: string }

async function request(scope: NurtureScope, init: RequestInit = {}): Promise<NurturePlan> {
  const response = await fetch(`${API_CLIENT_BASE}/leads/${scope.leadId}/meeting-nurture`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-supabase-user-id": scope.supabaseId,
      "x-team-id": scope.teamId,
    },
  })
  const output = (await response.json().catch(() => null)) as
    | { isValid?: boolean; errorMessages?: string[]; result?: NurturePlan }
    | null
  if (!response.ok || !output?.isValid) {
    throw new Error(output?.errorMessages?.[0] ?? "Não foi possível carregar a nutrição do lead.")
  }
  return output.result ?? { meetingAt: null, contacts: [] }
}

export const meetingNurtureService = {
  list: (scope: NurtureScope) => request(scope),
  add: (scope: NurtureScope, dueAt: string) => request(scope, { method: "POST", body: JSON.stringify({ dueAt }) }),
  remove: (scope: NurtureScope, contactId: string) =>
    request(scope, { method: "DELETE", body: JSON.stringify({ contactId }) }),
}
