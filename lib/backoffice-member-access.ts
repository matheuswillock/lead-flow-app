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

  for (let page = 1; page <= 30 && remaining.size > 0; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) {
      throw new Error(error.message || "Erro ao listar usuários no Supabase Auth")
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

      const { data, error } = await supabaseAdmin.auth.admin.getUserById(profile.supabaseId)
      if (error || !data?.user) {
        snapshots.set(profile.profileId, buildSnapshot(null))
        return
      }

      snapshots.set(profile.profileId, buildSnapshot(data.user as SupabaseAuthUser))
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

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: input.profile.email,
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

    await emailService.sendOperatorInviteEmail({
      operatorName: displayName,
      operatorEmail: input.profile.email,
      operatorRole: input.profile.role === "operator" ? "operator" : "manager",
      managerName: input.profile.managerName || "Equipe Corretor Studio",
      inviteUrl: buildSetPasswordEmailAuthLink(data, "invite"),
    })

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

  await emailService.sendPasswordResetEmail(
    input.profile.email,
    displayName,
    buildSetPasswordEmailAuthLink(data, "recovery")
  )

  return { email: input.profile.email, access }
}
