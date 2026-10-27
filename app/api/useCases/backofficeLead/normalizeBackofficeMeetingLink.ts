import { validateMeetingLinkValue } from "@/lib/validations/meetingLink"

export type NormalizedBackofficeMeetingLink =
  | { isValid: true; value: string | null }
  | { isValid: false; errorMessage: string }

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1d — achado da revisão (R13d-4):
 * as rotas de lead do backoffice gravavam `meetingLink` direto em
 * `BackofficeLead` sem validação nenhuma sempre que o lead não passava pelo
 * `BackofficeLeadScheduleService` (status diferente de agendado, ou agenda
 * sem mudança) — um `javascript:` enviado à API ia para o banco e depois
 * para um `<a href>`. Aplica a mesma validação de lib/validations/meetingLink.ts
 * (DA8: só https). O `http:` legado (carry-over da A-E1c) só passa quando é
 * exatamente o link já gravado (`persistedMeetingLink`), para não travar a
 * edição de outros campos de um lead antigo.
 */
export function normalizeBackofficeMeetingLink(
  value: unknown,
  persistedMeetingLink: string | null = null
): NormalizedBackofficeMeetingLink {
  if (value !== undefined && value !== null && typeof value !== "string") {
    return { isValid: false, errorMessage: "Link da reunião inválido." }
  }

  const meetingLink = value?.trim() || null
  if (!meetingLink) return { isValid: true, value: null }

  const validation = validateMeetingLinkValue(meetingLink, {
    required: false,
    allowLegacyHttp: meetingLink === persistedMeetingLink,
  })
  if (!validation.isValid) {
    return { isValid: false, errorMessage: validation.error }
  }

  return { isValid: true, value: meetingLink }
}
