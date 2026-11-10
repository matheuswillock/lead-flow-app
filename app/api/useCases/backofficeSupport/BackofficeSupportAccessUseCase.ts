import { Output } from "@/lib/output"
import { auditLogWriter } from "@/app/api/useCases/audit/AuditLogWriter"
import { buildAuditActorMetadata } from "@/app/api/useCases/audit/auditActor"
import type { AuditLogEntry } from "@/app/api/infra/data/repositories/audit/IAuditLogRepository"
import { backofficeSupportRepository } from "@/app/api/infra/data/repositories/backofficeSupport/BackofficeSupportRepository"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import type {
  IBackofficeSupportRepository,
  SupportManagerRef,
  SupportTeamDetails,
} from "@/app/api/infra/data/repositories/backofficeSupport/IBackofficeSupportRepository"

const MIN_SEARCH_LENGTH = 2
const MAX_ACCOUNTS_PER_SEARCH = 8

interface AuditWriter {
  logAudit(entry: AuditLogEntry): Promise<void>
}

/** Mesma forma do TeamSummary usado pelo seletor de times do app. */
export interface SupportTeamRow {
  id: string
  name: string
  masterId: string
  accountMasterId: string
  accountName: string
  isOwnAccount: false
  isAssociateAccount: false
  sponsorMasterId: null
  associateAccountName: null
  isAccessible: true
  accountSubscriptionActive: true
  accountMasterBanned: false
  accountAccessDecision: { state: "allowed" }
  isDefault: boolean
  role: "backoffice"
  functions: []
  canCreateAccountUsers: true
  canManageAccountTeams: true
  canTransferAccountLeads: true
  canViewAllTeams: true
  accountTeamsCount: number
  hasTransferRoutes: false
  membershipCreatedAt: Date
  isPending: false
  pendingPayment: null
  isSupportAccess: true
}

export interface SupportTeamState {
  canSupportSearch: boolean
  supportTeam: SupportTeamRow | null
}

export function buildSupportTeamRow(team: SupportTeamDetails): SupportTeamRow {
  return {
    id: team.id,
    name: team.name,
    masterId: team.masterId,
    accountMasterId: team.masterId,
    accountName: team.masterName ?? team.masterEmail,
    isOwnAccount: false,
    isAssociateAccount: false,
    sponsorMasterId: null,
    associateAccountName: null,
    isAccessible: true,
    accountSubscriptionActive: true,
    accountMasterBanned: false,
    accountAccessDecision: { state: "allowed" },
    isDefault: team.isDefault,
    role: "backoffice",
    functions: [],
    canCreateAccountUsers: true,
    canManageAccountTeams: true,
    canTransferAccountLeads: true,
    canViewAllTeams: true,
    accountTeamsCount: team.accountTeamsCount,
    hasTransferRoutes: false,
    membershipCreatedAt: team.createdAt,
    isPending: false,
    pendingPayment: null,
    isSupportAccess: true,
  }
}

type ProfileLookup = { findBySupabaseId(supabaseId: string): Promise<{ id: string } | null> }

export class BackofficeSupportAccessUseCase {
  constructor(
    private readonly repository: IBackofficeSupportRepository,
    private readonly audit: AuditWriter,
    private readonly profiles: ProfileLookup = profileRepository
  ) {}

  async searchAccountsForUser(supabaseId: string, query: string): Promise<Output> {
    const profile = await this.profiles.findBySupabaseId(supabaseId)
    if (!profile) {
      return new Output(false, [], ["Perfil não encontrado"], null)
    }

    return this.searchAccounts(profile.id, query)
  }

  /** O Manager ativo do backoffice é quem pode entrar em qualquer conta. */
  async isSupportManager(profileId: string): Promise<boolean> {
    return (await this.repository.findActiveSupportManager(profileId)) !== null
  }

  async searchAccounts(profileId: string, query: string): Promise<Output> {
    try {
      const manager = await this.repository.findActiveSupportManager(profileId)
      if (!manager) {
        return new Output(false, [], ["Acesso negado"], null)
      }

      const normalized = query.trim()
      if (normalized.length < MIN_SEARCH_LENGTH) {
        return new Output(true, [], [], [])
      }

      const accounts = await this.repository.searchAccounts(normalized, MAX_ACCOUNTS_PER_SEARCH)
      return new Output(true, [], [], accounts)
    } catch (error) {
      console.error("[BackofficeSupportAccessUseCase][searchAccounts]", error)
      return new Output(false, [], ["Erro ao buscar contas"], null)
    }
  }

  /**
   * Estado do suporte para o seletor de times: se a pessoa pode buscar contas
   * e, quando o time ativo é de um cliente, a linha que o representa.
   */
  async resolveTeamState(profileId: string, activeTeamId: string | null): Promise<SupportTeamState> {
    const manager = await this.repository.findActiveSupportManager(profileId)
    if (!manager) {
      return { canSupportSearch: false, supportTeam: null }
    }
    if (!activeTeamId) {
      return { canSupportSearch: true, supportTeam: null }
    }

    const team = await this.repository.findActiveTeam(activeTeamId)
    return { canSupportSearch: true, supportTeam: team ? buildSupportTeamRow(team) : null }
  }

  /** Valida a entrada e registra quem entrou em qual conta. */
  async enterTeam(profileId: string, teamId: string): Promise<SupportTeamDetails | null> {
    const manager = await this.repository.findActiveSupportManager(profileId)
    if (!manager) return null

    const team = await this.repository.findActiveTeam(teamId)
    if (!team) return null

    await this.writeEntryAudit(profileId, manager, team)
    return team
  }

  private async writeEntryAudit(
    profileId: string,
    manager: SupportManagerRef,
    team: SupportTeamDetails
  ): Promise<void> {
    // Falha fechado: sem registro de quem entrou, o acesso não é concedido.
    await this.audit.logAudit({
      entityType: "TEAM",
      entityId: team.id,
      action: "UPDATE",
      actorProfileId: profileId,
      before: null,
      after: { activeTeamId: team.id },
      metadata: buildAuditActorMetadata(
        {
          profileId,
          backofficeUserId: manager.backofficeUserId,
          backofficeEmail: manager.email,
        },
        { operation: "support_account_entered", masterProfileId: team.masterId, teamId: team.id }
      ),
    })
  }
}

export const backofficeSupportAccessUseCase = new BackofficeSupportAccessUseCase(
  backofficeSupportRepository,
  auditLogWriter
)
