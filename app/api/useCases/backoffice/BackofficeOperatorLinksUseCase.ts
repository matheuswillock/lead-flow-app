import type { BackofficeUser, UserFunction } from "@prisma/client"
import { Output } from "@/lib/output"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import type {
  IBackofficeOperatorLinksRepository,
  OperatorLinkedTeam,
} from "@/app/api/infra/data/repositories/backoffice/OperatorLinksRepository/IBackofficeOperatorLinksRepository"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import { buildAuditActorMetadata } from "@/app/api/useCases/audit/auditActor"
import type { AuditLogEntry } from "@/app/api/infra/data/repositories/audit/IAuditLogRepository"

export interface OperatorAccountLinkInput {
  masterId: string
  teamIds: string[]
}

export interface OperatorAccountLink {
  masterId: string
  masterName: string | null
  masterEmail: string
  teams: { id: string; name: string }[]
}

export interface IBackofficeOperatorLinksSync {
  syncAfterUserChange(user: Pick<BackofficeUser, "profileId" | "fullAccess" | "isSdr" | "isCloser">): Promise<void>
}

interface AuditWriter {
  logAudit(entry: AuditLogEntry): Promise<void>
}

const MAX_LINKED_TEAMS = 200

export function resolveOperatorFunctions(user: Pick<BackofficeUser, "isSdr" | "isCloser">): UserFunction[] {
  const functions: UserFunction[] = []
  if (user.isSdr) functions.push("SDR")
  if (user.isCloser) functions.push("CLOSER")
  return functions
}

function groupByAccount(teams: OperatorLinkedTeam[]): OperatorAccountLink[] {
  const accounts = new Map<string, OperatorAccountLink>()

  for (const team of teams) {
    const account = accounts.get(team.masterId) ?? {
      masterId: team.masterId,
      masterName: team.masterName,
      masterEmail: team.masterEmail,
      teams: [],
    }
    account.teams.push({ id: team.teamId, name: team.teamName })
    accounts.set(team.masterId, account)
  }

  return [...accounts.values()]
}

type ParsedLinks = { ok: true; desired: Map<string, string> } | { ok: false; error: string }

/** Devolve teamId -> masterId pedido, sem repetições. */
function parseLinks(links: unknown): ParsedLinks {
  if (!Array.isArray(links)) {
    return { ok: false, error: "Informe a lista de contas e times" }
  }

  const desired = new Map<string, string>()
  for (const link of links as Partial<OperatorAccountLinkInput>[]) {
    const masterId = typeof link?.masterId === "string" ? link.masterId.trim() : ""
    if (!masterId || !Array.isArray(link?.teamIds)) {
      return { ok: false, error: "Cada conta precisa de masterId e da lista de times" }
    }

    for (const teamId of link.teamIds) {
      if (typeof teamId !== "string" || !teamId.trim()) {
        return { ok: false, error: "Time inválido na lista" }
      }
      desired.set(teamId.trim(), masterId)
    }
  }

  if (desired.size > MAX_LINKED_TEAMS) {
    return { ok: false, error: `Limite de ${MAX_LINKED_TEAMS} times por usuário` }
  }

  return { ok: true, desired }
}

export class BackofficeOperatorLinksUseCase implements IBackofficeOperatorLinksSync {
  constructor(
    private userRepo: IBackofficeUserRepository,
    private linksRepo: IBackofficeOperatorLinksRepository,
    private audit: AuditWriter
  ) {}

  async getLinks(userId: string): Promise<Output> {
    try {
      const user = await this.userRepo.findById(userId)
      if (!user) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      const linked = await this.linksRepo.findLinkedTeams(user.profileId)
      return new Output(true, [], [], groupByAccount(linked))
    } catch (error) {
      console.error("[BackofficeOperatorLinksUseCase][getLinks]", error)
      return new Output(false, [], ["Erro ao buscar contas e times do usuário"], null)
    }
  }

  async syncLinks(userId: string, links: unknown, actorAccess: BackofficeAccess): Promise<Output> {
    try {
      if (!actorAccess.fullAccess) {
        return new Output(false, [], ["Apenas usuários com acesso total podem vincular contas"], null)
      }

      const user = await this.userRepo.findById(userId)
      if (!user) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }
      if (user.fullAccess) {
        return new Output(false, [], ["Apenas usuários Operator podem ser vinculados a contas e times"], null)
      }

      const parsed = parseLinks(links)
      if (!parsed.ok) {
        return new Output(false, [], [parsed.error], null)
      }

      const functions = resolveOperatorFunctions(user)
      if (parsed.desired.size > 0 && functions.length === 0) {
        return new Output(false, [], ["Marque SDR ou Closer no usuário antes de vinculá-lo a times"], null)
      }

      const teamsMismatch = await this.findTeamsOutsideAccounts(parsed.desired)
      if (teamsMismatch) {
        return new Output(false, [], [teamsMismatch], null)
      }

      const current = await this.linksRepo.findLinkedTeams(user.profileId)
      const currentIds = new Set(current.map((team) => team.teamId))
      const toAdd = [...parsed.desired.keys()].filter((teamId) => !currentIds.has(teamId))
      const toRemove = [...currentIds].filter((teamId) => !parsed.desired.has(teamId))

      const removed = await this.linksRepo.removeTeams(user.profileId, toRemove)
      const added = await this.linksRepo.addTeams(user.profileId, toAdd, functions)

      await this.writeAudit(actorAccess, user, "DELETE", removed, parsed.desired, current)
      await this.writeAudit(actorAccess, user, "CREATE", added, parsed.desired, current)

      const linked = await this.linksRepo.findLinkedTeams(user.profileId)
      return new Output(true, ["Contas e times atualizados"], [], groupByAccount(linked))
    } catch (error) {
      console.error("[BackofficeOperatorLinksUseCase][syncLinks]", error)
      return new Output(false, [], ["Erro ao atualizar contas e times do usuário"], null)
    }
  }

  /**
   * Mantém os vínculos coerentes quando o cadastro do usuário muda: as funções
   * dos times acompanham SDR/Closer, e quem vira Manager perde os vínculos de
   * Operator (o Manager entra nas contas pelo acesso de suporte).
   */
  async syncAfterUserChange(
    user: Pick<BackofficeUser, "profileId" | "fullAccess" | "isSdr" | "isCloser">
  ): Promise<void> {
    if (user.fullAccess) {
      const linked = await this.linksRepo.findLinkedTeams(user.profileId)
      await this.linksRepo.removeTeams(
        user.profileId,
        linked.map((team) => team.teamId)
      )
      return
    }

    await this.linksRepo.updateFunctions(user.profileId, resolveOperatorFunctions(user))
  }

  private async findTeamsOutsideAccounts(desired: Map<string, string>): Promise<string | null> {
    const found = await this.linksRepo.findActiveTeams([...desired.keys()])
    const masterByTeam = new Map(found.map((team) => [team.teamId, team.masterId]))

    for (const [teamId, masterId] of desired) {
      const realMasterId = masterByTeam.get(teamId)
      if (!realMasterId) return "Time não encontrado"
      if (realMasterId !== masterId) return "Time não pertence à conta informada"
    }

    return null
  }

  private async writeAudit(
    actorAccess: BackofficeAccess,
    user: BackofficeUser,
    action: "CREATE" | "DELETE",
    members: { memberId: string; teamId: string }[],
    desired: Map<string, string>,
    current: OperatorLinkedTeam[]
  ): Promise<void> {
    const masterByTeam = new Map(current.map((team) => [team.teamId, team.masterId]))

    for (const member of members) {
      await this.audit.logAudit({
        entityType: "TEAM_MEMBER",
        entityId: member.memberId,
        action,
        actorProfileId: actorAccess.profileId,
        before: action === "DELETE" ? { teamId: member.teamId, profileId: user.profileId } : null,
        after: action === "CREATE" ? { teamId: member.teamId, profileId: user.profileId, role: "operator" } : null,
        metadata: buildAuditActorMetadata(
          {
            profileId: actorAccess.profileId,
            backofficeUserId: actorAccess.backofficeUserId,
            backofficeEmail: actorAccess.backofficeEmail,
          },
          {
            operation: "backoffice_operator_link",
            teamId: member.teamId,
            masterProfileId: desired.get(member.teamId) ?? masterByTeam.get(member.teamId) ?? null,
            operatorProfileId: user.profileId,
          }
        ),
      })
    }
  }
}
