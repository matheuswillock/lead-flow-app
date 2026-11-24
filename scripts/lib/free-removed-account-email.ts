/**
 * Libera um e-mail preso por uma conta removida ou por um operador órfão.
 *
 * Causa: a remoção de usuário é soft-delete (`Profile.deletedAt`) e não apaga
 * o usuário do Supabase Auth nem libera o e-mail. `Profile.email` é `@unique`,
 * e a checagem de adesão (`findProfileIdByEmail`) não filtra `deletedAt`, então
 * o e-mail segue bloqueado para uma nova adesão.
 *
 * Limpeza planejada:
 *   - perfil removido com o e-mail: troca o e-mail por um tombstone (mantém as
 *     FKs e o histórico; `Profile` tem relações `onDelete: Restrict`, então a
 *     linha não é apagada);
 *   - com `deactivateOrphanOperators`, operador ativo sem vínculo nenhum
 *     (sem time, sem subordinados, sem adesão, não master) é desativado do
 *     mesmo jeito: deletedAt + tombstone;
 *   - usuário do Auth com o e-mail que não pertence a perfil ativo: apaga.
 * Conta ativa com o e-mail que não se encaixa acima bloqueia a execução toda.
 *
 * Este módulo não acessa banco nem Auth: recebe um snapshot e dependências
 * injetadas. O entrypoint `scripts/free-removed-account-email.ts` conecta o
 * Prisma e o Supabase Admin reais.
 */

import { removedProfileEmailFor } from "@/lib/account/removed-profile-email"

export type EmailCleanupProfile = {
  id: string
  email: string
  role: string
  isMaster: boolean
  supabaseId: string | null
  deletedAt: Date | null
  /** Vínculos que impedem a desativação: time, subordinados, time mestre e adesões. */
  linkedRecords: number
}

export type EmailCleanupAuthUser = {
  id: string
  email: string | null
}

export type EmailCleanupSnapshot = {
  profiles: EmailCleanupProfile[]
  authUsers: EmailCleanupAuthUser[]
}

export type EmailCleanupOptions = {
  deactivateOrphanOperators: boolean
}

export type EmailCleanupAction =
  | {
      kind: "tombstone-profile-email"
      profileId: string
      previousEmail: string
      newEmail: string
    }
  | {
      kind: "deactivate-orphan-profile"
      profileId: string
      previousEmail: string
      newEmail: string
    }
  | {
      kind: "delete-auth-user"
      authUserId: string
      email: string | null
    }

export type EmailCleanupPlan = {
  email: string
  blockers: string[]
  actions: EmailCleanupAction[]
}

export type EmailCleanupDeps = {
  loadSnapshot: (email: string) => Promise<EmailCleanupSnapshot>
  tombstoneProfileEmail: (profileId: string, newEmail: string) => Promise<void>
  deactivateOrphanProfile: (profileId: string, newEmail: string) => Promise<void>
  deleteAuthUser: (authUserId: string) => Promise<void>
  log: (message: string) => void
}

export type EmailCleanupStatus = "nothing-to-do" | "blocked" | "planned" | "applied"

export type EmailCleanupResult = {
  status: EmailCleanupStatus
  plan: EmailCleanupPlan
}

export function normalizeCleanupEmail(email: string): string {
  return email.trim().toLowerCase()
}

export const tombstoneEmailFor = removedProfileEmailFor

export function isOrphanOperator(profile: EmailCleanupProfile): boolean {
  return profile.role === "operator" && !profile.isMaster && profile.linkedRecords === 0
}

function hasEmail(value: string | null, target: string): boolean {
  return value !== null && normalizeCleanupEmail(value) === target
}

export function planEmailCleanup(
  email: string,
  snapshot: EmailCleanupSnapshot,
  options: EmailCleanupOptions = { deactivateOrphanOperators: false }
): EmailCleanupPlan {
  const target = normalizeCleanupEmail(email)
  const blockers: string[] = []
  const actions: EmailCleanupAction[] = []
  const deactivatedIds = new Set<string>()

  const activeProfiles = snapshot.profiles.filter((profile) => profile.deletedAt === null)

  for (const profile of activeProfiles) {
    if (!hasEmail(profile.email, target)) continue
    if (options.deactivateOrphanOperators && isOrphanOperator(profile)) {
      deactivatedIds.add(profile.id)
      actions.push({
        kind: "deactivate-orphan-profile",
        profileId: profile.id,
        previousEmail: profile.email,
        newEmail: tombstoneEmailFor(profile.id),
      })
      continue
    }
    blockers.push(`Conta ativa com este e-mail (perfil ${profile.id}): nada a liberar`)
  }

  for (const profile of snapshot.profiles) {
    if (profile.deletedAt === null || !hasEmail(profile.email, target)) continue
    actions.push({
      kind: "tombstone-profile-email",
      profileId: profile.id,
      previousEmail: profile.email,
      newEmail: tombstoneEmailFor(profile.id),
    })
  }

  for (const authUser of snapshot.authUsers) {
    if (!hasEmail(authUser.email, target)) continue
    const activeOwner = activeProfiles.find(
      (profile) => profile.supabaseId === authUser.id && !deactivatedIds.has(profile.id)
    )
    if (activeOwner) {
      blockers.push(
        `Usuário do Auth ${authUser.id} pertence ao perfil ativo ${activeOwner.id}: não será apagado`
      )
      continue
    }
    actions.push({ kind: "delete-auth-user", authUserId: authUser.id, email: authUser.email })
  }

  return { email: target, blockers, actions }
}

function describeAction(action: EmailCleanupAction): string {
  if (action.kind === "tombstone-profile-email") {
    return `Perfil removido ${action.profileId}: e-mail ${action.previousEmail} -> ${action.newEmail}`
  }
  if (action.kind === "deactivate-orphan-profile") {
    return `Operador órfão ${action.profileId}: desativar e e-mail ${action.previousEmail} -> ${action.newEmail}`
  }
  return `Usuário do Auth ${action.authUserId} (${action.email ?? "sem e-mail"}): apagar`
}

export async function runEmailCleanup(
  input: { email: string; confirm: boolean; deactivateOrphanOperators?: boolean },
  deps: EmailCleanupDeps
): Promise<EmailCleanupResult> {
  const options: EmailCleanupOptions = {
    deactivateOrphanOperators: input.deactivateOrphanOperators === true,
  }
  const snapshot = await deps.loadSnapshot(normalizeCleanupEmail(input.email))
  const plan = planEmailCleanup(input.email, snapshot, options)

  deps.log(`E-mail: ${plan.email}`)
  for (const blocker of plan.blockers) deps.log(`BLOQUEIO: ${blocker}`)
  for (const action of plan.actions) deps.log(`AÇÃO: ${describeAction(action)}`)

  if (plan.blockers.length > 0) return { status: "blocked", plan }
  if (plan.actions.length === 0) {
    deps.log("Nada a liberar: nenhum perfil nem usuário do Auth com este e-mail.")
    return { status: "nothing-to-do", plan }
  }
  if (!input.confirm) {
    deps.log("Dry-run: nada foi gravado. Rode com --confirm para aplicar.")
    return { status: "planned", plan }
  }

  for (const action of plan.actions) {
    if (action.kind === "tombstone-profile-email") {
      await deps.tombstoneProfileEmail(action.profileId, action.newEmail)
    } else if (action.kind === "deactivate-orphan-profile") {
      await deps.deactivateOrphanProfile(action.profileId, action.newEmail)
    } else {
      await deps.deleteAuthUser(action.authUserId)
    }
    deps.log(`OK: ${describeAction(action)}`)
  }

  return { status: "applied", plan }
}
