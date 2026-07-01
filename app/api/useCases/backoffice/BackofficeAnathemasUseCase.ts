import type { BackofficeBanScope } from "@prisma/client"
import { Output } from "@/lib/output"
import { createSupabaseAdmin } from "@/lib/supabase/server"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import {
  backofficeBannedUsersRepository,
} from "@/app/api/infra/data/repositories/backoffice/BannedUsersRepository/BackofficeBannedUsersRepository"
import type {
  BackofficeBannedUserRecord,
  IBackofficeBannedUsersRepository,
} from "@/app/api/infra/data/repositories/backoffice/BannedUsersRepository/IBackofficeBannedUsersRepository"

const PERMANENT_BAN_DURATION = "876000h"

function serializeBan(record: BackofficeBannedUserRecord) {
  return {
    id: record.id,
    profileId: record.profileId,
    supabaseId: record.supabaseId,
    email: record.email,
    fullName: record.fullName,
    reason: record.reason,
    status: record.status,
    scope: record.scope,
    bannedAt: record.bannedAt.toISOString(),
    liftedAt: record.liftedAt?.toISOString() ?? null,
    liftReason: record.liftReason,
    bannedBy: record.bannedBy,
    liftedBy: record.liftedBy,
  }
}

export class BackofficeAnathemasUseCase {
  constructor(private repository: IBackofficeBannedUsersRepository = backofficeBannedUsersRepository) {}

  async list(params: {
    page?: number
    pageSize?: number
    status?: "ACTIVE" | "LIFTED" | "all"
    query?: string
  }): Promise<Output> {
    try {
      const result = await this.repository.list({
        page: Math.max(params.page ?? 1, 1),
        pageSize: Math.max(params.pageSize ?? 20, 5),
        status: params.status ?? "all",
        query: params.query,
      })

      return new Output(
        true,
        [],
        [],
        {
          items: result.items.map(serializeBan),
          pagination: result.pagination,
        }
      )
    } catch (error) {
      console.error("[BackofficeAnathemasUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar anatemas"], null)
    }
  }

  async banUser(
    profileId: string,
    reason: string | null | undefined,
    actorAccess: BackofficeAccess
  ): Promise<Output> {
    try {
      if (!actorAccess.fullAccess) {
        return new Output(false, [], ["Apenas usuários com acesso total podem banir usuários"], null)
      }

      if (profileId === actorAccess.profileId) {
        return new Output(false, [], ["Você não pode banir a si mesmo"], null)
      }

      const profile = await this.repository.findBanTargetProfile(profileId)
      if (!profile) {
        return new Output(false, [], ["Usuário não encontrado"], null)
      }

      if (profile.role === "backoffice" || profile.isActiveBackofficeUser) {
        return new Output(false, [], ["Usuários internos do backoffice não podem ser banidos por esta ação"], null)
      }

      if (!profile.supabaseId) {
        return new Output(false, [], ["Usuário não possui conta de autenticação ativa"], null)
      }

      const existingBan = await this.repository.findActiveByProfileId(profileId)
      if (existingBan) {
        return new Output(false, [], ["Usuário já possui um banimento ativo"], null)
      }

      const scope = await this.repository.resolveBanScope(profileId, profile.isMaster)
      const supabaseAdmin = createSupabaseAdmin()
      if (!supabaseAdmin) {
        return new Output(false, [], ["Credenciais administrativas do Supabase não configuradas"], null)
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(profile.supabaseId, {
        ban_duration: PERMANENT_BAN_DURATION,
      })

      if (authError) {
        console.error("[BackofficeAnathemasUseCase][banUser] Supabase error:", authError)
        return new Output(false, [], ["Erro ao banir usuário no Supabase Auth"], null)
      }

      let record: BackofficeBannedUserRecord
      try {
        record = await this.repository.create({
          profileId: profile.id,
          supabaseId: profile.supabaseId,
          email: profile.email,
          fullName: profile.fullName,
          reason: reason?.trim() || null,
          scope,
          bannedByProfileId: actorAccess.profileId,
        })
      } catch (dbError) {
        await supabaseAdmin.auth.admin
          .updateUserById(profile.supabaseId, { ban_duration: "none" })
          .catch((liftError) => {
            console.error("[BackofficeAnathemasUseCase][banUser] rollback failed:", liftError)
          })
        throw dbError
      }

      const successMessage =
        scope === "ACCOUNT"
          ? "Conta banida com sucesso. Usuários vinculados perderão acesso à plataforma."
          : "Usuário banido com sucesso."

      return new Output(true, [successMessage], [], serializeBan(record))
    } catch (error) {
      console.error("[BackofficeAnathemasUseCase][banUser]", error)
      return new Output(false, [], ["Erro ao banir usuário"], null)
    }
  }

  async liftBan(
    banId: string,
    liftReason: string | null | undefined,
    actorAccess: BackofficeAccess
  ): Promise<Output> {
    try {
      if (!actorAccess.fullAccess) {
        return new Output(false, [], ["Apenas usuários com acesso total podem desbanir usuários"], null)
      }

      const activeBan = await this.repository.findActiveBanById(banId)
      if (!activeBan) {
        return new Output(false, [], ["Banimento ativo não encontrado"], null)
      }

      if (!activeBan.supabaseId) {
        return new Output(false, [], ["Banimento sem vínculo de autenticação"], null)
      }

      const supabaseAdmin = createSupabaseAdmin()
      if (!supabaseAdmin) {
        return new Output(false, [], ["Credenciais administrativas do Supabase não configuradas"], null)
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(activeBan.supabaseId, {
        ban_duration: "none",
      })

      if (authError) {
        console.error("[BackofficeAnathemasUseCase][liftBan] Supabase error:", authError)
        return new Output(false, [], ["Erro ao desbanir usuário no Supabase Auth"], null)
      }

      const record = await this.repository.lift({
        banId,
        liftedByProfileId: actorAccess.profileId,
        liftReason: liftReason?.trim() || null,
      })

      if (!record) {
        return new Output(false, [], ["Banimento ativo não encontrado"], null)
      }

      const successMessage =
        record.scope === "ACCOUNT"
          ? "Conta desbanida com sucesso. O acesso dos usuários vinculados foi restaurado."
          : "Usuário desbanido com sucesso."

      return new Output(true, [successMessage], [], serializeBan(record))
    } catch (error) {
      console.error("[BackofficeAnathemasUseCase][liftBan]", error)
      return new Output(false, [], ["Erro ao desbanir usuário"], null)
    }
  }
}

export const backofficeAnathemasUseCase = new BackofficeAnathemasUseCase()
