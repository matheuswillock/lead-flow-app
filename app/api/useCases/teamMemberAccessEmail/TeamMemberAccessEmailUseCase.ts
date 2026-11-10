import { Output } from "@/lib/output"
import type {
  BackofficeMemberAccessProfileRecord,
  IBackofficeMemberAccessRepository,
} from "@/app/api/infra/data/repositories/backoffice/MemberAccessRepository/IBackofficeMemberAccessRepository"
import type {
  BackofficeMemberAccessMode,
  BackofficeMemberAccessSnapshot,
} from "@/lib/backoffice-member-access"
import type { TeamMemberAccessHistory, TeamMemberAccessSummary } from "@/lib/team-member-access/access-history"
import type {
  ITeamMemberAccessHistoryRepository,
  TeamMemberIdentity,
} from "@/app/api/infra/data/repositories/teamMemberAccessHistory/ITeamMemberAccessHistoryRepository"

/** O que dizer a quem pediu o reenvio enquanto o e-mail não chega. */
export const ACCESS_EMAIL_DELIVERY_HINT =
  "Deve chegar em até 5 minutos. Peça para a pessoa olhar também a caixa de spam e as promoções."

export type TeamMemberAccessEmailDependencies = {
  memberAccess: IBackofficeMemberAccessRepository
  /** Membro do time ativo; null quando a pessoa não é deste time. */
  findTeamMember: (teamId: string, profileId: string) => Promise<{ profileId: string } | null>
  resolveAccess: (profile: BackofficeMemberAccessProfileRecord) => Promise<BackofficeMemberAccessSnapshot>
  /** Login de várias pessoas de uma vez (para a coluna "Acesso" da tabela). */
  resolveAccessMany: (profiles: TeamMemberIdentity[]) => Promise<Map<string, BackofficeMemberAccessSnapshot>>
  sendEmail: (input: {
    profile: BackofficeMemberAccessProfileRecord
    mode: BackofficeMemberAccessMode
  }) => Promise<{ dispatchId: string | null }>
  history: ITeamMemberAccessHistoryRepository
}

const ACCESS_HISTORY_LIMIT = 10

export type TeamMemberAccessEmailInput = {
  /** Time ativo de quem pede (master ou manager, já validado na rota). */
  teamId: string
  /** Master da conta; o membro precisa ser desta conta. */
  accountMasterId: string
  targetProfileId: string
  /** Quem pediu o envio (master ou manager). */
  requesterProfileId: string
}

/**
 * Master e manager reenviam sozinhos o e-mail de acesso de quem é do time: convite de primeiro
 * acesso para quem ainda não entrou, ou redefinição de senha para quem já entrou. É o mesmo e-mail
 * que o backoffice envia, então o time de produto não precisa mais fazer isso pelo cliente.
 */
export class TeamMemberAccessEmailUseCase {
  constructor(private readonly dependencies: TeamMemberAccessEmailDependencies) {}

  /** Membro do time ativo e desta conta; null quando quem pede não pode ver essa pessoa. */
  private async findAccountMember(input: TeamMemberAccessEmailInput): Promise<BackofficeMemberAccessProfileRecord | null> {
    const member = await this.dependencies.findTeamMember(input.teamId, input.targetProfileId)
    if (!member) return null
    return this.dependencies.memberAccess.findProfileAccessRecord({
      profileId: input.targetProfileId,
      accountMasterId: input.accountMasterId,
    })
  }

  /**
   * Situação de acesso de cada pessoa do time ativo (último login e último e-mail desta conta),
   * para o selo da coluna "Acesso". Uma pessoa sem login consultável fica como "sem acesso".
   */
  async getTeamAccessSummary(input: { teamId: string; accountMasterId: string }): Promise<{ output: Output; status: number }> {
    try {
      const members = await this.dependencies.history.listTeamMemberIdentities({
        teamId: input.teamId,
        accountId: input.accountMasterId,
      })
      const profileIds = members.map((member) => member.profileId)
      const [access, emails] = await Promise.all([
        this.dependencies.resolveAccessMany(members),
        this.dependencies.history.listLatestAccessEmails({ accountId: input.accountMasterId, profileIds }),
      ])
      const summaries: TeamMemberAccessSummary[] = profileIds.map((profileId) => ({
        profileId,
        lastSignInAt: access.get(profileId)?.lastSignInAt ?? null,
        lastEmail: emails.get(profileId) ?? null,
      }))
      return { output: new Output(true, [], [], summaries), status: 200 }
    } catch (error) {
      console.error("[TeamMemberAccessEmailUseCase][getTeamAccessSummary]", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return failure(500, "Não foi possível carregar a situação de acesso da equipe")
    }
  }

  /** Último login e os últimos e-mails de acesso da pessoa, para conferir antes de pedir ajuda. */
  async getAccessHistory(input: TeamMemberAccessEmailInput): Promise<{ output: Output; status: number }> {
    try {
      const profile = await this.findAccountMember(input)
      if (!profile) return failure(404, "Usuário não encontrado neste time")
      const [access, emails] = await Promise.all([
        this.dependencies.resolveAccess(profile),
        this.dependencies.history.listAccessEmails({
          accountId: input.accountMasterId,
          profileId: profile.profileId,
          limit: ACCESS_HISTORY_LIMIT,
        }),
      ])
      const history: TeamMemberAccessHistory = {
        email: profile.email,
        name: profile.fullName?.trim() || profile.email,
        lastSignInAt: access.lastSignInAt,
        emails,
      }
      return { output: new Output(true, [], [], history), status: 200 }
    } catch (error) {
      console.error("[TeamMemberAccessEmailUseCase][getAccessHistory]", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return failure(500, "Não foi possível carregar o histórico de acesso")
    }
  }

  async sendAccessEmail(input: TeamMemberAccessEmailInput): Promise<{ output: Output; status: number }> {
    if (input.targetProfileId === input.accountMasterId) {
      return failure(400, "O master da conta acessa pelo próprio e-mail; use \"Esqueci minha senha\" no login.")
    }
    try {
      const profile = await this.findAccountMember(input)
      if (!profile) return failure(404, "Usuário não encontrado neste time")

      const access = await this.dependencies.resolveAccess(profile)
      const mode: BackofficeMemberAccessMode = access.accessStatus === "active" ? "reset_password" : "invite"
      const outcome = await this.dependencies.memberAccess.runWithInviteLock(profile.profileId, () =>
        this.dependencies.sendEmail({ profile, mode })
      )
      if (!outcome.acquired) {
        return failure(409, "Já existe um envio em andamento para este usuário. Aguarde alguns segundos e tente de novo.")
      }
      await this.recordSent(input, outcome.result.dispatchId)

      const message = mode === "invite"
        ? `E-mail de primeiro acesso enviado para ${profile.email}.`
        : `E-mail para criar uma nova senha enviado para ${profile.email}.`
      return {
        output: new Output(true, [message, ACCESS_EMAIL_DELIVERY_HINT], [], { email: profile.email, mode }),
        status: 200,
      }
    } catch (error) {
      console.error("[TeamMemberAccessEmailUseCase][sendAccessEmail]", {
        message: error instanceof Error ? error.message : "unknown",
      })
      return failure(500, error instanceof Error ? error.message : "Não foi possível enviar o e-mail de acesso")
    }
  }

  /**
   * Liga o envio à conta para o histórico. O e-mail já saiu: falhar aqui não pode virar erro
   * para quem pediu, só deixa o envio fora do histórico.
   */
  private async recordSent(input: TeamMemberAccessEmailInput, dispatchId: string | null): Promise<void> {
    if (!dispatchId) return
    try {
      await this.dependencies.history.recordAccessEmail({
        accountId: input.accountMasterId,
        teamId: input.teamId,
        profileId: input.targetProfileId,
        dispatchId,
        requestedByProfileId: input.requesterProfileId,
      })
    } catch (error) {
      console.error("[TeamMemberAccessEmailUseCase][recordSent]", {
        message: error instanceof Error ? error.message : "unknown",
      })
    }
  }
}

function failure(status: number, message: string): { output: Output; status: number } {
  return { output: new Output(false, [], [message], null), status }
}
