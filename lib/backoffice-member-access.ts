import { isE2eTestMode } from "@/lib/e2e/is-e2e-test-mode"
import { createEmailService } from "@/lib/services/EmailService"
import { buildSetPasswordEmailAuthLink } from "@/lib/supabase/email-auth-link"
import { createSupabaseAdmin } from "@/lib/supabase/server"
import { getFullUrl } from "@/lib/utils/app-url"

export type BackofficeMemberAccessMode = "invite" | "reset_password"
export type BackofficeMemberAccessStatus = "pending_first_access" | "active"

export interface BackofficeMemberAccessSnapshot {
  accessStatus: BackofficeMemberAccessStatus
  hasCompletedFirstAccess: boolean
  lastSignInAt: string | null
}

export interface BackofficeMemberAccessIdentity {
  profileId: string
  supabaseId: string | null
  email: string
  fullName: string | null
  role: "manager" | "backoffice" | "operator"
  isMaster?: boolean
  managerName?: string | null
}

type SupabaseAuthUser = {
  id?: string
  email?: string | null
  last_sign_in_at?: string | null
}

function buildSnapshot(user: SupabaseAuthUser | null): BackofficeMemberAccessSnapshot {
  const lastSignInAt = user?.last_sign_in_at ?? null
  return {
    accessStatus: lastSignInAt ? "active" : "pending_first_access",
    hasCompletedFirstAccess: Boolean(lastSignInAt),
    lastSignInAt,
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function findAuthUsersByEmails(emails: string[]): Promise<Map<string, SupabaseAuthUser>> {
  const supabaseAdmin = createSupabaseAdmin()
  if (!supabaseAdmin) {
    throw new Error("Erro ao conectar com o Supabase Admin")
  }

  const remaining = new Set(emails.map(normalizeEmail))
  const found = new Map<string, SupabaseAuthUser>()

  try {
    for (let page = 1; page <= 30 && remaining.size > 0; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      })

      if (error) {
        console.error("[findAuthUsersByEmails] Erro ao listar usuários:", error)
        break
      }

      const users = (data?.users ?? []) as SupabaseAuthUser[]
      if (users.length === 0) {
        break
      }

      for (const user of users) {
        const userEmail = typeof user.email === "string" ? normalizeEmail(user.email) : null
        if (!userEmail || !remaining.has(userEmail)) {
          continue
        }

        found.set(userEmail, user)
        remaining.delete(userEmail)
      }

      if (users.length < 200) {
        break
      }
    }
  } catch (err) {
    console.error("[findAuthUsersByEmails] Supabase Auth indisponível:", err)
  }

  return found
}

export async function resolveBackofficeMemberAccess(
  profiles: BackofficeMemberAccessIdentity[]
): Promise<Map<string, BackofficeMemberAccessSnapshot>> {
  const snapshots = new Map<string, BackofficeMemberAccessSnapshot>()
  if (profiles.length === 0) {
    return snapshots
  }

  const supabaseAdmin = createSupabaseAdmin()
  if (!supabaseAdmin) {
    throw new Error("Erro ao conectar com o Supabase Admin")
  }

  const profilesWithoutSupabaseId: BackofficeMemberAccessIdentity[] = []

  await Promise.all(
    profiles.map(async (profile) => {
      if (!profile.supabaseId) {
        profilesWithoutSupabaseId.push(profile)
        return
      }

      try {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(profile.supabaseId)
        if (error || !data?.user) {
          snapshots.set(profile.profileId, buildSnapshot(null))
          return
        }

        snapshots.set(profile.profileId, buildSnapshot(data.user as SupabaseAuthUser))
      } catch (err) {
        console.error("[resolveBackofficeMemberAccess] Supabase Auth indisponível:", err)
        snapshots.set(profile.profileId, buildSnapshot(null))
      }
    })
  )

  if (profilesWithoutSupabaseId.length > 0) {
    const authUsersByEmail = await findAuthUsersByEmails(
      profilesWithoutSupabaseId.map((profile) => profile.email)
    )

    for (const profile of profilesWithoutSupabaseId) {
      const authUser = authUsersByEmail.get(normalizeEmail(profile.email)) ?? null
      snapshots.set(profile.profileId, buildSnapshot(authUser))
    }
  }

  for (const profile of profiles) {
    if (!snapshots.has(profile.profileId)) {
      snapshots.set(profile.profileId, buildSnapshot(null))
    }
  }

  return snapshots
}

type SupabaseAdminHandle = NonNullable<ReturnType<typeof createSupabaseAdmin>>

/**
 * Mensagem que só chega aqui se o Entregável 1 falhar (chave de idempotência
 * voltar a ser estável por pessoa) — mapeada porque o texto cru do Resend é
 * detalhe técnico que não ajuda quem clicou em "Reenviar convite" a agir.
 */
function mapEmailSendErrorMessage(rawMessage: string): string {
  if (rawMessage.toLowerCase().includes("idempotency key")) {
    return "Reenvio duplicado — aguarde alguns segundos e tente novamente."
  }
  return rawMessage
}

/**
 * `EmailService` nunca lança em falha de envio — devolve `{ success: false, error }`.
 * Bug reenvio de convite (2026-08-27): o resultado era descartado aqui (`await` sem
 * checar `.success`), então um 409 real do Resend virava
 * `Output(true, ["Convite reenviado com sucesso."])` para quem clicou — falha muda,
 * dispatch gravado `failed` no banco, ninguém vê nada na tela.
 */
function assertEmailSendSucceeded(result: { success: boolean; error?: string }): void {
  if (!result.success) {
    throw new Error(mapEmailSendErrorMessage(result.error || "Erro ao enviar e-mail"))
  }
}

async function generateInviteActionLink(
  profile: BackofficeMemberAccessIdentity,
  supabaseAdmin: SupabaseAdminHandle
): Promise<{ actionLink: string; displayName: string }> {
  const displayName = profile.fullName?.trim() || profile.email
  const redirectTo = getFullUrl("/set-password")

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "invite",
    email: profile.email,
    options: {
      redirectTo,
      data: {
        name: displayName,
        invited: true,
        first_access: true,
      },
    },
  })

  if (error || !data?.properties?.action_link) {
    throw new Error(error?.message || "Erro ao gerar link de convite")
  }

  return { actionLink: buildSetPasswordEmailAuthLink(data, "invite"), displayName }
}

function buildE2eInviteActionLink(profileId: string): string {
  const inviteUrl = new URL(getFullUrl("/set-password"))
  inviteUrl.searchParams.set("token_hash", `e2e-invite-${profileId}`)
  inviteUrl.searchParams.set("type", "invite")
  return inviteUrl.toString()
}

export async function sendBackofficeMemberAccessEmail(input: {
  profile: BackofficeMemberAccessIdentity
  mode: BackofficeMemberAccessMode
}): Promise<{
  email: string
  access: BackofficeMemberAccessSnapshot
}> {
  const accessByProfileId = await resolveBackofficeMemberAccess([input.profile])
  const access = accessByProfileId.get(input.profile.profileId) ?? buildSnapshot(null)
  const supabaseAdmin = createSupabaseAdmin()
  if (!supabaseAdmin) {
    throw new Error("Erro ao conectar com o Supabase Admin")
  }

  const emailService = createEmailService()
  const displayName = input.profile.fullName?.trim() || input.profile.email
  const redirectTo = getFullUrl("/set-password")

  if (input.mode === "invite") {
    if (access.accessStatus === "active") {
      throw new Error("Convite disponível apenas para usuários sem primeiro acesso concluído.")
    }

    const { actionLink } = await generateInviteActionLink(input.profile, supabaseAdmin)

    const sendResult = await emailService.sendOperatorInviteEmail({
      operatorName: displayName,
      operatorEmail: input.profile.email,
      operatorRole: input.profile.role === "operator" ? "operator" : "manager",
      managerName: input.profile.managerName || "Equipe Corretor Studio",
      inviteUrl: actionLink,
      profileId: input.profile.profileId,
      sourceType: "member_access",
      sourceId: input.profile.profileId,
    })
    assertEmailSendSucceeded(sendResult)

    return { email: input.profile.email, access }
  }

  if (access.accessStatus !== "active") {
    throw new Error("Reset de senha disponível apenas para usuários que já acessaram a plataforma.")
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: input.profile.email,
    options: { redirectTo },
  })

  if (error || !data?.properties?.action_link) {
    throw new Error(error?.message || "Erro ao gerar link de reset de senha")
  }

  const sendResult = await emailService.sendPasswordResetEmail(
    input.profile.email,
    displayName,
    buildSetPasswordEmailAuthLink(data, "recovery"),
    {
      profileId: input.profile.profileId,
      sourceType: "member_access",
      sourceId: input.profile.profileId,
    }
  )
  assertEmailSendSucceeded(sendResult)

  return { email: input.profile.email, access }
}

/**
 * Entregável 3 (botão "Copiar link do convite"): gera um link de convite NOVO
 * (o mesmo `generateLink` do envio por e-mail — invalida o anterior, ver
 * `IBackofficeMemberAccessRepository`/nota do bug) sem disparar e-mail. Uso
 * previsto: dono cola no WhatsApp quando o e-mail não chega. O link nunca é
 * persistido nem logado por este módulo — cabe ao chamador (rota) manter essa
 * garantia na resposta HTTP.
 */
export async function generateBackofficeInviteAccessLink(
  profile: BackofficeMemberAccessIdentity
): Promise<{ actionLink: string; email: string }> {
  if (isE2eTestMode()) {
    return {
      actionLink: buildE2eInviteActionLink(profile.profileId),
      email: profile.email,
    }
  }

  const accessByProfileId = await resolveBackofficeMemberAccess([profile])
  const access = accessByProfileId.get(profile.profileId) ?? buildSnapshot(null)
  if (access.accessStatus === "active") {
    throw new Error("Link de convite disponível apenas para usuários sem primeiro acesso concluído.")
  }

  const supabaseAdmin = createSupabaseAdmin()
  if (!supabaseAdmin) {
    throw new Error("Erro ao conectar com o Supabase Admin")
  }

  const { actionLink } = await generateInviteActionLink(profile, supabaseAdmin)
  return { actionLink, email: profile.email }
}
