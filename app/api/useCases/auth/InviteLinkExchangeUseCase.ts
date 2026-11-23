import { verifyInviteLinkToken } from "@/lib/auth/invite-link-token"
import { Output } from "@/lib/output"
import { createSupabaseAdmin } from "@/lib/supabase/server"
import { getFullUrl } from "@/lib/utils/app-url"

export type InviteLinkExchangeFailure = "invalid" | "already_used" | "unavailable"

export interface InviteLinkExchangeDeps {
  /** Usuário do Supabase Auth pelo e-mail, ou null se ainda não existir. Lança se a consulta falhar. */
  findAuthUserByEmail(email: string): Promise<{ last_sign_in_at?: string | null } | null>
  /** Gera o token de convite no momento do clique (cria o usuário se ainda não existir). */
  generateInviteTokenHash(input: { email: string; name: string | null }): Promise<string | null>
}

interface ExchangeOptions {
  nowMs?: number
  secret?: string
}

const FAILURE_MESSAGES: Record<InviteLinkExchangeFailure, string> = {
  invalid: "Este link é inválido. Solicite um novo link de acesso.",
  already_used: "Este link já foi usado ou expirou. Solicite um novo link de acesso.",
  unavailable: "Não foi possível validar o link agora. Tente novamente.",
}

function failure(reason: InviteLinkExchangeFailure): Output {
  return new Output(false, [], [FAILURE_MESSAGES[reason]], { reason })
}

/**
 * Troca o token assinado do e-mail de convite por um token do Supabase, só no clique
 * em "Continuar". O token do Supabase nasce e morre aqui, então reenvios e cópias do
 * link não invalidam o convite já enviado. Quem já fez o primeiro acesso não recebe
 * token novo: o link deixa de funcionar.
 */
export class InviteLinkExchangeUseCase {
  constructor(
    private readonly deps: InviteLinkExchangeDeps,
    private readonly options: ExchangeOptions = {}
  ) {}

  /** Sucesso: `result.tokenHash`. Falha: `result.reason` ("invalid" | "already_used" | "unavailable"). */
  async exchange(inviteToken: string): Promise<Output> {
    const payload = verifyInviteLinkToken(inviteToken, this.options)
    if (!payload) return failure("invalid")

    let authUser: { last_sign_in_at?: string | null } | null
    try {
      authUser = await this.deps.findAuthUserByEmail(payload.email)
    } catch (error) {
      console.error("[InviteLinkExchangeUseCase][exchange] Falha ao consultar Supabase Auth", error)
      return failure("unavailable")
    }
    if (authUser?.last_sign_in_at) return failure("already_used")

    let tokenHash: string | null
    try {
      tokenHash = await this.deps.generateInviteTokenHash({ email: payload.email, name: payload.name })
    } catch (error) {
      console.error("[InviteLinkExchangeUseCase][exchange] Falha ao gerar token de convite", error)
      return failure("unavailable")
    }
    if (!tokenHash) return failure("unavailable")

    return new Output(true, [], [], { tokenHash })
  }
}

/** Implementação com Supabase Admin. Consultas e geração acontecem só no clique, nunca ao carregar a página. */
export function createInviteLinkExchangeUseCase(): InviteLinkExchangeUseCase {
  return new InviteLinkExchangeUseCase({
    findAuthUserByEmail: async (email) => {
      const supabaseAdmin = createSupabaseAdmin()
      if (!supabaseAdmin) throw new Error("Erro ao conectar com o Supabase Admin")

      for (let page = 1; page <= 30; page += 1) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
        if (error) throw error

        const users = data?.users ?? []
        const match = users.find((user) => user.email?.trim().toLowerCase() === email)
        if (match) return { last_sign_in_at: match.last_sign_in_at ?? null }
        if (users.length < 200) return null
      }
      return null
    },
    generateInviteTokenHash: async ({ email, name }) => {
      const supabaseAdmin = createSupabaseAdmin()
      if (!supabaseAdmin) throw new Error("Erro ao conectar com o Supabase Admin")

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: getFullUrl("/set-password"),
          data: { name: name ?? email, invited: true, first_access: true },
        },
      })
      if (error) throw error
      return data?.properties?.hashed_token ?? null
    },
  })
}
