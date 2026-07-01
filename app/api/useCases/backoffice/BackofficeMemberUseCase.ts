import { createClient } from "@supabase/supabase-js"
import { Output } from "@/lib/output"
import { AsaasSubscriptionService } from "@/app/api/services/AsaasSubscription/AsaasSubscriptionService"
import { createEmailService } from "@/lib/services/EmailService"
import { BackofficeMemberRepository } from "@/app/api/infra/data/repositories/backoffice/MemberRepository/BackofficeMemberRepository"
import type { IBackofficeMemberRepository } from "@/app/api/infra/data/repositories/backoffice/MemberRepository/IBackofficeMemberRepository"
import { memberProBillingUseCase } from "@/app/api/useCases/billing/MemberProBillingUseCase"

type MemberRole = "manager" | "backoffice" | "operator"

interface UpdateMemberInput {
  fullName?: string | null
  phone?: string | null
  email?: string
  role?: MemberRole
  functions?: string[]
  canCreateAccountUsers?: boolean
  canManageAccountTeams?: boolean
  canTransferAccountLeads?: boolean
  canViewAllTeams?: boolean
  teamId?: string
  accountMasterId?: string
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Supabase admin credentials não configuradas")
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isIdempotentAsaasCancelError(errorMessage: string): boolean {
  const normalized = errorMessage
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
  const patterns = [
    "not found",
    "nao encontrado",
    "nao encontrada",
    "already canceled",
    "already cancelled",
    "already deleted",
    "ja cancelada",
    "ja cancelado",
    "cancelada anteriormente",
    "inexistente",
    "erro na api asaas: 404",
  ]
  return patterns.some((p) => normalized.includes(p))
}

export class BackofficeMemberUseCase {
  constructor(private readonly repository: IBackofficeMemberRepository) {}

  async updateMember(memberId: string, data: UpdateMemberInput): Promise<Output> {
    try {
      const member = await this.repository.findMemberForUpdate(memberId)
      if (!member) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      const payload: UpdateMemberInput = {}

      if (data.fullName !== undefined) {
        if (data.fullName === null) {
          payload.fullName = null
        } else {
          const name = data.fullName.trim()
          if (name.length < 2) {
            return new Output(false, [], ["Nome completo deve ter pelo menos 2 caracteres"], null)
          }
          payload.fullName = name
        }
      }

      if (data.phone !== undefined) {
        payload.phone = data.phone === null ? null : data.phone.trim() || null
      }

      let emailChanged = false
      if (data.email !== undefined) {
        const email = data.email.trim().toLowerCase()
        if (!isValidEmail(email)) {
          return new Output(false, [], ["E-mail inválido"], null)
        }
        if (email !== member.email) {
          emailChanged = true
          payload.email = email
        }
      }

      const hasTeamAccessUpdate =
        data.role !== undefined ||
        data.functions !== undefined ||
        data.canCreateAccountUsers !== undefined ||
        data.canManageAccountTeams !== undefined ||
        data.canTransferAccountLeads !== undefined ||
        data.canViewAllTeams !== undefined

      if (hasTeamAccessUpdate && data.teamId === undefined && data.accountMasterId === undefined) {
        return new Output(false, [], ["teamId é obrigatório para alterar permissões do membro"], null)
      }

      const profilePayloadEmpty = Object.keys(payload).length === 0

      if (profilePayloadEmpty && !hasTeamAccessUpdate) {
        return new Output(true, ["Nenhuma alteração necessária"], [], { id: memberId })
      }

      const updated = await this.repository.updateMemberProfile(memberId, payload)
      if (!updated) {
        return new Output(false, [], ["Não foi possível atualizar o membro"], null)
      }

      if (hasTeamAccessUpdate) {
        const role = data.role
        const accessPayload: {
          role?: string
          functions?: string[]
          canCreateAccountUsers?: boolean
          canManageAccountTeams?: boolean
          canTransferAccountLeads?: boolean
          canViewAllTeams?: boolean
        } = {}

        if (role !== undefined) accessPayload.role = role
        if (data.functions !== undefined) accessPayload.functions = data.functions

        if (role !== undefined || data.canCreateAccountUsers !== undefined) {
          accessPayload.canCreateAccountUsers =
            role === "manager" || (role === undefined && data.canCreateAccountUsers !== undefined)
              ? data.canCreateAccountUsers
              : false
        }

        if (role !== undefined || data.canManageAccountTeams !== undefined) {
          accessPayload.canManageAccountTeams =
            role === "manager" || (role === undefined && data.canManageAccountTeams !== undefined)
              ? data.canManageAccountTeams
              : false
        }

        if (role !== undefined || data.canTransferAccountLeads !== undefined) {
          accessPayload.canTransferAccountLeads =
            role === "manager" || role === "backoffice" || (role === undefined && data.canTransferAccountLeads !== undefined)
              ? data.canTransferAccountLeads
              : false
        }

        if (role !== undefined || data.canViewAllTeams !== undefined) {
          accessPayload.canViewAllTeams =
            role === "manager" || role === "backoffice" || (role === undefined && data.canViewAllTeams !== undefined)
              ? data.canViewAllTeams
              : false
        }

        if (data.accountMasterId) {
          await this.repository.updateAccountMemberAccess(memberId, data.accountMasterId, accessPayload)
        } else {
          await this.repository.updateTeamMemberAccess(memberId, data.teamId!, accessPayload)
        }
      }

      if (emailChanged && member.supabaseId) {
        const rollbackPayload: UpdateMemberInput = {}
        if (payload.fullName !== undefined) rollbackPayload.fullName = member.fullName
        if (payload.phone !== undefined) rollbackPayload.phone = member.phone
        if (payload.email !== undefined) rollbackPayload.email = member.email

        const rollbackLocalProfile = async (authError: unknown): Promise<Output> => {
          const rollbackResult = await this.repository.updateMemberProfile(memberId, rollbackPayload)
          if (!rollbackResult) {
            console.error(
              "[BackofficeMemberUseCase][updateMember] Erro ao atualizar e-mail no Auth e falha no rollback:",
              authError
            )
            return new Output(
              false,
              [],
              ["Não foi possível atualizar o e-mail no Supabase Auth e desfazer as alterações locais"],
              null
            )
          }

          console.error("[BackofficeMemberUseCase][updateMember] Erro ao atualizar e-mail no Auth:", authError)
          return new Output(false, [], ["Não foi possível atualizar o e-mail no Supabase Auth"], null)
        }

        try {
          const supabase = createSupabaseAdmin()
          const { error: authError } = await supabase.auth.admin.updateUserById(member.supabaseId, {
            email: payload.email,
          })

          if (authError) {
            return await rollbackLocalProfile(authError)
          }
        } catch (authError) {
          return await rollbackLocalProfile(authError)
        }

      }

      return new Output(true, ["Membro atualizado com sucesso"], [], { id: updated.id })
    } catch (error) {
      console.error("[BackofficeMemberUseCase][updateMember]", error)
      return new Output(false, [], ["Erro ao atualizar membro"], null)
    }
  }

  async deleteMember(
    memberId: string,
    adminProfileId: string,
    password: string
  ): Promise<Output> {
    try {
      if (!password) {
        return new Output(false, [], ["Senha é obrigatória para confirmar a exclusão"], null)
      }

      const adminEmail = await this.repository.findAdminEmailByProfileId(adminProfileId)
      if (!adminEmail) {
        return new Output(false, [], ["Usuário admin não encontrado"], null)
      }

      const member = await this.repository.findMemberForDeletion(memberId)
      if (!member) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      if (member.isMaster) {
        return new Output(
          false,
          [],
          ["Para excluir o usuário master use o botão Excluir conta no topo da página"],
          null
        )
      }

      const supabase = createSupabaseAdmin()

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password,
      })
      if (signInError) {
        console.error("[BackofficeMemberUseCase][deleteMember] Senha incorreta")
        return new Output(false, [], ["Senha incorreta"], null)
      }

      if (member.subscriptionAsaasId && !member.subscriptionAsaasId.startsWith("backoffice-adhesion-")) {
        try {
          await AsaasSubscriptionService.cancelSubscription(member.subscriptionAsaasId)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          if (!isIdempotentAsaasCancelError(message)) {
            console.error("[BackofficeMemberUseCase][deleteMember] Falha ao cancelar assinatura Asaas:", message)
            return new Output(
              false,
              [],
              ["Não foi possível cancelar a assinatura do membro. Tente novamente em alguns instantes."],
              null
            )
          }
        }
      }

      await this.repository.deleteMemberCascade(memberId)

      if (member.managerId) {
        await memberProBillingUseCase.syncBillingAfterUsageChange(member.managerId, "remove_user")
      }

      if (member.supabaseId) {
        try {
          await supabase.auth.admin.deleteUser(member.supabaseId)
        } catch (authError) {
          console.error("[BackofficeMemberUseCase][deleteMember] Erro ao excluir do Supabase Auth:", authError)
        }
      }

      try {
        const emailService = createEmailService()
        await emailService.sendAccountDeletionFarewellEmail({
          userName: member.fullName ?? member.email,
          userEmail: member.email,
        })
      } catch (emailError) {
        console.error("[BackofficeMemberUseCase][deleteMember] Erro ao enviar e-mail de encerramento:", emailError)
      }

      console.info("[BackofficeMemberUseCase][deleteMember] Conta excluída:", member.email)
      return new Output(true, ["Conta excluída com sucesso"], [], { id: memberId })
    } catch (error) {
      console.error("[BackofficeMemberUseCase][deleteMember]", error)
      return new Output(false, [], ["Erro ao excluir conta do membro"], null)
    }
  }

  async removeFromTeam(memberId: string, teamId: string): Promise<Output> {
    try {
      const member = await this.repository.findMemberForUpdate(memberId)
      if (!member) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      if (member.isMaster) {
        return new Output(false, [], ["Não é permitido remover um usuário master de times"], null)
      }

      const membership = await this.repository.findTeamMembership(teamId, memberId)
      if (!membership) {
        return new Output(false, [], ["Membro não pertence a este time"], null)
      }

      const team = await this.repository.findTeamById(teamId)
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null)
      }

      await this.repository.deleteTeamMembership(teamId, memberId)

      await memberProBillingUseCase.syncBillingAfterUsageChange(team.masterId, "remove_member")

      return new Output(true, ["Membro removido do time"], [], { teamId, memberId })
    } catch (error) {
      console.error("[BackofficeMemberUseCase][removeFromTeam]", error)
      return new Output(false, [], ["Erro ao remover membro do time"], null)
    }
  }

  async addToTeam(memberId: string, teamId: string): Promise<Output> {
    try {
      const member = await this.repository.findMemberForUpdate(memberId)
      if (!member) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      const profileContext = await this.repository.findProfileRoleContext(memberId)
      if (!profileContext) {
        return new Output(false, [], ["Membro não encontrado"], null)
      }

      const team = await this.repository.findTeamById(teamId)
      if (!team) {
        return new Output(false, [], ["Time não encontrado"], null)
      }

      const existingMembership = await this.repository.findTeamMembership(teamId, memberId)
      if (existingMembership) {
        return new Output(false, [], ["Usuário já pertence a este time"], null)
      }

      let role: string
      let functions: string[]
      let canCreateAccountUsers = false
      let canManageAccountTeams = false
      let canTransferAccountLeads = false

      if (profileContext.isMaster && team.masterId === memberId) {
        role = "manager"
        functions = []
      } else {
        const template = await this.repository.findAccountMembershipTemplate(memberId, team.masterId)
        if (template) {
          role = template.role
          functions = template.functions
          canCreateAccountUsers = template.canCreateAccountUsers
          canManageAccountTeams = template.canManageAccountTeams
          canTransferAccountLeads = template.canTransferAccountLeads
        } else if (profileContext.isMaster) {
          role = "operator"
          functions = profileContext.functions
        } else {
          role = profileContext.role === "backoffice" ? "backoffice" : profileContext.role
          functions = profileContext.functions
        }
      }

      const teamMember = await this.repository.createTeamMembership({
        teamId,
        profileId: memberId,
        role,
        functions,
        canCreateAccountUsers: role === "manager" && canCreateAccountUsers,
        canManageAccountTeams: role === "manager" && canManageAccountTeams,
        canTransferAccountLeads:
          (role === "manager" || role === "backoffice") && canTransferAccountLeads,
      })

      console.info("[BackofficeMemberUseCase][addToTeam] Membro adicionado ao time:", teamId, memberId)
      return new Output(true, ["Membro adicionado ao time com sucesso"], [], {
        teamMemberId: teamMember.id,
        teamId,
        memberId,
      })
    } catch (error) {
      console.error("[BackofficeMemberUseCase][addToTeam]", error)
      return new Output(false, [], ["Erro ao adicionar membro ao time"], null)
    }
  }

  async listExternalTeamMemberships(
    memberId: string,
    accountMasterId: string
  ): Promise<Output> {
    try {
      const memberships = await this.repository.findExternalTeamMemberships(
        memberId,
        accountMasterId
      )
      return new Output(true, [], [], { items: memberships })
    } catch (error) {
      console.error("[BackofficeMemberUseCase][listExternalTeamMemberships]", error)
      return new Output(false, [], ["Erro ao listar times externos"], null)
    }
  }
}

export const backofficeMemberUseCase = new BackofficeMemberUseCase(
  new BackofficeMemberRepository()
)
