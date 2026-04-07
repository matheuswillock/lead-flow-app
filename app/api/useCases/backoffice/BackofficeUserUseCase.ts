import { randomUUID } from "crypto"
import { createClient } from "@supabase/supabase-js"
import { Output } from "@/lib/output"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/IBackofficeUserRepository"
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository"
import type { IMailboxProvisioningService } from "@/app/api/services/mailbox/IMailboxProvisioningService"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"

export interface CreateBackofficeUserInput {
  email: string
  fullName: string
  temporaryPassword: string
  fullAccess?: boolean
}

export interface UpdateBackofficeUserInput {
  isActive?: boolean
  fullAccess?: boolean
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("Supabase admin credentials não configuradas")
  return createClient(url, serviceKey)
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

      if (!data.email || !data.email.trim().endsWith("@corretorstudio.com")) {
        return new Output(false, [], ["E-mail deve pertencer ao domínio @corretorstudio.com"], null)
      }
      if (!data.fullName || data.fullName.trim().length < 2) {
        return new Output(false, [], ["Nome completo deve ter pelo menos 2 caracteres"], null)
      }
      if (!data.temporaryPassword || data.temporaryPassword.length < 8) {
        return new Output(false, [], ["Senha temporária deve ter pelo menos 8 caracteres"], null)
      }

      const email = data.email.trim().toLowerCase()

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
      const id = randomUUID()
      const backofficeUser = await this.userRepo.create({
        id: profileId,
        profileId,
        email,
        fullAccess: data.fullAccess ?? false,
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
      return new Output(true, [], [], users)
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

      const updated = await this.userRepo.update(id, data)
      return new Output(true, ["Usuário atualizado com sucesso"], [], updated)
    } catch (error) {
      console.error("[BackofficeUserUseCase][updateUser]", error)
      return new Output(false, [], ["Erro ao atualizar usuário backoffice"], null)
    }
  }
}
