import { createSupabaseAdmin as createGuardedSupabaseAdmin } from "@/lib/supabase/server"
import { Output } from "@/lib/output"
import { isGoogleConnectionActive } from "@/lib/google/connection"
import {
  backofficeEmailDomainErrorMessage,
  isValidBackofficeEmail,
  normalizeBackofficeEmail,
} from "@/lib/backoffice/email-domain"
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository"
import type { IMailboxProvisioningService } from "@/app/api/services/mailbox/IMailboxProvisioningService"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { IBackofficeUserRepository } from "../../infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"

export interface CreateBackofficeUserInput {
  email: string
  fullName: string
  temporaryPassword: string
  fullAccess?: boolean
  isSdr?: boolean
  isCloser?: boolean
}

export interface UpdateBackofficeUserInput {
  email?: string
  fullName?: string
  isActive?: boolean
  fullAccess?: boolean
  isSdr?: boolean
  isCloser?: boolean
}

function createSupabaseAdmin() {
  const client = createGuardedSupabaseAdmin()
  if (!client) {
    throw new Error(
      "Supabase admin indisponível: credenciais ausentes ou bloqueado no dev local (ver SUPABASE_LOCAL_ALLOW_REMOTE_ADMIN)"
    )
  }
  return client
}

export class BackofficeUserUseCase {
  constructor(
    private userRepo: IBackofficeUserRepository,
    private profileRepo: IProfileRepository,
    private mailboxService: IMailboxProvisioningService
  ) {}

  async createUser(data: CreateBackofficeUserInput, actorAccess: BackofficeAccess): Promise<Output> {
    try {
      if (!actorAccess.fullAccess) {
        return new Output(false, [], ["Apenas usuários com acesso total podem criar usuários backoffice"], null)
      }

      if (!data.email || !isValidBackofficeEmail(data.email)) {
        return new Output(false, [], [backofficeEmailDomainErrorMessage()], null)
      }
      if (!data.fullName || data.fullName.trim().length < 2) {
        return new Output(false, [], ["Nome completo deve ter pelo menos 2 caracteres"], null)
      }
      if (!data.temporaryPassword || data.temporaryPassword.length < 8) {
        return new Output(false, [], ["Senha temporária deve ter pelo menos 8 caracteres"], null)
      }

      const email = normalizeBackofficeEmail(data.email)

      const supabaseAdmin = createSupabaseAdmin()

      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.temporaryPassword,
        email_confirm: true,
      })

      if (authError || !authData.user) {
        console.error("[BackofficeUserUseCase] Erro Supabase Auth:", authError)
        return new Output(false, [], [authError?.message ?? "Erro ao criar usuário na autenticação"], null)
      }

      const supabaseId = authData.user.id

      // Criar Profile
      let profileId: string
      try {
        const result = await this.profileRepo.createBackofficeProfile(
          supabaseId,
          email,
          data.fullName.trim()
        )
        profileId = result.profileId
      } catch (profileError) {
        // Rollback: remover do Supabase Auth
        await supabaseAdmin.auth.admin.deleteUser(supabaseId).catch((e) =>
          console.error("[BackofficeUserUseCase] Rollback Auth falhou:", e)
        )
        console.error("[BackofficeUserUseCase] Erro ao criar profile:", profileError)
        return new Output(false, [], ["Erro ao criar perfil do usuário"], null)
      }

      // Criar BackofficeUser
      const backofficeUser = await this.userRepo.create({
        id: profileId,
        profileId,
        email,
        fullAccess: data.fullAccess ?? false,
        isSdr: data.isSdr ?? true,
        isCloser: data.isCloser ?? true,
        createdByProfileId: actorAccess.profileId,
      })

      // Provisionar mailbox (fire-and-forget)
      this.mailboxService
        .provision(email, data.fullName.trim())
        .then(async (result) => {
          await this.userRepo.update(backofficeUser.id, {
            mailboxStatus: result.status,
            mailboxAddress: result.address,
            mailboxProvisionedAt: result.provisionedAt,
          })
        })
        .catch((e) => console.error("[BackofficeUserUseCase] Mailbox provision error:", e))

      console.info("[BackofficeUserUseCase] Usuário backoffice criado:", email)
      return new Output(true, ["Usuário backoffice criado com sucesso"], [], backofficeUser)
    } catch (error) {
      console.error("[BackofficeUserUseCase][createUser]", error)
      return new Output(false, [], ["Erro ao criar usuário backoffice"], null)
    }
  }

  async listUsers(): Promise<Output> {
    try {
      const users = await this.userRepo.findMany()
      const mapped = users.map(({ googleConnection, linkedCorretorStudioProfile, ...u }) => ({
        ...u,
        googleCalendarConnected:
          isGoogleConnectionActive(googleConnection) ||
          isGoogleConnectionActive(linkedCorretorStudioProfile?.googleConnection ?? null),
        googleEmail:
          googleConnection?.googleEmail ??
          linkedCorretorStudioProfile?.googleConnection?.googleEmail ??
          null,
      }))
      return new Output(true, [], [], mapped)
    } catch (error) {
      console.error("[BackofficeUserUseCase][listUsers]", error)
      return new Output(false, [], ["Erro ao listar usuários backoffice"], null)
    }
  }

  async updateUser(
    id: string,
    data: UpdateBackofficeUserInput,
    actorAccess: BackofficeAccess
  ): Promise<Output> {
    try {
      if (!actorAccess.fullAccess) {
        return new Output(false, [], ["Apenas usuários com acesso total podem editar usuários backoffice"], null)
      }

      const existing = await this.userRepo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      const profileUpdates: { fullName?: string; email?: string } = {}
      let email: string | undefined

      if (data.fullName !== undefined) {
        const fullName = data.fullName.trim()
        if (fullName.length < 2) {
          return new Output(false, [], ["Nome completo deve ter pelo menos 2 caracteres"], null)
        }

        profileUpdates.fullName = fullName
      }

      if (data.email !== undefined) {
        if (!isValidBackofficeEmail(data.email)) {
          return new Output(false, [], [backofficeEmailDomainErrorMessage()], null)
        }

        const normalizedEmail = normalizeBackofficeEmail(data.email)
        if (normalizedEmail !== existing.email) {
          const emailOwner = await this.userRepo.findByEmail(normalizedEmail)
          if (emailOwner && emailOwner.id !== existing.id) {
            return new Output(false, [], ["E-mail já está em uso por outro usuário backoffice"], null)
          }

          email = normalizedEmail
          profileUpdates.email = normalizedEmail
        }
      }

      if (Object.keys(profileUpdates).length > 0) {
        const profile = await this.profileRepo.updateProfileById(existing.profileId, profileUpdates)
        if (!profile) {
          return new Output(false, [], ["Erro ao atualizar perfil do usuário"], null)
        }
      }

      const hasBackofficeChanges =
        email !== undefined ||
        data.isActive !== undefined ||
        data.fullAccess !== undefined ||
        data.isSdr !== undefined ||
        data.isCloser !== undefined
      const updated = hasBackofficeChanges
        ? await this.userRepo.update(id, {
            email,
            isActive: data.isActive,
            fullAccess: data.fullAccess,
            isSdr: data.isSdr,
            isCloser: data.isCloser,
          })
        : existing

      return new Output(true, ["Usuário atualizado com sucesso"], [], updated)
    } catch (error) {
      console.error("[BackofficeUserUseCase][updateUser]", error)
      return new Output(false, [], ["Erro ao atualizar usuário backoffice"], null)
    }
  }

  async deleteUser(id: string, actorAccess: BackofficeAccess): Promise<Output> {
    try {
      if (!actorAccess.fullAccess) {
        return new Output(false, [], ["Apenas usuários com acesso total podem excluir usuários backoffice"], null)
      }

      const existing = await this.userRepo.findById(id)
      if (!existing) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      if (existing.profileId === actorAccess.profileId) {
        return new Output(false, [], ["Você não pode excluir seu próprio usuário backoffice"], null)
      }

      const profile = await this.profileRepo.findById(existing.profileId)
      if (!profile?.supabaseId) {
        return new Output(false, [], ["Perfil de autenticação do usuário não encontrado"], null)
      }

      const supabaseAdmin = createSupabaseAdmin()
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.supabaseId)
      if (authError) {
        console.error("[BackofficeUserUseCase] Erro ao excluir usuário no Supabase Auth:", authError)
        return new Output(false, [], ["Erro ao excluir usuário na autenticação"], null)
      }

      const deletedProfile = await this.profileRepo.deleteProfile(profile.supabaseId)
      if (!deletedProfile) {
        return new Output(false, [], ["Erro ao excluir perfil do usuário"], null)
      }

      console.info("[BackofficeUserUseCase] Usuário backoffice excluído:", existing.email)
      return new Output(true, ["Usuário backoffice excluído com sucesso"], [], { id })
    } catch (error) {
      console.error("[BackofficeUserUseCase][deleteUser]", error)
      return new Output(false, [], ["Erro ao excluir usuário backoffice"], null)
    }
  }
}
