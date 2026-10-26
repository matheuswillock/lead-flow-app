export type DevelopmentSubscriptionPointerTarget = {
  profileId: string
  email: string
  legacySubscriptionId: string
}

export type DevelopmentSubscriptionProfile = {
  id: string
  email: string
  asaasCustomerId: string | null
  asaasCustomerAccount: "primary" | "legacy"
  asaasSubscriptionId: string | null
  asaasSubscriptionAccount: "primary" | "legacy"
  hasPermanentSubscription: boolean
  subscription: {
    asaasSubscriptionId: string | null
    asaasSubscriptionAccount: "primary" | "legacy"
    hasPermanentSubscription: boolean
  } | null
}

export type DevelopmentSubscriptionPointerPlan = {
  target: DevelopmentSubscriptionPointerTarget
  action: "clear" | "already-cleared" | "blocked"
  reason: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function planDevelopmentSubscriptionPointerCleanup(input: {
  targets: readonly DevelopmentSubscriptionPointerTarget[]
  profiles: readonly DevelopmentSubscriptionProfile[]
}): DevelopmentSubscriptionPointerPlan[] {
  const profilesById = new Map(input.profiles.map((profile) => [profile.id, profile]))

  return input.targets.map((target) => {
    const profile = profilesById.get(target.profileId)
    if (!profile) {
      return { target, action: "blocked", reason: "profile local não encontrado" }
    }
    if (normalizeEmail(profile.email) !== normalizeEmail(target.email)) {
      return { target, action: "blocked", reason: "e-mail local não corresponde ao alvo" }
    }
    if (!profile.hasPermanentSubscription || !profile.subscription?.hasPermanentSubscription) {
      return { target, action: "blocked", reason: "assinatura permanente não está confirmada no banco" }
    }
    if (!profile.asaasCustomerId || profile.asaasCustomerAccount !== "primary") {
      return { target, action: "blocked", reason: "customer primary não está confirmado no profile" }
    }
    if (
      profile.asaasSubscriptionId === null &&
      profile.asaasSubscriptionAccount === "primary" &&
      profile.subscription?.asaasSubscriptionId === null &&
      profile.subscription.asaasSubscriptionAccount === "primary"
    ) {
      return {
        target,
        action: "already-cleared",
        reason: "ponteiros locais já estão limpos e o customer primary permanece confirmado",
      }
    }
    if (
      profile.asaasSubscriptionId !== target.legacySubscriptionId ||
      profile.asaasSubscriptionAccount !== "legacy"
    ) {
      return { target, action: "blocked", reason: "ponteiro legado do Profile não corresponde ao alvo" }
    }
    if (
      profile.subscription?.asaasSubscriptionId !== target.legacySubscriptionId ||
      profile.subscription.asaasSubscriptionAccount !== "legacy"
    ) {
      return { target, action: "blocked", reason: "ponteiro legado do ProfileSubscription não corresponde ao alvo" }
    }

    return {
      target,
      action: "clear",
      reason: "customer primary e assinatura permanente confirmados; assinatura legacy não existe remotamente",
    }
  })
}
