import type { AccessEmailDispatchStatus, AccessHistoryEmail } from "@/lib/team-member-access/access-history"

export type RecordAccessEmailInput = {
  accountId: string
  teamId: string | null
  profileId: string
  dispatchId: string
  requestedByProfileId: string | null
}

/** Membro do time com o que é preciso para consultar o login dele. */
export type TeamMemberIdentity = {
  profileId: string
  supabaseId: string | null
  email: string
  fullName: string | null
  role: "manager" | "backoffice" | "operator"
}

export interface ITeamMemberAccessHistoryRepository {
  /** Membros do time, exceto o master da conta. */
  listTeamMemberIdentities(input: { teamId: string; accountId: string }): Promise<TeamMemberIdentity[]>
  /** Último e-mail de acesso que esta conta enviou a cada pessoa (só quem tem algum envio). */
  listLatestAccessEmails(input: {
    accountId: string
    profileIds: string[]
  }): Promise<Map<string, { status: AccessEmailDispatchStatus; createdAt: string }>>
  /** Liga o envio à conta que pediu; só envios ligados à conta aparecem no histórico dela. */
  recordAccessEmail(input: RecordAccessEmailInput): Promise<void>
  /** Últimos e-mails de acesso que ESTA conta enviou à pessoa, do mais novo para o mais antigo. */
  listAccessEmails(input: { accountId: string; profileId: string; limit: number }): Promise<AccessHistoryEmail[]>
}
